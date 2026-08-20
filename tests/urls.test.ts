/**
 * Canonical URL + H1 contract for /venta. Segment ORDER is the SEO invariant
 * (category → brand → city → condition) — it must match venta-params.ts.
 */
import { afterEach, describe, expect, it } from "vitest";
import { categoryBySlug } from "@/lib/taxonomy";
import {
  absoluteUrl,
  guidePath,
  listingPath,
  sellerPath,
  siteOrigin,
  ventaH1,
  ventaPath,
} from "@/lib/urls";

const camiones = categoryBySlug("camiones")!;
const camionetas = categoryBySlug("camionetas")!;
const scania = { name: "Scania", slug: "scania" };
const asuncion = { name: "Asunción", slug: "asuncion" };

describe("ventaPath", () => {
  it("returns the bare hub with no selection", () => {
    expect(ventaPath({})).toBe("/venta");
  });

  it("emits segments in canonical order regardless of key order", () => {
    expect(
      ventaPath({
        condition: "usado",
        city: asuncion,
        brand: scania,
        category: camiones,
      }),
    ).toBe("/venta/camiones/scania/asuncion/usados");
  });

  it("skips missing facets without leaving gaps", () => {
    expect(ventaPath({ brand: scania, condition: "nuevo" })).toBe(
      "/venta/scania/nuevos",
    );
  });
});

describe("ventaH1", () => {
  it('defaults to Paraguay when no city is selected', () => {
    expect(ventaH1({ category: camiones })).toBe("Camiones en Paraguay");
  });

  it("agrees the condition adjective with the category gender", () => {
    expect(ventaH1({ category: camionetas, condition: "usado" })).toBe(
      "Camionetas de trabajo usadas en Paraguay",
    );
  });

  it("builds the full pattern", () => {
    expect(
      ventaH1({ category: camiones, brand: scania, city: asuncion, condition: "usado" }),
    ).toBe("Camiones Scania usados en Asunción");
  });
});

describe("paths", () => {
  it("builds the public detail paths", () => {
    expect(listingPath("scania-r450-2019-a1b2")).toBe("/camion/scania-r450-2019-a1b2");
    expect(sellerPath("demo-dealer")).toBe("/vendedor/demo-dealer");
    expect(guidePath("financiacion")).toBe("/guias/financiacion");
  });
});

describe("siteOrigin", () => {
  const original = process.env.NEXT_PUBLIC_CANONICAL_HOST;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_CANONICAL_HOST;
    else process.env.NEXT_PUBLIC_CANONICAL_HOST = original;
  });

  it("falls back to the production host", () => {
    delete process.env.NEXT_PUBLIC_CANONICAL_HOST;
    expect(siteOrigin()).toBe("https://camiones.com.py");
    expect(absoluteUrl("/venta/camiones")).toBe("https://camiones.com.py/venta/camiones");
  });

  it("uses the env host so staging never leaks into canonicals", () => {
    process.env.NEXT_PUBLIC_CANONICAL_HOST = "staging.example.com";
    expect(siteOrigin()).toBe("https://staging.example.com");
  });
});
