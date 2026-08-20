import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  assertStatusTransition,
  canTransition,
  canSetFeatured,
  nextPublishedAt,
  resolveFeatured,
  selectableStatuses,
} from "@/lib/admin/listing-policy";
import { LISTING_STATUS_VALUES } from "@/lib/admin/constants";

describe("F27 — status transitions", () => {
  it("allows a no-op transition for every status (plain edits)", () => {
    for (const s of LISTING_STATUS_VALUES) {
      expect(canTransition(s, s)).toBe(true);
    }
  });

  it("refuses sold → published: it would keep a year-old published_at", () => {
    expect(canTransition("sold", "published")).toBe(false);
    expect(() => assertStatusTransition("sold", "published")).toThrow(
      /no permitido/i,
    );
  });

  it("routes a sold listing back through draft", () => {
    expect(canTransition("sold", "draft")).toBe(true);
    expect(canTransition("draft", "published")).toBe(true);
  });

  it("refuses removed → published directly", () => {
    expect(canTransition("removed", "published")).toBe(false);
  });

  it("keeps the pause/unpause loop cheap", () => {
    expect(canTransition("published", "paused")).toBe(true);
    expect(canTransition("paused", "published")).toBe(true);
  });

  it("never lists a status outside the known set", () => {
    for (const from of LISTING_STATUS_VALUES) {
      for (const to of ALLOWED_TRANSITIONS[from]) {
        expect(LISTING_STATUS_VALUES).toContain(to);
      }
    }
  });

  it("offers the current status first and no duplicates", () => {
    for (const from of LISTING_STATUS_VALUES) {
      const options = selectableStatuses(from);
      expect(options[0]).toBe(from);
      expect(new Set(options).size).toBe(options.length);
      // Everything the UI offers must pass the server-side check.
      for (const to of options) expect(canTransition(from, to)).toBe(true);
    }
  });
});

describe("F27 — published_at", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  const old = new Date("2025-01-05T08:00:00Z");

  it("stamps the first publish", () => {
    expect(nextPublishedAt("published", null, now)).toEqual(now);
  });

  it("preserves the first publish date on re-publish", () => {
    expect(nextPublishedAt("published", old, now)).toEqual(old);
  });

  it("clears the date when a listing goes back to draft", () => {
    expect(nextPublishedAt("draft", old, now)).toBeNull();
  });

  it("leaves the date alone for paused/sold/removed", () => {
    for (const s of ["paused", "sold", "removed"] as const) {
      expect(nextPublishedAt(s, old, now)).toEqual(old);
    }
  });

  it("re-publishing after a draft round-trip stamps a fresh date", () => {
    const cleared = nextPublishedAt("draft", old, now);
    expect(nextPublishedAt("published", cleared, now)).toEqual(now);
  });
});

describe("F27 — admin-only featured", () => {
  it("lets an admin set and unset it", () => {
    expect(resolveFeatured("admin", true, false)).toBe(true);
    expect(resolveFeatured("admin", false, true)).toBe(false);
  });

  it("ignores what a dealer submits, in both directions", () => {
    // A dealer buying home-page placement…
    expect(resolveFeatured("dealer", true, false)).toBe(false);
    // …and a dealer's form silently dropping a feature an admin granted.
    expect(resolveFeatured("dealer", false, true)).toBe(true);
  });

  it("hides the control from dealers", () => {
    expect(canSetFeatured("admin")).toBe(true);
    expect(canSetFeatured("dealer")).toBe(false);
  });
});
