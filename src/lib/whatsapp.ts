/**
 * WhatsApp CTA helpers — Paraguay conversion rule #1.
 * Numbers are stored digits-only with country code (5959...). Sellers without
 * a number fall back to NEXT_PUBLIC_DEFAULT_WHATSAPP (a placeholder until the
 * real business line exists — never invent numbers).
 */

export function waNumber(sellerPhone?: string | null): string {
  const raw = sellerPhone || process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP || "";
  return raw.replace(/[^0-9]/g, "");
}

/** wa.me deep link with a URL-encoded prefilled message. */
export function waLink(phone: string | null | undefined, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

/** Prefill for a listing detail CTA (PLAN.md exact copy). */
export function waListingText(title: string): string {
  return `Hola, vi el ${title} en camiones.com.py y quiero consultar`;
}

/** Generic prefill for the floating button. */
export const WA_GENERIC_TEXT =
  "Hola, estoy buscando un camión y los encontré en camiones.com.py";
