/**
 * WhatsApp CTA helpers — Paraguay conversion rule #1.
 * Numbers are stored digits-only with country code (5959...). Sellers without
 * a number fall back to NEXT_PUBLIC_DEFAULT_WHATSAPP (a placeholder until the
 * real business line exists — never invent numbers).
 */

/**
 * F6 — a number nobody answers is worse than no number.
 *
 * `.env.example` shipped `595000000000` as a placeholder, and a seller with no
 * phone plus an unset fallback produced `wa.me/?text=…` (a WhatsApp error
 * page) and a "Llamanos · +" button. So: obviously-fake numbers are treated as
 * ABSENT, and every CTA asks `hasWhatsApp()` before it renders.
 *
 * A number is fake when it is all zeros after the country code, too short to
 * dial, or the exact placeholder we ship.
 */
const PLACEHOLDER_NUMBERS = new Set(["595000000000", "0"]);

export function waNumber(sellerPhone?: string | null): string {
  const raw = sellerPhone || process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP || "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (PLACEHOLDER_NUMBERS.has(digits)) return "";
  // 595 + 9 digits is the shortest real Paraguayan mobile; anything under 8
  // digits total is not a dialable number in any format we accept.
  if (digits.length < 8) return "";
  if (/^595?0+$/.test(digits) || /^0+$/.test(digits)) return "";
  return digits;
}

/** Does this seller (or the site fallback) have a usable WhatsApp number? */
export function hasWhatsApp(sellerPhone?: string | null): boolean {
  return waNumber(sellerPhone).length > 0;
}

/**
 * wa.me deep link, or null when there is no number to send anyone to. Callers
 * MUST handle null by hiding the CTA — never render `wa.me/?text=…`.
 */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const number = waNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** `tel:` href, or null when there is no number. */
export function telLink(phone: string | null | undefined): string | null {
  const number = waNumber(phone);
  return number ? `tel:+${number}` : null;
}

/** Prefill for a listing detail CTA (PLAN.md exact copy). */
export function waListingText(title: string): string {
  return `Hola, vi el ${title} en camiones.com.py y quiero consultar`;
}

/** Generic prefill for the floating button. */
export const WA_GENERIC_TEXT =
  "Hola, estoy buscando un camión y los encontré en camiones.com.py";
