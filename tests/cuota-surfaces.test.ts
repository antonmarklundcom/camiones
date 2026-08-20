/**
 * F5 regression: the cached card figure and the detail calculator's OPENING
 * figure must be the same number for the same truck.
 *
 * `tests/cuota.test.ts` already covers `defaultCuota()` on its own, and it
 * passed while the two surfaces disagreed on screen — because the mismatch
 * lived in how CuotaCalculator seeded its state (it opened at
 * `Math.ceil(minDownPct)` while the cache used the exact minimum). So these
 * cases reproduce the component's opening arithmetic rather than trusting the
 * helper, which is the only way this class of bug shows up in a unit test.
 */
import { describe, expect, it } from "vitest";
import {
  defaultCuota,
  defaultProgram,
  defaultTerm,
  frenchAmortization,
  type FinancingProgram,
} from "@/lib/cuota";

const program = (over: Partial<FinancingProgram> = {}): FinancingProgram => ({
  code: "banco",
  name: "Banco Real",
  annualRate: 18,
  rateConvention: "tea",
  maxTermMonths: 60,
  maxAmountGs: null,
  minDownPct: 20,
  active: true,
  ...over,
});

/** Exactly what CuotaCalculator computes on first render. */
function calculatorOpeningCuota(priceGs: number, programs: FinancingProgram[]) {
  const p = defaultProgram(priceGs, programs.filter((x) => x.active));
  if (!p) return null;
  const downPct = p.minDownPct; // the component's initial downPct
  const downGs = Math.round(priceGs * (downPct / 100));
  const financedGs = priceGs - downGs;
  const term = Math.min(defaultTerm(p), p.maxTermMonths);
  return Math.round(
    frenchAmortization(financedGs, p.annualRate, term, p.rateConvention),
  );
}

describe("card cache vs calculator opening figure", () => {
  const price = 379_600_000;

  it("agree on a whole-number minimum down payment", () => {
    const programs = [program({ minDownPct: 20 })];
    expect(calculatorOpeningCuota(price, programs)).toBe(
      defaultCuota(price, programs)!.monthlyGs,
    );
  });

  it("agree on a FRACTIONAL minimum — the case that was broken live", () => {
    // 12,5% minimum: the calculator used to open at 13%, quoting ₲ 9.472.484
    // next to a card that said ₲ 9.526.923 for the same truck.
    const programs = [program({ minDownPct: 12.5 })];
    expect(calculatorOpeningCuota(price, programs)).toBe(
      defaultCuota(price, programs)!.monthlyGs,
    );
  });

  it("agree on a minimum below 20%", () => {
    const programs = [program({ minDownPct: 10 })];
    expect(calculatorOpeningCuota(price, programs)).toBe(
      defaultCuota(price, programs)!.monthlyGs,
    );
  });

  it("agree when a cap pushes the default onto a different program", () => {
    const programs = [
      program({ code: "barato", annualRate: 10, maxAmountGs: 1_000_000 }),
      program({ code: "caro", annualRate: 22, minDownPct: 15.5 }),
    ];
    expect(calculatorOpeningCuota(price, programs)).toBe(
      defaultCuota(price, programs)!.monthlyGs,
    );
  });

  it("agree on the term as well as the amount", () => {
    const programs = [program({ maxTermMonths: 36, minDownPct: 12.5 })];
    const cached = defaultCuota(price, programs)!;
    expect(cached.termMonths).toBe(36);
    expect(calculatorOpeningCuota(price, programs)).toBe(cached.monthlyGs);
  });
});
