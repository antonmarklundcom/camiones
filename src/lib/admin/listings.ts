import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  brands,
  financingPrograms,
  images,
  listings,
  CATEGORY_VALUES,
  CONDITION_VALUES,
  FUEL_VALUES,
  TRACTION_VALUES,
  TRANSMISSION_VALUES,
} from "@/db/schema";
import { slugify } from "@/lib/slug";
import { generatePublicId } from "@/lib/public-id";
import { bestCuota, type FinancingProgram } from "@/lib/cuota";
import type { SessionUser } from "@/lib/auth/session";
import { assertCanManageSeller, resolveOwningSeller } from "@/lib/auth/guard";

import {
  LISTING_STATUS_VALUES,
  type ListingStatus,
} from "@/lib/admin/constants";
import {
  assertStatusTransition,
  nextPublishedAt,
  resolveFeatured,
} from "@/lib/admin/listing-policy";

export {
  LISTING_STATUS_VALUES,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from "@/lib/admin/constants";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

/**
 * Shared input schema for create + edit. Numbers arrive as strings from
 * FormData; z.coerce handles that. Optional numerics must be pre-normalised to
 * undefined (empty string → 0 otherwise) — see listingInputFromForm().
 */
export const listingInputSchema = z.object({
  condition: z.enum(CONDITION_VALUES),
  category: z.enum(CATEGORY_VALUES),
  brandId: z.coerce.number().int().positive({ message: "Elegí una marca" }),
  model: z.string().trim().min(1, "Ingresá el modelo").max(120),
  year: z.coerce
    .number()
    .int()
    .min(1970, "Año inválido")
    .max(2035, "Año inválido"),
  km: z.coerce.number().int().min(0).default(0),
  priceUsd: z.coerce
    .number()
    .positive("Ingresá un precio en US$")
    .max(100_000_000),
  priceGs: z.coerce.number().int().nonnegative().optional(),
  transmission: z.enum(TRANSMISSION_VALUES),
  fuel: z.enum(FUEL_VALUES),
  traction: z.enum(TRACTION_VALUES),
  capacityKg: z.coerce.number().int().positive().optional(),
  description: z.string().trim().max(5000).optional(),
  locationId: z.coerce.number().int().positive({ message: "Elegí una ciudad" }),
  sellerId: z.coerce.number().int().positive().optional(),
  featured: z.boolean().default(false),
  status: z.enum(LISTING_STATUS_VALUES).default("draft"),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

/** Normalise a FormData into the shape the schema expects, then parse. */
export function parseListingForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : v;
  };
  return listingInputSchema.safeParse({
    condition: formData.get("condition"),
    category: formData.get("category"),
    brandId: formData.get("brandId"),
    model: formData.get("model"),
    year: formData.get("year"),
    km: num("km") ?? 0,
    priceUsd: formData.get("priceUsd"),
    priceGs: num("priceGs"),
    transmission: formData.get("transmission"),
    fuel: formData.get("fuel"),
    traction: formData.get("traction"),
    capacityKg: num("capacityKg"),
    description: formData.get("description") ?? undefined,
    locationId: formData.get("locationId"),
    sellerId: num("sellerId"),
    featured: formData.get("featured") === "on",
    status: formData.get("status") ?? "draft",
  });
}

async function loadPrograms(): Promise<FinancingProgram[]> {
  const rows = await db.select().from(financingPrograms);
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));
}

async function brandName(brandId: number): Promise<string> {
  const [b] = await db
    .select({ name: brands.name })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);
  if (!b) throw new Error("La marca elegida no existe.");
  return b.name;
}

/** Derived money + cuota fields shared by create and update. */
async function moneyFields(input: ListingInput) {
  const priceGs =
    input.priceGs && input.priceGs > 0
      ? input.priceGs
      : Math.round(input.priceUsd * USD_TO_PYG);
  const cuota = bestCuota(priceGs, await loadPrograms());
  return {
    priceUsd: input.priceUsd.toFixed(2),
    priceGs: String(priceGs),
    cuotaGs: cuota ? String(cuota.monthlyGs) : null,
  };
}

