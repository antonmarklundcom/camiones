/**
 * F3 — the merge policy. A regression here either unpublishes a dealer's whole
 * inventory or silently overwrites the copy someone wrote in /admin.
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_OWNED_FIELDS,
  IMPORT_OWNED_FIELDS,
  mergeListing,
  parseAvailability,
  resolveAvailability,
} from "@/lib/import/merge";

const existing = {
  id: 7,
  title: "Scania R500 2021",
  brandId: 3,
  model: "R500",
  year: 2021,
  km: 320000,
  condition: "usado",
  category: "tractocamion",
  priceUsd: "105000.00",
  priceGs: "766500000",
  cuotaGs: "12000000",
  transmission: "automatizada",
  fuel: "diesel",
  traction: "6x4",
  capacityKg: 26000,
  locationId: 11,
  description: "Texto escrito a mano en el admin.",
  featured: true,
  status: "published" as const,
  publishedAt: new Date("2026-01-05T10:00:00Z"),
};

describe("mergeListing", () => {
  it("takes the dealer's price and km", () => {
    const { values, changed } = mergeListing(existing, {
      ...existing,
      km: 345000,
      priceUsd: "99000.00",
    });
    expect(values).toEqual({ km: 345000, priceUsd: "99000.00" });
    expect(changed).toEqual(["km", "priceUsd"]);
  });

  it("never touches description, category or featured", () => {
    const { values, changed } = mergeListing(existing, {
      ...existing,
      description: "Copy comercial del CSV",
      category: "camion",
      featured: false,
    });
    expect(values).toEqual({});
    expect(changed).toEqual([]);
  });

  it("never touches status or published_at (the F3 unpublish bug)", () => {
    const { values } = mergeListing(existing, {
      ...existing,
      status: "draft",
      publishedAt: new Date("2026-08-20T00:00:00Z"),
    });
    expect(values).not.toHaveProperty("status");
    expect(values).not.toHaveProperty("publishedAt");
  });

  it("writes nothing when the sheet is unchanged", () => {
    expect(mergeListing(existing, { ...existing }).changed).toEqual([]);
  });

  it("compares decimals by value, not by string form", () => {
    const { changed } = mergeListing(existing, { ...existing, priceUsd: "105000" });
    expect(changed).toEqual([]);
  });

  it("can clear an optional field", () => {
    const { values, changed } = mergeListing(existing, { ...existing, capacityKg: null });
    expect(changed).toEqual(["capacityKg"]);
    expect(values.capacityKg).toBeNull();
  });

  it("keeps the two ownership sets disjoint", () => {
    const overlap = IMPORT_OWNED_FIELDS.filter((f) =>
      (ADMIN_OWNED_FIELDS as readonly string[]).includes(f),
    );
    expect(overlap).toEqual([]);
  });
});

describe("parseAvailability", () => {
  it("reads the documented values and their common aliases", () => {
    expect(parseAvailability("Disponible")).toBe("disponible");
    expect(parseAvailability("VENDIDO")).toBe("vendido");
    expect(parseAvailability("reservado")).toBe("reservado");
    expect(parseAvailability("pausado")).toBe("reservado");
  });

  it("ignores anything it does not recognise", () => {
    expect(parseAvailability("en camino")).toBeNull();
    expect(parseAvailability("")).toBeNull();
    expect(parseAvailability(undefined)).toBeNull();
  });
});

describe("resolveAvailability", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  const firstPublish = new Date("2026-01-05T10:00:00Z");

  it("does nothing without an estado column", () => {
    expect(resolveAvailability("published", firstPublish, null, now)).toBeNull();
  });

  it("marks a published truck sold", () => {
    expect(resolveAvailability("published", firstPublish, "vendido", now)).toEqual({
      status: "sold",
      publishedAt: firstPublish,
    });
  });

  it("pauses on reservado and un-pauses on disponible", () => {
    expect(resolveAvailability("published", firstPublish, "reservado", now)?.status).toBe(
      "paused",
    );
    expect(resolveAvailability("paused", firstPublish, "disponible", now)).toEqual({
      status: "published",
      publishedAt: firstPublish, // preserved, not re-stamped
    });
  });

  it("refuses to publish a draft from a CSV cell", () => {
    expect(resolveAvailability("draft", null, "disponible", now)).toBeNull();
  });

  it("refuses to resurrect a sold listing", () => {
    expect(resolveAvailability("sold", firstPublish, "disponible", now)).toBeNull();
  });

  it("is a no-op when the status already matches", () => {
    expect(resolveAvailability("sold", firstPublish, "vendido", now)).toBeNull();
  });
});
