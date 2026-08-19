import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl, siteOrigin, ventaH1, ventaPath } from "@/lib/urls";
import { categoryBySlug } from "@/lib/taxonomy";

const camiones = categoryBySlug("camiones")!;
const camionetas = categoryBySlug("camionetas");
const scania = { name: "Scania", slug: "scania" };
const asuncion = { name: "Asunción", slug: "asuncion" };

describe("ventaPath", () => {
  it("returns the bare hub with no selection", () => {
    expect(ventaPath({})).toBe("/venta");
  });

  it("emits segments in the fixed category → brand → city → condition order", () => {
    expect(
      ventaPath({
        category: camiones,
        brand: scania,
        city: asuncion,
        condition: "usado",
      }),
    ).toBe("/venta/camiones/scania/asuncion/usados");
  });

  it("skips absent facets without leaving empty segments", () => {
    expect(ventaPath({ brand: scania, condition: "nuevo" })).toBe(
      "/venta/scania/nuevos",
    );
    expect(ventaPath({ city: asuncion })).toBe("/venta/asuncion");
  });
});

describe("ventaH1", () => {
  it("builds the full pattern: plural + brand + condition + place", () => {
    expect(
      ventaH1({ category: camiones, brand: scania, city: asuncion, condition: "usado" }),
    ).toBe("Camiones Scania usados en Asunción");
  });

  it("falls back to Paraguay when no city is selected", () => {
    expect(ventaH1({ category: camiones })).toBe("Camiones en Paraguay");
  });

  it("uses a generic plural when no category is selected", () => {
    expect(ventaH1({})).toBe("Camiones y vehículos de trabajo en Paraguay");
  });

  it.runIf(camionetas)("agrees the adjective with a feminine category", () => {
    expect(ventaH1({ category: camionetas!, condition: "usado" })).toContain("usadas");
  });
});

describe("siteOrigin", () => {
  const original = process.env.NEXT_PUBLIC_CANONICAL_HOST;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_CANONICAL_HOST;
    else process.env.NEXT_PUBLIC_CANONICAL_HOST = original;
  });

  it("defaults to the production host", () => {
    delete process.env.NEXT_PUBLIC_CANONICAL_HOST;
    expect(siteOrigin()).toBe("https://camiones.com.py");
  });

  it("honours the env override so staging never leaks into canonicals", () => {
    process.env.NEXT_PUBLIC_CANONICAL_HOST = "staging.camiones.com.py";
    expect(absoluteUrl("/venta/camiones")).toBe(
      "https://staging.camiones.com.py/venta/camiones",
    );
  });
});
