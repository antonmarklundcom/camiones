/**
 * Canonical URL + H1 building for the faceted /venta pages.
 * Segment order is fixed (PLAN.md): category → brand → city → condition.
 */
import type { Condition } from "@/db/schema";
import {
  conditionAdj,
  conditionSegment,
  type CategoryDef,
} from "@/lib/taxonomy";

export interface VentaSelection {
  category?: CategoryDef;
  brand?: { name: string; slug: string };
  city?: { name: string; slug: string };
  condition?: Condition;
}

export function ventaPath(sel: VentaSelection): string {
  const segs: string[] = [];
  if (sel.category) segs.push(sel.category.slug);
  if (sel.brand) segs.push(sel.brand.slug);
  if (sel.city) segs.push(sel.city.slug);
  if (sel.condition) segs.push(conditionSegment(sel.condition));
  return segs.length ? `/venta/${segs.join("/")}` : "/venta";
}

/** H1 pattern: "Camiones Scania usados en Asunción". */
export function ventaH1(sel: VentaSelection): string {
  const gender = sel.category?.gender ?? "m";
  const parts: string[] = [sel.category?.plural ?? "Camiones y vehículos de trabajo"];
  if (sel.brand) parts.push(sel.brand.name);
  if (sel.condition) parts.push(conditionAdj(sel.condition, gender));
  parts.push(sel.city ? `en ${sel.city.name}` : "en Paraguay");
  return parts.join(" ");
}

export function listingPath(slug: string): string {
  return `/camion/${slug}`;
}

/**
 * I8 — the tracked WhatsApp hop. Every listing CTA points here instead of
 * straight at wa.me, so the click is logged before the redirect. Uses the
 * publicId (stable, short, already in the slug) rather than the numeric id.
 */
export function waTrackPath(publicId: string): string {
  return `/wa/${publicId}`;
}

export function sellerPath(slug: string): string {
  return `/vendedor/${slug}`;
}

export function guidePath(slug: string): string {
  return `/guias/${slug}`;
}

/** Canonical origin — host comes from env so staging never leaks into SEO. */
export function siteOrigin(): string {
  return `https://${process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "camiones.com.py"}`;
}

export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path}`;
}
