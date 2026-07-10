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
