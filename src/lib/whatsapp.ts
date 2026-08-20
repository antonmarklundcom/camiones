/**
 * WhatsApp / phone CTA helpers — Paraguay conversion rule #1.
 *
 * Numbers are stored digits-only with country code (5959...). F6: when neither
 * the seller nor NEXT_PUBLIC_DEFAULT_WHATSAPP yields a USABLE number, these
 * return null and the caller hides the CTA — the old behaviour rendered
 * `wa.me/?text=` (WhatsApp error page) and a literal "Llamanos · +", which is
 * worse than no button. The `.env.example` sentinel is rejected on purpose:
 * a placeholder that "works" sends real buyers to a dead number.
 */

/** Placeholders that must never reach a buyer. */
const SENTINELS = new Set(["595000000000", "000000000000", "5950000000"]);

/**
 * Digits-only number, or null when nothing usable resolves.
 * Length rule: country code + national number is 8–15 digits (E.164).
 */
export function normalizeWaNumber(input?: string | null): string | null {
  const digits = (input ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (SENTINELS.has(digits)) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}

/** Seller number, else the site-wide default, else null. */
export function waNumber(sellerPhone?: string | null): string | null {
  return (
    normalizeWaNumber(sellerPhone) ??
    normalizeWaNumber(process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP)
  );
}

/** wa.me deep link with a URL-encoded prefilled message — null if no number. */
export function waLink(
  phone: string | null | undefined,
  text: string,
): string | null {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export interface ContactChannels {
  /** wa.me link, or null → hide the WhatsApp button. */
  wa: string | null;
  /** tel: link, or null → hide the call button. */
  tel: string | null;
  /** Human-readable number for button copy, or null. */
  phoneText: string | null;
}

/**
 * One resolution for every contact CTA on a page. `displayPhone` is only ever
 * shown next to a working `tel:` link, never on its own.
 */
export function contactChannels(
  sellerPhone: string | null | undefined,
  displayPhone: string | null | undefined,
  text: string,
): ContactChannels {
  const n = waNumber(sellerPhone);
  if (!n) return { wa: null, tel: null, phoneText: null };
  return {
    wa: `https://wa.me/${n}?text=${encodeURIComponent(text)}`,
    tel: `tel:+${n}`,
    phoneText: displayPhone?.trim() || `+${n}`,
  };
}

/** Prefill for a listing detail CTA (PLAN.md exact copy). */
export function waListingText(title: string): string {
  return `Hola, vi el ${title} en camiones.com.py y quiero consultar`;
}

/** Generic prefill for the floating button. */
export const WA_GENERIC_TEXT =
  "Hola, estoy buscando un camión y los encontré en camiones.com.py";
