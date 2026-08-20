import { randomBytes } from "node:crypto";

/**
 * Public IDs are char(10), embedded in listing slugs. Seeds use `CAM0000001`,
 * the CSV importer uses `I` + 9 random chars; admin-created listings use `A` + 9 random
 * base32 chars (no 0/1/O/I to avoid ambiguity). Callers pass an existence
 * check and we retry on the rare collision.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford-ish, 32 chars

function randomId(prefix: string): string {
  const bytes = randomBytes(9);
  let out = prefix;
  for (let i = 0; i < 9; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * `prefix` marks provenance: "A" admin-created, "I" CSV import. It is NOT
 * derived from the row's content — F28: the importer used to slice the first 9
 * hex chars of its identity sha1, so a 36-bit prefix collision would have made
 * `ON DUPLICATE KEY UPDATE` overwrite an unrelated seller's listing in silence.
 */
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