export async function createListing(
  user: SessionUser,
  input: ListingInput,
): Promise<number> {
  const sellerId = resolveOwningSeller(user, input.sellerId);
  const name = await brandName(input.brandId);
  const title = `${name} ${input.model} ${input.year}`;

  const publicId = await generatePublicId(async (candidate) => {
    const [row] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.publicId, candidate))
      .limit(1);
    return !!row;
  });
  const slug = `${slugify(title)}-${publicId.toLowerCase()}`;
  const money = await moneyFields(input);
  // F27: a brand-new listing can only be born as a draft or published — never
  // as sold/paused/removed, which are lifecycle states of an existing listing.
  const status: ListingStatus =
    input.status === "published" ? "published" : "draft";
  const publishing = status === "published";

  await db.insert(listings).values({
    publicId,
    slug,
    title,
    condition: input.condition,
    category: input.category,
    brandId: input.brandId,
    model: input.model,
    year: input.year,
    km: input.km,
    ...money,
    transmission: input.transmission,
    fuel: input.fuel,
    traction: input.traction,
    capacityKg: input.capacityKg,
    description: input.description || null,
    locationId: input.locationId,
    sellerId,
    // F27: dealers can't self-feature (paid placement, PLAN.md).
    featured: resolveFeatured(user.role, input.featured, false),
    status,
    publishedAt: publishing ? new Date() : null,
    updatedBy: user.id,
  });

  const [created] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.publicId, publicId))
    .limit(1);
  return created.id;
}

export async function updateListing(
  user: SessionUser,
  id: number,
  input: ListingInput,
): Promise<void> {
  // Fetch current row (scoped) to authorise and preserve slug/publicId.
  const [current] = await db
    .select({
      sellerId: listings.sellerId,
      status: listings.status,
      featured: listings.featured,
      publishedAt: listings.publishedAt,
    })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!current) throw new Error("El aviso no existe.");
  assertCanManageSeller(user, current.sellerId);
  assertStatusTransition(current.status, input.status);

  // Dealers can't reassign a listing to another seller; admins may.
  const sellerId =
    user.role === "admin" && input.sellerId ? input.sellerId : current.sellerId;

  const name = await brandName(input.brandId);
  const title = `${name} ${input.model} ${input.year}`;
  const money = await moneyFields(input);

  // Slug/publicId are stable (inbound-link safe) — never recomputed on edit.

  await db
    .update(listings)
    .set({
      title,
      condition: input.condition,
      category: input.category,
      brandId: input.brandId,
      model: input.model,
      year: input.year,
      km: input.km,
      ...money,
      transmission: input.transmission,
      fuel: input.fuel,
      traction: input.traction,
      capacityKg: input.capacityKg ?? null,
      description: input.description || null,
      locationId: input.locationId,
      sellerId,
      featured: resolveFeatured(user.role, input.featured, current.featured),
      status: input.status,
      publishedAt: nextPublishedAt(input.status, current.publishedAt, new Date()),
      updatedBy: user.id,
    })
    .where(eq(listings.id, id));
}

/** Publish/unpublish/etc. from the list view — one field + audit stamp. */
export async function setListingStatus(
  user: SessionUser,
  id: number,
  status: ListingStatus,
): Promise<void> {
  const [current] = await db
    .select({
      sellerId: listings.sellerId,
      status: listings.status,
      publishedAt: listings.publishedAt,
    })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!current) throw new Error("El aviso no existe.");
  assertCanManageSeller(user, current.sellerId);
  assertStatusTransition(current.status, status);

  await db
    .update(listings)
    .set({
      status,
      publishedAt: nextPublishedAt(status, current.publishedAt, new Date()),
      updatedBy: user.id,
    })
    .where(eq(listings.id, id));
}

export async function deleteListing(user: SessionUser, id: number): Promise<void> {
  const [current] = await db
    .select({ sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!current) return;
  assertCanManageSeller(user, current.sellerId);
  // Remove image rows first (no FK cascade in the schema). The R2 objects are
  // left in place — cheap, and avoids deleting a key another row might reuse.
  await db.delete(images).where(eq(images.listingId, id));
  await db.delete(listings).where(eq(listings.id, id));
}
