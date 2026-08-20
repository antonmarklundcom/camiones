/**
 * Client-safe admin constants — no "server-only", no DB imports, so form
 * components can import these without dragging the data layer into the client
 * bundle. The mutation logic in listings.ts / sellers.ts re-exports from here.
 */
export const LISTING_STATUS_VALUES = [
  "draft",
  "published",
  "paused",
  "sold",
  "removed",
] as const;
export type ListingStatus = (typeof LISTING_STATUS_VALUES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  paused: "Pausado",
  sold: "Vendido",
  removed: "Retirado",
};

/**
 * Legal status transitions (F27). Any→any used to be allowed, so a listing
 * could go sold → published and keep its year-old `published_at`, sorting as
 * fresh stock in "Últimos publicados". A sold truck must be re-drafted (which
 * is also the moment to fix price/km) before it can be published again.
 *
 * Client-safe: the edit form uses it to show only reachable options.
 */
export const LISTING_STATUS_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["draft", "published", "removed"],
  published: ["published", "paused", "sold", "removed"],
  paused: ["paused", "published", "draft", "sold", "removed"],
  sold: ["sold", "draft", "removed"],
  removed: ["removed", "draft"],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_STATUS_TRANSITIONS[from].includes(to);
}

export const SELLER_TYPE_LABELS = {
  dealer: "Concesionaria",
  particular: "Particular",
} as const;
