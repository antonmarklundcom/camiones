/**
 * The dealer-inventory CSV contract. Pure: it turns one parsed CSV record into
 * a validated `ParsedRow` (or an error message in es-PY) given the taxonomy
 * lookups. No DB, no I/O — `tests/import-*.test.ts` drives it directly.
 *
 * Column contract lives in data/ejemplo-inventario.csv; keep the two in sync.
 */
import {
  CATEGORY_VALUES,
  CONDITION_VALUES,
  FUEL_VALUES,
  TRACTION_VALUES,
  TRANSMISSION_VALUES,
  type Category,
  type Condition,
  type Fuel,
  type Traction,
  type Transmission,
} from "@/db/schema";
import type { ListingStatus } from "@/lib/admin/constants";
import { categoryBySlug } from "@/lib/taxonomy";
import { slugify } from "@/lib/slug";
import { normalizeExternalId } from "@/lib/import/identity";

/** Header aliases for the identity anchor (F2). First non-empty one wins. */
export const ANCHOR_COLUMNS = [
  "chapa",
  "stock_id",
  "id_stock",
  "codigo",
  "patente",
] as const;

/**
 * Optional availability column. Import owns availability (Decisions Log), so a
 * dealer marking a truck "vendido" in their sheet takes it off the grid.
 */
export const AVAILABILITY_COLUMNS = ["estado", "disponibilidad"] as const;

const AVAILABILITY_MAP: Record<string, ListingStatus> = {
  disponible: "published",
  activo: "published",
  publicado: "published",
  vendido: "sold",
  reservado: "paused",
  pausado: "paused",
  senado: "paused", // "señado" after slugify
  retirado: "removed",
  eliminado: "removed",
};

export interface BrandRef {
  id: number;
  slug: string;
  name: string;
}
export interface CityRef {
  id: number;
  slug: string;
}

export interface ImportLookups {
  brandBySlug: Map<string, BrandRef>;
  cityBySlug: Map<string, CityRef>;
}

export interface ParsedRow {
  rowNo: number;
  externalId: string | null;
  brand: BrandRef;
  city: CityRef;
  category: Category;
  condition: Condition;
  model: string;
  year: number;
  km: number;
  priceUsd: number;
  priceGs: number;
  transmission: Transmission;
  fuel: Fuel;
  traction: Traction;
  capacityKg: number | null;
  description: string | null;
  photos: string[];
  /** NULL when the CSV said nothing about availability — then status is left alone. */
  availability: ListingStatus | null;
}

export type ParseResult =
  | { ok: true; row: ParsedRow }
  | { ok: false; message: string };

function pick(rec: Record<string, string>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = (rec[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function oneOf<T extends string>(raw: string, values: readonly T[], fallback: T): T {
  const v = slugify(raw) as T;
  return values.includes(v) ? v : fallback;
}

function parseCategory(raw: string): Category | null {
  const v = slugify(raw);
  if ((CATEGORY_VALUES as readonly string[]).includes(v)) return v as Category;
  return categoryBySlug(v)?.value ?? null;
}

/**
 * Numbers arrive in whatever the dealer's spreadsheet exported: "105.000",
 * "105,000", "US$ 105000". Strip everything but digits; a decimal part on a
 * truck price is noise, so we deliberately do not try to honour it.
 */
function parseAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : NaN;
}

export function parseRow(
  rec: Record<string, string>,
  rowNo: number,
  lookups: ImportLookups,
  opts: { usdToPyg: number },
): ParseResult {
  const fail = (message: string): ParseResult => ({ ok: false, message });

  const brand = lookups.brandBySlug.get(slugify(rec.marca ?? ""));
  if (!brand) return fail(`marca desconocida '${rec.marca ?? ""}'`);

  const city = lookups.cityBySlug.get(slugify(rec.ciudad ?? ""));
  if (!city) return fail(`ciudad desconocida '${rec.ciudad ?? ""}'`);

  const category = parseCategory(rec.categoria ?? "");
  if (!category) return fail(`categoría desconocida '${rec.categoria ?? ""}'`);

  const model = (rec.modelo ?? "").trim();
  if (!model) return fail("modelo vacío");

  const year = Number(rec.anio ?? rec["año"] ?? rec.ano);
  if (!Number.isInteger(year) || year < 1970 || year > 2035) {
    return fail(`año inválido '${rec.anio ?? rec["año"] ?? ""}'`);
  }

  const priceUsd = parseAmount(rec.precio_usd ?? "");
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return fail(`precio_usd inválido '${rec.precio_usd ?? ""}'`);
  }

  const kmRaw = (rec.km ?? "").trim();
  const km = kmRaw ? parseAmount(kmRaw) : 0;
  if (!Number.isFinite(km) || km < 0) return fail(`km inválido '${kmRaw}'`);

  const priceGsRaw = parseAmount(rec.precio_gs ?? "");
  const priceGs =
    Number.isFinite(priceGsRaw) && priceGsRaw > 0
      ? Math.round(priceGsRaw)
      : Math.round(priceUsd * opts.usdToPyg);

  const capacityRaw = parseAmount(rec.capacidad_kg ?? "");
  const capacityKg =
    Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.round(capacityRaw) : null;

  const availabilityRaw = pick(rec, AVAILABILITY_COLUMNS);
  let availability: ListingStatus | null = null;
  if (availabilityRaw) {
    const mapped = AVAILABILITY_MAP[slugify(availabilityRaw)];
    if (!mapped) return fail(`estado desconocido '${availabilityRaw}'`);
    availability = mapped;
  }

  return {
    ok: true,
    row: {
      rowNo,
      externalId: normalizeExternalId(pick(rec, ANCHOR_COLUMNS)),
      brand,
      city,
      category,
      condition: oneOf(rec.condicion ?? "", CONDITION_VALUES, "usado"),
      model,
      year,
      km: Math.round(km),
      priceUsd,
      priceGs,
      transmission: oneOf(rec.transmision ?? "", TRANSMISSION_VALUES, "manual"),
      fuel: oneOf(rec.combustible ?? "", FUEL_VALUES, "diesel"),
      traction: oneOf(rec.traccion ?? "", TRACTION_VALUES, "4x2"),
      capacityKg,
      description: (rec.descripcion ?? "").trim() || null,
      photos: (rec.fotos ?? "")
        .split("|")
        .map((k) => k.trim())
        .filter(Boolean),
      availability,
    },
  };
}
