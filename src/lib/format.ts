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
