import { randomBytes } from "node:crypto";

/**
 * Public IDs are char(10), embedded in listing slugs. Seeds use `CAM0000001`,
 * the CSV importer uses `I<sha1>`; admin-created listings use `A` + 9 random
 * base32 chars (no 0/1/O/I to avoid ambiguity). Callers pass an existence
 * check and we retry on the rare collision.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford-ish, 32 chars

function randomId(): string {
  const bytes = randomBytes(9);
  let out = "A";
  for (let i = 0; i < 9; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function generatePublicId(
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomId();
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("No se pudo generar un ID único para el aviso.");
}
