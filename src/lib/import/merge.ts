/**
 * Field-level merge policy for re-imports (audit F3, Decisions Log 2026-08-19:
 * "import wins price/km/availability; admin wins description/photos/category;
 * first `published_at` always preserved").
 *
 * The old importer sent one `ON DUPLICATE KEY UPDATE` set containing every
 * column INCLUDING `status`/`published_at` derived from the `--publish` flag,
 * so a re-run without the flag unpublished the dealer's whole inventory and a
 * re-run with it re-stamped `published_at = now()` on rows that were published
 * months ago. Both are silent and both are visible to buyers.
 *
 * Pure module: no DB, no dates beyond what the caller passes in.
 */
import {
  canTransition,
  nextPublishedAt,
} from "@/lib/admin/listing-policy";
import type { ListingStatus } from "@/lib/admin/constants";

/**
 * Columns the dealer's system is authoritative for. Everything here is
 * overwritten on every run — that is the point of a nightly inventory feed.
 * `title` rides along because it is derived from brand+model+year; `slug` and
 * `public_id` never move (inbound links + SEO).
 */
export const IMPORT_OWNED_FIELDS = [
  "title",
  "brandId",
  "model",
  "year",
  "km",
  "condition",
  "priceUsd",
  "priceGs",
  "cuotaGs",
  "transmission",
  "fuel",
  "traction",
  "capacityKg",
  "locationId",
  "externalId",
] as const;

/**
 * Columns a human curated in /admin. An import must never undo that work:
 * `description` gets rewritten by the dealer's sales copy, `category` gets
 * re-guessed from a sloppy CSV column, photos get replaced by whatever the
 * sheet's `fotos` column happened to contain that day.
 */
export const ADMIN_OWNED_FIELDS = [
  "description",
  "category",
  "featured",
  "slug",
  "publicId",
  "status",
  "publishedAt",
] as const;

export type ImportOwnedField = (typeof IMPORT_OWNED_FIELDS)[number];

/** The subset of a listing row the merge cares about. */
export type MergeableListing = Record<string, unknown>;

export interface MergeResult {
  /** Only the fields that actually differ — an unchanged row writes nothing. */
  values: Record<string, unknown>;
  changed: ImportOwnedField[];
}

/** Decimal columns arrive as strings from MySQL; compare by value, not text. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  if (typeof a === "string" && typeof b === "string") {
    const na = Number(a);
    const nb = Number(b);
    if (a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
      return na === nb;
    }
  }
  return a === b;
}

/**
 * Merge an incoming CSV row onto an existing listing. Admin-owned fields in
 * `incoming` are ignored outright, so a caller can hand over the full "as if
 * created now" value object without having to remember the policy.
 */
export function mergeListing(
  existing: MergeableListing,
  incoming: MergeableListing,
): MergeResult {
  const values: Record<string, unknown> = {};
  const changed: ImportOwnedField[] = [];
  for (const field of IMPORT_OWNED_FIELDS) {
    if (!(field in incoming)) continue;
    const next = incoming[field];
    if (next === undefined) continue;
    if (sameValue(existing[field], next)) continue;
    values[field] = next;
    changed.push(field);
  }
  return { values, changed };
}

/* ------------------------------------------------------------------ */
/* Availability (the "import wins availability" half of the policy)    */
/* ------------------------------------------------------------------ */

export const AVAILABILITY_VALUES = ["disponible", "reservado", "vendido"] as const;
export type Availability = (typeof AVAILABILITY_VALUES)[number];

const AVAILABILITY_ALIASES: Record<string, Availability> = {
  disponible: "disponible",
  disponibles: "disponible",
  activo: "disponible",
  stock: "disponible",
  si: "disponible",
  reservado: "reservado",
  reserva: "reservado",
  pausado: "reservado",
  vendido: "vendido",
  vendida: "vendido",
  no: "vendido",
};

/** Parses the optional `estado`/`disponibilidad` column. Unknown → null. */
export function parseAvailability(raw: string | null | undefined): Availability | null {
  if (!raw) return null;
  const v = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return AVAILABILITY_ALIASES[v] ?? null;
}

export interface AvailabilityChange {
  status: ListingStatus;
  publishedAt: Date | null;
}

/**
 * Translate a CSV availability into a listing status — the ONLY thing that may
 * move `status`/`published_at` on an update (F3). Everything routes through
 * the F27 transition rules, so a sold truck coming back into stock lands in
 * `draft` (needs a human to re-publish, and gets an honest publish date)
 * rather than resurrecting with a year-old `published_at`.
 *
 * Returns null when nothing should change.
 */
export function resolveAvailability(
  current: ListingStatus,
  currentPublishedAt: Date | null,
  requested: Availability | null,
  now: Date,
): AvailabilityChange | null {
  if (!requested) return null;
  const target: ListingStatus =
    requested === "vendido" ? "sold" : requested === "reservado" ? "paused" : "published";
  if (target === current) return null;
  // "disponible" is only authority to UN-PAUSE. Publishing a draft, or bringing
  // a sold truck back onto the site, stays an admin decision — a CSV cell must
  // not be able to put a listing in front of buyers on its own (F3).
  if (target === "published" && current !== "paused") return null;
  if (!canTransition(current, target)) return null;
  return {
    status: target,
    publishedAt: nextPublishedAt(target, currentPublishedAt, now),
  };
}
