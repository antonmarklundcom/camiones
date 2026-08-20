/**
 * Which sink leads go to, and the store-then-forward pipeline around it (F1).
 *
 * The old `pushLead()` fired a webhook and returned `{ok: true}` when the URL
 * was unset — so production with a missing env var reported success to the
 * buyer and kept nothing. Now: write the row, commit, THEN try to deliver.
 * The buyer's "gracias" is backed by a row in our own database, always.
 *
 * Not `server-only`: the cron sweep reaches this from tsx (see src/lib/fx.ts).
 */
import { and, asc, eq, lt, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { ghlSink } from "@/lib/crm/ghl";
import { venderCrmSink } from "@/lib/crm/vendercrm";
import {
  MAX_ATTEMPTS,
  isDue,
  type LeadRecord,
  type LeadSink,
} from "@/lib/crm/types";

export type { LeadRecord } from "@/lib/crm/types";

/**
 * `LEAD_SINK` picks explicitly; unset auto-detects from whichever credentials
 * exist. A site with no sink configured still STORES every lead — it just
 * says so loudly instead of pretending.
 */
export function resolveSink(): LeadSink | null {
  const choice = (process.env.LEAD_SINK ?? "").trim().toLowerCase();
  if (choice === "vendercrm") return venderCrmSink();
  if (choice === "ghl") return ghlSink();
  if (choice === "none") return null;

  const vc = venderCrmSink();
  if (vc.configured) return vc;
  const ghl = ghlSink();
  if (ghl.configured) return ghl;
  return null;
}

export interface NewLead {
  name: string;
  phone: string;
  message: string;
  listingId?: number | null;
  sellerId?: number | null;
  listingPublicId?: string | null;
  listingTitle?: string | null;
  listingUrl?: string | null;
  priceUsd?: number | null;
  pageUrl?: string | null;
  referrerHost?: string | null;
  idempotencyKey: string;
}

/**
 * Write-ahead: the row lands before any network call, so a CRM outage costs a
 * retry, never the enquiry. Returns the row id, or null when the write itself
 * failed — the ONLY case where the form may tell the buyer it went wrong.
 */
export async function storeLead(input: NewLead): Promise<number | null> {
  try {
    const [res] = await db.insert(leads).values({
      name: input.name,
      phone: input.phone,
      message: input.message,
      listingId: input.listingId ?? undefined,
      sellerId: input.sellerId ?? undefined,
      listingPublicId: input.listingPublicId ?? null,
      listingTitle: input.listingTitle ?? null,
      listingUrl: input.listingUrl ?? null,
      priceUsd: input.priceUsd != null ? input.priceUsd.toFixed(2) : null,
      pageUrl: input.pageUrl ?? null,
      referrerHost: input.referrerHost ?? null,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
    });
    return Number(res.insertId);
  } catch (e) {
    // A duplicate idempotency key is a double-submit: the first row is safe,
    // so this is a success from the buyer's point of view.
    if (isDuplicateKey(e)) {
      const [existing] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return existing.id;
    }
    console.error("[leads] no se pudo guardar el lead", e);
    return null;
  }
}

function isDuplicateKey(e: unknown): boolean {
  const cause = (e as { cause?: unknown })?.cause ?? e;
  return (cause as { code?: string })?.code === "ER_DUP_ENTRY";
}

/** One delivery attempt for one stored lead. Never throws. */
export async function deliverLead(id: number): Promise<boolean> {
  const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!row || row.status === "sent") return true;

  const sink = resolveSink();
  const now = new Date();

  if (!sink) {
    // Loud in production, quiet in dev: an unset sink in prod means every
    // enquiry is piling up unforwarded and somebody needs to know today.
    const msg =
      "Ningún destino de leads configurado (LEAD_SINK / VENDERCRM_* / GHL_WEBHOOK_URL). " +
      "El lead quedó guardado en la tabla `leads` y no se reenvió.";
    if (process.env.NODE_ENV === "production") console.error(`[leads] ${msg}`);
    else console.info(`[leads:dev] ${msg}`);
    await db
      .update(leads)
      .set({ attempts: row.attempts + 1, lastAttemptAt: now, lastError: msg.slice(0, 500) })
      .where(eq(leads.id, id));
    return false;
  }

  const record: LeadRecord = {
    id: row.id,
    name: row.name,
    phone: row.phone,
    message: row.message,
    listingPublicId: row.listingPublicId,
    listingTitle: row.listingTitle,
    listingUrl: row.listingUrl,
    priceUsd: row.priceUsd,
    pageUrl: row.pageUrl,
    referrerHost: row.referrerHost,
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
  };

  const result = await sink.deliver(record);
  const attempts = row.attempts + 1;

  if (result.ok) {
    await db
      .update(leads)
      .set({ status: "sent", sink: sink.name, attempts, lastAttemptAt: now, sentAt: now, lastError: null })
      .where(eq(leads.id, id));
    return true;
  }

  const exhausted = result.permanent || attempts >= MAX_ATTEMPTS;
  const detail = `${result.status ?? "?"} ${result.detail ?? ""}`.trim().slice(0, 500);
  console.error(`[leads] entrega fallida (lead ${id}, intento ${attempts}): ${detail}`);
  await db
    .update(leads)
    .set({
      status: exhausted ? "failed" : "pending",
      sink: sink.name,
      attempts,
      lastAttemptAt: now,
      lastError: detail,
    })
    .where(eq(leads.id, id));
  return false;
}

export interface SweepOutcome {
  attempted: number;
  delivered: number;
  failed: number;
}

/**
 * The cron sweep: every `pending` lead whose backoff has elapsed. Bounded per
 * run so one wedged CRM can't turn a cron tick into a ten-minute request.
 */
export async function sweepPendingLeads(limit = 50): Promise<SweepOutcome> {
  const now = new Date();
  const candidates = await db
    .select({ id: leads.id, attempts: leads.attempts, lastAttemptAt: leads.lastAttemptAt })
    .from(leads)
    .where(
      and(
        eq(leads.status, "pending"),
        lt(leads.attempts, MAX_ATTEMPTS),
        // Cheap pre-filter; isDue() applies the exact backoff below.
        or(isNull(leads.lastAttemptAt), lt(leads.lastAttemptAt, new Date(now.getTime() - 60_000))),
      ),
    )
    .orderBy(asc(leads.lastAttemptAt))
    .limit(limit);

  const due = candidates.filter((c) => isDue(c, now));
  let delivered = 0;
  let failed = 0;
  for (const c of due) {
    if (await deliverLead(c.id)) delivered++;
    else failed++;
  }
  return { attempted: due.length, delivered, failed };
}
