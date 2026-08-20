import "server-only";
import { and, asc, desc, eq, count, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  brands,
  images,
  listings,
  locations,
  sellers,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Admin/dealer reads. Unlike src/lib/queries.ts (public, published-only), these
 * see every status and are SELLER-SCOPED for dealers: a dealer never sees rows
 * outside their own sellerId. Admins see everything.
 */

/**
 * F20 — the scope MUST fail closed. Previously a dealer whose `sellerId` was
 * NULL fell through to the admin branch (empty filter) and could read every
 * seller's rows. Anything that is not a confirmed admin, or is a dealer
 * without a seller, now gets a condition that matches nothing.
 */
const MATCH_NOTHING = sql`1 = 0`;

function listingScope(user: SessionUser): SQL[] {
  if (user.role === "admin") return [];
  if (user.role === "dealer" && user.sellerId) {
    return [eq(listings.sellerId, user.sellerId)];
  }
  return [MATCH_NOTHING];
}

function sellerScope(user: SessionUser): SQL[] {
  if (user.role === "admin") return [];
  if (user.role === "dealer" && user.sellerId) {
    return [eq(sellers.id, user.sellerId)];
  }
  return [MATCH_NOTHING];
}

export async function listAdminListings(user: SessionUser) {
  const scope = listingScope(user);
  return db
    .select({
      id: listings.id,
      title: listings.title,
      status: listings.status,
      category: listings.category,
      priceUsd: listings.priceUsd,
      featured: listings.featured,
      updatedAt: listings.updatedAt,
      publishedAt: listings.publishedAt,
      brandName: brands.name,
      sellerName: sellers.name,
      coverKey: images.r2Key,
    })
    .from(listings)
    .innerJoin(brands, eq(listings.brandId, brands.id))
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .leftJoin(
      images,
      and(eq(images.listingId, listings.id), eq(images.sortOrder, 0)),
    )
    .where(scope.length ? and(...scope) : undefined)
    .orderBy(desc(listings.updatedAt));
}

export type AdminListingRow = Awaited<ReturnType<typeof listAdminListings>>[number];

/** Full listing for the edit form, scoped so dealers can't fetch by guessing ids. */
export async function getAdminListing(user: SessionUser, id: number) {
  const scope = listingScope(user);
  const [row] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), ...scope))
    .limit(1);
  if (!row) return null;

  const imgs = await db
    .select({
      id: images.id,
      r2Key: images.r2Key,
      alt: images.alt,
      sortOrder: images.sortOrder,
    })
    .from(images)
    .where(eq(images.listingId, id))
    .orderBy(asc(images.sortOrder));

  return { ...row, images: imgs };
}

export type AdminListingDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminListing>>
>;

/* --------------------------------- sellers -------------------------------- */

export async function listAdminSellers(user: SessionUser) {
  const scope = sellerScope(user);
  const rows = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      slug: sellers.slug,
      type: sellers.type,
      status: sellers.status,
      phoneDisplay: sellers.phoneDisplay,
      cityName: locations.name,
      listingCount: count(listings.id),
    })
    .from(sellers)
    .leftJoin(locations, eq(sellers.locationId, locations.id))
    .leftJoin(listings, eq(listings.sellerId, sellers.id))
    .where(scope.length ? and(...scope) : undefined)
    .groupBy(
      sellers.id,
      sellers.name,
      sellers.slug,
      sellers.type,
      sellers.status,
      sellers.phoneDisplay,
      locations.name,
    )
    .orderBy(asc(sellers.name));
  return rows;
}

export async function getAdminSeller(user: SessionUser, id: number) {
  if (user.role !== "admin" && user.sellerId !== id) return null;
  const [row] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  return row ?? null;
}

/** Dropdown options for the listing form's seller select (admin only uses it). */
export async function getSellerOptions() {
  return db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .orderBy(asc(sellers.name));
}

/* ---------------------------------- users --------------------------------- */

export async function listAdminUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sellerId: users.sellerId,
      sellerName: sellers.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(sellers, eq(users.sellerId, sellers.id))
    .orderBy(asc(users.email));
}

export async function getAdminUser(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/* ------------------------------- form options ----------------------------- */

export async function getBrandOptions() {
  return db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .orderBy(asc(brands.name));
}

export async function getCityOptions() {
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.level, "ciudad"))
    .orderBy(asc(locations.name));
}

/* ------------------------------- dashboard -------------------------------- */

export async function dashboardCounts(user: SessionUser) {
  const scope = listingScope(user);
  const base = () =>
    db.select({ n: count() }).from(listings);
  const [total] = await base().where(
    scope.length ? and(...scope) : undefined,
  );
  const [published] = await base().where(
    and(eq(listings.status, "published"), ...scope),
  );
  const [drafts] = await base().where(
    and(eq(listings.status, "draft"), ...scope),
  );
  return {
    total: total?.n ?? 0,
    published: published?.n ?? 0,
    drafts: drafts?.n ?? 0,
  };
}
