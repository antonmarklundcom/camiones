/**
 * VenderCRM sink. Contract: POST {base}/api/v1/leads with `X-Api-Key`, phone
 * required, `idempotency_key` required, and NEVER pipeline/stage/owner/tag —
 * routing lives on the site record in the CRM so the customer can re-route
 * without a code change (and a leaked key can't redirect leads elsewhere).
 *
 * 200 means the idempotency key replayed — that is the retry working, so it
 * counts as success, not as a duplicate to worry about.
 */
import type { DeliveryResult, LeadRecord, LeadSink } from "@/lib/crm/types";
import { isPermanentStatus } from "@/lib/crm/types";

const TIMEOUT_MS = 10_000;

export function venderCrmSink(): LeadSink {
  const base = process.env.VENDERCRM_URL?.replace(/\/+$/, "");
  const key = process.env.VENDERCRM_API_KEY;

  return {
    name: "vendercrm",
    configured: Boolean(base && key),

    async deliver(lead: LeadRecord): Promise<DeliveryResult> {
      if (!base || !key) {
        return { ok: false, permanent: true, detail: "VenderCRM sin configurar" };
      }

      // Omit optional fields rather than sending "" — an empty string fails
      // validation on the CRM side.
      const body: Record<string, unknown> = {
        phone: lead.phone,
        idempotency_key: lead.idempotencyKey,
        name: lead.name || undefined,
        message: lead.message || undefined,
        source: "camiones.com.py",
        page_url: lead.pageUrl ?? undefined,
        referrer: lead.referrerHost ?? undefined,
        fields: {
          aviso: lead.listingTitle ?? undefined,
          aviso_id: lead.listingPublicId ?? undefined,
          aviso_url: lead.listingUrl ?? undefined,
          precio_usd: lead.priceUsd ?? undefined,
        },
      };

      try {
        const res = await fetch(`${base}/api/v1/leads`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return { ok: true, status: res.status };

        const detail = (await res.text().catch(() => "")).slice(0, 300);
        return {
          ok: false,
          status: res.status,
          permanent: isPermanentStatus(res.status),
          detail,
        };
      } catch (e) {
        // Network/timeout — always worth retrying.
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
