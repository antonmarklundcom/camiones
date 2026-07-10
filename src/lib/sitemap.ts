/**
 * Sitemap entry builder — shares the MIN_INDEXABLE rule with the page
 * templates (src/lib/indexability.ts) so the sitemap NEVER lists a page the
 * templates mark noindex.
 */
import {
  facetCounts,
  getActiveSellerSlugs,
  getPublishedListingSlugs,
} from "@/lib/queries";
import { MIN_INDEXABLE } from "@/lib/indexability";
import { CATEGORIES, conditionSegment } from "@/lib/taxonomy";
import { listingPath, sellerPath } from "@/lib/urls";

export interface SitemapEntry {
  path: string;
  lastmod?: Date;
}

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [{ path: "/" }, { path: "/venta" }];
  const catSlug = new Map(CATEGORIES.map((c) => [c.value, c.slug]));

  const { byCat, byCatBrand, byCatCity, byCatCondition } = await facetCounts();

  for (const r of byCat) {
    if (r.n >= MIN_INDEXABLE) entries.push({ path: `/venta/${catSlug.get(r.category)}` });
  }
  for (const r of byCatBrand) {
    if (r.n >= MIN_INDEXABLE)
      entries.push({ path: `/venta/${catSlug.get(r.category)}/${r.brandSlug}` });
  }
  for (const r of byCatCity) {
    if (r.n >= MIN_INDEXABLE)
      entries.push({ path: `/venta/${catSlug.get(r.category)}/${r.citySlug}` });
  }
  for (const r of byCatCondition) {
    if (r.n >= MIN_INDEXABLE)
      entries.push({
        path: `/venta/${catSlug.get(r.category)}/${conditionSegment(r.condition)}`,
      });
  }

  const listingRows = await getPublishedListingSlugs();
  for (const l of listingRows) {
    entries.push({ path: listingPath(l.slug), lastmod: l.updatedAt });
  }

  const sellerRows = await getActiveSellerSlugs();
  for (const s of sellerRows) {
    entries.push({ path: sellerPath(s.slug) });
  }

  return entries;
}
