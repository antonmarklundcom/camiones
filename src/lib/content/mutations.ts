import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentPages, CATEGORY_VALUES, CONTENT_KIND_VALUES } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { uploadToR2 } from "@/lib/r2";
import { assertUploadable, MAX_SINGLE_IMAGE_BYTES } from "@/lib/admin/uploads";
import { excerptFromMarkdown } from "@/lib/content/markdown";
import type { SessionUser } from "@/lib/auth/session";

export const contentInputSchema = z.object({
  title: z.string().trim().min(3, "Ingresá un título").max(200),
  kind: z.enum(CONTENT_KIND_VALUES).default("guia"),
  excerpt: z.string().trim().max(320).optional(),
  body: z.string().trim().min(20, "El contenido es muy corto"),
  brandId: z.coerce.number().int().positive().optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type ContentInput = z.infer<typeof contentInputSchema>;

export function parseContentForm(formData: FormData) {
  const val = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : v;
  };
  return contentInputSchema.safeParse({
    title: formData.get("title"),
    kind: val("kind") ?? "guia",
    excerpt: val("excerpt"),
    body: formData.get("body"),
    brandId: val("brandId"),
    category: val("category"),
    status: val("status") ?? "draft",
  });
}

async function uniqueSlug(base: string, exceptId?: number): Promise<string> {
  const root = slugify(base) || "guia";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const [row] = await db
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(eq(contentPages.slug, slug))
      .limit(1);
    if (!row || row.id === exceptId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

/** brandId only for kind=marca, category only for kind=categoria. */
function scopeLinks(input: ContentInput) {
  return {
    brandId: input.kind === "marca" ? (input.brandId ?? null) : null,
    category: input.kind === "categoria" ? (input.category ?? null) : null,
  };
}

export async function createContent(
  user: SessionUser,
  input: ContentInput,
  source = "manual",
): Promise<number> {
  const slug = await uniqueSlug(input.title);
  const excerpt = input.excerpt || excerptFromMarkdown(input.body);
  const publishing = input.status === "published";
  await db.insert(contentPages).values({
    slug,
    kind: input.kind,
    title: input.title,
    excerpt,
    body: input.body,
    ...scopeLinks(input),
    source,
    status: input.status,
    publishedAt: publishing ? new Date() : null,
    updatedBy: user.id,
  });
  const [row] = await db
    .select({ id: contentPages.id })
    .from(contentPages)
    .where(eq(contentPages.slug, slug))
    .limit(1);
  return row.id;
}

export async function updateContent(
  user: SessionUser,
  id: number,
  input: ContentInput,
): Promise<void> {
  const [current] = await db
    .select({ status: contentPages.status, publishedAt: contentPages.publishedAt })
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);
  if (!current) throw new Error("La página no existe.");

  const excerpt = input.excerpt || excerptFromMarkdown(input.body);
  const becomingPublished =
    input.status === "published" && current.publishedAt == null;

  await db
    .update(contentPages)
    .set({
      // slug is stable (inbound-link safe) — never recomputed on edit.
      kind: input.kind,
      title: input.title,
      excerpt,
      body: input.body,
      ...scopeLinks(input),
      status: input.status,
      publishedAt: becomingPublished ? new Date() : current.publishedAt,
      updatedBy: user.id,
    })
    .where(eq(contentPages.id, id));
}

export async function setContentStatus(
  user: SessionUser,
  id: number,
  status: "draft" | "published",
): Promise<void> {
  const [current] = await db
    .select({ publishedAt: contentPages.publishedAt })
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);
  if (!current) throw new Error("La página no existe.");
  const becomingPublished = status === "published" && current.publishedAt == null;
  await db
    .update(contentPages)
    .set({
      status,
      publishedAt: becomingPublished ? new Date() : current.publishedAt,
      updatedBy: user.id,
    })
    .where(eq(contentPages.id, id));
}

export async function deleteContent(id: number): Promise<void> {
  await db.delete(contentPages).where(eq(contentPages.id, id));
}

/** Upload/replace a guide hero image (re-encoded to WebP, long edge ≤1600). */
export async function setContentHero(
  user: SessionUser,
  id: number,
  file: File,
): Promise<void> {
  const [current] = await db
    .select({ slug: contentPages.slug })
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);
  if (!current) throw new Error("La página no existe.");
  assertUploadable(file, MAX_SINGLE_IMAGE_BYTES); // F10

  const sharp = (await import("sharp")).default;
  const webp = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const key = `content/${current.slug}/hero-${Date.now()}-${randomBytes(3).toString("hex")}.webp`;
  await uploadToR2(key, webp, "image/webp");
  await db
    .update(contentPages)
    .set({ heroR2Key: key, updatedBy: user.id })
    .where(eq(contentPages.id, id));
}

export async function removeContentHero(user: SessionUser, id: number): Promise<void> {
  await db
    .update(contentPages)
    .set({ heroR2Key: null, updatedBy: user.id })
    .where(eq(contentPages.id, id));
}
