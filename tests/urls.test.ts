import { describe, expect, it } from "vitest";
import { guidePath, listingPath, sellerPath, ventaH1, ventaPath } from "@/lib/urls";
import { categoryBySlug } from "@/lib/taxonomy";
import { joinSlug, slugify } from "@/lib/slug";

const camiones = categoryBySlug("camiones")!;
const camionetas = categoryBySlug("camionetas")!;
const scania = { name: "Scania", slug: "scania" };
const asuncion = { name: "Asunción", slug: "asuncion" };

describe("ventaPath — segment order is the contract", () => {
  it("bare /venta with no selection", () => {
    expect(ventaPath({})).toBe("/venta");
  });

  it("emits category → brand → city → condition, always in that order", () => {
    expect(
      ventaPath({ condition: "usado", city: asuncion, brand: scania, category: camiones }),
    ).toBe("/venta/camiones/scania/asuncion/usados");
  });

  it("skips missing facets without leaving empty segments", () => {
    expect(ventaPath({ brand: scania })).toBe("/venta/scania");
    expect(ventaPath({ category: camiones, condition: "nuevo" })).toBe(
      "/venta/camiones/nuevos",
    );
  });
});

describe("ventaH1 — es-PY gender agreement", () => {
  it("falls back to a generic H1 with no category", () => {
    expect(ventaH1({})).toBe("Camiones y vehículos de trabajo en Paraguay");
  });

  it("agrees with a masculine category", () => {
    expect(ventaH1({ category: camiones, condition: "usado" })).toBe(
      "Camiones usados en Paraguay",
    );
  });

  it("agrees with a feminine category", () => {
    expect(ventaH1({ category: camionetas, condition: "usado" })).toBe(
      "Camionetas de trabajo usadas en Paraguay",
    );
  });

  it("names the city when there is one", () => {
    expect(ventaH1({ category: camiones, brand: scania, city: asuncion })).toBe(
      "Camiones Scania en Asunción",
    );
  });
});

describe("detail paths", () => {
  it("builds the stable public paths", () => {
    expect(listingPath("scania-r450-2019-a1b2c3d4e")).toBe("/camion/scania-r450-2019-a1b2c3d4e");
    expect(sellerPath("demo-dealer")).toBe("/vendedor/demo-dealer");
    expect(guidePath("como-financiar")).toBe("/guias/como-financiar");
  });
});

describe("slugify", () => {
  it("strips Spanish diacritics", () => {
    expect(slugify("Asunción")).toBe("asuncion");
    expect(slugify("Ñeembucú")).toBe("neembucu");
  });

  it("collapses punctuation and whitespace to single hyphens", () => {
    expect(slugify("Mercedes-Benz  Actros / 2019")).toBe("mercedes-benz-actros-2019");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ¡Hola!  ")).toBe("hola");
  });

  it("caps length at 140 chars to fit the varchar columns", () => {
    expect(slugify("a".repeat(300))).toHaveLength(140);
  });

  it("is idempotent — re-slugging a slug is a no-op", () => {
    const once = slugify("Sinotruk/Howo");
    expect(slugify(once)).toBe(once);
  });
});

describe("joinSlug", () => {
  it("returns the child alone under an empty parent", () => {
    expect(joinSlug("", "paraguay")).toBe("paraguay");
  });

  it("builds the hierarchical full slug", () => {
    expect(joinSlug("paraguay/central", "luque")).toBe("paraguay/central/luque");
  });
});
