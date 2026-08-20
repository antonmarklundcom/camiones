/**
 * Money math. These figures are the ones printed on cards ("₲ 6,4 M/mes") and
 * recomputed by cron:cuotas — a silent regression here misquotes every listing.
 */
import { describe, expect, it } from "vitest";
import { bestCuota, frenchAmortization, type FinancingProgram } from "@/lib/cuota";

const program = (over: Partial<FinancingProgram> = {}): FinancingProgram => ({
  code: "test",
  name: "Test (PLACEHOLDER)",
  annualRate: 12,
  maxTermMonths: 60,
  maxAmountGs: null,
  minDownPct: 20,
  active: true,
  ...over,
});

describe("frenchAmortization", () => {
  it("matches the closed-form payment (1% monthly, 12 months)", () => {
    // 1_000_000 · 0.01 / (1 − 1.01^−12) = 88 848,79
    expect(frenchAmortization(1_000_000, 12, 12)).toBeCloseTo(88_848.79, 2);
  });

  it("falls back to straight division at 0%", () => {
    expect(frenchAmortization(1_200_000, 0, 12)).toBe(100_000);
  });

  it("is 0 for non-positive principal or term", () => {
    expect(frenchAmortization(0, 12, 60)).toBe(0);
    expect(frenchAmortization(-1, 12, 60)).toBe(0);
    expect(frenchAmortization(1_000_000, 12, 0)).toBe(0);
  });

  it("lowers the monthly payment as the term grows", () => {
    const short = frenchAmortization(100_000_000, 12, 24);
    const long = frenchAmortization(100_000_000, 12, 60);
    expect(long).toBeLessThan(short);
  });
});

describe("bestCuota", () => {
  it("applies the minimum down payment before financing", () => {
    const r = bestCuota(100_000_000, [program({ minDownPct: 30 })])!;
    expect(r.downPaymentGs).toBe(30_000_000);
    expect(r.financedGs).toBe(70_000_000);
  });

  it("picks the lowest monthly payment among active programs", () => {
    const r = bestCuota(100_000_000, [
      program({ code: "caro", annualRate: 24 }),
      program({ code: "barato", annualRate: 9 }),
    ])!;
    expect(r.programCode).toBe("barato");
  });

  it("ignores inactive programs", () => {
    const r = bestCuota(100_000_000, [
      program({ code: "off", annualRate: 1, active: false }),
      program({ code: "on", annualRate: 20 }),
    ])!;
    expect(r.programCode).toBe("on");
  });

  it("skips programs whose cap is under the financed amount", () => {
    expect(
      bestCuota(100_000_000, [program({ maxAmountGs: 50_000_000 })]),
    ).toBeNull();
  });

  it("caps the requested term at the program maximum", () => {
    const r = bestCuota(100_000_000, [program({ maxTermMonths: 36 })], 72)!;
    expect(r.termMonths).toBe(36);
  });

  it("honours a shorter requested term", () => {
    const r = bestCuota(100_000_000, [program()], 24)!;
    expect(r.termMonths).toBe(24);
  });

  it("returns null when no program fits (card omits the cuota line)", () => {
    expect(bestCuota(100_000_000, [])).toBeNull();
  });
});

/**
 * Cases carried over from the parallel Batch 0 suite: rate monotonicity, the
 * empty-programme list, and the two invariants a card depends on — down
 * payment + financed == price, and whole guaraníes (no fractional currency).
 */
describe("bestCuota — carried-over invariants", () => {
  const priceGs = 380_000_000;

  it("charges more per month at a higher rate", () => {
    expect(frenchAmortization(100_000_000, 18, 48)).toBeGreaterThan(
      frenchAmortization(100_000_000, 9, 48),
    );
  });

  it("returns null when there are no programs at all", () => {
    expect(bestCuota(priceGs, [])).toBeNull();
  });

  it("reports the down payment and financed amount consistently", () => {
    const r = bestCuota(priceGs, [program({ minDownPct: 25 })])!;
    expect(r.downPaymentGs).toBe(priceGs * 0.25);
    expect(r.downPaymentGs + r.financedGs).toBe(priceGs);
  });

  it("returns whole guaraníes — no fractional currency on a card", () => {
    const r = bestCuota(priceGs, [program()])!;
    expect(Number.isInteger(r.monthlyGs)).toBe(true);
    expect(Number.isInteger(r.financedGs)).toBe(true);
  });
});
