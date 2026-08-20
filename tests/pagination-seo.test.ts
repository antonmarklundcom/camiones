import { describe, expect, it } from "vitest";
import {
  MIN_INDEXABLE,
  paginatedCanonical,
  paginationIndexability,
  robotsFor,
  segmentIndexability,
} from "@/lib/indexability";
import { pageOnly, parseVentaQuery, queryString } from "@/lib/venta-params";

describe("F15/F16 — pagination canonicals", () => {
  it("page 1 canonicalises to the clean path (no ?page=1)", () => {
    expect(paginatedCanonical("/venta/camiones", 1)).toBe("/venta/camiones");
    expect(paginatedCanonical("/vendedor/demo", 1)).toBe("/vendedor/demo");
  });

  it("page ≥2 canonicalises to ITSELF, not back to page 1", () => {
    expect(paginatedCanonical("/venta/camiones", 3)).toBe("/venta/camiones?page=3");
    expect(paginatedCanonical("/vendedor/demo", 2)).toBe("/vendedor/demo?page=2");
  });

  it("page ≥2 is never indexable, however many listings page 1 has", () => {
    const rich = segmentIndexability(MIN_INDEXABLE + 500);
    expect(rich.state).toBe("index");
    expect(paginationIndexability(2, rich).state).toBe("noindex");
    expect(paginationIndexability(99, rich).state).toBe("noindex");
  });

  it("page 1 keeps whatever the thin-page rule decided", () => {
    expect(paginationIndexability(1, segmentIndexability(MIN_INDEXABLE)).state).toBe("index");
    expect(paginationIndexability(1, segmentIndexability(MIN_INDEXABLE - 1)).state).toBe(
      "noindex",
    );
  });

  it("noindex still means follow — crawlers must reach the listings", () => {
    expect(robotsFor(paginationIndexability(4, segmentIndexability(999)))).toEqual({
      index: false,
      follow: true,
    });
  });
});

describe("F15 — seller pagination drops filter params", () => {
  const raw = {
    page: "3",
    transmission: "manual",
    price_max: "50000",
    year_min: "2015",
    traction: "6x4",
    km_max: "300000",
  };

  it("keeps the page and nothing else", () => {
    const q = pageOnly(parseVentaQuery(raw));
    expect(q.page).toBe(3);
    expect(q.hasFilters).toBe(false);
    expect(q.transmission).toBeUndefined();
    expect(q.priceMax).toBeUndefined();
    expect(q.yearMin).toBeUndefined();
    expect(q.traction).toBeUndefined();
    expect(q.kmMax).toBeUndefined();
  });

  it("produces a pagination href with only ?page", () => {
    expect(queryString(pageOnly(parseVentaQuery(raw)))).toBe("?page=3");
  });

  it("produces a bare path on page 1", () => {
    expect(queryString(pageOnly(parseVentaQuery({ ...raw, page: "1" })))).toBe("");
  });

  it("leaves the venta grid's own filter serialisation untouched", () => {
    const q = parseVentaQuery(raw);
    const s = queryString(q);
    expect(s).toContain("transmission=manual");
    expect(s).toContain("page=3");
  });
});
