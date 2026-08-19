/**
 * CRM boundary — the ONLY file that knows leads go to VenderCRM.
 *
 * Contract: POST {VENDERCRM_URL}/api/v1/leads with an X-Api-Key header.
 * Phone is the contact identity; `idempotency_key` makes a retry safe. Routing
 * (pipeline / stage / owner) lives on the site record inside the CRM, never in
 * this payload — so leads can be re-routed without a deploy.
 *
 * This function NEVER throws and never blocks the visitor: the lead is already
 * persisted in our own `leads` table before we get here (audit F1), so a
 * failure means "retry later", not "lost".
 */
import { createHash } from "node:crypto";

export interface LeadInput {
  name: string;
  phone: string;
  message: string;
  pageUrl?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Anything worth keeping on the CRM timeline (listing id, price, seller). */
  fields?: Record<string, string | number>;
}

export type CrmResult =
  | { ok: true; contactId?: string; dealId?: string; duplicate: boolean }
  | { ok: false; error: string; retryable: boolean };

/**
 * Stable per submission: the same phone within the same hour collapses to one
 * key, so a double-click or a timed-out retry cannot create a second contact,
 * while the same person enquiring tomorrow still gets a fresh lead.
 */
export function idempotencyKey(phone: string, at: Date = new Date()): string {
  const digits = phone.replace(/[^0-9+]/g, "");
  const hour = at.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return createHash("sha256").update(`${digits}|${hour}`).digest("hex").slice(0, 40);
}

/** Optional fields are omitted, never sent as "" — the CRM 422s on empty email. */
export function buildPayload(lead: LeadInput, key: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    phone: lead.phone,
    idempotency_key: key,
    name: lead.name,
    message: lead.message,
    source: "site:camiones",
  };
  const optional: [string, string | undefined][] = [
    ["page_url", lead.pageUrl],
    ["referrer", lead.referrer],
    ["utm_source", lead.utmSource],
    ["utm_medium", lead.utmMedium],
    ["utm_campaign", lead.utmCampaign],
  ];
  for (const [k, v] of optional) if (v) payload[k] = v;
  if (lead.fields && Object.keys(lead.fields).length) payload.fields = lead.fields;
  return payload;
}

const TIMEOUT_MS = 10_000;

export async function pushLead(lead: LeadInput, key: string): Promise<CrmResult> {
  const base = process.env.VENDERCRM_URL?.replace(/\/+$/, "");
  const apiKey = process.env.VENDERCRM_API_KEY;

  if (!base || !apiKey) {
    // Loud in production: a silent drop is exactly the F1 bug we are fixing.
    // The lead is safe in our DB either way, so this is a config alarm.
    const msg = "VENDERCRM_URL / VENDERCRM_API_KEY no configurados";
    if (process.env.NODE_ENV === "production") console.error(`[crm] ${msg}`);
    else console.info(`[crm:dev] ${msg} — lead:`, JSON.stringify(buildPayload(lead, key)));
    return { ok: false, error: msg, retryable: true };
  }

  try {
    const res = await fetch(`${base}/api/v1/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(buildPayload(lead, key)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // 200 = idempotency key replayed; that IS the retry working, not a failure.
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        contactId?: string;
        dealId?: string;
        duplicate?: boolean;
      };
      return {
        ok: true,
        contactId: body.contactId,
        dealId: body.dealId,
        duplicate: body.duplicate ?? res.status === 200,
      };
    }

    const detail = await res.text().catch(() => "");
    console.error(`[crm] VenderCRM respondió ${res.status}: ${detail.slice(0, 300)}`);
    return {
      ok: false,
      error: `HTTP ${res.status}`,
      // 401/403/422 are misconfiguration or bad data — retrying cannot fix them.
      retryable: res.status === 429 || res.status >= 500,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[crm] error enviando lead a VenderCRM:", error);
    return { ok: false, error, retryable: true };
  }
}
