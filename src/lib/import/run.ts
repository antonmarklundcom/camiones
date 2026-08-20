/**
 * DB side of the importer: load the context buildPlan() needs, then commit a
 * plan row by row inside its own transaction, journalling everything.
 *
 * Kept out of scripts/import-csv.ts so the CLI is only argument parsing and
 * printing — and so a future /admin "importar CSV" screen can reuse exactly
 * this path instead of growing a second, subtly different one.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  brands,
  financingPrograms,
  images,
  importJobs,
  importRows,
  listings,
  locations,
  sellers,
  type ImportMode,
} from "@/db/schema";
import { type FinancingProgram, type RateConvention } from "@/lib/cuota";
import type { ImportLookups } from "@/lib/import/contract";
import type { ExistingListing } from "@/lib/import/merge";
import type { ImportPlan, PlannedRow } from "@/lib/import/plan";
import { generatePublicId } from "@/lib/public-id";
import { slugify } from "@/lib/slug";

export interface SellerRef {
  id: number;
  slug: string;
  name: string;
  status: string;
}

export async function findSeller(sellerSlug: string): Promise<SellerRef | null> {
  const [row] = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      name: sellers.name,
      status: sellers.status,
    })
    .from(sellers)
    .where(eq(sellers.slug, sellerSlug))
    .limit(1);
  return row ?? null;
}

/**
 * F12 — `--create-seller` is the explicit opt-in. Even then the seller lands as
 * a DRAFT with no phone: a typo'd slug can cost you a stray admin row, never a
 * published dealer page silently absorbing someone else's inventory.
 */
export async function createSellerDraft(sellerSlug: string): Promise<SellerRef> {
  const name = sellerSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  await db.insert(sellers).values({
    name,
    slug: sellerSlug,
    type: "dealer",
    status: "draft",
    publishedAt: null,
  });
  const created = await findSeller(sellerSlug);
  if (!created) throw new Error(`No se pudo crear el vendedor '${sellerSlug}'.`);
  return created;
}

export async function loadLookups(): Promise<ImportLookups> {
  const brandRows = await db
    .select({ id: brands.id, slug: brands.slug, name: brands.name })
    .from(brands);
  const cityRows = await db
    .select({ id: locations.id, slug: locations.slug })
    .from(locations)
    .where(eq(locations.level, "ciudad"));
  return {
    brandBySlug: new Map(brandRows.map((b) => [b.slug, b])),
    cityBySlug: new Map(cityRows.map((c) => [c.slug, c])),
  };
}

export async function loadPrograms(): Promise<FinancingProgram[]> {
  const rows = await db.select().from(financingPrograms);
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
    rateConvention: p.rateConvention as RateConvention,
  }));
}

/** The listings this run might touch, keyed by import key. */
export async function loadExisting(
  importKeys: string[],
): Promise<Map<string, ExistingListing>> {
  if (!importKeys.length) return new Map();
  const rows = await db
    .select()
    .from(listings)
    .where(inArray(listings.importKey, importKeys));
  const map = new Map<string, ExistingListing>();
  for (const r of rows) {
    if (!r.importKey) continue;
    map.set(r.importKey, {
      id: r.id,
      publicId: r.publicId,
      slug: r.slug,
      title: r.title,
      condition: r.condition,
      category: r.category,
      brandId: r.brandId,
      model: r.model,
      year: r.year,
      km: r.km,
      priceUsd: r.priceUsd,
      priceGs: r.priceGs,
      transmission: r.transmission,
      fuel: r.fuel,
      traction: r.traction,
      capacityKg: r.capacityKg,
      description: r.description,
      locationId: r.locationId,
      sellerId: r.sellerId,
      externalId: r.externalId,
      status: r.status,
      publishedAt: r.publishedAt,
      updatedBy: r.updatedBy,
    });
  }
  return map;
}

export interface JobRef {
  id: number;
}

