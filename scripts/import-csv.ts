/**
 * Dealer-inventory CSV importer — rebuilt for Phase 6 Batch 2 (audit F2, F3,
 * F12, F28).
 *
 *   npm run import:csv -- <file.csv> <seller-slug> [flags]
 *
 * Flags:
 *   --dry-run          plan and journal the run, write nothing to `listings`
 *   --publish          create new rows as `published` (REFUSED without an
 *                      identity anchor column — see below)
 *   --create-seller    allow creating the seller (as a DRAFT) when the slug
 *                      does not exist yet
 *   --replace-photos   let the CSV overwrite an admin-curated gallery
 *
 * Identity (F2): give the sheet a `chapa` (or `stock_id` / `patente` /
 * `placa`) column. With it, a truck is matched on `sha1(seller|ext|<anchor>)`
 * and monthly price/km updates always MERGE. Without it the importer falls
 * back to a spec bucket (brand+model+year, km deliberately excluded) and
 * refuses `--publish`, because that bucket can silently fuse two distinct
 * trucks and only a human looking at drafts will catch it.
 *
 * Publish state (F3): `status`/`published_at` are set ONLY when a row is
 * created. On update they move only if the sheet carries an `estado` column,
 * and even then only through the F27 transition rules — the first
 * `published_at` is preserved forever. Merge policy: import wins
 * price/km/spec/availability, admin wins description/photos/category.
 *
 * Safety (F12): one shared plan/commit path (so `--dry-run` exercises exactly
 * the code a real run does), an `import_jobs`/`import_rows` journal with a
 * `previous_json` snapshot per changed row, one transaction per row, and a
 * non-zero exit if ANY row errored.
 *
 * Column contract: `data/ejemplo-inventario.csv`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import {
  brands,
  financingPrograms,
  images,
  listings,
  locations,
  sellers,
} from "../src/db/schema";
import type { ListingStatus } from "../src/lib/admin/constants";
import { parseCsv } from "../src/lib/csv";
import type { FinancingProgram } from "../src/lib/cuota";
import { commitImport, finishJob, journalPlan, startJob } from "../src/lib/import/commit";
import {
  planImport,
  summarizePlan,
  type BrandRef,
  type CityRef,
  type ExistingListing,
} from "../src/lib/import/plan";
import { slugify } from "../src/lib/slug";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

const USAGE =
  "uso: npm run import:csv -- <archivo.csv> <seller-slug> " +
  "[--dry-run] [--publish] [--create-seller] [--replace-photos]";

const KNOWN_FLAGS = new Set([
  "--dry-run",
  "--publish",
  "--create-seller",
  "--replace-photos",
]);

function fail(message: string, code = 1): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(code);
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const unknown = flags.filter((f) => !KNOWN_FLAGS.has(f));
  if (unknown.length) fail(`flag desconocido: ${unknown.join(", ")}\n${USAGE}`);

  const dryRun = flags.includes("--dry-run");
  const publish = flags.includes("--publish");
  const createSeller = flags.includes("--create-seller");
  const replacePhotos = flags.includes("--replace-photos");

  const [file, sellerSlugArg] = args.filter((a) => !a.startsWith("--"));
  if (!file || !sellerSlugArg) fail(USAGE);
  const sellerSlug = slugify(sellerSlugArg);

  const raw = readFileSync(file, "utf8");
  const fileSha1 = createHash("sha1").update(raw).digest("hex");
  const records = parseCsv(raw);
  if (!records.length) fail(`'${file}' no tiene filas de datos.`);

  /* --- seller: must already exist (F12) ---------------------------------- */
  const [seller] = await db
    .select({ id: sellers.id, name: sellers.name, status: sellers.status })
    .from(sellers)
    .where(eq(sellers.slug, sellerSlug))
    .limit(1);

  let sellerId: number;
  if (seller) {
    sellerId = seller.id;
  } else if (!createSeller) {
    // The old importer upserted the CLI argument, so one typo minted a live
    // PUBLISHED seller with a derived name and no phone that quietly absorbed
    // the whole inventory.
    fail(
      `no existe ningún vendedor con slug '${sellerSlug}'.\n` +
        `  Si el slug está bien escrito, creá el vendedor en /admin/sellers ` +
        `(o volvé a correr con --create-seller, que lo crea como BORRADOR).\n` +
        `  Si es un typo, corregilo: un slug equivocado le atribuye todo el ` +
        `inventario a otro vendedor.`,
    );
  } else {
    const name = sellerSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const [res] = await db.insert(sellers).values({
      name,
      slug: sellerSlug,
      type: "dealer",
      // Draft, never published: a seller page goes live when a human says so.
      status: "draft",
      publishedAt: null,
    });
    sellerId = Number(res.insertId);
    console.log(`+ vendedor '${sellerSlug}' creado como BORRADOR (id ${sellerId}).`);
  }

  /* --- lookups ----------------------------------------------------------- */
  const brandRows = await db
    .select({ id: brands.id, slug: brands.slug, name: brands.name })
    .from(brands);
  const brandBySlug = new Map<string, BrandRef>(brandRows.map((b) => [b.slug, b]));

  const cityRows = await db
    .select({ id: locations.id, slug: locations.slug })
    .from(locations)
    .where(eq(locations.level, "ciudad"));
  const cityBySlug = new Map<string, CityRef>(cityRows.map((c) => [c.slug, c]));

  const programRows = await db.select().from(financingPrograms);
  const programs: FinancingProgram[] = programRows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));

  /* --- existing imported rows for this seller ---------------------------- */
  const existingRows = await db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      importKey: listings.importKey,
      externalId: listings.externalId,
      title: listings.title,
      brandId: listings.brandId,
      model: listings.model,
      year: listings.year,
      km: listings.km,
      condition: listings.condition,
      category: listings.category,
      priceUsd: listings.priceUsd,
      priceGs: listings.priceGs,
      cuotaGs: listings.cuotaGs,
      transmission: listings.transmission,
      fuel: listings.fuel,
      traction: listings.traction,
      capacityKg: listings.capacityKg,
      locationId: listings.locationId,
      status: listings.status,
      publishedAt: listings.publishedAt,
    })
    .from(listings)
    .where(and(eq(listings.sellerId, sellerId), isNotNull(listings.importKey)));

  // Photo counts as their own grouped query rather than a correlated subquery:
  // drizzle renders a `sql` template's column references unqualified, so
  // `where listing_id = id` resolved BOTH sides inside `images` and every
  // listing came back with a non-zero count (caught on a live MariaDB run).
  const listingIds = existingRows.map((r) => r.id);
  const imageCounts = new Map<number, number>();
  if (listingIds.length) {
    const counted = await db
      .select({ listingId: images.listingId, n: count() })
      .from(images)
      .where(inArray(images.listingId, listingIds))
      .groupBy(images.listingId);
    for (const c of counted) imageCounts.set(c.listingId, Number(c.n));
  }

  const existing = new Map<string, ExistingListing>();
  for (const r of existingRows) {
    if (!r.importKey) continue;
    existing.set(r.importKey, {
      ...r,
      status: r.status as ListingStatus,
      imageCount: imageCounts.get(r.id) ?? 0,
    });
  }

  /* --- plan (the only place decisions are made) -------------------------- */
  const now = new Date();
  const plan = planImport({
    records,
    sellerSlug,
    sellerId,
    publish,
    replacePhotos,
    brands: brandBySlug,
    cities: cityBySlug,
    existing,
    programs,
    usdToPyg: USD_TO_PYG,
    now,
  });

  const ctx = {
    sellerId,
    sellerSlug,
    file,
    fileSha1,
    mode: (dryRun ? "dry-run" : "commit") as "dry-run" | "commit",
    publishRequested: publish,
  };

  const header =
    `\nimport '${file}' → vendedor '${sellerSlug}'` +
    ` [${dryRun ? "DRY-RUN" : "COMMIT"}]` +
    ` · identidad: ${plan.anchored ? "chapa/stock_id" : "marca+modelo+año (sin ancla)"}`;

  /* --- hard refusals: nothing is written to listings --------------------- */
  if (plan.refusals.length) {
    const notes = plan.refusals.join("\n");
    const jobId = await startJob(plan, ctx, notes);
    await finishJob(jobId, "failed", plan.counts, notes);
    console.log(header);
    for (const r of plan.refusals) console.error(`\n✗ ${r}`);
    console.error(`\n  (job #${jobId} registrado como 'failed'; no se escribió nada)\n`);
    process.exit(2);
  }

  const jobId = await startJob(plan, ctx);

  if (dryRun) {
    await journalPlan(jobId, plan);
    await finishJob(jobId, "committed", plan.counts);
    console.log(`${header}\n${summarizePlan(plan)}`);
    printRows(plan.rows);
    console.log(`\n  nada escrito (--dry-run) · job #${jobId}\n`);
    process.exit(plan.counts.error > 0 ? 1 : 0);
  }

  const result = await commitImport(plan, ctx, jobId);
  await finishJob(jobId, result.counts.error ? "failed" : "committed", result.counts);

  console.log(
    `${header}\n` +
      `  creados:      ${result.counts.create}\n` +
      `  actualizados: ${result.counts.update}\n` +
      `  sin cambios:  ${result.counts.skip}\n` +
      `  con error:    ${result.counts.error}`,
  );
  // Plan-time errors AND write-time failures both land in result.errors, so
  // printRows only reports the rows that did something.
  printRows(plan.rows, false);
  for (const e of result.errors) console.log(`  ✗ fila ${e.rowNo}: ${e.message}`);
  console.log(`\n  job #${jobId} · revertí con import_rows.previous_json si hace falta\n`);

  // F12: a mostly-failed import used to exit 0 as long as one row landed.
  process.exit(result.counts.error > 0 ? 1 : 0);
}

function printRows(
  rows: { rowNo: number; action: string; changed: string[]; error: string | null }[],
  includeErrors = true,
) {
  const interesting = rows.filter(
    (r) => r.action !== "skip" && (includeErrors || r.action !== "error"),
  );
  if (!interesting.length) return;
  console.log("");
  for (const r of interesting) {
    const detail = r.error ?? (r.changed.length ? r.changed.join(", ") : "");
    const mark = r.action === "error" ? "✗" : r.action === "create" ? "+" : "~";
    console.log(`  ${mark} fila ${r.rowNo} ${r.action}${detail ? ` · ${detail}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
