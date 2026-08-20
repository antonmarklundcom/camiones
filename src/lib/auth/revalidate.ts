import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

/**
 * F8 — session revalidation.
 *
 * The iron-session cookie is stateless and lives 30 days, so it bakes in the
 * role/sellerId the user had at login. Deleting a user, demoting an admin or
 * reassigning a dealer left the old cookie fully privileged until it expired.
 * Every guarded request now re-reads the row (one PK lookup) and either
 * returns the CURRENT identity or rejects the session outright.
 *
 * Deliberately not cached: caching this would reintroduce exactly the staleness
 * window the finding is about. It is one indexed read on an already-DB-backed
 * request.
 */
export type Revalidated =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "gone" };

export async function revalidateSessionUser(
  cookieUser: SessionUser,
): Promise<Revalidated> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sellerId: users.sellerId,
    })
    .from(users)
    .where(eq(users.id, cookieUser.id))
    .limit(1);

  // Deleted user — the cookie is worthless even though it still decrypts.
  if (!row) return { ok: false, reason: "gone" };

  // Identity must still match the cookie: if the email changed, the row was
  // recycled onto a different person and this cookie is not theirs.
  if (row.email !== cookieUser.email) return { ok: false, reason: "gone" };

  return {
    ok: true,
    // Role and sellerId come from the DB, never from the cookie.
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      sellerId: row.sellerId,
    },
  };
}
