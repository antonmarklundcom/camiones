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

export const SELLER_TYPE_LABELS = {
  dealer: "Concesionaria",
  particular: "Particular",
} as const;
