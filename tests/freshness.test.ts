/**
 * I5/I7 — the badge copy a buyer reads on every card. Pure functions, fixed
 * "now", so the wording is pinned and can't drift with the clock.
 */
import { describe, expect, it } from "vitest";
import {
  PRICE_DROP_MAX_DAYS,
  freshnessLabel,
  isNewlyPublished,
  priceDrop,
} from "@/lib/freshness";

const NOW = new Date("2026-08-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("freshnessLabel (I7)", () => {
  it("counts days, weeks and months in es-PY", () => {
    expect(freshnessLabel(daysAgo(0), NOW)).toBe("Publicado hoy");
    expect(freshnessLabel(daysAgo(1), NOW)).toBe("Publicado ayer");
    expect(freshnessLabel(daysAgo(3), NOW)).toBe("Publicado hace 3 días");
    expect(freshnessLabel(daysAgo(7), NOW)).toBe("Publicado hace 1 semana");
    expect(freshnessLabel(daysAgo(21), NOW)).toBe("Publicado hace 3 semanas");
    expect(freshnessLabel(daysAgo(35), NOW)).toBe("Publicado hace 1 mes");
    expect(freshnessLabel(daysAgo(60), NOW)).toBe("Publicado hace 2 meses");
  });

  it("goes quiet past the freshness window rather than advertising stale stock", () => {
    expect(freshnessLabel(daysAgo(61), NOW)).toBeNull();
    expect(freshnessLabel(daysAgo(400), NOW)).toBeNull();
  });

  it("is null for a missing, unparseable or future date", () => {
    expect(freshnessLabel(null, NOW)).toBeNull();
    expect(freshnessLabel("no es una fecha", NOW)).toBeNull();
    expect(freshnessLabel(new Date(NOW.getTime() + 86_400_000), NOW)).toBeNull();
  });

  it("accepts the string a driver may hand back for a datetime column", () => {
    expect(freshnessLabel("2026-08-19T12:00:00Z", NOW)).toBe("Publicado ayer");
  });

  it("flags only the freshest stock as new", () => {
    expect(isNewlyPublished(daysAgo(3), NOW)).toBe(true);
    expect(isNewlyPublished(daysAgo(4), NOW)).toBe(false);
    expect(isNewlyPublished(null, NOW)).toBe(false);
  });
});

describe("priceDrop (I5)", () => {
  const drop = (over: Record<string, unknown> = {}) =>
    priceDrop(
      {
        priceUsd: 99_000,
        priceUsdPrev: 105_000,
        priceChangedAt: daysAgo(2),
        ...over,
      } as Parameters<typeof priceDrop>[0],
      NOW,
    );

  it("reports a real drop as a whole percent", () => {
    expect(drop()).toEqual({ previousUsd: 105_000, currentUsd: 99_000, percent: 6 });
  });

  it("accepts the decimal strings MySQL returns", () => {
    expect(drop({ priceUsd: "99000.00", priceUsdPrev: "105000.00" })?.percent).toBe(6);
  });

  it("never fires on a price RISE", () => {
    expect(drop({ priceUsd: 110_000 })).toBeNull();
  });

  it("never fires on an unchanged price", () => {
    expect(drop({ priceUsd: 105_000 })).toBeNull();
  });

  it("ignores rounding noise under 1%", () => {
    expect(drop({ priceUsd: 104_500 })).toBeNull();
  });

  it("expires — a drop is only news for a while", () => {
    expect(drop({ priceChangedAt: daysAgo(PRICE_DROP_MAX_DAYS) })).not.toBeNull();
    expect(drop({ priceChangedAt: daysAgo(PRICE_DROP_MAX_DAYS + 1) })).toBeNull();
  });

  it("is null when the listing has no price history yet", () => {
    expect(drop({ priceUsdPrev: null })).toBeNull();
    expect(drop({ priceChangedAt: null })).toBeNull();
  });
});
