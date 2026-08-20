/**
 * DB-backed view of the /venta segment namespace (F24). Kept separate from
 * segment-namespace.ts (pure, unit-tested) so seeds, scripts and server code
 * share one definition of "what is already taken".
 *
 * Not marked `server-only`: the seeds run it under tsx.
 */
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { brands, locations } from "@/db/schema";
import {
  assertSegmentAvailable,
  type SegmentKind,
  type TakenSegment,
} from "@/lib/segment-namespace";

/** Every brand + city slug currently in the DB. */
export async function loadTakenSegments(): Promise<TakenSegment[]> {
  const [brandRows, cityRows] = await Promise.all([
    db.select({ slug: brands.slug }).from(brands),
    db
      .select({ slug: locations.slug })
      .from(locations)
      .where(eq(locations.level, "ciudad")),
  ]);
  return [
    ...brandRows.map((b) => ({ slug: b.slug, kind: "marca" as SegmentKind })),
    ...cityRows.map((c) => ({ slug: c.slug, kind: "ciudad" as SegmentKind })),
  ];
}

/**
 * Throws when `slug` would shadow (or be shadowed by) another facet. Rows of
 * the SAME kind are excluded — re-seeding a brand is not a conflict with itself.
 */
export async function assertSegmentFree(
  slug: string,
  kind: SegmentKind,
): Promise<void> {
  const taken = (await loadTakenSegments()).filter((t) => t.kind !== kind);
  assertSegmentAvailable(slug, taken);
}

/** Same check, restricted to city slugs colliding with a DIFFERENT city. */
export async function assertCitySegmentFree(
  slug: string,
  ownFullSlug: string,
): Promise<void> {
  const brandRows = await db.select({ slug: brands.slug }).from(brands);
  const cityRows = await db
    .select({ slug: locations.slug })
    .from(locations)
    .where(and(eq(locations.level, "ciudad"), ne(locations.fullSlug, ownFullSlug)));
  assertSegmentAvailable(slug, [
    ...brandRows.map((b) => ({ slug: b.slug, kind: "marca" as SegmentKind })),
    ...cityRows.map((c) => ({ slug: c.slug, kind: "ciudad" as SegmentKind })),
  ]);
}