export async function openJob(input: {
  sourceFile: string;
  sellerSlug: string;
  sellerId: number | null;
  mode: ImportMode;
  flags: string;
}): Promise<JobRef> {
  const res = await db.insert(importJobs).values({
    sourceFile: input.sourceFile.slice(0, 300),
    sellerSlug: input.sellerSlug,
    sellerId: input.sellerId,
    mode: input.mode,
    flags: input.flags.slice(0, 300),
    status: "running",
  });
  return { id: Number(res[0].insertId) };
}

export async function closeJob(
  job: JobRef,
  plan: ImportPlan,
  status: "ok" | "partial" | "failed" | "blocked",
  message: string | null,
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      status,
      anchored: plan.anchored,
      rowsTotal: plan.counts.total,
      rowsCreated: plan.counts.create,
      rowsUpdated: plan.counts.update,
      rowsSkipped: plan.counts.skip,
      rowsError: plan.counts.error,
      message,
      finishedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));
}

export interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { rowNo: number; message: string }[];
}

/**
 * Walk the plan. Each row is its own transaction, so a failure mid-gallery can
 * never leave a published listing with zero photos — the row rolls back whole
 * and the run keeps going, then exits non-zero.
 *
 * `dryRun` skips only the listing/image writes. The journal is still written,
 * because "what would this run have done?" is precisely what the journal is
 * for.
 */
export async function commitPlan(
  plan: ImportPlan,
  job: JobRef,
  opts: { dryRun: boolean },
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of plan.rows) {
    if (row.action === "error") {
      result.errors.push({ rowNo: row.rowNo, message: row.message ?? "error" });
      await journal(job, row, null, row.message);
      continue;
    }
    if (row.action === "skip") {
      result.skipped++;
      await journal(job, row, row.listingId, row.message);
      continue;
    }

    try {
      const listingId = opts.dryRun ? row.listingId : await writeRow(row);
      if (row.action === "create") result.created++;
      else result.updated++;
      await journal(job, row, listingId, row.message);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push({ rowNo: row.rowNo, message });
      await journal(job, { ...row, action: "error" }, row.listingId, message);
    }
  }
  return result;
}

async function writeRow(row: PlannedRow): Promise<number> {
  if (row.action === "create") {
    // F28 — publicId is generated independently of the import key and checked
    // against the DB, then the slug is built from it once and never again.
    const publicId = await generatePublicId(
      async (candidate) =>
        (
          await db
            .select({ id: listings.id })
            .from(listings)
            .where(eq(listings.publicId, candidate))
            .limit(1)
        ).length > 0,
      "I",
    );
    const slug = `${slugify(row.title)}-${publicId.toLowerCase()}`.slice(0, 200);

    return db.transaction(async (tx) => {
      const res = await tx
        .insert(listings)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .values({ ...(row.values as any), publicId, slug });
      const id = Number(res[0].insertId);
      await replacePhotos(tx, id, row);
      return id;
    });
  }

  const id = row.listingId;
  if (id == null) throw new Error("fila sin listingId — plan inconsistente");
  return db.transaction(async (tx) => {
    if (Object.keys(row.values).length) {
      await tx
        .update(listings)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(row.values as any)
        .where(eq(listings.id, id));
    }
    await replacePhotos(tx, id, row);
    return id;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replacePhotos(tx: Tx, listingId: number, row: PlannedRow): Promise<void> {
  if (row.photos === null) return; // "no opinion" — never an implicit delete
  await tx.delete(images).where(eq(images.listingId, listingId));
  for (const [i, key] of row.photos.entries()) {
    await tx.insert(images).values({
      listingId,
      r2Key: key,
      sortOrder: i,
      alt: `${row.title} — foto ${i + 1}`.slice(0, 180),
    });
  }
}

async function journal(
  job: JobRef,
  row: PlannedRow,
  listingId: number | null,
  message: string | null,
): Promise<void> {
  await db.insert(importRows).values({
    jobId: job.id,
    rowNo: row.rowNo,
    action: row.action,
    importKey: row.importKey,
    externalId: row.externalId,
    listingId,
    changed: row.changed.length ? row.changed.join(", ").slice(0, 500) : null,
    message,
    previousJson: row.previous ? JSON.stringify(row.previous) : null,
    nextJson: Object.keys(row.values).length ? JSON.stringify(row.values) : null,
  });
}
