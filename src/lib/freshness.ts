/**
 * Listing freshness + price-drop badges (I5, I7). Pure — no DB, no Intl
 * surprises — so `tests/freshness.test.ts` can pin the wording.
 *
 * "¿De cuándo es este aviso?" is the used-truck buyer's first question, and the
 * answer costs nothing: `published_at` is already on every card query.
 */

/** Older than this and we stop advertising the age — it reads as stale stock. */
export const FRESHNESS_MAX_DAYS = 60;

/** A price drop is only news for this long. */
export const PRICE_DROP_MAX_DAYS = 30;

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * "Publicado hoy" / "hace 3 días" / "hace 2 semanas" / "hace 1 mes".
 * Null when there is no date, when the date is in the future (clock skew), or
 * when the listing is older than FRESHNESS_MAX_DAYS.
 */
export function freshnessLabel(
  publishedAt: Date | string | null,
  now: Date = new Date(),
): string | null {
  if (!publishedAt) return null;
  const at = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(at.getTime())) return null;

  const days = daysBetween(at, now);
  if (days < 0) return null;
  if (days > FRESHNESS_MAX_DAYS) return null;

  if (days === 0) return "Publicado hoy";
  if (days === 1) return "Publicado ayer";
  if (days < 7) return `Publicado hace ${days} días`;

  const weeks = Math.floor(days / 7);
  if (days < 28) {
    return weeks === 1 ? "Publicado hace 1 semana" : `Publicado hace ${weeks} semanas`;
  }
  const months = Math.floor(days / 30);
  return months <= 1 ? "Publicado hace 1 mes" : `Publicado hace ${months} meses`;
}

/** "Nuevo" chip for the very freshest stock — a stronger signal than the date. */
export function isNewlyPublished(
  publishedAt: Date | string | null,
  now: Date = new Date(),
): boolean {
  const label = freshnessLabel(publishedAt, now);
  if (!label) return false;
  const at = publishedAt instanceof Date ? publishedAt : new Date(publishedAt!);
  return daysBetween(at, now) <= 3;
}

export interface PriceDrop {
  previousUsd: number;
  currentUsd: number;
  /** Whole percent, always positive. */
  percent: number;
}

/**
 * I5 — "precio bajó", from the columns the importer maintains.
 *
 * Deliberately strict: only a real DROP (not a rise), only within
 * PRICE_DROP_MAX_DAYS, and only when it is at least 1% — rounding noise from a
 * re-import is not news, and a badge that fires on nothing teaches buyers to
 * ignore it.
 */
export function priceDrop(
  input: {
    priceUsd: number | string;
    priceUsdPrev: number | string | null;
    priceChangedAt: Date | string | null;
  },
  now: Date = new Date(),
): PriceDrop | null {
  if (input.priceUsdPrev == null || input.priceChangedAt == null) return null;

  const current = Number(input.priceUsd);
  const previous = Number(input.priceUsdPrev);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= current) return null;

  const at =
    input.priceChangedAt instanceof Date
      ? input.priceChangedAt
      : new Date(input.priceChangedAt);
  if (Number.isNaN(at.getTime())) return null;

  const days = daysBetween(at, now);
  if (days < 0 || days > PRICE_DROP_MAX_DAYS) return null;

  const percent = Math.round(((previous - current) / previous) * 100);
  if (percent < 1) return null;

  return { previousUsd: previous, currentUsd: current, percent };
}
