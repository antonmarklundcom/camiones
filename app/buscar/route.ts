import { NextRequest, NextResponse } from "next/server";
import { CONDITION_SEGMENTS, categoryBySlug } from "@/lib/taxonomy";
import { TRACTION_VALUES, TRANSMISSION_VALUES } from "@/db/schema";

export const dynamic = "force-dynamic";

const FILTER_KEYS = ["year_min", "year_max", "price_min", "price_max", "km_max"] as const;

/**
 * GET /buscar — turns the no-JS filter/search forms into canonical URLs:
 * segment facets (categoria/marca/ciudad/condicion) become path segments in
 * the fixed order, numeric/enum filters stay as query params. 302 keeps
 * crawlers off this endpoint (robots.txt also disallows it).
 */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const segs: string[] = [];
  const cat = categoryBySlug((p.get("categoria") ?? "").toLowerCase());
  if (cat) segs.push(cat.slug);
  // Brand/city slugs come from our own selects; sanitize to slug charset and
  // let the /venta resolver 404 anything that doesn't exist.
  const marca = (p.get("marca") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (marca) segs.push(marca);
  const ciudad = (p.get("ciudad") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (ciudad) segs.push(ciudad);
  const condicion = (p.get("condicion") ?? "").toLowerCase();
  const condSeg = condicion === "nuevo" ? "nuevos" : condicion === "usado" ? "usados" : "";
  if (condSeg && CONDITION_SEGMENTS[condSeg]) segs.push(condSeg);

  const out = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const v = p.get(key);
    if (v && /^\d+$/.test(v)) out.set(key, v);
  }
  const transmission = p.get("transmission") ?? "";
  if ((TRANSMISSION_VALUES as readonly string[]).includes(transmission)) {
    out.set("transmission", transmission);
  }
  const traction = p.get("traction") ?? "";
  if ((TRACTION_VALUES as readonly string[]).includes(traction)) {
    out.set("traction", traction);
  }

  const path = segs.length ? `/venta/${segs.join("/")}` : "/venta";
  const qs = out.toString();
  return NextResponse.redirect(new URL(`${path}${qs ? `?${qs}` : ""}`, req.nextUrl), 302);
}
