/**
 * WhatsApp CTA helpers — Paraguay conversion rule #1.
 *
 * Numbers are stored digits-only with country code (5959...). Every helper
 * returns null when no VALID number resolves, and callers must hide the CTA
 * rather than render a dead link (audit F6): `wa.me/?text=` shows WhatsApp's
 * error page and `tel:+` is a visibly broken button on the main conversion
 * path. The contact form is the fallback.
 *
 * The env fallback is deliberately NOT trusted blindly: the .env.example
 * sentinel 595000000000 would otherwise send real buyers to a dead number,
 * and NEXT_PUBLIC_ values are inlined at build time — unrecoverable without a
 * rebuild (propia lesson 12).
 */

/** Placeholder shipped in .env.example — never a real destination. */
const SENTINEL = "595000000000";

/** Paraguayan mobile numbers are 595 + 9 digits; allow 10–15 for other cases. */
function isPlausible(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15 && digits !== SENTINEL;
}

/** Digits-only number, or null when nothing usable resolves. */
export function waNumber(sellerPhone?: string | null): string | null {
  const raw = sellerPhone || process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP || "";
  const digits = raw.replace(/[^0-9]/g, "");
  return isPlausible(digits) ? digits : null;
}

/** wa.me deep link, or null when there is no number to link to. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = waNumber(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

/** tel: link, or null when there is no number to call. */
export function telLink(phone: string | null | undefined): string | null {
  const digits = waNumber(phone);
  return digits ? `tel:+${digits}` : null;
}

/** Prefill for a listing detail CTA (PLAN.md exact copy). */
export function waListingText(title: string): string {
  return `Hola, vi el ${title} en camiones.com.py y quiero consultar`;
}

/** Generic prefill for the floating button. */
export const WA_GENERIC_TEXT =
  "Hola, estoy buscando un camión y los encontré en camiones.com.py";
