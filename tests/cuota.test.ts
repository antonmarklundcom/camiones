import { describe, expect, it } from "vitest";
import {
  bestCuota,
  frenchAmortization,
  type FinancingProgram,
} from "@/lib/cuota";

const program = (over: Partial<FinancingProgram> = {}): FinancingProgram => ({
  code: "A",
  name: "Programa A",
  annualRate: 12,
  maxTermMonths: 48,
  maxAmountGs: null,
  minDownPct: 20,
  active: true,
  ...over,
});

describe("frenchAmortization", () => {
  it("matches the closed-form payment for a known loan", () => {
    // 1.000.000 at 12% nominal (1%/month) over 12 months => 88.848,79
    expect(frenchAmortization(1_000_000, 12, 12)).toBeCloseTo(88_848.79, 2);
  });

  it("splits principal evenly at a zero rate", () => {
    expect(frenchAmortization(1_200_000, 0, 12)).toBe(100_000);
  });

  it("returns 0 for non-positive principal or term", () => {
    expect(frenchAmortization(0, 12, 12)).toBe(0);
    expect(frenchAmortization(-5, 12, 12)).toBe(0);
    expect(frenchAmortization(1_000_000, 12, 0)).toBe(0);
  });

  it("lowers the payment as the term lengthens", () => {
    const short = frenchAmortization(1_000_000, 12, 12);
    const long = frenchAmortization(1_000_000, 12, 48);
    expect(long).toBeLessThan(short);
  });
});

describe("bestCuota", () => {
  it("picks the lowest monthly payment among active programs", () => {
    const result = bestCuota(100_000_000, [
      program({ code: "EXPENSIVE", annualRate: 24 }),
      program({ code: "CHEAP", annualRate: 8 }),
    ]);
    expect(result?.programCode).toBe("CHEAP");
  });

  it("ignores inactive programs", () => {
    const result = bestCuota(100_000_000, [
      program({ code: "CHEAP", annualRate: 4, active: false }),
      program({ code: "ACTIVE", annualRate: 20 }),
    ]);
    expect(result?.programCode).toBe("ACTIVE");
  });

  it("skips programs whose cap is below the financed amount", () => {
    // 20% down on 100M leaves 80M financed, above the 50M cap.
    const result = bestCuota(100_000_000, [
      program({ code: "CAPPED", maxAmountGs: 50_000_000 }),
    ]);
    expect(result).toBeNull();
  });

  it("derives down payment and financed amount from minDownPct", () => {
    const result = bestCuota(100_000_000, [program({ minDownPct: 30 })]);
    expect(result?.downPaymentGs).toBe(30_000_000);
    expect(result?.financedGs).toBe(70_000_000);
  });

  it("clamps a requested term to the program maximum", () => {
    const result = bestCuota(100_000_000, [program({ maxTermMonths: 36 })], 60);
    expect(result?.termMonths).toBe(36);
  });

  it("honours a requested term shorter than the maximum", () => {
    const result = bestCuota(100_000_000, [program({ maxTermMonths: 48 })], 24);
    expect(result?.termMonths).toBe(24);
  });

  it("returns null when there are no programs at all", () => {
    expect(bestCuota(100_000_000, [])).toBeNull();
  });

  it("rounds the monthly figure to whole guaraníes", () => {
    const result = bestCuota(100_000_000, [program()]);
    expect(result?.monthlyGs).toBe(Math.round(result!.monthlyGs));
  });
});
