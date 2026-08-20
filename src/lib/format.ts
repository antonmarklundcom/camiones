/**
 * Display formatting — Paraguay conventions (es-PY: '.' thousands, ',' decimal).
 * Trucks are quoted in US$ with the ₲ equivalent alongside (both columns are
 * stored; USD is the filtering unit).
 */
const nfInt = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

export function formatUsd(amount: number | string): string {
  return `US$ ${nfInt.format(Math.round(Number(amount)))}`;
}

export function formatGs(amount: number | string): string {
  return `₲ ${nfInt.format(Math.round(Number(amount)))}`;
}

export function formatKm(km: number | string): string {
  return `${nfInt.format(Math.round(Number(km)))} km`;
}

export function formatInt(n: number | string): string {
  return nfInt.format(Math.round(Number(n)));
}

/**
 * A percentage as es-PY text: 20 → "20", 12.5 → "12,5". Down-payment minimums
 * are not always whole numbers, and a fractional one must survive display —
 * rounding it for the label invites rounding it in the math (see F5).
 */
export function formatPct(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/** Compact cuota, e.g. "₲ 6,4 M/mes". Null-safe for missing cuota. */
export function formatCuota(cuotaGs: string | number | null): string | null {
  if (cuotaGs == null) return null;
  const n = Number(cuotaGs);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const millions = (n / 1_000_000).toFixed(1).replace(".", ",");
    return `₲ ${millions} M/mes`;
  }
  return `${formatGs(n)}/mes`;
}
