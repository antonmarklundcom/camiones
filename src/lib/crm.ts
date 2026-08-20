/**
 * CRM boundary — the ONLY file that knows leads go to GoHighLevel.
 *
 * Leads are STORED FIRST (src/lib/leads.ts writes the row, F1) and only then
 * handed here. That inverts the original fire-and-forget design: this function
 * is now allowed to fail, because a failure costs a delivery attempt and not
 * the lead. scripts/retry-leads.ts re-runs whatever stays undelivered.
 */

export interface LeadPayload {
  event: "lead";
  vertical: "camiones";
  leadId: number;
  name: string;
  phone: string;
  message: string;
  listing?: {
    publicId: string;
    title: string;
    url: string;
    priceUsd: number;
  };
  sellerSlug?: string;
}

export interface DeliveryResult {
  ok: boolean;
  /** Short reason, stored on leads.last_error for the retry sweep. */
  error?: string;
}

/** A hanging endpoint must not pin the server action. */
const TIMEOUT_MS = 8_000;

export async function deliverLead(payload: LeadPayload): Promise<DeliveryResult> {
  const url = process.env.GHL_WEBHOOK_URL;

  if (!url) {
    // Loud in production: the lead is safe in the DB, but nobody is reading it.
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[crm] GHL_WEBHOOK_URL no configurado — lead ${payload.leadId} guardado SIN entregar.`,
      );
      return { ok: false, error: "GHL_WEBHOOK_URL no configurado" };
    }
    console.info("[crm:dev] sin GHL_WEBHOOK_URL — lead:", JSON.stringify(payload));
    return { ok: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[crm] GHL respondió ${res.status} (lead ${payload.leadId})`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.name === "TimeoutError" ? "timeout" : e.message : "error desconocido";
    console.error(`[crm] error entregando lead ${payload.leadId}:`, error);
    return { ok: false, error: error.slice(0, 200) };
  }
}
