/**
 * All public-site DB reads. Server components call these; every filter runs
 * server-side on indexed scalar columns (idx_search) — no client-side
 * filtering anywhere.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  brands,
  financingPrograms,
  images,
  listings,
  locations,
  sellers,
  type Category,
  type Condition,
  type Traction,
  type Transmission,
} from "@/db/schema";
import type { FinancingProgram } from "@/lib/cuota";

export const PER_PAGE = 12;

/**
 * F13 — runtime caching. Public pages stay `force-dynamic` (Hostinger can't
 * reach MySQL at build time, so SSG is off the table), but that never justified
 * paying 4–7 queries per anonymous view. Two layers:
 *
 *  - `unstable_cache` (5 min) for the slow-moving taxonomy reads that every
 *    page repeats — brands, cities, counts, financing programs. Tagged so a
 *    future admin mutation can revalidate instead of waiting out the TTL.
 *  - `React.cache` for per-request dedupe, where `generateMetadata` and the
 *    page body ask the exact same question (Next dedupes fetch(), not DB calls).
 */
const TAXONOMY_TTL = 300;
export const TAG_TAXONOMY = "taxonomy";
export const TAG_LISTINGS = "listings";

export interface ListingFilters {
  category?: Category;
  brandId?: number;
  locationId?: number;
  condition?: Condition;
  sellerId?: number;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number; // USD
  priceMax?: number; // USD
  kmMax?: number;
  transmission?: Transmission;
  traction?: Traction;
}

function whereFor(f: ListingFilters): SQL {
  const conds: SQL[] = [eq(listings.status, "published")];
  if (f.category) conds.push(eq(listings.category, f.category));
  if (f.brandId) conds.push(eq(listings.brandId, f.brandId));
  if (f.locationId) conds.push(eq(listings.locationId, f.locationId));
  if (f.condition) conds.push(eq(listings.condition, f.condition));
  if (f.sellerId) conds.push(eq(listings.sellerId, f.sellerId));
  if (f.yearMin) conds.push(gte(listings.year, f.yearMin));
  if (f.yearMax) conds.push(lte(listings.year, f.yearMax));
  if (f.priceMin) conds.push(gte(listings.priceUsd, f.priceMin.toFixed(2)));
  if (f.priceMax) conds.push(lte(listings.priceUsd, f.priceMax.toFixed(2)));
  if (f.kmMax !== undefined) conds.push(lte(listings.km, f.kmMax));
  if (f.transmission) conds.push(eq(listings.transmission, f.transmission));
  if (f.traction) conds.push(eq(listings.traction, f.traction));
  return and(...conds)!;
}

const cardColumns = {
  slug: listings.slug,
  title: listings.title,
  condition: listings.condition,
  category: listings.category,
  year: listings.year,
  km: listings.km,
  priceUsd: listings.priceUsd,
  priceGs: listings.priceGs,
  cuotaGs: listings.cuotaGs,
  transmission: listings.transmission,
  featured: listings.featured,
  brandName: brands.name,
  cityName: locations.name,
  coverKey: images.r2Key,
  publishedAt: listings.publishedAt,
};

function cardSelect() {
  return db
    .select(cardColumns)
    .from(listings)
    .innerJoin(brands, eq(listings.brandId, brands.id))
    .innerJoin(locations, eq(listings.locationId, locations.id))
    .leftJoin(
      images,
      and(eq(images.listingId, listings.id), eq(images.sortOrder, 0)),
    );
}

export type ListingCardData = Awaited<ReturnType<typeof getListingCards>>[number];

