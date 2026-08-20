/**
 * Import identity (audit F2).
 *
 * The old key was `sha1(seller|brand|model|year|km)`. Two ways that lies:
 * next month's CSV carries a higher `km` for the same physical truck, the hash
 * changes and the importer mints a SECOND listing while the first stays
 * published on its old URL; and two genuinely different trucks with the same
 * model/year/km from one dealer collapse into one row.
 *
 * The fix is propia's "return null without the anchor" discipline:
 *
 *  - With a dealer-side anchor (chapa / stock id) the key is
 *    `sha1(seller|ext|<anchor>)` — nothing about the truck's condition enters
 *    it, so price and mileage updates always MERGE.
 *  - Without one we fall back to a spec bucket WITHOUT `km`, so a mileage
 *    update still merges, and the caller must refuse `--publish`
 *    (`requiresAnchorToPublish`): an anchorless run can silently merge two
 *    distinct trucks, which is only tolerable while the rows are drafts a
 *    human still has to look at.
 *
 * Pure and dependency-free apart from node:crypto so the whole thing is unit
 * testable without a database.
 */
import { createHash } from "node:crypto";

export type IdentityAnchor = "external" | "spec";

export interface IdentityInput {
  sellerSlug: string;
  /** chapa / stock id straight from the CSV; empty and NULL both mean absent. */
  externalId?: string | null;
  brandSlug: string;
  model: string;
  year: number;
}

export interface Identity {
  key: string;
  anchor: IdentityAnchor;
  /** Normalised anchor, or null when the CSV had none. */
  externalId: string | null;
}

/** CSV columns accepted as the anchor, in precedence order. */
export const ANCHOR_COLUMNS = ["chapa", "stock_id", "patente", "placa"] as const;

/**
 * Plates get written as "ABC 123", "abc-123", "ABC123" by three different
 * people in the same sheet. Normalising to bare uppercase alphanumerics makes
 * those one truck instead of three. Dealer stock ids survive the same way.
 */
export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return v.length ? v.slice(0, 60) : null;
}

/** Reads the anchor out of a parsed CSV record, honouring column precedence. */
export function readAnchor(record: Record<string, string>): string | null {
  for (const col of ANCHOR_COLUMNS) {
    const v = normalizeExternalId(record[col]);
    if (v) return v;
  }
  return null;
}

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

export function importIdentity(input: IdentityInput): Identity {
  const seller = input.sellerSlug.trim().toLowerCase();
  const externalId = normalizeExternalId(input.externalId);
  if (externalId) {
    return { key: sha1(`v2|${seller}|ext|${externalId}`), anchor: "external", externalId };
  }
  const model = input.model.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    // km is deliberately absent — see the header comment.
    key: sha1(`v2|${seller}|spec|${input.brandSlug}|${model}|${input.year}`),
    anchor: "spec",
    externalId: null,
  };
}

/** True when at least one row lacks an anchor, i.e. `--publish` must be refused. */
export function requiresAnchorToPublish(identities: readonly Identity[]): boolean {
  return identities.some((i) => i.anchor === "spec");
}

export const ANCHORLESS_PUBLISH_REFUSAL =
  "Este CSV no trae columna de identidad (chapa / stock_id), así que --publish " +
  "está bloqueado.\n" +
  "Sin ancla, dos camiones distintos con la misma marca/modelo/año se fusionan " +
  "en un solo aviso y no hay forma de detectarlo después.\n" +
  "Pedile al concesionario la chapa o el código de stock de cada unidad, o " +
  "corré el import sin --publish y publicá desde /admin después de revisar.";
