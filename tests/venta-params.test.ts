import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveSegments reads brands/cities from the DB; the resolution ORDER is the
// logic under test, so the lookups are stubbed with a fixed catalogue.
vi.mock("@/lib/queries", () => ({
  getPublishedBrands: vi.fn(async () => [
    { id: 1, name: "Scania", slug: "scania" },
    { id: 2, name: "Volvo", slug: "volvo" },
  ]),
  getCities: vi.fn(async () => [
    { id: 10, name: "Asunción", slug: "asuncion" },
    { id: 11, name: "Ciudad del Este", slug: "ciudad-del-este" },
  ]),
}));

const { parseVentaQuery, queryString, resolveSegments, toFilters } = await import(
  "@/lib/venta-params"
);

describe("resolveSegments", () => {
  it("resolves the full category → brand → city → condition chain", async () => {
    const r = await resolveSegments(["camiones", "scania", "asuncion", "usados"]);
    expect(r?.selection.category?.value).toBe("camion");
    expect(r?.selection.brand?.id).toBe(1);
    expect(r?.selection.city?.id).toBe(10);
    expect(r?.selection.condition).toBe("usado");
  });

  it("allows facets to be skipped as long as order holds", async () => {
    const r = await resolveSegments(["scania", "usados"]);
    expect(r?.selection.brand?.slug).toBe("scania");
    expect(r?.selection.condition).toBe("usado");
    expect(r?.selection.category).toBeUndefined();
  });

  it("404s when the order is violated", async () => {
    expect(await resolveSegments(["usados", "scania"])).toBeNull();
    expect(await resolveSegments(["asuncion", "camiones"])).toBeNull();
  });

  it("404s on an unknown segment", async () => {
    expect(await resolveSegments(["camiones", "no-existe"])).toBeNull();
  });

  it("404s on a repeated facet — one brand per URL", async () => {
    expect(await resolveSegments(["scania", "volvo"])).toBeNull();
  });

  it("resolves an empty segment list to the bare hub", async () => {
    const r = await resolveSegments([]);
    expect(r?.selection).toEqual({});
  });

  it("decodes and lowercases percent-encoded segments", async () => {
    const r = await resolveSegments(["ciudad-del-este".toUpperCase()]);
    expect(r?.selection.city?.id).toBe(11);
  });
});

describe("parseVentaQuery", () => {
  it("defaults to page 1 with no filters", () => {
    const q = parseVentaQuery({});
    expect(q.page).toBe(1);
    expect(q.hasFilters).toBe(false);
  });

  it("parses numeric filters and flags hasFilters", () => {
    const q = parseVentaQuery({ year_min: "2018", km_max: "250000" });
    expect(q.yearMin).toBe(2018);
    expect(q.kmMax).toBe(250_000);
    expect(q.hasFilters).toBe(true);
  });

  it("rejects negative and non-numeric values", () => {
    const q = parseVentaQuery({ year_min: "-5", price_max: "abc" });
    expect(q.yearMin).toBeUndefined();
    expect(q.priceMax).toBeUndefined();
    expect(q.hasFilters).toBe(false);
  });

  it("rejects enum values outside the schema", () => {
    expect(parseVentaQuery({ transmission: "turbo" }).transmission).toBeUndefined();
  });

  it("takes the first value when a param repeats", () => {
    expect(parseVentaQuery({ year_min: ["2018", "2020"] }).yearMin).toBe(2018);
  });

  it("clamps page to a minimum of 1", () => {
    expect(parseVentaQuery({ page: "0" }).page).toBe(1);
  });

  it("does NOT count page as a filter — paginated pages stay indexable", () => {
    expect(parseVentaQuery({ page: "3" }).hasFilters).toBe(false);
  });
});

describe("toFilters", () => {
  it("merges segment selection and query params into one filter object", async () => {
    const r = await resolveSegments(["camiones", "scania", "asuncion", "usados"]);
    const filters = toFilters(r!.selection, parseVentaQuery({ year_min: "2018" }));
    expect(filters).toMatchObject({
      category: "camion",
      brandId: 1,
      locationId: 10,
      condition: "usado",
      yearMin: 2018,
    });
  });
});

describe("queryString", () => {
  it("returns an empty string when nothing is active", () => {
    expect(queryString(parseVentaQuery({}))).toBe("");
  });

  it("omits page 1 but keeps later pages", () => {
    expect(queryString(parseVentaQuery({ page: "1" }))).toBe("");
    expect(queryString(parseVentaQuery({ page: "2" }))).toBe("?page=2");
  });

  it("round-trips active filters", () => {
    const q = parseVentaQuery({ year_min: "2018", km_max: "250000" });
    expect(queryString(q)).toBe("?year_min=2018&km_max=250000");
  });

  it("applies overrides for pagination links", () => {
    const q = parseVentaQuery({ year_min: "2018", page: "2" });
    expect(queryString(q, { page: 3 })).toBe("?year_min=2018&page=3");
  });

  it("drops a key when the override is empty", () => {
    const q = parseVentaQuery({ year_min: "2018", page: "2" });
    expect(queryString(q, { page: "" })).toBe("?year_min=2018");
  });
});
