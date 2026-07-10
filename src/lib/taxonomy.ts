/**
 * Category / condition / spec taxonomy — single source of truth shared by the
 * URL resolver, filter bar, H1 builder and JSON-LD. DB enum values live in
 * src/db/schema.ts; this file maps them to URL segments and es-PY labels.
 */
import type {
  Category,
  Condition,
  Fuel,
  Traction,
  Transmission,
} from "@/db/schema";

export interface CategoryDef {
  value: Category;
  /** URL segment, plural: /venta/camiones */
  slug: string;
  plural: string;
  singular: string;
  /** Grammatical gender for condition agreement (camionetas usadAs). */
  gender: "m" | "f";
  tileDesc: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    value: "camion",
    slug: "camiones",
    plural: "Camiones",
    singular: "Camión rígido",
    gender: "m",
    tileDesc: "Rígidos con caja, chasis y carrocería",
  },
  {
    value: "tractocamion",
    slug: "tractocamiones",
    plural: "Tractocamiones",
    singular: "Tractocamión",
    gender: "m",
    tileDesc: "Cabezas tractoras para semirremolque",
  },
  {
    value: "furgon",
    slug: "furgones",
    plural: "Furgones",
    singular: "Furgón",
    gender: "m",
    tileDesc: "Furgones de reparto y carga seca",
  },
  {
    value: "volquete",
    slug: "volquetes",
    plural: "Volquetes",
    singular: "Volquete",
    gender: "m",
    tileDesc: "Tumbas para obra y minería",
  },
  {
    value: "frigorifico",
    slug: "frigorificos",
    plural: "Frigoríficos",
    singular: "Frigorífico",
    gender: "m",
    tileDesc: "Cadena de frío para alimentos",
  },
  {
    value: "camioneta",
    slug: "camionetas",
    plural: "Camionetas de trabajo",
    singular: "Camioneta de trabajo",
    gender: "f",
    tileDesc: "Utilitarios livianos para reparto",
  },
  {
    value: "bus",
    slug: "buses",
    plural: "Buses",
    singular: "Bus",
    gender: "m",
    tileDesc: "Transporte de pasajeros y personal",
  },
];

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
const byValue = new Map(CATEGORIES.map((c) => [c.value, c]));

export function categoryBySlug(slug: string): CategoryDef | undefined {
  return bySlug.get(slug);
}
export function categoryByValue(value: Category): CategoryDef {
  return byValue.get(value)!;
}

/** URL segment → DB value: /venta/.../usados */
export const CONDITION_SEGMENTS: Record<string, Condition> = {
  nuevos: "nuevo",
  usados: "usado",
};
export function conditionSegment(c: Condition): string {
  return c === "nuevo" ? "nuevos" : "usados";
}
/** Adjective with gender/number agreement: usados / usadas / nuevos / nuevas. */
export function conditionAdj(c: Condition, gender: "m" | "f"): string {
  const stem = c === "nuevo" ? "nuev" : "usad";
  return `${stem}${gender === "f" ? "a" : "o"}s`;
}
export function conditionLabel(c: Condition): string {
  return c === "nuevo" ? "Nuevo" : "Usado";
}

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: "Manual",
  automatica: "Automática",
  automatizada: "Automatizada",
};

export const FUEL_LABELS: Record<Fuel, string> = {
  diesel: "Diésel",
  nafta: "Nafta",
  electrico: "Eléctrico",
  hibrido: "Híbrido",
};

/** Traction values read fine as-is (4x2, 6x4, …). */
export function tractionLabel(t: Traction): string {
  return t;
}
