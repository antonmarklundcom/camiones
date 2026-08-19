import { formatUsd } from "@/lib/format";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

/**
 * Mobile-only sticky bottom bar on detail pages: price + call + WhatsApp.
 * The injected style lifts the global floating WhatsApp button above the bar
 * so the two never overlap on small screens.
 */
export function StickyCtaBar({
  priceUsd,
  waHref,
  telHref,
}: {
  priceUsd: string | number;
  waHref: string | null;
  telHref: string | null;
}) {
  if (!waHref && !telHref) return null;

  return (
    <>
      {/* The float lift accounts for the bar's own safe-area padding too, so the
          two never overlap on iOS devices with a gesture bar. */}
      <style>{`@media (max-width: 767px){.wa-float{bottom:calc(6.5rem + env(safe-area-inset-bottom))}}`}</style>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-charcoal-950 px-4 pt-3 md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 font-heading text-lg font-extrabold text-amber-brand">
            {formatUsd(priceUsd)}
          </p>
          {telHref && (
            <a
              href={telHref}
              className="flex h-12 items-center justify-center rounded-lg border border-white/25 px-4 font-heading text-sm font-bold text-white"
            >
              Llamanos
            </a>
          )}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-wa px-4 font-heading text-sm font-bold text-white"
            >
              <WhatsAppIcon className="h-5 w-5" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
      {/* spacer so page content never hides behind the fixed bar */}
      <div className="h-20 md:hidden" aria-hidden="true" />
    </>
  );
}
