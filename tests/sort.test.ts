/**
 * I5 — sort controls. Two things must hold: the default order never leaks into
 * the URL (one URL per view), and a sort is treated as a FILTER for SEO
 * purposes so it stays noindex with a canonical back to the clean segment URL.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  SORT_LABELS,
  SORT_ORDER_BY,
  SORT_VALUES,
  parseSort,
  sortParam,
} from "@/lib/sort";
import { parseVentaQuery, queryString, pageOnly } from "@/lib/venta-params";

describe("parseSort", () => {
  it("accepts every known value", () => {
    for (const s of SORT_VALUES) expect(parseSort(s)).toBe(s);
  });

  it("falls back to the default for junk, absent or array params", () => {
    expect(parseSort(undefined)).toBe(DEFAULT_SORT);
    expect(parseSort("precio")).toBe(DEFAULT_SORT);
    expect(parseSort("'; DROP TABLE listings;--")).toBe(DEFAULT_SORT);
    expect(parseSort(["precio_asc", "km_asc"])).toBe("precio_asc");
  });

  it("has a label for every value", () => {
    for (const s of SORT_VALUES) expect(SORT_LABELS[s]).toBeTruthy();
  });
});

describe("ORDER BY spec", () => {
  it("keeps featured-first ONLY on the default view", () => {
    expect(SORT_ORDER_BY[DEFAULT_SORT].featuredFirst).toBe(true);
    for (const s of SORT_VALUES.filter((v) => v !== DEFAULT_SORT)) {
      // A buyer who asked for "cheapest first" must get the cheapest truck,
      // not the cheapest featured one.
      expect(SORT_ORDER_BY[s].featuredFirst).toBe(false);
    }
  });

  it("sorts price ascending and descending on the same column", () => {
    expect(SORT_ORDER_BY.precio_asc).toMatchObject({ column: "priceUsd", direction: "asc" });
    expect(SORT_ORDER_BY.precio_desc).toMatchObject({ column: "priceUsd", direction: "desc" });
  });
});

describe("URL round-trip", () => {
  it("never serialises the default order", () => {
    expect(sortParam(DEFAULT_SORT)).toBeUndefined();
    expect(queryString(parseVentaQuery({}))).toBe("");
  });

  it("serialises an explicit order as ?orden=", () => {
    const q = parseVentaQuery({ orden: "precio_asc" });
    expect(q.sort).toBe("precio_asc");
    expect(queryString(q)).toBe("?orden=precio_asc");
  });

  it("treats a non-default order as a filter (noindex + canonical back)", () => {
    expect(parseVentaQuery({ orden: "km_asc" }).hasFilters).toBe(true);
    expect(parseVentaQuery({ orden: "recientes" }).hasFilters).toBe(false);
    expect(parseVentaQuery({}).hasFilters).toBe(false);
  });

  it("pageOnly() strips the order along with the other filters (F15)", () => {
    const q = parseVentaQuery({ orden: "precio_desc", price_max: "50000", page: "3" });
    const stripped = pageOnly(q);
    expect(stripped.sort).toBe(DEFAULT_SORT);
    expect(stripped.hasFilters).toBe(false);
    expect(queryString(stripped)).toBe("?page=3");
  });

  it("keeps the order when paginating", () => {
    const q = parseVentaQuery({ orden: "anio_desc", page: "2" });
    expect(queryString(q)).toBe("?orden=anio_desc&page=2");
  });
});
