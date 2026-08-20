/**
 * F24 — the /venta segment namespace.
 *
 * `/venta/[...segments]` resolves category → brand → city → condition against
 * ONE flat namespace, by precedence (src/lib/venta-params.ts). A brand called
 * "Asunción" or a city called "Buses" would therefore silently shadow the
 * facet that resolves earlier, changing what an existing URL means. Nothing at
 * write time prevented that; this module is the write-time check.
 *
 * Pure and dependency-light on purpose: the taxonomy/condition/reserved words
 * are known statically, and the caller supplies the DB-backed brand and city
 * slugs. Seeds and admin mutations both go through `assertSegmentAvailable`.
 */
import { CATEGORIES, CONDITION_SEGMENTS } from "@/lib/taxonomy";

export type SegmentKind = "category" | "brand" | "city" | "condition" | "reserved";

/**
 * Words that must never become a taxonomy slug because they are (or will be)
 * route segments or query semantics under /venta.
 */
export const RESERVED_SEGMENTS: readonly string[] = [
  "venta",
  "camion",
  "vendedor",
  "guias",
  "buscar",
  "admin",
  "api",
  "page",
  "todos",
  "todas",
];

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
const CONDITION_SLUGS = Object.keys(CONDITION_SEGMENTS);

export interface NamespaceInput {
  /** Existing brand slugs from the DB. */
  brandSlugs: readonly string[];
  /** Existing city slugs from the DB. */
  citySlugs: readonly string[];
}

/**
 * What (if anything) already owns `slug` in the /venta namespace, ignoring the
 * row being edited. `self` is the kind+slug of the row itself, so re-saving a
 * brand under its own slug is not a collision.
 */
export function segmentOwner(
  slug: string,
  ns: NamespaceInput,
  self?: { kind: SegmentKind; slug: string },
): SegmentKind | null {
  const s = slug.toLowerCase();
  const isSelf = (kind: SegmentKind) =>
    self !== undefined && self.kind === kind && self.slug.toLowerCase() === s;

  if (RESERVED_SEGMENTS.includes(s)) return "reserved";
  if (CATEGORY_SLUGS.includes(s)) return "category";
  if (CONDITION_SLUGS.includes(s)) return "condition";
  if (!isSelf("brand") && ns.brandSlugs.some((b) => b.toLowerCase() === s)) {
    return "brand";
  }
  if (!isSelf("city") && ns.citySlugs.some((c) => c.toLowerCase() === s)) {
    return "city";
  }
  return null;
}

const KIND_LABELS: Record<SegmentKind, string> = {
  category: "una categoría",
  brand: "una marca",
  city: "una ciudad",
  condition: "un estado (nuevos/usados)",
  reserved: "una palabra reservada del sitio",
};

/**
 * True when `slug` is free. `segmentOwner` already ignores the row itself, so
 * any owner it reports is a genuine collision.
 */
export function isSegmentAvailable(
  slug: string,
  ns: NamespaceInput,
  self?: { kind: SegmentKind; slug: string },
): boolean {
  return segmentOwner(slug, ns, self) === null;
}

/** Throwing form — call from every brand/location write path. */
export function assertSegmentAvailable(
  slug: string,
  ns: NamespaceInput,
  self?: { kind: SegmentKind; slug: string },
): void {
  const owner = segmentOwner(slug, ns, self);
  if (owner === null) return;
  throw new Error(
    `El slug "${slug}" ya está tomado por ${KIND_LABELS[owner]} en /venta. ` +
      `Elegí otro: los segmentos de /venta comparten un solo espacio de nombres.`,
  );
}
