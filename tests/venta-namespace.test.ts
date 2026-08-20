import { describe, expect, it } from "vitest";
import {
  assertSegmentAvailable,
  isSegmentAvailable,
  RESERVED_SEGMENTS,
  segmentOwner,
} from "@/lib/venta-namespace";
import { CATEGORIES, CONDITION_SEGMENTS } from "@/lib/taxonomy";

const ns = { brandSlugs: ["scania", "volvo", "foton"], citySlugs: ["asuncion", "luque"] };

describe("F24 — /venta segment namespace", () => {
  it("reports no owner for a free slug", () => {
    expect(segmentOwner("shacman", ns)).toBeNull();
    expect(isSegmentAvailable("shacman", ns)).toBe(true);
  });

  it("catches a brand colliding with a category", () => {
    // A brand literally named "Buses" would shadow /venta/buses.
    expect(segmentOwner("buses", ns)).toBe("category");
    expect(() => assertSegmentAvailable("buses", ns)).toThrow(/ya está tomado/);
  });

  it("catches a city colliding with an existing brand", () => {
    expect(segmentOwner("scania", ns)).toBe("brand");
  });

  it("catches a brand colliding with an existing city", () => {
    expect(segmentOwner("asuncion", ns)).toBe("city");
  });

  it("catches the condition words", () => {
    for (const word of Object.keys(CONDITION_SEGMENTS)) {
      expect(segmentOwner(word, ns)).toBe("condition");
    }
  });

  it("catches reserved route words", () => {
    for (const word of RESERVED_SEGMENTS) {
      expect(segmentOwner(word, ns)).toBe("reserved");
    }
  });

  it("is case-insensitive — slugs are lowercased at write time", () => {
    expect(segmentOwner("SCANIA", ns)).toBe("brand");
    expect(segmentOwner("Asuncion", ns)).toBe("city");
  });

  it("lets a row keep its own slug (re-saving is not a collision)", () => {
    expect(segmentOwner("scania", ns, { kind: "brand", slug: "scania" })).toBeNull();
    expect(isSegmentAvailable("asuncion", ns, { kind: "city", slug: "asuncion" })).toBe(true);
  });

  it("does not let a city claim a brand's slug by pretending to be it", () => {
    // `self` must match the row's OWN kind — a city editing itself can't
    // excuse a collision with a brand of the same name.
    expect(segmentOwner("scania", ns, { kind: "city", slug: "scania" })).toBe("brand");
  });

  it("keeps every shipped category slug reserved", () => {
    for (const c of CATEGORIES) {
      expect(segmentOwner(c.slug, ns)).toBe("category");
    }
  });
});
