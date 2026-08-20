import { waLink, WA_GENERIC_TEXT } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

/**
 * Floating WhatsApp button — on EVERY page (Paraguay conversion rule).
 * The .wa-float class lets the detail page's sticky CTA bar push it up on
 * mobile so the two never overlap.
 */
export function WhatsAppFloat() {
  // F6 — no site-wide number configured means no button. A floating CTA that
  // opens a WhatsApp error page is worse than no CTA at all.
  const href = waLink(null, WA_GENERIC_TEXT);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="wa-float fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-wa text-white shadow-lg shadow-black/25 transition-transform hover:scale-105"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
