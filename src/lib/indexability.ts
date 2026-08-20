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
 * F15/F16 — the canonical URL of a paginated listing page.
 *
 * Page ≥2 must canonicalise to ITSELF, not to page 1: page 1 is different
 * content, so "canonical → page 1" told Google the pages were duplicates while
 * the noindex told it not to index them at all — two contradictory signals.
 * Self-canonical + noindex,follow is coherent: don't index this page, do crawl
 * through it to the listings.
 *
 * Query-param FILTER variants are a separate case and still canonicalise back
 * to the clean segment URL — those really are duplicate slices of one page.
 */
export function paginatedCanonical(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

/** Indexability of a paginated page: only page 1 may ever be indexed. */
export function paginationIndexability(
  page: number,
  pageOneIndexability: Indexability,
): Indexability {
  return page > 1 ? { state: "noindex" } : pageOneIndexability;
}
