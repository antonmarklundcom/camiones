/**
 * Faceted-URL discipline (same thin-page rule as propia) — single source of
 * truth used by BOTH the page templates and the sitemap generator. Only
 * category/brand/city/condition segment pages can be indexed; anything with
 * query-param filters is noindex,follow at the page level.
 */

export type Indexability =
  | { state: "index" } // in sitemap, indexable
  | { state: "noindex" }; // renders, noindex,follow, NOT in sitemap

export const MIN_INDEXABLE = 3;

export function segmentIndexability(listingCount: number): Indexability {
  return listingCount >= MIN_INDEXABLE ? { state: "index" } : { state: "noindex" };
}

export function robotsFor(ix: Indexability): { index: boolean; follow: boolean } {
  return { index: ix.state === "index", follow: true };
}

/**
 * Pagination rule (F15/F16), shared by /venta and /vendedor.
 *
 * Page ≥2 is `noindex,follow` and SELF-canonical (`?page=N`). Pointing page 2's
 * canonical at page 1 — what both templates used to do — tells Google the two
 * are the same document while the content differs, which it ignores; the
 * self-canonical is the honest signal, and noindex keeps the thin duplicates
 * out of the index while still letting the crawler reach every listing.
 * Only page 1 of a clean segment URL ever enters the sitemap.
 */
export function paginatedCanonical(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

export function pageIndexability(page: number, base: Indexability): Indexability {
  return page > 1 ? { state: "noindex" } : base;
}
