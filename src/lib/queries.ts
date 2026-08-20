/**
 * All public-site DB reads. Server components call these; every filter runs
 * server-side on indexed scalar columns (idx_search) — no client-side
 * filtering anywhere.
 */
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
import { SORT_ORDER_BY, DEFAULT_SORT, type Sort } from "@/lib/sort";
import {
  orderPrograms,
  usablePrograms,
  type FinancingProgram,
  type RateConvention,
} from "@/lib/cuota";

export const PER_PAGE = 12;

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
  // I5 — price-drop badge inputs.
  priceUsdPrev: listings.priceUsdPrev,
  priceChangedAt: listings.priceChangedAt,
  // I6 — verified-seller badge. One indexed PK join, already needed for the
  // seller name on the detail page.
  sellerVerifiedAt: sellers.verifiedAt,
};

function cardSelect() {
  return db
    .select(cardColumns)
    .from(listings)
    .innerJoin(brands, eq(listings.brandId, brands.id))
    .innerJoin(locations, eq(listings.locationId, locations.id))
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .leftJoin(
      images,
      and(eq(images.listingId, listings.id), eq(images.sortOrder, 0)),
    );
}

/**
 * ORDER BY for the sort controls (I5).
 *
 * `featured DESC` leads only the DEFAULT view: featured placement is a paid
 * slot, but a buyer who asked for "precio: menor a mayor" must get the cheapest
 * truck first, not the cheapest featured one. `id` is the final tiebreaker so
 * pagination can never show the same listing on two pages.
 */
function orderFor(sort: Sort) {
  const spec = SORT_ORDER_BY[sort];
  const col = {
    publishedAt: listings.publishedAt,
    priceUsd: listings.priceUsd,
    year: listings.year,
    km: listings.km,
  }[spec.column];
  const dir = spec.direction === "asc" ? asc : desc;
  return [
    ...(spec.featuredFirst ? [desc(listings.featured)] : []),
    dir(col),
    desc(listings.id),
  ];
}

export type ListingCardData = Awaited<ReturnType<typeof getListingCards>>[number];

export async function getListingCards(
  f: ListingFilters,
  page = 1,
  perPage = PER_PAGE,
  sort: Sort = DEFAULT_SORT,
) {
  return cardSelect()
    .where(whereFor(f))
    .orderBy(...orderFor(sort))
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

export async function getPublishedBrands() {
  return db
    .select({ id: brands.id, name: brands.name, slug: brands.slug })
    .from(brands)
    .where(eq(brands.status, "published"))
    .orderBy(asc(brands.name));
}

export async function getCities() {
  return db
    .select({ id: locations.id, name: locations.name, slug: locations.slug })
    .from(locations)
    .where(and(eq(locations.level, "ciudad"), eq(locations.status, "published")))
    .orderBy(asc(locations.name));
}

/** Published-listing count per category — home tiles + sitemap. */
export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: listings.category, n: count() })
    .from(listings)
    .where(eq(listings.status, "published"))
    .groupBy(listings.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

/* ------------------------------ detail page ------------------------------ */

export async function getListingBySlug(slug: string) {
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
      priceUsdPrev: listings.priceUsdPrev,
      priceChangedAt: listings.priceChangedAt,
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
        verifiedAt: sellers.verifiedAt,
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
}

/**
 * Programs the public site may quote from.
 *
 * F5: `orderPrograms()` gives a deterministic order — this query had no ORDER
 * BY, so "whichever row MySQL happened to return first" decided which program
 * the detail-page calculator opened on.
 *
 * `usablePrograms()` drops anything still carrying the "(PLACEHOLDER)" marker,
 * so a page literally cannot render a made-up rate even if the `financing`
 * feature flag were switched on by mistake.
 */
export async function getActivePrograms(): Promise<FinancingProgram[]> {
  const rows = await db
    .select()
    .from(financingPrograms)
    .where(
      and(
        eq(financingPrograms.active, true),
        eq(financingPrograms.status, "published"),
      ),
    );
  return orderPrograms(
    usablePrograms(
      rows.map((p) => ({
        code: p.code,
        name: p.name,
        annualRate: Number(p.annualRate),
        maxTermMonths: p.maxTermMonths,
        maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
        minDownPct: Number(p.minDownPct),
        active: p.active,
        rateConvention: p.rateConvention as RateConvention,
      })),
    ),
  );
}

/* ------------------------------ seller page ------------------------------ */

export async function getSellerBySlug(slug: string) {
  const [row] = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      slug: sellers.slug,
      type: sellers.type,
      verifiedAt: sellers.verifiedAt,
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
}

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
