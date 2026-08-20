/**
 * Trust + freshness badges (I5, I6, I7). Server-rendered spans — no client JS,
 * no icons beyond a text glyph, because every byte here lands on a prepaid-data
 * Android.
 */
import { freshnessLabel, priceDrop } from "@/lib/freshness";

const BASE =
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight";

/**
 * I6 — backed by `sellers.verified_at`, never by a hardcoded assumption. The
 * home page has claimed "vendedores verificados" since day one with nothing
 * behind it (F18); this is what makes the claim true.
 */
export function VerifiedBadge({
  verifiedAt,
  className = "",
}: {
  verifiedAt: Date | string | null;
  className?: string;
}) {
  if (!verifiedAt) return null;
  return (
    <span
      className={`${BASE} bg-emerald-50 text-emerald-700 ${className}`}
      title="Identidad y contacto verificados por camiones.com.py"
    >
      <span aria-hidden="true">✓</span> Verificado
    </span>
  );
}

/** I7 — "Publicado hace 3 días", from a column every card query already has. */
export function FreshnessBadge({
  publishedAt,
  className = "",
}: {
  publishedAt: Date | string | null;
  className?: string;
}) {
  const label = freshnessLabel(publishedAt);
  if (!label) return null;
  return <span className={`text-xs text-ink-soft ${className}`}>{label}</span>;
}

/** I5 — "Precio bajó 8%", only for a real, recent drop (see freshness.ts). */
export function PriceDropBadge({
  priceUsd,
  priceUsdPrev,
  priceChangedAt,
  className = "",
}: {
  priceUsd: number | string;
  priceUsdPrev: number | string | null;
  priceChangedAt: Date | string | null;
  className?: string;
}) {
  const drop = priceDrop({ priceUsd, priceUsdPrev, priceChangedAt });
  if (!drop) return null;
  return (
    <span
      className={`${BASE} bg-amber-soft text-amber-deep ${className}`}
      title={`Antes US$ ${Math.round(drop.previousUsd).toLocaleString("es-PY")}`}
    >
      <span aria-hidden="true">↓</span> Precio bajó {drop.percent}%
    </span>
  );
}
