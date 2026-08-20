/**
 * F3 — field-level merge policy, straight from PLAN.md's Decisions Log:
 *
 *   "import wins price/km/availability; admin wins description/photos/category;
 *    first `published_at` always preserved."
 *
 * The one judgement call this file makes is *when* "admin wins" applies.
 * `listings.updated_by` is NULL for every script/import write and non-NULL the
 * moment a human saves the row in /admin, so it is an exact "a person has
 * curated this listing" signal. Before anyone touches a row, the CSV is the
 * only source of truth and refreshes everything; afterwards the admin-owned
 * fields are frozen against the importer.
 *
 * Everything here is pure so `tests/import-merge.test.ts` can assert the policy
 * without a database.
 */
import type { Category } from "@/db/schema";

/** Fields the importer always owns — a re-import refreshes them unconditionally. */
export const IMPORT_OWNED_FIELDS = [
  "title",
  "condition",
  "brandId",
  "model",
  "year",
  "km",
  "priceUsd",
  "priceGs",
  "transmission",
  "fuel",
  "traction",
  "capacityKg",
  "locationId",
  "externalId",
] as const;

/** Fields a human curates in /admin — frozen once `updated_by` is set. */
export const ADMIN_OWNED_FIELDS = ["category", "description"] as const;

export interface ExistingListing {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  condition: string;
  category: Category;
  brandId: number;
  model: string;
  year: number;
  km: number;
  priceUsd: string;
  priceGs: string;
  transmission: string;
  fuel: string;
  traction: string;
  capacityKg: number | null;
  description: string | null;
  locationId: number;
  sellerId: number;
  externalId: string | null;
  status: string;
  publishedAt: Date | null;
  /** NULL = never edited by a human; non-NULL = admin-curated (see above). */
  updatedBy: number | null;
}

/** True when a person has saved this listing in /admin at least once. */
export function isAdminCurated(existing: Pick<ExistingListing, "updatedBy">): boolean {
  return existing.updatedBy != null;
}

/**
 * Photos are admin-owned: a dealer's `fotos` column may not overwrite images an
 * admin has uploaded, sorted or cropped. They are also only ever replaced when
 * the CSV actually carries photos — an empty column means "no opinion", never
 * "delete the gallery".
 */
export function shouldReplacePhotos(
  existing: Pick<ExistingListing, "updatedBy"> | null,
  csvPhotos: string[],
): boolean {
  if (csvPhotos.length === 0) return false;
  if (existing === null) return true;
  return !isAdminCurated(existing);
}

export type FieldValues = Record<string, unknown>;

export interface MergeResult {
  /** Only the columns that actually differ — an unchanged row writes nothing. */
  values: FieldValues;
  changed: string[];
}

/**
 * Merge the importer's candidate values onto an existing row.
 *
 * `candidate` must contain every import- and admin-owned field; anything not
 * listed in either set (publicId, slug, featured, createdAt, status,
 * publishedAt, sellerId, importKey) is deliberately unreachable from here.
 */
export function mergeExisting(
  existing: ExistingListing,
  candidate: FieldValues,
): MergeResult {
  const curated = isAdminCurated(existing);
  const values: FieldValues = {};
  const changed: string[] = [];

  const consider = (field: string) => {
    if (!(field in candidate)) return;
    const next = candidate[field];
    const prev = (existing as unknown as FieldValues)[field];
    if (sameValue(prev, next)) return;
    values[field] = next;
    changed.push(field);
  };

  for (const f of IMPORT_OWNED_FIELDS) consider(f);
  if (!curated) for (const f of ADMIN_OWNED_FIELDS) consider(f);

  return { values, changed };
}

/**
 * Decimal columns come back from MySQL as strings ("105000.00"), so a naive
 * !== would report a change on every single run and rewrite the whole table.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  if (typeof a === "string" && typeof b === "string") {
    const na = Number(a);
    const nb = Number(b);
    if (a.trim() !== "" && b.trim() !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
      return na === nb;
    }
  }
  return false;
}
