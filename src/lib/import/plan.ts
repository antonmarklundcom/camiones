/**
 * The import planner (audit F12, propia lesson 4: ONE planner for dry-run and
 * commit). Everything that can go wrong with a CSV row — unknown brand, bad
 * year, anchorless publish, a merge that turns out to be a no-op — is decided
 * here, with zero writes and zero DB access. `scripts/import-csv.ts` calls
 * `planImport()` exactly once and then either prints the plan (`--dry-run`) or
 * hands the SAME plan to `commitImport()`. A dry run can therefore never
 * disagree with the commit that follows it, which is the drift bug propia paid
 * for once already.
 *
 * Pure ⇒ unit-testable: the tests feed it plain objects, no MySQL.
 */
import {
  CATEGORY_VALUES,
  CONDITION_VALUES,
  FUEL_VALUES,
  TRACTION_VALUES,
  TRANSMISSION_VALUES,
  type Category,
} from "@/db/schema";
import type { ListingStatus } from "@/lib/admin/constants";
import { bestCuota, type FinancingProgram } from "@/lib/cuota";
import { slugify } from "@/lib/slug";
import { categoryBySlug } from "@/lib/taxonomy";
import {
  ANCHORLESS_PUBLISH_REFUSAL,
  importIdentity,
  readAnchor,
  type Identity,
} from "@/lib/import/identity";
import {
  mergeListing,
  parseAvailability,
  resolveAvailability,
  type Availability,
  type ImportOwnedField,
} from "@/lib/import/merge";

export interface BrandRef {
  id: number;
  slug: string;
  name: string;
}
export interface CityRef {
  id: number;
  slug: string;
}

/** The columns of an existing listing the planner needs to diff against. */
export interface ExistingListing {
  id: number;
  publicId: string;
  status: ListingStatus;
  publishedAt: Date | null;
  imageCount: number;
  [field: string]: unknown;
}

export interface PlanInput {
  records: Record<string, string>[];
  sellerSlug: string;
  sellerId: number;
  publish: boolean;
  /** `--replace-photos`: opt in to overwriting admin-curated galleries. */
  replacePhotos: boolean;
  brands: Map<string, BrandRef>;
  cities: Map<string, CityRef>;
  /** Existing imported listings for this seller, keyed by import_key. */
  existing: Map<string, ExistingListing>;
  programs: FinancingProgram[];
  usdToPyg: number;
  now: Date;
}

export type PlanAction = "create" | "update" | "skip" | "error";

export interface PlannedRow {
  rowNo: number;
  action: PlanAction;
  /** Listing title — kept out of `values` because updates only carry a delta. */
  title: string;
  identity: Identity | null;
  listingId: number | null;
  /** Full insert payload (create) or the merged delta (update). */
  values: Record<string, unknown>;
  /** Pre-change snapshot for the journal's previous_json (update only). */
  previous: Record<string, unknown> | null;
  changed: ImportOwnedField[];
  availability: Availability | null;
  statusChange: { status: ListingStatus; publishedAt: Date | null } | null;
  photos: string[];
  applyPhotos: boolean;
  error: string | null;
}

export interface ImportPlan {
  anchored: boolean;
  /** Hard refusals — the run must abort before any write. */
  refusals: string[];
  rows: PlannedRow[];
  counts: Record<PlanAction, number>;
}

function parseCategory(raw: string): Category | null {
  const v = slugify(raw);
  if ((CATEGORY_VALUES as readonly string[]).includes(v)) return v as Category;
  return categoryBySlug(v)?.value ?? null;
}

function oneOf<T extends string>(raw: string, values: readonly T[], fallback: T): T {
  const v = slugify(raw) as T;
  return values.includes(v) ? v : fallback;
}

/** Accepts "105.000", "105,000" and "105000.50" — dealer sheets use all three. */
function parseNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return Number(cleaned);
}

