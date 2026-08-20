// NOTE: deliberately NOT marked `server-only` — scripts/retry-leads.ts runs
// this same pipeline under tsx, where that marker fails to resolve. Nothing
// here is client-safe; it is only ever imported from server actions and CLI.
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { deliverLead, type LeadPayload } from "@/lib/crm";
import { absoluteUrl, listingPath } from "@/lib/urls";
import { getListingForLead } from "@/lib/queries";

/**
 * Lead pipeline (F1): write-ahead log → CRM webhook → status.
 *
 * `captureLead` returns ok as long as the ROW was written — that is the
 * promise we make to the buyer ("te contactamos"). A webhook that is unset,
 * slow or broken leaves the row `pending`/`failed` for retryLeads() to sweep;
 * it never turns into a lost lead or a lie on screen.
 */

export interface LeadInput {
  name: string;
  phone: string;
  message: string;
  /** Public id of the listing the buyer is asking about, if any. */
  listingPublicId?: string;
}

export interface CaptureResult {
  ok: boolean;
  leadId?: number;
  delivered?: boolean;
}

/** Max delivery attempts before the sweep stops picking a lead up. */
export const MAX_ATTEMPTS = 6;

function payloadFor(row: {
  id: number;
  name: string;
  phone: string;
  message: string;
  listingPublicId: string | null;
  listingTitle: string | null;
  listingUrl: string | null;
  listingPriceUsd: string | null;
  sellerSlug: string | null;
}): LeadPayload {
  return {
    event: "lead",
    vertical: "camiones",
    leadId: row.id,
    name: row.name,
    phone: row.phone,
    message: row.message,
    listing:
      row.listingPublicId && row.listingTitle && row.listingUrl
        ? {
            publicId: row.listingPublicId,
            title: row.listingTitle,
            url: row.listingUrl,
            priceUsd: Number(row.listingPriceUsd ?? 0),
          }
        : undefined,
    sellerSlug: row.sellerSlug ?? undefined,
  };
}

async function markDelivery(
  id: number,
  result: { ok: boolean; error?: string },
): Promise<void> {
  await db
    .update(leads)
    .set({
      delivery: result.ok ? "sent" : "failed",
      deliveredAt: result.ok ? new Date() : null,
      lastError: result.ok ? null : (result.error ?? "error").slice(0, 250),
      attempts: sql`${leads.attempts} + 1`,
    })
    .where(eq(leads.id, id));
}

export async function captureLead(input: LeadInput): Promise<CaptureResult> {
  // Snapshot the listing from the DB — never from the client (F9).
  const listing = input.listingPublicId
    ? await getListingForLead(input.listingPublicId)
    : null;

  const values = {
    name: input.name,
    phone: input.phone,
    message: input.message,
    listingId: listing?.id ?? null,
    listingPublicId: listing?.publicId ?? null,
    listingTitle: listing?.title ?? null,
    listingUrl: listing ? absoluteUrl(listingPath(listing.slug)) : null,
    listingPriceUsd: listing?.priceUsd ?? null,
    sellerId: listing?.sellerId ?? null,
    sellerSlug: listing?.sellerSlug ?? null,
  };

  let id: number;
  try {
    const [res] = await db.insert(leads).values(values);
    id = Number(res.insertId);
  } catch (e) {
    // The only case the buyer must be told about: we did NOT keep the lead.
    console.error("[leads] no se pudo guardar el lead:", e);
    return { ok: false };
  }

  const result = await deliverLead(payloadFor({ id, ...values }));
  await markDelivery(id, result);
  return { ok: true, leadId: id, delivered: result.ok };
}

/**
 * Re-deliver everything the webhook hasn't taken yet. Runs from
 * `npm run cron:leads` (Batch 3 wires it to the guarded cron route).
 */
export async function retryLeads(limit = 50): Promise<{
  tried: number;
  sent: number;
}> {
  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        inArray(leads.delivery, ["pending", "failed"]),
        lt(leads.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(limit);

  let sent = 0;
  for (const row of rows) {
    const result = await deliverLead(payloadFor(row));
    await markDelivery(row.id, result);
    if (result.ok) sent++;
  }
  return { tried: rows.length, sent };
}
