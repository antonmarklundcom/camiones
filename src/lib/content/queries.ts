import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands, contentPages, type ContentKind } from "@/db/schema";

/* -------------------------------- public --------------------------------- */

/** Published guides for the /guias index (cards), newest first. */
export async function getPublishedGuides(kind?: ContentKind) {
  const conds = [eq(contentPages.status, "published")];
  if (kind) conds.push(eq(contentPages.kind, kind));
  return db
    .select({
      slug: contentPages.slug,
      kind: contentPages.kind,
      title: contentPages.title,
      excerpt: contentPages.excerpt,
      heroR2Key: contentPages.heroR2Key,
      publishedAt: contentPages.publishedAt,
    })
    .from(contentPages)
    .where(and(...conds))
    .orderBy(desc(contentPages.publishedAt));
}

/** One published guide by slug, with its (optional) linked brand. */
export async function getGuideBySlug(slug: string) {
  const [row] = await db
    .select({
      id: contentPages.id,
      slug: contentPages.slug,
      kind: contentPages.kind,
      title: contentPages.title,
      excerpt: contentPages.excerpt,
      body: contentPages.body,
      heroR2Key: contentPages.heroR2Key,
      category: contentPages.category,
      publishedAt: contentPages.publishedAt,
      updatedAt: contentPages.updatedAt,
      brand: { id: brands.id, name: brands.name, slug: brands.slug },
    })
    .from(contentPages)
    .leftJoin(brands, eq(contentPages.brandId, brands.id))
    .where(and(eq(contentPages.slug, slug), eq(contentPages.status, "published")))
    .limit(1);
  return row ?? null;
}

/** Published guide slugs for the sitemap. */
export async function getPublishedGuideSlugs() {
  return db
    .select({ slug: contentPages.slug, updatedAt: contentPages.updatedAt })
    .from(contentPages)
    .where(eq(contentPages.status, "published"));
}

/* --------------------------------- admin --------------------------------- */

export async function listAdminContent() {
  return db
    .select({
      id: contentPages.id,
      slug: contentPages.slug,
      kind: contentPages.kind,
      title: contentPages.title,
      status: contentPages.status,
      source: contentPages.source,
      updatedAt: contentPages.updatedAt,
    })
    .from(contentPages)
    .orderBy(desc(contentPages.updatedAt));
}

export async function getAdminContent(id: number) {
  const [row] = await db
    .select()
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);
  return row ?? null;
}
