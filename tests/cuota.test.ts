import { describe, expect, it } from "vitest";
import { bestCuota, frenchAmortization, type FinancingProgram } from "@/lib/cuota";

const program = (over: Partial<FinancingProgram> = {}): FinancingProgram => ({
  code: "p1",
  name: "Programa 1",
  annualRate: 12,
  maxTermMonths: 60,
  maxAmountGs: null,
  minDownPct: 20,
  active: true,
  ...over,
});

describe("frenchAmortization", () => {
  it("matches the textbook figure", () => {
    // 100M ₲ at 12% nominal over 12 months → 1% monthly.
    expect(Math.round(frenchAmortization(100_000_000, 12, 12))).toBe(8_884_879);
  });

  it("splits evenly at a 0% rate", () => {
    expect(frenchAmortization(120_000, 0, 12)).toBe(10_000);
  });

  it("returns 0 for a non-positive principal or term", () => {
    expect(frenchAmortization(0, 12, 60)).toBe(0);
    expect(frenchAmortization(-1, 12, 60)).toBe(0);
    expect(frenchAmortization(100, 12, 0)).toBe(0);
  });

  it("charges less per month over a longer term", () => {
    const short = frenchAmortization(100_000_000, 12, 24);
    const long = frenchAmortization(100_000_000, 12, 60);
    expect(long).toBeLessThan(short);
  });

  it("charges more per month at a higher rate", () => {
    expect(frenchAmortization(100_000_000, 18, 48)).toBeGreaterThan(
      frenchAmortization(100_000_000, 9, 48),
    );
  });
});

describe("bestCuota", () => {
  const priceGs = 380_000_000;

  it("returns null when there are no programs", () => {
    expect(bestCuota(priceGs, [])).toBeNull();
  });

  it("ignores inactive programs", () => {
    expect(bestCuota(priceGs, [program({ active: false })])).toBeNull();
  });

  it("picks the lowest monthly payment", () => {
    const cheap = program({ code: "cheap", annualRate: 8 });
    const dear = program({ code: "dear", annualRate: 22 });
    expect(bestCuota(priceGs, [dear, cheap])?.programCode).toBe("cheap");
  });

  it("skips a program whose cap can't cover the financed amount", () => {
    const capped = program({ code: "capped", annualRate: 5, maxAmountGs: 1_000_000 });
    const open = program({ code: "open", annualRate: 20 });
    expect(bestCuota(priceGs, [capped, open])?.programCode).toBe("open");
  });

  it("reports the down payment and financed amount consistently", () => {
    const r = bestCuota(priceGs, [program({ minDownPct: 25 })])!;
    expect(r.downPaymentGs).toBe(priceGs * 0.25);
    expect(r.downPaymentGs + r.financedGs).toBe(priceGs);
  });

  it("defaults to the program's max term and honours a shorter request", () => {
    expect(bestCuota(priceGs, [program()])!.termMonths).toBe(60);
    expect(bestCuota(priceGs, [program()], 24)!.termMonths).toBe(24);
  });

  it("never exceeds the program's max term", () => {
    expect(bestCuota(priceGs, [program({ maxTermMonths: 36 })], 120)!.termMonths).toBe(36);
  });

  it("returns whole guaraníes — no fractional currency on a card", () => {
    const r = bestCuota(priceGs, [program()])!;
    expect(Number.isInteger(r.monthlyGs)).toBe(true);
    expect(Number.isInteger(r.financedGs)).toBe(true);
  });
});
