/**
 * /venta/[...segments] resolution + query-param filter parsing.
 *
 * Segments resolve IN ORDER (PLAN.md): category → brand → city → condition.
 * Each segment must match a facet "deeper" than the previous one, so
 * /venta/camiones/scania/asuncion/usados works, /venta/scania/usados works,
 * and /venta/usados/scania 404s (order violated).
 */
import type { Condition, Traction, Transmission } from "@/db/schema";
import { TRACTION_VALUES, TRANSMISSION_VALUES } from "@/db/schema";
import { getCities, getPublishedBrands, type ListingFilters } from "@/lib/queries";
import { categoryBySlug, CONDITION_SEGMENTS } from "@/lib/taxonomy";
import { DEFAULT_SORT, parseSort, sortParam, type Sort } from "@/lib/sort";
import type { VentaSelection } from "@/lib/urls";

export interface ResolvedVenta {
  selection: VentaSelection & {
    brand?: { id: number; name: string; slug: string };
    city?: { id: number; name: string; slug: string };
  };
  brands: { id: number; name: string; slug: string }[];
  cities: { id: number; name: string; slug: string }[];
}

export async function resolveSegments(
  segments: string[],
): Promise<ResolvedVenta | null> {
  const [brandRows, cityRows] = await Promise.all([
    getPublishedBrands(),
    getCities(),
  ]);
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));
  const cityBySlug = new Map(cityRows.map((c) => [c.slug, c]));

  const sel: ResolvedVenta["selection"] = {};
  // facet order: 0=category 1=brand 2=city 3=condition
  let next = 0;

  for (const raw of segments) {
    const seg = decodeURIComponent(raw).toLowerCase();
    const cat = next <= 0 ? categoryBySlug(seg) : undefined;
    if (cat) {
      sel.category = cat;
      next = 1;
      continue;
    }
    const brand = next <= 1 ? brandBySlug.get(seg) : undefined;
    if (brand) {
      sel.brand = brand;
      next = 2;
      continue;
    }
    const city = next <= 2 ? cityBySlug.get(seg) : undefined;
    if (city) {
      sel.city = city;
      next = 3;
      continue;
    }
    const condition = next <= 3 ? CONDITION_SEGMENTS[seg] : undefined;
    if (condition) {
      sel.condition = condition;
      next = 4;
      continue;
    }
    return null; // unknown segment or order violation → 404
  }

  return { selection: sel, brands: brandRows, cities: cityRows };
}

/* --------------------------- query-param filters -------------------------- */

export interface VentaQuery {
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  kmMax?: number;
  transmission?: Transmission;
  traction?: Traction;
  /** I5 — sort controls. Default order is never serialised into the URL. */
  sort: Sort;
  page: number;
  /**
   * true when any FILTER param is present (drives noindex + canonical).
   * A non-default `?orden=` counts: a reordering is a duplicate slice of the
   * same segment page, so it gets the same noindex,follow + canonical-back
   * treatment as `?price_max=`.
   */
  hasFilters: boolean;
}

type RawParams = Record<string, string | string[] | undefined>;

function num(params: RawParams, key: string): number | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function oneOf<T extends string>(
  params: RawParams,
  key: string,
  values: readonly T[],
): T | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && (values as readonly string[]).includes(s) ? (s as T) : undefined;
}

export function parseVentaQuery(params: RawParams): VentaQuery {
  const q: VentaQuery = {
    yearMin: num(params, "year_min"),
    yearMax: num(params, "year_max"),
    priceMin: num(params, "price_min"),
    priceMax: num(params, "price_max"),
    kmMax: num(params, "km_max"),
    transmission: oneOf(params, "transmission", TRANSMISSION_VALUES),
    traction: oneOf(params, "traction", TRACTION_VALUES),
    sort: parseSort(params.orden),
    page: Math.max(1, num(params, "page") ?? 1),
    hasFilters: false,
  };
  q.hasFilters =
    q.yearMin !== undefined ||
    q.yearMax !== undefined ||
    q.priceMin !== undefined ||
    q.priceMax !== undefined ||
    q.kmMax !== undefined ||
    q.transmission !== undefined ||
    q.traction !== undefined ||
    q.sort !== DEFAULT_SORT;
  return q;
}

/** Merge resolved segments + query params into the SQL filter object. */
export function toFilters(
  resolved: ResolvedVenta["selection"],
  q: VentaQuery,
): ListingFilters {
  return {
    category: resolved.category?.value,
    brandId: resolved.brand?.id,
    locationId: resolved.city?.id,
    condition: resolved.condition as Condition | undefined,
    yearMin: q.yearMin,
    yearMax: q.yearMax,
    priceMin: q.priceMin,
    priceMax: q.priceMax,
    kmMax: q.kmMax,
    transmission: q.transmission,
    traction: q.traction,
  };
}

/**
 * F15 — drop every FILTER param, keep the page.
 *
 * Seller pages don't apply venta filters at all, but they were re-serialising
 * whatever `?transmission=…&price_max=…` happened to be in the URL into their
 * own pagination hrefs, minting crawlable duplicates of the same seller page.
 */
export function pageOnly(q: VentaQuery): VentaQuery {
  return { page: q.page, sort: DEFAULT_SORT, hasFilters: false };
}

/** Re-serialize the ACTIVE query filters (used by pagination links). */
export function queryString(
  q: VentaQuery,
  overrides: Partial<Record<string, string | number>> = {},
): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: number | string | undefined) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  };
  set("year_min", q.yearMin);
  set("year_max", q.yearMax);
  set("price_min", q.priceMin);
  set("price_max", q.priceMax);
  set("km_max", q.kmMax);
  set("transmission", q.transmission);
  set("traction", q.traction);
  set("orden", sortParam(q.sort));
  if (q.page > 1) set("page", q.page);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
