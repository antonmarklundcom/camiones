/**
 * F15/F16: page ≥2 self-canonicalises and is noindex,follow — page 1 is the
 * only thing that ever enters the sitemap.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_INDEXABLE,
  pageIndexability,
  paginatedCanonical,
  robotsFor,
  segmentIndexability,
} from "@/lib/indexability";

describe("segmentIndexability", () => {
  it("applies the thin-page threshold", () => {
    expect(segmentIndexability(MIN_INDEXABLE).state).toBe("index");
    expect(segmentIndexability(MIN_INDEXABLE - 1).state).toBe("noindex");
  });
});

describe("paginatedCanonical", () => {
  it("leaves page 1 clean", () => {
    expect(paginatedCanonical("/venta/camiones", 1)).toBe("/venta/camiones");
  });

  it("self-canonicalises page ≥2 instead of pointing at page 1", () => {
    expect(paginatedCanonical("/venta/camiones", 3)).toBe(
      "/venta/camiones?page=3",
    );
    expect(paginatedCanonical("/vendedor/demo-dealer", 2)).toBe(
      "/vendedor/demo-dealer?page=2",
    );
  });
});

describe("pageIndexability", () => {
  it("passes page 1 through untouched", () => {
    expect(pageIndexability(1, { state: "index" }).state).toBe("index");
    expect(pageIndexability(1, { state: "noindex" }).state).toBe("noindex");
  });

  it("forces noindex from page 2 on", () => {
    expect(pageIndexability(2, { state: "index" }).state).toBe("noindex");
  });

  it("keeps follow on, so deeper pages are still crawled", () => {
    expect(robotsFor(pageIndexability(2, { state: "index" }))).toEqual({
      index: false,
      follow: true,
    });
  });
});
