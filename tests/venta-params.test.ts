import { describe, expect, it } from "vitest";
import { parseVentaQuery, queryString, toFilters } from "@/lib/venta-params";
import { categoryBySlug } from "@/lib/taxonomy";

describe("parseVentaQuery", () => {
  it("defaults to page 1 with no filters", () => {
    const q = parseVentaQuery({});
    expect(q.page).toBe(1);
    expect(q.hasFilters).toBe(false);
  });

  it("parses the numeric ranges", () => {
    const q = parseVentaQuery({ year_min: "2015", price_max: "80000", km_max: "250000" });
    expect(q).toMatchObject({ yearMin: 2015, priceMax: 80000, kmMax: 250000 });
    expect(q.hasFilters).toBe(true);
  });

  it("drops junk and negative numbers instead of trusting them", () => {
    const q = parseVentaQuery({ year_min: "abc", price_max: "-5" });
    expect(q.yearMin).toBeUndefined();
    expect(q.priceMax).toBeUndefined();
    expect(q.hasFilters).toBe(false);
  });

  it("floors fractional input", () => {
    expect(parseVentaQuery({ km_max: "1500.9" }).kmMax).toBe(1500);
  });

  it("only accepts enum values it knows", () => {
    expect(parseVentaQuery({ transmission: "manual" }).transmission).toBe("manual");
    expect(parseVentaQuery({ transmission: "cohete" }).transmission).toBeUndefined();
    expect(parseVentaQuery({ traction: "6x4" }).traction).toBe("6x4");
    expect(parseVentaQuery({ traction: "9x9" }).traction).toBeUndefined();
  });

  it("takes the first value of a repeated param", () => {
    expect(parseVentaQuery({ year_min: ["2018", "1990"] }).yearMin).toBe(2018);
  });

  it("clamps page to at least 1, so ?page=0 and ?page=-3 can't paginate backwards", () => {
    expect(parseVentaQuery({ page: "0" }).page).toBe(1);
    expect(parseVentaQuery({ page: "-3" }).page).toBe(1);
  });

  it("does NOT count ?page as a filter — pagination is not a facet", () => {
    expect(parseVentaQuery({ page: "4" }).hasFilters).toBe(false);
  });

  it("treats km_max=0 as a real filter (brand-new, zero-km trucks)", () => {
    const q = parseVentaQuery({ km_max: "0" });
    expect(q.kmMax).toBe(0);
    expect(q.hasFilters).toBe(true);
  });
});

describe("toFilters", () => {
  it("merges resolved segments with query params", () => {
    const q = parseVentaQuery({ year_min: "2016", transmission: "automatica" });
    const filters = toFilters(
      {
        category: categoryBySlug("tractocamiones"),
        brand: { id: 7, name: "Scania", slug: "scania" },
        city: { id: 3, name: "Asunción", slug: "asuncion" },
        condition: "usado",
      },
      q,
    );
    expect(filters).toMatchObject({
      category: "tractocamion",
      brandId: 7,
      locationId: 3,
      condition: "usado",
      yearMin: 2016,
      transmission: "automatica",
    });
  });

  it("leaves unselected facets undefined rather than null", () => {
    const filters = toFilters({}, parseVentaQuery({}));
    expect(filters.category).toBeUndefined();
    expect(filters.brandId).toBeUndefined();
  });
});

describe("queryString", () => {
  it("returns an empty string when there is nothing to serialise", () => {
    expect(queryString(parseVentaQuery({}))).toBe("");
  });

  it("omits page=1", () => {
    expect(queryString(parseVentaQuery({ page: "1" }))).toBe("");
  });

  it("applies overrides and deletes on an empty override", () => {
    const q = parseVentaQuery({ page: "3", transmission: "manual" });
    expect(queryString(q, { page: 2 })).toContain("page=2");
    expect(queryString(q, { page: undefined })).not.toContain("page=");
  });
});
