/**
 * F3 — field-level merge policy (PLAN.md Decisions Log): import wins
 * price/km/availability, admin wins description/photos/category, first
 * published_at preserved forever.
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_OWNED_FIELDS,
  IMPORT_OWNED_FIELDS,
  isAdminCurated,
  mergeExisting,
  shouldReplacePhotos,
  type ExistingListing,
} from "@/lib/import/merge";

const existing = (over: Partial<ExistingListing> = {}): ExistingListing => ({
  id: 1,
  publicId: "IABCDEFGHJ",
  slug: "scania-r500-2021-iabcdefghj",
  title: "Scania R500 2021",
  condition: "usado",
  category: "tractocamion",
  brandId: 3,
  model: "R500",
  year: 2021,
  km: 320000,
  priceUsd: "105000.00",
  priceGs: "766500000",
  transmission: "automatizada",
  fuel: "diesel",
  traction: "6x4",
  capacityKg: 26000,
  description: "Descripción original del CSV.",
  locationId: 9,
  sellerId: 2,
  externalId: "ABC123",
  status: "published",
  publishedAt: new Date("2026-01-15T10:00:00Z"),
  updatedBy: null,
  ...over,
});

describe("merge policy — ownership sets are disjoint", () => {
  it("no field is both import- and admin-owned", () => {
    const overlap = (IMPORT_OWNED_FIELDS as readonly string[]).filter((f) =>
      (ADMIN_OWNED_FIELDS as readonly string[]).includes(f),
    );
    expect(overlap).toEqual([]);
  });

  it("status/publishedAt/publicId/slug are unreachable from mergeExisting", () => {
    const { values } = mergeExisting(existing(), {
      status: "removed",
      publishedAt: null,
      publicId: "HACKED0000",
      slug: "hacked",
      sellerId: 999,
      featured: true,
    });
    expect(values).toEqual({});
  });
});

describe("import wins price / km", () => {
  it("overwrites price and km even on an admin-curated row", () => {
    const { values, changed } = mergeExisting(existing({ updatedBy: 7 }), {
      km: 341000,
      priceUsd: "99000.00",
      priceGs: "722700000",
    });
    expect(values).toEqual({ km: 341000, priceUsd: "99000.00", priceGs: "722700000" });
    expect(changed.sort()).toEqual(["km", "priceGs", "priceUsd"]);
  });

  it("reports no change when the numbers are equal but differently formatted", () => {
    // MySQL hands decimals back as strings — a naive !== rewrote every row on
    // every run.
    const { changed } = mergeExisting(existing(), {
      priceUsd: "105000",
      priceGs: 766500000,
      km: 320000,
    });
    expect(changed).toEqual([]);
  });
});

describe("admin wins description / category", () => {
  it("refreshes them while the row is untouched by a human", () => {
    const { values, changed } = mergeExisting(existing({ updatedBy: null }), {
      description: "Texto nuevo del concesionario.",
      category: "camion",
    });
    expect(values).toEqual({
      description: "Texto nuevo del concesionario.",
      category: "camion",
    });
    expect(changed.sort()).toEqual(["category", "description"]);
  });

  it("freezes them once an admin saved the listing", () => {
    const { values, changed } = mergeExisting(existing({ updatedBy: 7 }), {
      description: "Texto nuevo del concesionario.",
      category: "camion",
    });
    expect(values).toEqual({});
    expect(changed).toEqual([]);
  });

  it("isAdminCurated keys off updated_by", () => {
    expect(isAdminCurated({ updatedBy: null })).toBe(false);
    expect(isAdminCurated({ updatedBy: 1 })).toBe(true);
  });
});

describe("photos", () => {
  it("an empty fotos column never deletes a gallery", () => {
    expect(shouldReplacePhotos(existing(), [])).toBe(false);
    expect(shouldReplacePhotos(null, [])).toBe(false);
  });

  it("replaces on a fresh row and on an untouched imported row", () => {
    expect(shouldReplacePhotos(null, ["a.webp"])).toBe(true);
    expect(shouldReplacePhotos(existing({ updatedBy: null }), ["a.webp"])).toBe(true);
  });

  it("leaves an admin-curated gallery alone", () => {
    expect(shouldReplacePhotos(existing({ updatedBy: 7 }), ["a.webp"])).toBe(false);
  });
});
