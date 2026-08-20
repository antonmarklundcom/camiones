/**
 * /venta segment namespace (F24).
 *
 * Categories, brands, cities and conditions all live in ONE URL segment space
 * resolved by precedence (see venta-params.ts). Nothing at write time stopped a
 * brand and a city sharing a slug — the loser just becomes unreachable, and the
 * template multiplies the taxonomies that can collide. This module is the
 * single place that answers "is this segment already taken?".
 *
 * Pure: callers pass the existing slugs, so seeds, scripts and admin actions
 * can all reuse it without importing the data layer.
 */
import { CATEGORIES, CONDITION_SEGMENTS } from "@/lib/taxonomy";

export type SegmentKind = "categoria" | "marca" | "ciudad" | "condicion" | "reservada";

/** Route words that must never be shadowed by a taxonomy slug. */
export const RESERVED_SEGMENTS = ["venta", "camion", "vendedor", "guias", "buscar", "admin"];

const KIND_LABELS: Record<SegmentKind, string> = {
  categoria: "una categoría",
  marca: "una marca",
  ciudad: "una ciudad",
  condicion: "un filtro de condición",
  reservada: "una ruta reservada",
};

/** Slugs the engine itself owns — fixed, independent of DB contents. */
export function builtInSegments(): Map<string, SegmentKind> {
  const m = new Map<string, SegmentKind>();
  for (const w of RESERVED_SEGMENTS) m.set(w, "reservada");
  for (const c of CATEGORIES) m.set(c.slug, "categoria");
  for (const seg of Object.keys(CONDITION_SEGMENTS)) m.set(seg, "condicion");
  return m;
}

export interface TakenSegment {
  slug: string;
  kind: SegmentKind;
}

/**
 * The conflicting owner of `slug`, or null when it's free. `self` lets an edit
 * keep its own slug (a row is never a conflict with itself).
 */
export function segmentConflict(
  slug: string,
  taken: TakenSegment[],
  self?: TakenSegment,
): TakenSegment | null {
  const builtIn = builtInSegments().get(slug);
  if (builtIn && !(self && self.kind === builtIn)) {
    return { slug, kind: builtIn };
  }
  for (const t of taken) {
    if (t.slug !== slug) continue;
    if (self && t.kind === self.kind && t.slug === self.slug) continue;
    return t;
  }
  return null;
}

/** es-PY message for the admin/seed error path. */
export function conflictMessage(conflict: TakenSegment): string {
  return `El slug "${conflict.slug}" ya lo usa ${KIND_LABELS[conflict.kind]} — elegí otro para que la URL /venta/${conflict.slug} no quede ambigua.`;
}

/** Throwing wrapper for write paths. */
export function assertSegmentAvailable(
  slug: string,
  taken: TakenSegment[],
  self?: TakenSegment,
): void {
  const conflict = segmentConflict(slug, taken, self);
  if (conflict) throw new Error(conflictMessage(conflict));
}
