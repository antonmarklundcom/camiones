import { describe, expect, it } from "vitest";
import { joinSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("strips Spanish diacritics", () => {
    expect(slugify("Asunción")).toBe("asuncion");
    expect(slugify("Ñeembucú")).toBe("neembucu");
    expect(slugify("Concepción del Paraguay")).toBe("concepcion-del-paraguay");
  });

  it("collapses punctuation and whitespace into single hyphens", () => {
    expect(slugify("Scania  R450 / 6x4")).toBe("scania-r450-6x4");
    expect(slugify("Mercedes-Benz  Actros")).toBe("mercedes-benz-actros");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ¡Oferta!  ")).toBe("oferta");
  });

  it("caps length at 140 characters", () => {
    expect(slugify("a".repeat(200))).toHaveLength(140);
  });

  it("is idempotent — slugifying a slug returns the same slug", () => {
    const once = slugify("Camión Volvo FH 540 — Asunción");
    expect(slugify(once)).toBe(once);
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("¿¡—!?")).toBe("");
  });
});

describe("joinSlug", () => {
  it("nests a child under its parent", () => {
    expect(joinSlug("central", "asuncion")).toBe("central/asuncion");
  });

  it("returns the child alone when there is no parent", () => {
    expect(joinSlug("", "central")).toBe("central");
  });
});
