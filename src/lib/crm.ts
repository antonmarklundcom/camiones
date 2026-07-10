/**
 * CRM boundary — the ONLY file that knows leads go to GoHighLevel.
 * Leads are NEVER stored in our DB (PLAN.md): the contact form fires this
 * webhook and forgets. With GHL_WEBHOOK_URL unset (local dev) the lead is
 * logged and reported as success so the form never breaks on config.
 */

export interface LeadPayload {
  event: "lead";
  vertical: "camiones";
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

export async function pushLead(
  lead: Omit<LeadPayload, "event" | "vertical">,
): Promise<{ ok: boolean }> {
  const url = process.env.GHL_WEBHOOK_URL;
  const payload: LeadPayload = { event: "lead", vertical: "camiones", ...lead };

  if (!url) {
    console.info("[crm:dev] GHL_WEBHOOK_URL no seteado — lead:", JSON.stringify(payload));
    return { ok: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[crm] GHL respondió ${res.status}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[crm] error enviando lead a GHL:", e);
    return { ok: false };
  }
}
