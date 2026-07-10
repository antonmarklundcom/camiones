import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { images, listings } from "@/db/schema";
import { uploadToR2 } from "@/lib/r2";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanManageSeller } from "@/lib/auth/guard";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per original upload
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

async function loadOwnedListing(user: SessionUser, listingId: number) {
  const [row] = await db
    .select({ id: listings.id, publicId: listings.publicId, sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row) throw new Error("El aviso no existe.");
  assertCanManageSeller(user, row.sellerId);
  return row;
}

/**
 * Re-encode to WebP (cap the long edge at 1600px, quality 80) before upload.
 * Photos off a dealer's phone are multi-MB; the public site targets a prepaid
 * data budget, so we shrink at ingest instead of shipping originals.
 */
async function toWebp(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function addListingImages(
  user: SessionUser,
  listingId: number,
  files: File[],
): Promise<number> {
  const listing = await loadOwnedListing(user, listingId);
  const valid = files.filter((f) => f && f.size > 0);
  if (!valid.length) return 0;

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${images.sortOrder}), -1) + 1` })
    .from(images)
    .where(eq(images.listingId, listingId));
  let sortOrder = Number(next);
  let added = 0;

  for (const file of valid) {
    if (file.size > MAX_BYTES) {
      throw new Error(`"${file.name}" supera el límite de 12 MB.`);
    }
    if (file.type && !ACCEPTED.includes(file.type)) {
      throw new Error(`"${file.name}" no es una imagen válida (JPG, PNG o WebP).`);
    }
    const original = Buffer.from(await file.arrayBuffer());
    const webp = await toWebp(original);
    const key = `listings/${listing.publicId}/${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
    await uploadToR2(key, webp, "image/webp");
    await db.insert(images).values({
      listingId,
      r2Key: key,
      sortOrder: sortOrder++,
      alt: null,
    });
    added++;
  }
  return added;
}

/** Persist a new cover/order. `orderedIds` is the full set for the listing. */
export async function reorderImages(
  user: SessionUser,
  listingId: number,
  orderedIds: number[],
): Promise<void> {
  await loadOwnedListing(user, listingId);
  // Only reorder rows that actually belong to this listing.
  const rows = await db
    .select({ id: images.id })
    .from(images)
    .where(eq(images.listingId, listingId));
  const owned = new Set(rows.map((r) => r.id));
  let sort = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await db
      .update(images)
      .set({ sortOrder: sort++ })
      .where(and(eq(images.id, id), eq(images.listingId, listingId)));
  }
}

export async function deleteImage(
  user: SessionUser,
  listingId: number,
  imageId: number,
): Promise<void> {
  await loadOwnedListing(user, listingId);
  await db
    .delete(images)
    .where(and(eq(images.id, imageId), eq(images.listingId, listingId)));
}
