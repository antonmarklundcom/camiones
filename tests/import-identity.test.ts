/**
 * F2 — the whole point of Batch 2. If these break, a monthly inventory refresh
 * starts minting duplicate listings for trucks that are already published.
 */
import { describe, expect, it } from "vitest";
import {
  ANCHOR_COLUMNS,
  importIdentity,
  normalizeExternalId,
  readAnchor,
  requiresAnchorToPublish,
} from "@/lib/import/identity";

const base = { sellerSlug: "camiones-py", brandSlug: "scania", model: "R500", year: 2021 };

describe("normalizeExternalId", () => {
  it("folds the ways one plate gets typed into one value", () => {
    for (const raw of ["abc 123", "ABC-123", " abc123 ", "AbC.123"]) {
      expect(normalizeExternalId(raw)).toBe("ABC123");
    }
  });

  it("strips accents from dealer stock codes", () => {
    expect(normalizeExternalId("camión-07")).toBe("CAMION07");
  });

  it("treats empty and punctuation-only values as absent", () => {
    expect(normalizeExternalId("")).toBeNull();
    expect(normalizeExternalId("   ")).toBeNull();
    expect(normalizeExternalId("---")).toBeNull();
    expect(normalizeExternalId(undefined)).toBeNull();
  });
});

describe("readAnchor", () => {
  it("accepts every documented anchor column", () => {
    for (const col of ANCHOR_COLUMNS) {
      expect(readAnchor({ [col]: "abc123" })).toBe("ABC123");
    }
  });

  it("prefers chapa over the later aliases", () => {
    expect(readAnchor({ chapa: "aaa111", stock_id: "bbb222" })).toBe("AAA111");
  });

  it("returns null when the sheet has no anchor column", () => {
    expect(readAnchor({ marca: "Scania", modelo: "R500" })).toBeNull();
  });
});

describe("importIdentity — anchored", () => {
  it("is stable across a km and price update (the F2 duplicate bug)", () => {
    const a = importIdentity({ ...base, externalId: "ABC123", model: "R500" });
    const b = importIdentity({ ...base, externalId: "ABC 123", model: "R 500" });
    expect(b.key).toBe(a.key);
    expect(a.anchor).toBe("external");
    expect(a.externalId).toBe("ABC123");
  });

  it("keeps two trucks with identical specs apart", () => {
    const a = importIdentity({ ...base, externalId: "ABC123" });
    const b = importIdentity({ ...base, externalId: "XYZ789" });
    expect(a.key).not.toBe(b.key);
  });

  it("scopes the key to the seller", () => {
    const a = importIdentity({ ...base, externalId: "ABC123" });
    const b = importIdentity({ ...base, sellerSlug: "otro-dealer", externalId: "ABC123" });
    expect(a.key).not.toBe(b.key);
  });
});

describe("importIdentity — anchorless fallback", () => {
  it("drops km from the key so a mileage update merges", () => {
    // The old key was sha1(seller|brand|model|year|km): this pair used to
    // produce two listings for one truck.
    const a = importIdentity(base);
    const b = importIdentity(base);
    expect(a.key).toBe(b.key);
    expect(a.anchor).toBe("spec");
    expect(a.externalId).toBeNull();
  });

  it("still separates different models and years", () => {
    expect(importIdentity(base).key).not.toBe(
      importIdentity({ ...base, year: 2022 }).key,
    );
    expect(importIdentity(base).key).not.toBe(
      importIdentity({ ...base, model: "R450" }).key,
    );
  });

  it("normalises model whitespace and case", () => {
    expect(importIdentity({ ...base, model: "  r  500 " }).key).toBe(
      importIdentity({ ...base, model: "R 500" }).key,
    );
  });
});

describe("requiresAnchorToPublish", () => {
  it("is true when even one row lacks an anchor", () => {
    const rows = [
      importIdentity({ ...base, externalId: "ABC123" }),
      importIdentity(base),
    ];
    expect(requiresAnchorToPublish(rows)).toBe(true);
  });

  it("is false when every row is anchored", () => {
    const rows = [
      importIdentity({ ...base, externalId: "ABC123" }),
      importIdentity({ ...base, externalId: "XYZ789" }),
    ];
    expect(requiresAnchorToPublish(rows)).toBe(false);
  });
});
