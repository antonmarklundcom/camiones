/**
 * Sort controls for /venta (I5). URL-driven and zero client JS: each option is
 * a plain link, so the whole thing works on a phone with JS disabled and on a
 * prepaid-data budget.
 *
 * SEO: a sort order is a duplicate slice of the same segment page, exactly like
 * a query-param filter, so `?orden=` counts as a filter — noindex,follow with
 * the canonical pointing back at the clean segment URL. The links also carry
 * rel="nofollow" so a crawler doesn't spend its budget on five reorderings of
 * every facet page it finds.
 *
 * Pure and DB-free: `SORT_ORDER_BY` names columns, `src/lib/queries.ts` turns
 * that into SQL.
 */
export const SORT_VALUES = [
  "recientes",
  "precio_asc",
  "precio_desc",
  "anio_desc",
  "km_asc",
] as const;
export type Sort = (typeof SORT_VALUES)[number];

export const DEFAULT_SORT: Sort = "recientes";

export const SORT_LABELS: Record<Sort, string> = {
  recientes: "Más recientes",
  precio_asc: "Precio: menor a mayor",
  precio_desc: "Precio: mayor a menor",
  anio_desc: "Año: más nuevos",
  km_asc: "Kilometraje: menor",
};

/** Short labels for the mobile chip row — the bar has to fit one thumb width. */
export const SORT_SHORT_LABELS: Record<Sort, string> = {
  recientes: "Recientes",
  precio_asc: "Precio ↑",
  precio_desc: "Precio ↓",
  anio_desc: "Año",
  km_asc: "Km",
};

export interface SortSpec {
  column: "publishedAt" | "priceUsd" | "year" | "km";
  direction: "asc" | "desc";
  /**
   * Whether `featured DESC` leads the ORDER BY. It does on the default view
   * (featured placement is a paid slot) but NOT on an explicit sort: a buyer
   * who asked for "precio: menor a mayor" must get the cheapest truck first,
   * not the cheapest featured one.
   */
  featuredFirst: boolean;
}

export const SORT_ORDER_BY: Record<Sort, SortSpec> = {
  recientes: { column: "publishedAt", direction: "desc", featuredFirst: true },
  precio_asc: { column: "priceUsd", direction: "asc", featuredFirst: false },
  precio_desc: { column: "priceUsd", direction: "desc", featuredFirst: false },
  anio_desc: { column: "year", direction: "desc", featuredFirst: false },
  km_asc: { column: "km", direction: "asc", featuredFirst: false },
};

export function parseSort(raw: string | string[] | undefined): Sort {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && (SORT_VALUES as readonly string[]).includes(v)
    ? (v as Sort)
    : DEFAULT_SORT;
}

/** The default never appears in the URL — one URL per view, not two. */
export function sortParam(sort: Sort): string | undefined {
  return sort === DEFAULT_SORT ? undefined : sort;
}
