/**
 * F12 — the shared plan/commit path.
 *
 * `buildPlan()` is pure: given the CSV records, the taxonomy lookups and the
 * listings that already carry each import key, it decides EXACTLY what the run
 * would do. `--dry-run` and a real run call this same function with the same
 * inputs and get the same plan; the only difference is whether
 * `commitPlan()` (src/lib/import/run.ts) is allowed to write. That is what
 * makes the dry run trustworthy — it is not a second, drifting code path.
 *
 * The plan also carries `blockers`: reasons the whole run must be refused
 * before a single row is touched (publishing without an identity anchor,
 * a seller that does not exist).
 */
import { canTransition, nextPublishedAt } from "@/lib/admin/listing-policy";
import type { ListingStatus } from "@/lib/admin/constants";
import { bestCuota, type FinancingProgram } from "@/lib/cuota";
import { deriveIdentity } from "@/lib/import/identity";
import { parseRow, type ImportLookups, type ParsedRow } from "@/lib/import/contract";
import {
  mergeExisting,
  shouldReplacePhotos,
  type ExistingListing,
  type FieldValues,
} from "@/lib/import/merge";

export interface PlannedRow {
  rowNo: number;
  action: "create" | "update" | "skip" | "error";
  message: string | null;
  importKey: string | null;
  externalId: string | null;
  anchored: boolean;
  listingId: number | null;
  /** Columns to write. On create this is the full row MINUS publicId/slug,
   *  which commitPlan() assigns (F28: derived independently of the key). */
  values: FieldValues;
  changed: string[];
  /** NULL = leave the gallery alone. An array = replace it with exactly these keys. */
  photos: string[] | null;
  title: string;
  previous: ExistingListing | null;
}

export interface ImportPlan {
  sellerSlug: string;
  anchored: boolean;
  blockers: string[];
  rows: PlannedRow[];
  counts: { total: number; create: number; update: number; skip: number; error: number };
}

export interface PlanInput {
  records: Record<string, string>[];
  lookups: ImportLookups;
  existingByKey: Map<string, ExistingListing>;
  sellerSlug: string;
  sellerId: number | null;
  sellerExists: boolean;
  programs: FinancingProgram[];
  usdToPyg: number;
  publish: boolean;
  createSeller: boolean;
  now: Date;
}

export function buildPlan(input: PlanInput): ImportPlan {
  const rows: PlannedRow[] = [];
  const seenKeys = new Map<string, number>(); // importKey → first CSV row that used it
  let anchorless = 0;

  for (const [i, rec] of input.records.entries()) {
    const rowNo = i + 2; // header is line 1
    const parsed = parseRow(rec, rowNo, input.lookups, { usdToPyg: input.usdToPyg });

    if (!parsed.ok) {
      rows.push(errorRow(rowNo, parsed.message));
      continue;
    }
    const row = parsed.row;
    const identity = deriveIdentity({
      sellerSlug: input.sellerSlug,
      externalId: row.externalId,
      brandSlug: row.brand.slug,
      model: row.model,
      year: row.year,
    });
    if (!identity.anchored) anchorless++;

    const firstUse = seenKeys.get(identity.importKey);
    if (firstUse !== undefined) {
      rows.push(
        errorRow(
          rowNo,
          identity.anchored
            ? `chapa/stock_id '${identity.externalId}' repetida (ya usada en la fila ${firstUse})`
            : `sin chapa/stock_id, colisiona con la fila ${firstUse} ` +
                `(misma marca/modelo/año). Agregá una columna chapa o stock_id.`,
        ),
      );
      continue;
    }
    seenKeys.set(identity.importKey, rowNo);

    rows.push(
      planOne(row, identity.importKey, identity.anchored, identity.externalId, input),
    );
  }

  const anchored = anchorless === 0 && rows.length > 0;
  const blockers: string[] = [];

  if (!input.sellerExists && !input.createSeller) {
    blockers.push(
      `El vendedor '${input.sellerSlug}' no existe. Creá el vendedor en /admin/sellers ` +
        `(con su teléfono y ciudad) o volvé a correr con --create-seller si de verdad ` +
        `querés que el import lo cree como borrador. Un slug mal tipeado NO puede ` +
        `inventar un vendedor publicado.`,
    );
  }
  if (input.publish && !anchored) {
    blockers.push(
      `--publish rechazado: ${anchorless} de ${rows.length} filas no traen chapa ni ` +
        `stock_id. Sin ese ancla la identidad del aviso se arma con marca/modelo/año, ` +
        `así que dos camiones iguales del mismo vendedor se pisan entre sí y no ` +
        `podemos publicar a ciegas. Pedile al concesionario una columna 'chapa' o ` +
        `'stock_id', o corré sin --publish y revisá los borradores en /admin.`,
    );
  }

  return {
    sellerSlug: input.sellerSlug,
    anchored,
    blockers,
    rows,
    counts: {
      total: rows.length,
      create: rows.filter((r) => r.action === "create").length,
      update: rows.filter((r) => r.action === "update").length,
      skip: rows.filter((r) => r.action === "skip").length,
      error: rows.filter((r) => r.action === "error").length,
    },
  };
}

