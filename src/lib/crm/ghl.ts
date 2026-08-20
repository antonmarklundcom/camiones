/**
 * GoHighLevel sink — an inbound-webhook URL that accepts any JSON body. Kept
 * because it is what propia uses and what this site was originally wired to;
 * `LEAD_SINK=ghl` selects it.
 */
import type { DeliveryResult, LeadRecord, LeadSink } from "@/lib/crm/types";
import { isPermanentStatus } from "@/lib/crm/types";

const TIMEOUT_MS = 10_000;

export function ghlSink(): LeadSink {
  const url = process.env.GHL_WEBHOOK_URL;

  return {
    name: "ghl",
    configured: Boolean(url),

    async deliver(lead: LeadRecord): Promise<DeliveryResult> {
      if (!url) return { ok: false, permanent: true, detail: "GHL sin configurar" };

      const payload = {
        event: "lead",
        vertical: "camiones",
        name: lead.name,
        phone: lead.phone,
        message: lead.message,
        idempotencyKey: lead.idempotencyKey,
        listing: lead.listingPublicId
          ? {
              publicId: lead.listingPublicId,
              title: lead.listingTitle,
              url: lead.listingUrl,
              priceUsd: lead.priceUsd != null ? Number(lead.priceUsd) : null,
            }
          : undefined,
      };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return { ok: true, status: res.status };
        return {
          ok: false,
          status: res.status,
          permanent: isPermanentStatus(res.status),
          detail: (await res.text().catch(() => "")).slice(0, 300),
        };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
