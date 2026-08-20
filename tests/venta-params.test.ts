/**
 * Segment resolution is the 404/200 decision for every faceted URL, and the
 * query parser is what makes a page noindex. Both are pure once the two DB
 * lookups are stubbed, so the suite stays DB-free.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries", () => ({
  getPublishedBrands: async () => [
    { id: 1, name: "Scania", slug: "scania" },
    { id: 2, name: "Volvo", slug: "volvo" },
  ],
  getCities: async () => [
    { id: 10, name: "Asunción", slug: "asuncion" },
    { id: 11, name: "Ciudad del Este", slug: "ciudad-del-este" },
  ],
}));

const {
  parseVentaQuery,
  queryString,
  resolveSegments,
  toFilters,
} = await import("@/lib/venta-params");

describe("resolveSegments", () => {
  it("resolves the full canonical order", async () => {
    const r = await resolveSegments(["camiones", "scania", "asuncion", "usados"]);
    expect(r!.selection.category?.value).toBe("camion");
    expect(r!.selection.brand?.id).toBe(1);
    expect(r!.selection.city?.id).toBe(10);
    expect(r!.selection.condition).toBe("usado");
  });

  it("allows skipping facets", async () => {
    const r = await resolveSegments(["scania", "usados"]);
    expect(r!.selection.brand?.slug).toBe("scania");
    expect(r!.selection.category).toBeUndefined();
  });

  it("returns an empty selection for the bare hub", async () => {
    const r = await resolveSegments([]);
    expect(r!.selection).toEqual({});
  });

  it("404s on an order violation (condition before brand)", async () => {
    expect(await resolveSegments(["usados", "scania"])).toBeNull();
  });

  it("404s on an unknown segment", async () => {
    expect(await resolveSegments(["camiones", "kenworth"])).toBeNull();
  });

  it("404s on a repeated facet", async () => {
    expect(await resolveSegments(["scania", "volvo"])).toBeNull();
  });

  it("decodes and lowercases percent-encoded segments", async () => {
    const r = await resolveSegments(["ciudad%2Ddel%2Deste"]);
    expect(r!.selection.city?.id).toBe(11);
  });
});

describe("parseVentaQuery", () => {
  it("defaults to page 1 with no filters", () => {
    const q = parseVentaQuery({});
    expect(q.page).toBe(1);
    expect(q.hasFilters).toBe(false);
  });

  it("parses numeric ranges and flags hasFilters", () => {
    const q = parseVentaQuery({ year_min: "2015", price_max: "60000" });
    expect(q.yearMin).toBe(2015);
    expect(q.priceMax).toBe(60_000);
    expect(q.hasFilters).toBe(true);
  });

  it("drops garbage and negative numbers", () => {
    const q = parseVentaQuery({ year_min: "abc", km_max: "-5" });
    expect(q.yearMin).toBeUndefined();
    expect(q.kmMax).toBeUndefined();
    expect(q.hasFilters).toBe(false);
  });

  it("accepts only known enum values", () => {
    expect(parseVentaQuery({ transmission: "automatica" }).transmission).toBe(
      "automatica",
    );
    expect(parseVentaQuery({ transmission: "cvt" }).transmission).toBeUndefined();
    expect(parseVentaQuery({ traction: "6x4" }).traction).toBe("6x4");
  });

  it("takes the first value of a repeated param", () => {
    expect(parseVentaQuery({ year_min: ["2015", "2020"] }).yearMin).toBe(2015);
  });

  it("clamps page to at least 1 and does not count it as a filter", () => {
    const q = parseVentaQuery({ page: "0" });
    expect(q.page).toBe(1);
    expect(parseVentaQuery({ page: "3" }).hasFilters).toBe(false);
  });
});

describe("toFilters", () => {
  it("merges resolved segments with query params", async () => {
    const r = await resolveSegments(["camiones", "scania", "asuncion", "usados"]);
    const f = toFilters(r!.selection, parseVentaQuery({ km_max: "200000" }));
    expect(f).toMatchObject({
      category: "camion",
      brandId: 1,
      locationId: 10,
      condition: "usado",
      kmMax: 200_000,
    });
  });
});

describe("queryString", () => {
  it("is empty for an unfiltered first page (clean canonical)", () => {
    expect(queryString(parseVentaQuery({}))).toBe("");
  });

  it("omits page=1 but keeps page≥2", () => {
    expect(queryString(parseVentaQuery({ page: "1" }))).toBe("");
    expect(queryString(parseVentaQuery({ page: "2" }))).toBe("?page=2");
  });

  it("round-trips active filters", () => {
    const q = parseVentaQuery({ year_min: "2015", traction: "6x4" });
    expect(queryString(q)).toBe("?year_min=2015&traction=6x4");
  });

  it("applies overrides and drops keys set to empty (pagination links)", () => {
    const q = parseVentaQuery({ year_min: "2015", page: "3" });
    expect(queryString(q, { page: 2 })).toBe("?year_min=2015&page=2");
    expect(queryString(q, { page: "" })).toBe("?year_min=2015");
  });
});

/**
 * Cases carried over from the parallel Batch 0 suite. The km_max=0 one is the
 * load-bearing edge: zero-km is a real search on a truck site, so a falsy
 * check would drop the filter and quietly widen the result set.
 */
describe("parseVentaQuery / toFilters — carried-over edges", () => {
  it("floors fractional input", () => {
    expect(parseVentaQuery({ km_max: "1500.9" }).kmMax).toBe(1500);
  });

  it("treats km_max=0 as a real filter (brand-new, zero-km trucks)", () => {
    const q = parseVentaQuery({ km_max: "0" });
    expect(q.kmMax).toBe(0);
    expect(q.hasFilters).toBe(true);
  });

  it("leaves unselected facets undefined rather than null", () => {
    const filters = toFilters({}, parseVentaQuery({}));
    expect(filters.category).toBeUndefined();
    expect(filters.brandId).toBeUndefined();
  });
});