export function planImport(input: PlanInput): ImportPlan {
  const rows: PlannedRow[] = [];
  let anchorless = 0;
  // Two rows in ONE sheet resolving to the same identity is a data problem in
  // the dealer's export (a copy-pasted plate, or two trucks that really are
  // indistinguishable without an anchor). Caught here so the CSV line number is
  // in the message, instead of surfacing later as a unique-index violation.
  const seenKeys = new Map<string, number>();

  for (const [i, rec] of input.records.entries()) {
    const rowNo = i + 2; // header is row 1
    const blank: PlannedRow = {
      rowNo,
      action: "error",
      title: "",
      identity: null,
      listingId: null,
      values: {},
      previous: null,
      changed: [],
      availability: null,
      statusChange: null,
      photos: [],
      applyPhotos: false,
      error: null,
    };

    try {
      const brand = input.brands.get(slugify(rec.marca ?? ""));
      if (!brand) throw new Error(`marca desconocida '${rec.marca ?? ""}'`);
      const city = input.cities.get(slugify(rec.ciudad ?? ""));
      if (!city) throw new Error(`ciudad desconocida '${rec.ciudad ?? ""}'`);
      const category = parseCategory(rec.categoria ?? "");
      if (!category) throw new Error(`categoria desconocida '${rec.categoria ?? ""}'`);

      const model = (rec.modelo ?? "").trim();
      if (!model) throw new Error("modelo vacío");
      const year = Number(rec.anio ?? rec["año"] ?? rec.ano);
      if (!Number.isInteger(year) || year < 1970 || year > 2035) {
        throw new Error(`año inválido '${rec.anio ?? ""}'`);
      }
      const kmRaw = parseNumber(rec.km);
      const km = Math.max(0, Math.round(Number.isFinite(kmRaw) ? kmRaw : 0));
      const priceUsd = parseNumber(rec.precio_usd);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        throw new Error(`precio_usd inválido '${rec.precio_usd ?? ""}'`);
      }
      const priceGsRaw = parseNumber(rec.precio_gs);
      const priceGs = Math.round(
        Number.isFinite(priceGsRaw) && priceGsRaw > 0 ? priceGsRaw : priceUsd * input.usdToPyg,
      );

      const identity = importIdentity({
        sellerSlug: input.sellerSlug,
        externalId: readAnchor(rec),
        brandSlug: brand.slug,
        model,
        year,
      });
      if (identity.anchor === "spec") anchorless++;
      const firstSeen = seenKeys.get(identity.key);
      if (firstSeen !== undefined) {
        throw new Error(
          identity.anchor === "external"
            ? `chapa/stock_id '${identity.externalId}' repetida (ya apareció en la fila ${firstSeen})`
            : `marca+modelo+año repetidos (ya aparecieron en la fila ${firstSeen}); ` +
              `agregá una columna chapa/stock_id para distinguirlos`,
        );
      }
      seenKeys.set(identity.key, rowNo);

      const cuota = bestCuota(priceGs, input.programs);
      const title = `${brand.name} ${model} ${year}`;
      const photos = (rec.fotos ?? "")
        .split("|")
        .map((k) => k.trim())
        .filter(Boolean);
      const availability = parseAvailability(rec.estado ?? rec.disponibilidad);

      // The "as if created now" payload. mergeListing() drops the admin-owned
      // half of it on updates, so the two paths share one construction.
      const incoming: Record<string, unknown> = {
        title,
        condition: oneOf(rec.condicion ?? "", CONDITION_VALUES, "usado"),
        category,
        brandId: brand.id,
        model,
        year,
        km,
        priceUsd: priceUsd.toFixed(2),
        priceGs: String(priceGs),
        cuotaGs: cuota ? String(cuota.monthlyGs) : null,
        transmission: oneOf(rec.transmision ?? "", TRANSMISSION_VALUES, "manual"),
        fuel: oneOf(rec.combustible ?? "", FUEL_VALUES, "diesel"),
        traction: oneOf(rec.traccion ?? "", TRACTION_VALUES, "4x2"),
        capacityKg:
          parseNumber(rec.capacidad_kg) > 0 ? Math.round(parseNumber(rec.capacidad_kg)) : null,
        description: (rec.descripcion ?? "").trim() || null,
        locationId: city.id,
        sellerId: input.sellerId,
        externalId: identity.externalId,
        importKey: identity.key,
      };

      const existing = input.existing.get(identity.key);
      if (!existing) {
        rows.push({
          ...blank,
          action: "create",
          title,
          identity,
          values: {
            ...incoming,
            // F3: a create is the ONLY place the importer sets publish state.
            status: input.publish ? "published" : "draft",
            publishedAt: input.publish ? input.now : null,
          },
          photos,
          applyPhotos: photos.length > 0,
          error: null,
        });
        continue;
      }

      const { values, changed } = mergeListing(existing, incoming);
      const statusChange = resolveAvailability(
        existing.status,
        existing.publishedAt,
        availability,
        input.now,
      );
      // Photos are admin-owned: only filled in when the gallery is still empty,
      // unless the operator explicitly asked to replace it.
      const applyPhotos =
        photos.length > 0 && (input.replacePhotos || existing.imageCount === 0);

      const noop = changed.length === 0 && !statusChange && !applyPhotos;
      rows.push({
        ...blank,
        action: noop ? "skip" : "update",
        title: String(existing.title ?? title),
        identity,
        listingId: existing.id,
        values,
        previous: noop ? null : snapshot(existing, changed, statusChange != null),
        changed,
        availability,
        statusChange,
        photos,
        applyPhotos,
        error: null,
      });
    } catch (e) {
      rows.push({
        ...blank,
        action: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const counts: Record<PlanAction, number> = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of rows) counts[r.action]++;

  const anchored = rows.length > 0 && anchorless === 0;
  const refusals: string[] = [];
  if (input.publish && !anchored) refusals.push(ANCHORLESS_PUBLISH_REFUSAL);

  return { anchored, refusals, rows, counts };
}

/** Only the columns this row is about to change — a diffable undo record. */
function snapshot(
  existing: ExistingListing,
  changed: readonly ImportOwnedField[],
  includeStatus: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { id: existing.id, publicId: existing.publicId };
  for (const f of changed) out[f] = existing[f] ?? null;
  if (includeStatus) {
    out.status = existing.status;
    out.publishedAt = existing.publishedAt ? existing.publishedAt.toISOString() : null;
  }
  return out;
}

/** Human summary shared by the dry-run and commit outputs (no drift). */
export function summarizePlan(plan: ImportPlan): string {
  const { counts } = plan;
  return (
    `  a crear:      ${counts.create}\n` +
    `  a actualizar: ${counts.update}\n` +
    `  sin cambios:  ${counts.skip}\n` +
    `  con error:    ${counts.error}`
  );
}
