/**
 * F2/F28 — import identity.
 *
 * The old key was `sha1(seller|brand|model|year|km)` and the publicId was the
 * first 9 hex chars of that same hash. Both were wrong:
 *
 *  - `km` inside the key meant next month's CSV (same truck, 8 000 km more)
 *    hashed differently and minted a SECOND listing, leaving the stale one
 *    published on its original URL.
 *  - A 36-bit publicId prefix could collide, and because the publicId is
 *    unique the upsert would then silently overwrite an unrelated listing.
 *
 * Now: when the dealer gives us an anchor (chapa / stock ID) the key is
 * `sha1(v2|seller|ext:<anchor>)` — nothing else about the truck can move it.
 * Without an anchor we fall back to a bucket key that deliberately EXCLUDES km
 * (and price), so routine updates merge; the trade-off is that two genuinely
 * different trucks of the same brand/model/year from one dealer collapse into
 * one row, which is exactly why anchorless runs are refused `--publish`.
 *
 * The `v2|` prefix is a deliberate namespace break from the pre-Batch-2 keys.
 * No real inventory was ever imported, so there is nothing to migrate; if that
 * changes, re-key by hand before the first run rather than removing the prefix.
 *
 * publicId is now generated independently of the key (see src/lib/public-id.ts)
 * and is only ever assigned on CREATE — updates keep the row's existing one.
 */
import { createHash } from "node:crypto";

/** Anchors are matched case- and punctuation-insensitively: "ABC 123" == "abc-123". */
export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return v.length ? v : null;
}

export interface IdentityInput {
  sellerSlug: string;
  externalId?: string | null;
  brandSlug: string;
  model: string;
  year: number;
}

export interface Identity {
  importKey: string;
  /** True when the key is anchored on the dealer's own ID (safe to publish). */
  anchored: boolean;
  /** Normalised anchor, stored on the listing so later runs can match it. */
  externalId: string | null;
}

export function deriveIdentity(input: IdentityInput): Identity {
  const seller = input.sellerSlug.trim().toLowerCase();
  const externalId = normalizeExternalId(input.externalId);

  const material = externalId
    ? `v2|${seller}|ext:${externalId}`
    : // NOTE: no km, no price — only the fields that identify the vehicle.
      `v2|${seller}|${input.brandSlug.trim().toLowerCase()}|` +
      `${input.model.trim().toLowerCase()}|${input.year}`;

  return {
    importKey: createHash("sha1").update(material).digest("hex"),
    anchored: externalId !== null,
    externalId,
  };
}
