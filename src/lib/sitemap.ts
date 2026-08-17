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
import { getPublishedGuideSlugs } from "@/lib/content/queries";
import { MIN_INDEXABLE } from "@/lib/indexability";
import { CATEGORIES, conditionSegment } from "@/lib/taxonomy";
import { guidePath, listingPath, sellerPath } from "@/lib/urls";

export interface SitemapEntry {
  path: string;
  lastmod?: Date;
}

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [{ path: "/" }, { path: "/venta" }];
  const catSlug = new Map(CATEGORIES.map((c) => [c.value, c.slug]));

  const { byCat, byCatBrand, byCatCity, byCatCondition } = await facetCounts();

  // Every path below interpolates catSlug.get(): if the DB enum and the
  // taxonomy ever drift, an unguarded lookup emits "/venta/undefined" into the
  // sitemap. Skip and warn instead of publishing a broken URL to crawlers.
  const seg = (category: string): string | null => {
    const s = catSlug.get(category as never);
    if (!s) {
      console.warn(`[sitemap] categoría sin slug en taxonomy: '${category}' — omitida`);
      return null;
    }
    return s;
  };

  for (const r of byCat) {
    const c = seg(r.category);
    if (c && r.n >= MIN_INDEXABLE) entries.push({ path: `/venta/${c}` });
  }
  for (const r of byCatBrand) {
    const c = seg(r.category);
    if (c && r.n >= MIN_INDEXABLE) entries.push({ path: `/venta/${c}/${r.brandSlug}` });
  }
  for (const r of byCatCity) {
    const c = seg(r.category);
    if (c && r.n >= MIN_INDEXABLE) entries.push({ path: `/venta/${c}/${r.citySlug}` });
  }
  for (const r of byCatCondition) {
    const c = seg(r.category);
    if (c && r.n >= MIN_INDEXABLE)
      entries.push({ path: `/venta/${c}/${conditionSegment(r.condition)}` });
  }

  const listingRows = await getPublishedListingSlugs();
  for (const l of listingRows) {
    entries.push({ path: listingPath(l.slug), lastmod: l.updatedAt });
  }

  const sellerRows = await getActiveSellerSlugs();
  for (const s of sellerRows) {
    entries.push({ path: sellerPath(s.slug) });
  }

  const guideRows = await getPublishedGuideSlugs();
  if (guideRows.length) entries.push({ path: "/guias" });
  for (const g of guideRows) {
    entries.push({ path: guidePath(g.slug), lastmod: g.updatedAt });
  }

  return entries;
}