export async function getListingCards(
  f: ListingFilters,
  page = 1,
  perPage = PER_PAGE,
) {
  return cardSelect()
    .where(whereFor(f))
    .orderBy(desc(listings.featured), desc(listings.publishedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export async function countListings(f: ListingFilters): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(listings)
    .where(whereFor(f));
  return row?.n ?? 0;
}

export async function getFeaturedListings(n: number) {
  return cardSelect()
    .where(and(whereFor({}), eq(listings.featured, true)))
    .orderBy(desc(listings.publishedAt))
    .limit(n);
}

export async function getRecentListings(n: number) {
  return getListingCards({}, 1, n);
}

/* ---------------------------- taxonomy lookups --------------------------- */

export const getPublishedBrands = unstable_cache(
  async () =>
    db
      .select({ id: brands.id, name: brands.name, slug: brands.slug })
      .from(brands)
      .where(eq(brands.status, "published"))
      .orderBy(asc(brands.name)),
  ["brands:published"],
  { revalidate: TAXONOMY_TTL, tags: [TAG_TAXONOMY] },
);

export const getCities = unstable_cache(
  async () =>
    db
      .select({ id: locations.id, name: locations.name, slug: locations.slug })
      .from(locations)
      .where(and(eq(locations.level, "ciudad"), eq(locations.status, "published")))
      .orderBy(asc(locations.name)),
  ["locations:cities"],
  { revalidate: TAXONOMY_TTL, tags: [TAG_TAXONOMY] },
);

/** Published-listing count per category — home tiles + sitemap. */
export const categoryCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
  const rows = await db
    .select({ category: listings.category, n: count() })
    .from(listings)
    .where(eq(listings.status, "published"))
    .groupBy(listings.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
  },
  ["listings:category-counts"],
  { revalidate: TAXONOMY_TTL, tags: [TAG_LISTINGS] },
);

/* ------------------------------ detail page ------------------------------ */

export const getListingBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      condition: listings.condition,
      category: listings.category,
      model: listings.model,
      year: listings.year,
      km: listings.km,
      priceUsd: listings.priceUsd,
      priceGs: listings.priceGs,
      cuotaGs: listings.cuotaGs,
      transmission: listings.transmission,
      fuel: listings.fuel,
      traction: listings.traction,
      capacityKg: listings.capacityKg,
      description: listings.description,
      publishedAt: listings.publishedAt,
      updatedAt: listings.updatedAt,
      brand: { id: brands.id, name: brands.name, slug: brands.slug },
      city: { id: locations.id, name: locations.name, slug: locations.slug },
      seller: {
        id: sellers.id,
        name: sellers.name,
        slug: sellers.slug,
        type: sellers.type,
        phoneWhatsapp: sellers.phoneWhatsapp,
        phoneDisplay: sellers.phoneDisplay,
      },
    })
    .from(listings)
    .innerJoin(brands, eq(listings.brandId, brands.id))
    .innerJoin(locations, eq(listings.locationId, locations.id))
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .where(and(eq(listings.slug, slug), eq(listings.status, "published")))
    .limit(1);
  if (!row) return null;

  const imgs = await db
    .select({ r2Key: images.r2Key, alt: images.alt })
    .from(images)
    .where(eq(images.listingId, row.id))
    .orderBy(asc(images.sortOrder));

  return { ...row, images: imgs };
});

/** Active programs for the cuota calculator (placeholder rates until Phase 4). */
export const getActivePrograms = unstable_cache(
  async (): Promise<FinancingProgram[]> => {
  const rows = await db
    .select()
    .from(financingPrograms)
    .where(
      and(
        eq(financingPrograms.active, true),
        eq(financingPrograms.status, "published"),
      ),
    );
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));
  },
  ["financing:active"],
  { revalidate: TAXONOMY_TTL, tags: [TAG_TAXONOMY] },
);

/**
 * Lead capture (F9): the contact form only sends a publicId; every value that
 * reaches the CRM is re-read from the DB here, so a forged bound argument can't
 * inject a title, price or link into our own CRM notes.
 */
export async function getListingForLead(publicId: string) {
  const [row] = await db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      priceUsd: listings.priceUsd,
      sellerId: listings.sellerId,
      sellerSlug: sellers.slug,
    })
    .from(listings)
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .where(and(eq(listings.publicId, publicId), eq(listings.status, "published")))
    .limit(1);
  return row ?? null;
}

/* ------------------------------ seller page ------------------------------ */

export const getSellerBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      slug: sellers.slug,
      type: sellers.type,
      phoneWhatsapp: sellers.phoneWhatsapp,
      phoneDisplay: sellers.phoneDisplay,
      email: sellers.email,
      address: sellers.address,
      description: sellers.description,
      logoR2Key: sellers.logoR2Key,
      cityName: locations.name,
    })
    .from(sellers)
    .leftJoin(locations, eq(sellers.locationId, locations.id))
    .where(and(eq(sellers.slug, slug), eq(sellers.status, "published")))
    .limit(1);
  return row ?? null;
});

/* -------------------------------- sitemap -------------------------------- */

/** Grouped counts feeding the sitemap's indexable-segment-page list. */
export async function facetCounts() {
  const published = eq(listings.status, "published");
  const [byCat, byCatBrand, byCatCity, byCatCondition] = await Promise.all([
    db
      .select({ category: listings.category, n: count() })
      .from(listings)
      .where(published)
      .groupBy(listings.category),
    db
      .select({
        category: listings.category,
        brandSlug: brands.slug,
        n: count(),
      })
      .from(listings)
      .innerJoin(brands, eq(listings.brandId, brands.id))
      .where(published)
      .groupBy(listings.category, brands.slug),
    db
      .select({
        category: listings.category,
        citySlug: locations.slug,
        n: count(),
      })
      .from(listings)
      .innerJoin(locations, eq(listings.locationId, locations.id))
      .where(published)
      .groupBy(listings.category, locations.slug),
    db
      .select({
        category: listings.category,
        condition: listings.condition,
        n: count(),
      })
      .from(listings)
      .where(published)
      .groupBy(listings.category, listings.condition),
  ]);
  return { byCat, byCatBrand, byCatCity, byCatCondition };
}

export async function getPublishedListingSlugs() {
  return db
    .select({ slug: listings.slug, updatedAt: listings.updatedAt })
    .from(listings)
    .where(eq(listings.status, "published"));
}

/** Published sellers that have at least one published listing. */
export async function getActiveSellerSlugs() {
  return db
    .select({ slug: sellers.slug })
    .from(sellers)
    .where(
      and(
        eq(sellers.status, "published"),
        sql`exists (select 1 from ${listings} where ${listings.sellerId} = ${sellers.id} and ${listings.status} = 'published')`,
      ),
    );
}
