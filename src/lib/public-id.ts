import { randomBytes } from "node:crypto";

/**
 * Public IDs are char(10), embedded in listing slugs. Seeds use `CAM0000001`;
 * admin-created listings use `A` + 9 random base32 chars (no 0/1/O/I to avoid
 * ambiguity) and CSV-imported ones `I` + the same. Callers pass an existence
 * check and we retry on the rare collision.
 *
 * F28: the importer used to slice the first 9 hex chars off its sha1 import
 * key — 36 bits, and a prefix collision turned the upsert into a silent
 * overwrite of an unrelated listing. The id is now generated independently of
 * the key and checked against the DB, so a collision costs a retry, not a row.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford-ish, 32 chars

function randomId(prefix: string): string {
  const bytes = randomBytes(9);
  let out = prefix;
  for (let i = 0; i < 9; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function generatePublicId(
  exists: (candidate: string) => Promise<boolean>,
  prefix: "A" | "I" = "A",
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomId(prefix);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("No se pudo generar un ID único para el aviso.");
}