function errorRow(rowNo: number, message: string): PlannedRow {
  return {
    rowNo,
    action: "error",
    message,
    importKey: null,
    externalId: null,
    anchored: false,
    listingId: null,
    values: {},
    changed: [],
    photos: null,
    title: "",
    previous: null,
  };
}

function planOne(
  row: ParsedRow,
  importKey: string,
  anchored: boolean,
  externalId: string | null,
  input: PlanInput,
): PlannedRow {
  const title = `${row.brand.name} ${row.model} ${row.year}`.slice(0, 180);
  const cuota = bestCuota(row.priceGs, input.programs);
  const cuotaGs = cuota ? String(cuota.monthlyGs) : null;

  const candidate: FieldValues = {
    title,
    condition: row.condition,
    category: row.category,
    brandId: row.brand.id,
    model: row.model,
    year: row.year,
    km: row.km,
    priceUsd: row.priceUsd.toFixed(2),
    priceGs: String(row.priceGs),
    transmission: row.transmission,
    fuel: row.fuel,
    traction: row.traction,
    capacityKg: row.capacityKg,
    description: row.description,
    locationId: row.city.id,
    externalId,
  };

  const existing = input.existingByKey.get(importKey) ?? null;

  // The import key is seller-scoped, but an admin can have reassigned the
  // listing since the last run. Refuse rather than yank someone else's truck
  // into this dealer's inventory.
  if (existing && input.sellerId != null && existing.sellerId !== input.sellerId) {
    return errorRow(
      row.rowNo,
      `el aviso '${existing.publicId}' con esa identidad pertenece a otro vendedor ` +
        `(seller_id ${existing.sellerId}); revisalo en /admin antes de reimportar`,
    );
  }

  /* ---------------------------------------------------------------- create */
  if (!existing) {
    // F3: on CREATE the run's intent is explicit, so --publish (or the CSV's
    // own availability column) decides the initial state.
    const status: ListingStatus = row.availability ?? (input.publish ? "published" : "draft");
    return {
      rowNo: row.rowNo,
      action: "create",
      message: null,
      importKey,
      externalId,
      anchored,
      listingId: null,
      values: {
        ...candidate,
        cuotaGs,
        sellerId: input.sellerId,
        importKey,
        status,
        publishedAt: status === "published" ? input.now : null,
      },
      changed: ["*"],
      photos: shouldReplacePhotos(null, row.photos) ? row.photos : null,
      title,
      previous: null,
    };
  }

  /* ---------------------------------------------------------------- update */
  const merged = mergeExisting(existing, candidate);
  const values: FieldValues = { ...merged.values };
  const changed = [...merged.changed];
  const notes: string[] = [];

  // Cuota is derived, not imported: refresh it only when the ₲ price moved.
  if (changed.includes("priceGs")) {
    values.cuotaGs = cuotaGs;
    changed.push("cuotaGs");
  }

  // F3 — status/publishedAt are untouched unless the CSV explicitly states an
  // availability, and the FIRST published_at is never re-stamped.
  const current = existing.status as ListingStatus;
  const target = row.availability;
  if (target && target !== current) {
    if (canTransition(current, target)) {
      values.status = target;
      const nextAt = nextPublishedAt(target, existing.publishedAt, input.now);
      if (!sameDate(nextAt, existing.publishedAt)) values.publishedAt = nextAt;
      changed.push("status");
    } else {
      // sold/removed → disponible. F27 routes that back through `draft` so the
      // truck re-publishes with an honest date instead of sorting as old stock.
      values.status = "draft";
      values.publishedAt = null;
      changed.push("status");
      notes.push(
        `volvió a estar disponible: queda en Borrador para que lo revises en /admin`,
      );
    }
  }

  const photos = shouldReplacePhotos(existing, row.photos) ? row.photos : null;
  if (photos) changed.push("fotos");
  else if (row.photos.length && existing.updatedBy != null) {
    notes.push("fotos ignoradas: el aviso ya fue editado en /admin");
  }

  if (!changed.length) {
    return {
      rowNo: row.rowNo,
      action: "skip",
      message: "sin cambios",
      importKey,
      externalId,
      anchored,
      listingId: existing.id,
      values: {},
      changed: [],
      photos: null,
      title,
      previous: existing,
    };
  }

  return {
    rowNo: row.rowNo,
    action: "update",
    message: notes.length ? notes.join("; ") : null,
    importKey,
    externalId,
    anchored,
    listingId: existing.id,
    values,
    changed,
    photos,
    title,
    previous: existing,
  };
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}
