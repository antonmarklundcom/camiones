/**
 * Slugs are written once and NEVER recomputed (inbound links + SEO), so the
 * function has to stay byte-stable across refactors.
 */
import { describe, expect, it } from "vitest";
import { joinSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("strips Spanish diacritics", () => {
    expect(slugify("Asunción")).toBe("asuncion");
    expect(slugify("Ñeembucú")).toBe("neembucu");
    expect(slugify("Presidente Hayes")).toBe("presidente-hayes");
  });

  it("collapses punctuation and separators to single hyphens", () => {
    expect(slugify("Mercedes-Benz  Actros 2045 / 6x4")).toBe(
      "mercedes-benz-actros-2045-6x4",
    );
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ¡Volquete!  ")).toBe("volquete");
  });

  it("caps length at 140 chars", () => {
    expect(slugify("a".repeat(200))).toHaveLength(140);
  });

  it("is idempotent", () => {
    const once = slugify("Camión Volvo FH 460 — Ciudad del Este");
    expect(slugify(once)).toBe(once);
  });
});

describe("joinSlug", () => {
  it("returns the child alone for a root parent", () => {
    expect(joinSlug("", "paraguay")).toBe("paraguay");
  });

  it("joins parent and child with a slash", () => {
    expect(joinSlug("paraguay/central", "asuncion")).toBe(
      "paraguay/central/asuncion",
    );
  });
});
