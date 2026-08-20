/**
 * Cuota engine — French amortization. The DEFAULT cuota is CACHED on
 * listings.cuota_gs (recomputed by the cron in src/lib/jobs/money.ts) so cards
 * render "₲ 6,4 M/mes" at zero query cost; the detail-page calculator reuses
 * frenchAmortization() live in the browser.
 *
 * Two rules this file exists to keep honest:
 *
 *  - **F5** — the card and the calculator must agree. `defaultProgram()` +
 *    `defaultTerm()` are the ONE shared default; the cron caches exactly what
 *    the calculator shows on load. Program ordering is deterministic
 *    (cheapest monthly rate, then longest term, then code) — `getActivePrograms`
 *    used to have no ORDER BY, so "whichever row MySQL returned first" decided
 *    what a buyer saw.
 *  - **F26** — a rate means nothing without its convention. Paraguayan quotes
 *    are usually TEA (tasa efectiva anual); a "tasa nominal anual" capitalises
 *    monthly. Same number, different cuota, so the convention is stored per
 *    program and converted here rather than assumed.
 *
 * NOTE: program rates in the DB are still PLACEHOLDERS. `usablePrograms()`
 * filters them out entirely, so nothing with a placeholder rate can render a
 * money figure — that is a hard rule, not a display preference.
 */

/**
 * `tea`   — tasa efectiva anual: monthly = (1+TEA)^(1/12) − 1.
 * `nominal` — tasa nominal anual capitalizable mensualmente: monthly = TNA/12.
 */
export const RATE_CONVENTION_VALUES = ["tea", "nominal"] as const;
export type RateConvention = (typeof RATE_CONVENTION_VALUES)[number];

export const RATE_CONVENTION_LABELS: Record<RateConvention, string> = {
  tea: "TEA (efectiva anual)",
  nominal: "Nominal anual (capitalizable mensual)",
};

/** Marker the seeds put in the NAME of every invented rate. */
export const PLACEHOLDER_MARKER = "(PLACEHOLDER)";

/** One shared default term for the card cache AND the calculator (F5). */
export const DEFAULT_TERM_MONTHS = 48;

export interface FinancingProgram {
  code: string;
  name: string;
  annualRate: number; // e.g. 9.5 (percent)
  maxTermMonths: number;
  maxAmountGs: number | null;
  minDownPct: number; // e.g. 20 (percent)
  active: boolean;
  /** Absent = "nominal", the pre-F26 assumption. New rows always carry it. */
  rateConvention?: RateConvention;
}

export interface CuotaResult {
  programCode: string;
  programName: string;
  monthlyGs: number;
  termMonths: number;
  financedGs: number;
  downPaymentGs: number;
}

/**
 * Annual rate → monthly rate, honouring the convention (F26).
 *
 * A 12% TEA is 0,949%/month; 12% nominal is 1,000%/month. Reading a TEA figure
 * as nominal therefore OVERSTATES every cuota (the audit's F26 note has the
 * direction inverted — the fix is the same either way: store the convention).
 */
export function monthlyRate(
  annualRatePct: number,
  convention: RateConvention = "nominal",
): number {
  const annual = annualRatePct / 100;
  if (annual === 0) return 0;
  return convention === "tea" ? Math.pow(1 + annual, 1 / 12) - 1 : annual / 12;
}

/** French amortization: P·r / (1 − (1+r)^−n), r = monthly rate. */
export function frenchAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  convention: RateConvention = "nominal",
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = monthlyRate(annualRatePct, convention);
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** A rate nobody has verified yet. Its name carries the marker the seeds set. */
export function isPlaceholderProgram(p: FinancingProgram): boolean {
  return p.name.includes(PLACEHOLDER_MARKER);
}

/**
 * The programs we are allowed to quote from: active, published and NOT
 * placeholders. Everything downstream goes through this, so "never ship a
 * visible placeholder money figure" is enforced in one place instead of at
 * each render site.
 */
export function usablePrograms(programs: FinancingProgram[]): FinancingProgram[] {
  return programs.filter((p) => p.active && !isPlaceholderProgram(p));
}

/**
 * Deterministic order: cheapest real monthly rate first, then the longest term,
 * then code as a tiebreaker so the list can never depend on row order.
 */
export function orderPrograms(programs: FinancingProgram[]): FinancingProgram[] {
  return [...programs].sort((a, b) => {
    const ra = monthlyRate(a.annualRate, a.rateConvention);
    const rb = monthlyRate(b.annualRate, b.rateConvention);
    if (ra !== rb) return ra - rb;
    if (a.maxTermMonths !== b.maxTermMonths) return b.maxTermMonths - a.maxTermMonths;
    return a.code.localeCompare(b.code);
  });
}

/** The shared default term for a program (F5). */
export function defaultTerm(p: FinancingProgram): number {
  return Math.min(DEFAULT_TERM_MONTHS, p.maxTermMonths);
}

/**
 * The ONE program the card cache and the calculator both start from: the first
 * usable program, in deterministic order, whose cap actually fits this price.
 */
export function defaultProgram(
  priceGs: number,
  programs: FinancingProgram[],
): FinancingProgram | null {
  for (const p of orderPrograms(usablePrograms(programs))) {
    const financed = priceGs - priceGs * (p.minDownPct / 100);
    if (p.maxAmountGs !== null && financed > p.maxAmountGs) continue;
    return p;
  }
  return null;
}

/**
 * The cuota to cache on the card. Same program and same term the detail-page
 * calculator opens with, so the number a buyer clicks is the number they land
 * on. Null when no verified program fits — the card then shows no cuota at all.
 */
export function defaultCuota(
  priceGs: number,
  programs: FinancingProgram[],
): CuotaResult | null {
  const p = defaultProgram(priceGs, programs);
  if (!p) return null;

  const term = defaultTerm(p);
  const down = priceGs * (p.minDownPct / 100);
  const financed = priceGs - down;
  const monthly = frenchAmortization(financed, p.annualRate, term, p.rateConvention);
  if (monthly <= 0) return null;

  return {
    programCode: p.code,
    programName: p.name,
    monthlyGs: Math.round(monthly),
    termMonths: term,
    financedGs: Math.round(financed),
    downPaymentGs: Math.round(down),
  };
}

/**
 * Lowest monthly payment across the active programs at each program's MAXIMUM
 * term. Kept for comparison/"desde ₲ X" style copy — it is deliberately NOT
 * what gets cached any more, because a 60-month figure on a card next to a
 * 48-month calculator is exactly the mismatch F5 is about. Use defaultCuota().
 */
export function bestCuota(
  priceGs: number,
  programs: FinancingProgram[],
  termMonths?: number,
): CuotaResult | null {
  let best: CuotaResult | null = null;

  for (const p of programs) {
    if (!p.active) continue;
    const down = priceGs * (p.minDownPct / 100);
    const financed = priceGs - down;
    if (p.maxAmountGs !== null && financed > p.maxAmountGs) continue;

    const n = Math.min(termMonths ?? p.maxTermMonths, p.maxTermMonths);
    const monthly = frenchAmortization(financed, p.annualRate, n, p.rateConvention);
    if (monthly <= 0) continue;

    if (!best || monthly < best.monthlyGs) {
      best = {
        programCode: p.code,
        programName: p.name,
        monthlyGs: Math.round(monthly),
        termMonths: n,
        financedGs: Math.round(financed),
        downPaymentGs: Math.round(down),
      };
    }
  }
  return best;
}
