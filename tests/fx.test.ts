/**
 * F11 — ₲ is derived from the DB rate. `priceGsFromUsd` is the single place the
 * multiplication happens, so this is where rounding is pinned down.
 *
 * (`getActiveFxRate` / `setActiveFxRate` need a database and are covered by the
 * real-DB checklist in PLAN.md, not here — the suite stays DB-free.)
 */
import { describe, expect, it } from "vitest";
import { priceGsFromUsd } from "@/lib/fx";

describe("priceGsFromUsd", () => {
  it("multiplies and rounds to whole guaraníes", () => {
    expect(priceGsFromUsd(105_000, 7300)).toBe(766_500_000);
    expect(priceGsFromUsd(26_500, 7350)).toBe(194_775_000);
  });

  it("accepts the string MySQL hands back for a decimal column", () => {
    expect(priceGsFromUsd("105000.00", 7300)).toBe(766_500_000);
  });

  it("never emits fractional guaraníes", () => {
    const r = priceGsFromUsd(1234.56, 7312.5);
    expect(Number.isInteger(r)).toBe(true);
  });

  it("moves every price when the rate moves — the drift F11 is about", () => {
    const at7300 = priceGsFromUsd(105_000, 7300);
    const at7800 = priceGsFromUsd(105_000, 7800);
    expect(at7800 - at7300).toBe(105_000 * 500);
  });
});
