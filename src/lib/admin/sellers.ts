import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellers } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { uploadToR2 } from "@/lib/r2";
import { assertUploadable, MAX_SINGLE_IMAGE_BYTES } from "@/lib/admin/uploads";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanManageSeller } from "@/lib/auth/guard";

export { SELLER_TYPE_LABELS } from "@/lib/admin/constants";

/** Phone numbers: digits only with country code (595…) for wa.me links. */
const phoneWhatsapp = z
  .string()
  .trim()
  .regex(/^\d{8,15}$/, "Solo dígitos con código de país (ej. 595981123456)")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const sellerInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre").max(160),
  type: z.enum(["dealer", "particular"]).default("dealer"),
  phoneWhatsapp,
  phoneDisplay: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(190)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().max(255).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["draft", "published"]).default("published"),
});

export type SellerInput = z.infer<typeof sellerInputSchema>;

export function parseSellerForm(formData: FormData) {
  const val = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : v;
  };
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : v;
  };
  return sellerInputSchema.safeParse({
    name: val("name"),
    type: val("type") ?? "dealer",
    phoneWhatsapp: val("phoneWhatsapp") ?? "",
    phoneDisplay: val("phoneDisplay"),
    email: val("email") ?? "",
    address: val("address"),
    locationId: num("locationId"),
    description: val("description"),
    status: val("status") ?? "published",
  });
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "vendedor";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const [row] = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.slug, slug))
      .limit(1);
    if (!row) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

/** Admins only (dealers don't create sellers). Returns the new id. */
export async function createSeller(input: SellerInput): Promise<number> {
  const slug = await uniqueSlug(input.name);
  const publishing = input.status === "published";
  await db.insert(sellers).values({
    name: input.name,
    slug,
    type: input.type,
    phoneWhatsapp: input.phoneWhatsapp ?? null,
    phoneDisplay: input.phoneDisplay || null,
    email: input.email ?? null,
    address: input.address || null,
    locationId: input.locationId,
    description: input.description || null,
    status: input.status,
    publishedAt: publishing ? new Date() : null,
  });
  const [row] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.slug, slug))
    .limit(1);
  return row.id;
}

export async function updateSeller(
  user: SessionUser,
  id: number,
  input: SellerInput,
): Promise<void> {
  assertCanManageSeller(user, id);
  const [current] = await db
    .select({ status: sellers.status, publishedAt: sellers.publishedAt })
    .from(sellers)
    .where(eq(sellers.id, id))
    .limit(1);
  if (!current) throw new Error("La concesionaria no existe.");

  // Dealers can't change their own publication status (that's an admin lever).
  const status = user.role === "admin" ? input.status : current.status;
  const becomingPublished =
    status === "published" && current.publishedAt == null;

  await db
    .update(sellers)
    .set({
      name: input.name,
      // slug is stable (inbound-link safe) — never recomputed on edit.
      type: input.type,
      phoneWhatsapp: input.phoneWhatsapp ?? null,
      phoneDisplay: input.phoneDisplay || null,
      email: input.email ?? null,
      address: input.address || null,
      locationId: input.locationId ?? null,
      description: input.description || null,
      status,
      publishedAt: becomingPublished ? new Date() : current.publishedAt,
    })
    .where(eq(sellers.id, id));
}

/** Guard for deletion: a seller with any user or listing attached stays put. */
export async function sellerHasDependents(id: number): Promise<boolean> {
  const { listings, users } = await import("@/db/schema");
  const [l] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.sellerId, id))
    .limit(1);
  if (l) return true;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.sellerId, id))
    .limit(1);
  return !!u;
}

export async function deleteSeller(id: number): Promise<void> {
  if (await sellerHasDependents(id)) {
    throw new Error(
      "No se puede borrar: la concesionaria tiene avisos o usuarios asociados.",
    );
  }
  await db.delete(sellers).where(eq(sellers.id, id));
}

/** Upload/replace a seller logo (re-encoded to WebP, long edge ≤600 — logos
 * render small, no need for the 1600px budget used on listing/guide photos). */
export async function setSellerLogo(
  user: SessionUser,
  id: number,
  file: File,
): Promise<void> {
  assertCanManageSeller(user, id);
  const [current] = await db
    .select({ slug: sellers.slug })
    .from(sellers)
    .where(eq(sellers.id, id))
    .limit(1);
  if (!current) throw new Error("La concesionaria no existe.");
  assertUploadable(file, MAX_SINGLE_IMAGE_BYTES); // F10

  const sharp = (await import("sharp")).default;
  const webp = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const key = `sellers/${current.slug}/logo-${Date.now()}-${randomBytes(3).toString("hex")}.webp`;
  await uploadToR2(key, webp, "image/webp");
  await db.update(sellers).set({ logoR2Key: key }).where(eq(sellers.id, id));
}

export async function removeSellerLogo(user: SessionUser, id: number): Promise<void> {
  assertCanManageSeller(user, id);
  await db.update(sellers).set({ logoR2Key: null }).where(eq(sellers.id, id));
}
