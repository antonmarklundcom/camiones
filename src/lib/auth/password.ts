import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password hashing. bcryptjs (pure JS) rather than native `bcrypt` so the
 * Hostinger build never has to compile a binary addon — a known deploy trap on
 * shared Node hosting. cost 10 is the usual web default.
 */
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
