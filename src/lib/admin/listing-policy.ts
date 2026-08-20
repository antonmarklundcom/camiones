/**
 * F27 — listing lifecycle policy. Pure, client-safe (no "server-only", no DB)
 * so the admin UI can grey out illegal choices with exactly the rules the
 * server enforces. The server is still the authority: every mutation calls
 * assertStatusTransition() / resolveFeatured() regardless of what the form sent.
 */
import { can, type Role } from "@/lib/auth/roles";
import { LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/admin/constants";

/**
 * Legal next states per current state.
 *
 * The shape encodes two business rules:
 *  - `sold` and `removed` are terminal-ish end states. A sold truck must not go
 *    straight back to `published` carrying its year-old `published_at` (it
 *    would sort as fresh stock); it goes back through `draft`, which forces a
 *    re-publish and a fresh timestamp.
 *  - `draft` is the only way into `published`, other than un-pausing.
 */
export const ALLOWED_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["published", "removed"],
  published: ["paused", "sold", "removed", "draft"],
  paused: ["published", "draft", "sold", "removed"],
  sold: ["draft", "removed"],
  removed: ["draft"],
};

/** Same-state "transitions" are always fine — plain edits don't move status. */
export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStatusTransition(
  from: ListingStatus,
  to: ListingStatus,
): void {
  if (canTransition(from, to)) return;
  throw new Error(
    `Cambio de estado no permitido: ${LISTING_STATUS_LABELS[from]} → ` +
      `${LISTING_STATUS_LABELS[to]}. Pasá el aviso a Borrador primero.`,
  );
}

/** Statuses the UI should offer for a listing currently in `from`. */
export function selectableStatuses(from: ListingStatus): ListingStatus[] {
  return [from, ...ALLOWED_TRANSITIONS[from].filter((s) => s !== from)];
}

/**
 * `published_at` is the FIRST publish date and never moves — except when the
 * listing re-enters the funnel through `draft`, which clears it so the next
 * publish stamps a truthful "recién publicado" date (the audit's sold→published
 * complaint). Anything else preserves whatever is already there.
 */
export function nextPublishedAt(
  to: ListingStatus,
  current: Date | null,
  now: Date,
): Date | null {
  if (to === "draft") return null;
  if (to === "published" && current == null) return now;
  return current;
}

/**
 * `featured` is home-page placement and is monetised later (PLAN.md Decisions
 * Log: featured placement becomes a paid upsell), so dealers must never set it
 * on their own listings. Non-admins keep whatever an admin last chose.
 */
export function resolveFeatured(
  role: Role,
  requested: boolean,
  current: boolean,
): boolean {
  // Admin-only on purpose — `staff` moderate listings but do not hand out
  // home-page placement, which becomes a paid upsell.
  return can(role, "featureListing") ? requested : current;
}

/** UI helper: should the "Destacado" checkbox be rendered at all? */
export function canSetFeatured(role: Role): boolean {
  return can(role, "featureListing");
}
