/**
 * Cuota engine — same math as propia (French amortization). The best cuota is
 * CACHED on listings.cuota_gs by scripts/recompute-cuotas.ts so cards render
 * "₲ 6,4 M/mes" at zero query cost; the detail-page calculator reuses
 * frenchAmortization() live in the browser.
 *
 * NOTE: program rates in the DB are PLACEHOLDERS until Phase 4 verifies real
 * bank/financiera terms — every figure shown is marked "indicativo".
 */

export interface FinancingProgram {
  code: string;
  name: string;
  annualRate: number; // e.g. 9.5 (percent)
  maxTermMonths: number;
  maxAmountGs: number | null;
  minDownPct: number; // e.g. 20 (percent)
  active: boolean;
}

export interface CuotaResult {
  programCode: string;
  programName: string;
  monthlyGs: number;
  termMonths: number;
  financedGs: number;
  downPaymentGs: number;
}

/** French amortization: P·r / (1 − (1+r)^−n), r = monthly rate. */
export function frenchAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/**
 * Best cuota for a price in ₲ across the active programs: lowest monthly
 * payment among programs whose cap fits the financed amount after minimum
 * down payment. Null when nothing fits — the card omits the cuota line.
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
    const monthly = frenchAmortization(financed, p.annualRate, n);
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
