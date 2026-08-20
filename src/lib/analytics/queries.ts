/**
 * Admin analytics reads. Everything here hits `analytics_daily` (the nightly
 * rollup), never the raw event log — a dealer opening their stats must cost a
 * handful of indexed rows, not a scan over months of events on shared MySQL.
 *
 * Scoping mirrors src/lib/admin/queries.ts exactly, including the fail-closed
 * rule from F20: anything that isn't a confirmed admin, or is a dealer with a
 * NULL sellerId, gets `1 = 0` and sees nothing.
 */
import "server-only";
import { and, desc, eq, gte, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { analyticsDaily, listings, sellers } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import type { EventKind } from "@/db/schema";

const MATCH_NOTHING = sql`1 = 0`;

function scope(user: SessionUser): SQL[] {
  if (user.role === "admin") return [];
  if (user.role === "dealer" && user.sellerId) {
    return [eq(analyticsDaily.sellerId, user.sellerId)];
  }
  return [MATCH_NOTHING];
}

/** SUM of one event kind, as a conditional aggregate over the grouped rows. */
function kindSum(k: EventKind): SQL<number> {
  return sql<number>`COALESCE(SUM(CASE WHEN ${analyticsDaily.kind} = ${k} THEN ${analyticsDaily.events} ELSE 0 END), 0)`;
}

/** MySQL DATE arithmetic — keeps the window out of JS/timezone territory. */
function sinceDays(days: number): SQL {
  return sql`${analyticsDaily.day} >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
}

export interface Totals {
  pageViews: number;
  waClicks: number;
  leads: number;
  visitors: number;
}

export async function analyticsTotals(
  user: SessionUser,
  days: number,
): Promise<Totals> {
  const rows = await db
    .select({
      kind: analyticsDaily.kind,
      events: sum(analyticsDaily.events),
      visitors: sum(analyticsDaily.visitors),
    })
    .from(analyticsDaily)
    .where(and(sinceDays(days), ...scope(user)))
    .groupBy(analyticsDaily.kind);

  const by = (k: EventKind) => Number(rows.find((r) => r.kind === k)?.events ?? 0);
  return {
    pageViews: by("page_view"),
    waClicks: by("wa_click"),
    leads: by("lead"),
    visitors: Number(rows.find((r) => r.kind === "page_view")?.visitors ?? 0),
  };
}

export interface ListingStatRow {
  listingId: number;
  title: string;
  slug: string;
  status: string;
  sellerName: string;
  pageViews: number;
  waClicks: number;
  leads: number;
}

/**
 * Per-listing stats, ordered by WhatsApp clicks. That ordering is the point:
 * clicks are the real conversion metric, pageviews are vanity — a listing with
 * 40 views and 0 clicks is priced wrong, and a dealer can act on that.
 */
export async function listingStats(
  user: SessionUser,
  days: number,
  limit = 25,
): Promise<ListingStatRow[]> {
  const views = kindSum("page_view");
  const clicks = kindSum("wa_click");

  const rows = await db
    .select({
      listingId: analyticsDaily.listingId,
      title: listings.title,
      slug: listings.slug,
      status: listings.status,
      sellerName: sellers.name,
      pageViews: views,
      waClicks: clicks,
      leads: kindSum("lead"),
    })
    .from(analyticsDaily)
    .innerJoin(listings, eq(analyticsDaily.listingId, listings.id))
    .innerJoin(sellers, eq(listings.sellerId, sellers.id))
    .where(and(sinceDays(days), ...scope(user)))
    .groupBy(
      analyticsDaily.listingId,
      listings.title,
      listings.slug,
      listings.status,
      sellers.name,
    )
    // WhatsApp clicks first, views as the tiebreaker — repeat the expressions
    // rather than using ordinals, which point at SELECT positions, not these.
    .orderBy(desc(clicks), desc(views))
    .limit(limit);

  return rows.map((r) => ({
    listingId: Number(r.listingId),
    title: r.title,
    slug: r.slug,
    status: r.status,
    sellerName: r.sellerName,
    pageViews: Number(r.pageViews),
    waClicks: Number(r.waClicks),
    leads: Number(r.leads),
  }));
}

export interface SellerStatRow {
  sellerId: number;
  name: string;
  slug: string;
  verifiedAt: Date | null;
  pageViews: number;
  waClicks: number;
  leads: number;
}

/** Per-seller stats. Admin-only in practice; a dealer sees just their own row. */
export async function sellerStats(
  user: SessionUser,
  days: number,
  limit = 25,
): Promise<SellerStatRow[]> {
  const views = kindSum("page_view");
  const clicks = kindSum("wa_click");

  const rows = await db
    .select({
      sellerId: analyticsDaily.sellerId,
      name: sellers.name,
      slug: sellers.slug,
      verifiedAt: sellers.verifiedAt,
      pageViews: views,
      waClicks: clicks,
      leads: kindSum("lead"),
    })
    .from(analyticsDaily)
    .innerJoin(sellers, eq(analyticsDaily.sellerId, sellers.id))
    .where(and(sinceDays(days), ...scope(user)))
    .groupBy(
      analyticsDaily.sellerId,
      sellers.name,
      sellers.slug,
      sellers.verifiedAt,
    )
    .orderBy(desc(clicks), desc(views))
    .limit(limit);

  return rows.map((r) => ({
    sellerId: Number(r.sellerId),
    name: r.name,
    slug: r.slug,
    verifiedAt: r.verifiedAt,
    pageViews: Number(r.pageViews),
    waClicks: Number(r.waClicks),
    leads: Number(r.leads),
  }));
}

/** Is there any rolled-up data at all? Drives the empty state's wording. */
export async function hasAnalytics(): Promise<boolean> {
  const [row] = await db
    .select({ day: analyticsDaily.day })
    .from(analyticsDaily)
    .where(gte(analyticsDaily.day, sql`DATE_SUB(CURDATE(), INTERVAL 400 DAY)`))
    .limit(1);
  return Boolean(row);
}
