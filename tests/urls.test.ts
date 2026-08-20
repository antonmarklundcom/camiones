/**
 * Canonical URL + H1 contract for /venta. Segment ORDER is the SEO invariant
 * (category → brand → city → condition) — it must match venta-params.ts.
 */
import { afterEach, describe, expect, it } from "vitest";
import { categoryBySlug } from "@/lib/taxonomy";
import { joinSlug, slugify } from "@/lib/slug";
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

  it("falls back to a generic H1 with no category", () => {
    expect(ventaH1({})).toBe("Camiones y vehículos de trabajo en Paraguay");
  });

  it("names the city when there is one", () => {
    expect(ventaH1({ category: camiones, brand: scania, city: asuncion })).toBe(
      "Camiones Scania en Asunción",
    );
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

/**
 * slug.ts backs every stable public URL — a change here silently breaks
 * inbound links, so the rules are pinned rather than assumed.
 */
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
