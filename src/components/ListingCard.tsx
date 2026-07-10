import Link from "next/link";
import Image from "next/image";
import type { ListingCardData } from "@/lib/queries";
import { formatCuota, formatKm, formatUsd } from "@/lib/format";
import { TRANSMISSION_LABELS, conditionLabel } from "@/lib/taxonomy";
import { imageUrl } from "@/lib/r2";
import { listingPath } from "@/lib/urls";

/**
 * Listing card. The ENTIRE card is wrapped in <Link> — this was a real bug in
 * propia (cards that didn't navigate); do not "simplify" the wrapper away.
 */
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData;
  priority?: boolean;
}) {
  const cover = imageUrl(listing.coverKey) ?? "/placeholder-truck-1.webp";
  const cuota = formatCuota(listing.cuotaGs);

  return (
    <Link
      href={listingPath(listing.slug)}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal-100">
        <Image
          src={cover}
          alt={listing.title}
          width={640}
          height={480}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded bg-charcoal-950/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
          {conditionLabel(listing.condition)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-heading text-xl font-bold text-amber-deep">
          {formatUsd(listing.priceUsd)}
        </p>
        <h3 className="line-clamp-2 font-heading text-base font-semibold leading-snug text-ink">
          {listing.title}
        </h3>
        <p className="flex flex-wrap gap-x-1.5 text-sm text-ink-soft">
          <span>{listing.year}</span>
          <span aria-hidden="true">·</span>
          <span>{formatKm(listing.km)}</span>
          <span aria-hidden="true">·</span>
          <span>{TRANSMISSION_LABELS[listing.transmission]}</span>
        </p>
        <p className="mt-auto flex items-center justify-between pt-1 text-sm">
          <span className="text-ink-soft">{listing.cityName}</span>
          {cuota ? (
            <span className="font-semibold text-amber-deep">{cuota}</span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
