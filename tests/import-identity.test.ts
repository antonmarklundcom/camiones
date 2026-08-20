/**
 * F2/F28 — identity-key derivation. The two properties that matter:
 * a mileage/price change must NEVER move the key, and an anchored key must
 * depend on nothing but seller + anchor.
 */
import { describe, expect, it } from "vitest";
import { deriveIdentity, normalizeExternalId } from "@/lib/import/identity";

const base = {
  sellerSlug: "camiones-py",
  brandSlug: "scania",
  model: "R500",
  year: 2021,
};

describe("normalizeExternalId", () => {
  it("uppercases and strips punctuation so 'abc 123' == 'ABC-123'", () => {
    expect(normalizeExternalId("abc 123")).toBe("ABC123");
    expect(normalizeExternalId("ABC-123")).toBe("ABC123");
  });

  it("treats blank and whitespace-only anchors as absent", () => {
    expect(normalizeExternalId("")).toBeNull();
    expect(normalizeExternalId("   ")).toBeNull();
    expect(normalizeExternalId(null)).toBeNull();
    expect(normalizeExternalId(undefined)).toBeNull();
  });
});

describe("deriveIdentity — anchored", () => {
  it("keys on seller + anchor only", () => {
    const a = deriveIdentity({ ...base, externalId: "ABC123" });
    const b = deriveIdentity({
      ...base,
      externalId: "abc-123",
      model: "R450", // corrected model
      year: 2022, // corrected year
      brandSlug: "volvo",
    });
    expect(a.importKey).toBe(b.importKey);
    expect(a.anchored).toBe(true);
    expect(a.externalId).toBe("ABC123");
  });

  it("gives different trucks different keys", () => {
    expect(deriveIdentity({ ...base, externalId: "ABC123" }).importKey).not.toBe(
      deriveIdentity({ ...base, externalId: "ABC124" }).importKey,
    );
  });

  it("scopes the key to the seller", () => {
    expect(deriveIdentity({ ...base, externalId: "ABC123" }).importKey).not.toBe(
      deriveIdentity({ ...base, sellerSlug: "otro-dealer", externalId: "ABC123" }).importKey,
    );
  });
});

describe("deriveIdentity — anchorless", () => {
  it("does NOT include km: a mileage update updates, never duplicates (F2)", () => {
    // km is not even an input any more — the regression this guards against is
    // someone re-adding it. Same truck, next month's sheet:
    const first = deriveIdentity({ ...base });
    const later = deriveIdentity({ ...base });
    expect(first.importKey).toBe(later.importKey);
    expect(first.anchored).toBe(false);
  });

  it("still distinguishes brand / model / year", () => {
    const keys = new Set([
      deriveIdentity({ ...base }).importKey,
      deriveIdentity({ ...base, model: "R450" }).importKey,
      deriveIdentity({ ...base, year: 2020 }).importKey,
      deriveIdentity({ ...base, brandSlug: "volvo" }).importKey,
    ]);
    expect(keys.size).toBe(4);
  });

  it("never collides with the anchored namespace", () => {
    expect(deriveIdentity({ ...base }).importKey).not.toBe(
      deriveIdentity({ ...base, externalId: "SCANIA" }).importKey,
    );
  });

  it("produces a 40-char sha1 hex key", () => {
    expect(deriveIdentity({ ...base })).toMatchObject({
      importKey: expect.stringMatching(/^[0-9a-f]{40}$/),
    });
  });
});
