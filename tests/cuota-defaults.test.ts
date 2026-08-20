/**
 * F5/F26 — the shared card/calculator default, deterministic program ordering,
 * the rate convention, and the hard "no placeholder rate ever renders money"
 * rule.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERM_MONTHS,
  defaultCuota,
  defaultProgram,
  defaultTerm,
  frenchAmortization,
  isPlaceholderProgram,
  monthlyRate,
  orderPrograms,
  usablePrograms,
  type FinancingProgram,
} from "@/lib/cuota";

const program = (over: Partial<FinancingProgram> = {}): FinancingProgram => ({
  code: "verificado",
  name: "Banco verificado",
  annualRate: 12,
  maxTermMonths: 60,
  maxAmountGs: null,
  minDownPct: 20,
  active: true,
  rateConvention: "nominal",
  ...over,
});

describe("rate convention (F26)", () => {
  it("nominal annual divides by 12", () => {
    expect(monthlyRate(12, "nominal")).toBeCloseTo(0.01, 10);
  });

  it("TEA compounds: 12% TEA is 0,9489%/month, not 1%", () => {
    expect(monthlyRate(12, "tea")).toBeCloseTo(0.0094888, 6);
  });

  it("defaults to nominal, the pre-F26 assumption", () => {
    expect(monthlyRate(12)).toBe(monthlyRate(12, "nominal"));
  });

  it("0% is 0 under either convention", () => {
    expect(monthlyRate(0, "tea")).toBe(0);
    expect(monthlyRate(0, "nominal")).toBe(0);
  });

  it("the same number quoted as TEA yields a LOWER cuota than as nominal", () => {
    const asTea = frenchAmortization(100_000_000, 18, 48, "tea");
    const asNominal = frenchAmortization(100_000_000, 18, 48, "nominal");
    expect(asTea).toBeLessThan(asNominal);
  });

  it("flows through defaultCuota", () => {
    const tea = defaultCuota(100_000_000, [program({ rateConvention: "tea" })])!;
    const nom = defaultCuota(100_000_000, [program({ rateConvention: "nominal" })])!;
    expect(tea.monthlyGs).toBeLessThan(nom.monthlyGs);
  });
});

describe("placeholder rates never produce a money figure", () => {
  it("detects the marker the seeds put in the name", () => {
    expect(isPlaceholderProgram(program({ name: "Banco X (PLACEHOLDER)" }))).toBe(true);
    expect(isPlaceholderProgram(program({ name: "Banco X" }))).toBe(false);
  });

  it("usablePrograms drops placeholders AND inactive rows", () => {
    const rows = [
      program({ code: "fake", name: "Fake (PLACEHOLDER)" }),
      program({ code: "off", active: false }),
      program({ code: "real" }),
    ];
    expect(usablePrograms(rows).map((p) => p.code)).toEqual(["real"]);
  });

  it("defaultCuota returns null when every program is a placeholder", () => {
    // This is why every cached cuota is NULL today — the cron clears them.
    expect(
      defaultCuota(100_000_000, [program({ name: "Todo inventado (PLACEHOLDER)" })]),
    ).toBeNull();
  });
});

describe("deterministic ordering (F5)", () => {
  it("orders by real monthly rate, cheapest first", () => {
    const ordered = orderPrograms([
      program({ code: "caro", annualRate: 24 }),
      program({ code: "barato", annualRate: 9 }),
      program({ code: "medio", annualRate: 14 }),
    ]);
    expect(ordered.map((p) => p.code)).toEqual(["barato", "medio", "caro"]);
  });

  it("compares across conventions, not raw percentages", () => {
    // 12,3% TEA (0,9727%/mo) is cheaper than 12% nominal (1,0000%/mo).
    const ordered = orderPrograms([
      program({ code: "nominal12", annualRate: 12, rateConvention: "nominal" }),
      program({ code: "tea123", annualRate: 12.3, rateConvention: "tea" }),
    ]);
    expect(ordered[0].code).toBe("tea123");
  });

  it("breaks ties by longest term, then by code — never by row order", () => {
    const a = orderPrograms([
      program({ code: "zzz", maxTermMonths: 60 }),
      program({ code: "aaa", maxTermMonths: 60 }),
      program({ code: "mmm", maxTermMonths: 36 }),
    ]);
    expect(a.map((p) => p.code)).toEqual(["aaa", "zzz", "mmm"]);

    const reversed = orderPrograms([
      program({ code: "mmm", maxTermMonths: 36 }),
      program({ code: "aaa", maxTermMonths: 60 }),
      program({ code: "zzz", maxTermMonths: 60 }),
    ]);
    expect(reversed.map((p) => p.code)).toEqual(a.map((p) => p.code));
  });

  it("does not mutate the caller's array", () => {
    const rows = [program({ code: "b", annualRate: 20 }), program({ code: "a" })];
    orderPrograms(rows);
    expect(rows.map((p) => p.code)).toEqual(["b", "a"]);
  });
});

describe("the ONE shared default (F5)", () => {
  it("uses 48 months, capped at the program maximum", () => {
    expect(DEFAULT_TERM_MONTHS).toBe(48);
    expect(defaultTerm(program({ maxTermMonths: 60 }))).toBe(48);
    expect(defaultTerm(program({ maxTermMonths: 36 }))).toBe(36);
  });

  it("picks the cheapest usable program whose cap fits this price", () => {
    const chosen = defaultProgram(100_000_000, [
      program({ code: "barato-pero-chico", annualRate: 6, maxAmountGs: 10_000_000 }),
      program({ code: "cabe", annualRate: 15 }),
    ])!;
    expect(chosen.code).toBe("cabe");
  });

  it("the cached cuota equals what the calculator computes on load", () => {
    // The regression this pins: card cached at 60 months, calculator opened at
    // 48 on a different program, so the two numbers disagreed.
    const p = program({ minDownPct: 25, maxTermMonths: 60 });
    const cached = defaultCuota(380_000_000, [p])!;

    const down = 380_000_000 * 0.25;
    const onLoad = Math.round(
      frenchAmortization(380_000_000 - down, p.annualRate, defaultTerm(p), p.rateConvention),
    );
    expect(cached.monthlyGs).toBe(onLoad);
    expect(cached.termMonths).toBe(48);
    expect(cached.programCode).toBe(p.code);
  });

  it("returns null when nothing fits, so the card shows no cuota line", () => {
    expect(defaultCuota(100_000_000, [])).toBeNull();
    expect(defaultCuota(100_000_000, [program({ maxAmountGs: 1 })])).toBeNull();
  });

  it("down payment + financed always equals the price, in whole guaraníes", () => {
    const r = defaultCuota(380_000_000, [program({ minDownPct: 25 })])!;
    expect(r.downPaymentGs + r.financedGs).toBe(380_000_000);
    expect(Number.isInteger(r.monthlyGs)).toBe(true);
  });
});
