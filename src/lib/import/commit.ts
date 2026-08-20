/**
 * The committer half of the import (audit F12). Takes the plan produced by
 * `planImport()` — never re-decides anything — and writes it, one transaction
 * per row, journalling what it did as it goes.
 *
 * Deliberately NOT `import "server-only"`: this module runs under tsx from
 * `scripts/import-csv.ts`, and it is the seam a future admin-side import UI
 * would call (the audit's §6 note about the CLI-only permission gate).
 *
 * Per-row transactions rather than one big one: a 400-row dealer sheet with
 * three bad rows should land 397 trucks, not zero, and the journal says
 * exactly which three to fix. What must never split is a single listing's
 * write + its photos + its journal row — that is what the transaction covers
 * (the old code deleted a listing's images and re-inserted them outside any
 * transaction, so a crash in between left a published truck with no photos).
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images, importJobs, importRows, listings } from "@/db/schema";
import { generatePublicId } from "@/lib/public-id";
import { slugify } from "@/lib/slug";
import type { ImportPlan, PlanAction, PlannedRow } from "@/lib/import/plan";

export interface JobContext {
  sellerId: number | null;
  sellerSlug: string;
  file: string;
  fileSha1: string;
  mode: "dry-run" | "commit";
  publishRequested: boolean;
}

export interface CommitResult {
  jobId: number;
  counts: Record<PlanAction, number>;
  errors: { rowNo: number; message: string }[];
}

/** Opens the journal entry. Dry runs get one too — a plan is worth keeping. */
export async function startJob(
  plan: ImportPlan,
  ctx: JobContext,
  notes?: string,
): Promise<number> {
  const [res] = await db.insert(importJobs).values({
    sellerId: ctx.sellerId ?? undefined,
    sellerSlug: ctx.sellerSlug,
    file: ctx.file.slice(0, 500),
    fileSha1: ctx.fileSha1,
    mode: ctx.mode,
    anchored: plan.anchored,
    publishRequested: ctx.publishRequested,
    rowsTotal: plan.rows.length,
    rowsCreated: plan.counts.create,
    rowsUpdated: plan.counts.update,
    rowsSkipped: plan.counts.skip,
    rowsErrored: plan.counts.error,
    status: "planned",
    notes: notes ?? null,
  });
  return Number(res.insertId);
}

export async function finishJob(
  jobId: number,
  status: "committed" | "failed",
  counts: Record<PlanAction, number>,
  notes?: string,
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      status,
      rowsCreated: counts.create,
      rowsUpdated: counts.update,
      rowsSkipped: counts.skip,
      rowsErrored: counts.error,
      finishedAt: new Date(),
      ...(notes ? { notes } : {}),
    })
    .where(eq(importJobs.id, jobId));
}

/** Writes the planned rows to the journal without touching `listings`. */
export async function journalPlan(jobId: number, plan: ImportPlan): Promise<void> {
  for (const row of plan.rows) await writeJournalRow(db, jobId, row, null);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeJournalRow(
  tx: Tx | typeof db,
  jobId: number,
  row: PlannedRow,
  listingId: number | null,
): Promise<void> {
  await tx.insert(importRows).values({
    jobId,
    rowNo: row.rowNo,
    action: row.action,
    importKey: row.identity?.key ?? null,
    externalId: row.identity?.externalId ?? null,
    listingId: listingId ?? row.listingId ?? undefined,
    changedFields: row.changed.length ? row.changed.join(",").slice(0, 500) : null,
    previousJson: row.previous ? JSON.stringify(row.previous) : null,
    error: row.error ? row.error.slice(0, 500) : null,
  });
}

export async function commitImport(
  plan: ImportPlan,
  ctx: JobContext,
  jobId: number,
): Promise<CommitResult> {
  const counts: Record<PlanAction, number> = { create: 0, update: 0, skip: 0, error: 0 };
  const errors: { rowNo: number; message: string }[] = [];

  for (const row of plan.rows) {
    if (row.action === "error") {
      counts.error++;
      errors.push({ rowNo: row.rowNo, message: row.error ?? "error desconocido" });
      await writeJournalRow(db, jobId, row, null);
      continue;
    }

    try {
      // publicId is generated OUTSIDE the transaction because the uniqueness
      // probe is a read loop; the insert below still fails loudly on the
      // unique index if something slipped in between.
      const publicId =
        row.action === "create" ? await nextPublicId() : null;

      const listingId = await db.transaction(async (tx) => {
        let id = row.listingId;

        if (row.action === "create") {
          const slug = `${slugify(row.title)}-${publicId!.toLowerCase()}`.slice(0, 200);
          const [res] = await tx
            .insert(listings)
            .values({ ...row.values, publicId: publicId!, slug } as never);
          id = Number(res.insertId);
        } else if (row.action === "update") {
          const set: Record<string, unknown> = { ...row.values };
          if (row.statusChange) {
            set.status = row.statusChange.status;
            set.publishedAt = row.statusChange.publishedAt;
          }
          if (Object.keys(set).length) {
            await tx
              .update(listings)
              .set(set as never)
              .where(eq(listings.id, id!));
          }
        }

        if (row.applyPhotos && id) {
          await tx.delete(images).where(eq(images.listingId, id));
          for (const [i, key] of row.photos.entries()) {
            await tx.insert(images).values({
              listingId: id,
              r2Key: key,
              sortOrder: i,
              alt: `${row.title} — foto ${i + 1}`.slice(0, 180),
            });
          }
        }

        await writeJournalRow(tx, jobId, row, id ?? null);
        return id ?? null;
      });

      void listingId;
      counts[row.action]++;
    } catch (e) {
      const message = describeDbError(e);
      counts.error++;
      errors.push({ rowNo: row.rowNo, message });
      // The row's transaction rolled back, so its journal entry went with it —
      // re-record the failure outside the transaction.
      await writeJournalRow(db, jobId, { ...row, action: "error", error: message }, null);
    }
  }

  return { jobId, counts, errors };
}

/**
 * Drizzle wraps a driver error in a message containing the full parameterised
 * query and every bound value — unreadable in a terminal and it echoes the
 * whole listing row. The driver's own `sqlMessage` is the useful part.
 */
function describeDbError(e: unknown): string {
  const cause = (e as { cause?: unknown })?.cause;
  const sqlMessage = (cause as { sqlMessage?: string } | undefined)?.sqlMessage;
  if (sqlMessage) return sqlMessage.slice(0, 300);
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

/** F28: a fresh random public id, never a prefix of the identity hash. */
async function nextPublicId(): Promise<string> {
  return generatePublicId(async (candidate) => {
    const [hit] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.publicId, candidate))
      .limit(1);
    return Boolean(hit);
  }, "I");
}
