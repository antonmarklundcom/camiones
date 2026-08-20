import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession, type SessionUser } from "@/lib/auth/session";

/**
 * F8: the iron-session cookie baked in role + sellerId for 30 days and nothing
 * ever re-checked them, so a deleted, demoted or reassigned user stayed fully
 * privileged until the cookie expired (stateless cookies can't be revoked).
 * Every gated request now re-reads the row — one indexed PK read, deduped per
 * request by React.cache — and the DB wins over whatever the cookie claims.
 *
 * Returns undefined when the user no longer exists: the caller decides between
 * "show logged-out UI" and "redirect to login".
 */
const revalidate = cache(async (id: number): Promise<SessionUser | undefined> => {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sellerId: users.sellerId,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row) return undefined;
  return { ...row, sellerId: row.sellerId ?? null };
});

/** Current user or undefined — for conditional UI (nav, "mine only" filters). */
export async function getCurrentUser(): Promise<SessionUser | undefined> {
  const session = await getSession();
  if (!session.user) return undefined;
  return revalidate(session.user.id);
}

/**
 * Gate a page/action: returns the user or redirects to login. `redirect()`
 * works in both server components and server actions, so this is the single
 * entry point for "must be logged in".
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Admin-only gate (user management, cross-seller listing/seller admin). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Acceso denegado: se requiere rol de administrador.");
  }
  return user;
}

/**
 * Row-level scope check for mutations. Admins may touch any seller's data;
 * dealers only their own. Throws (not redirect) — reaching here means a
 * tampered request, not a missing login.
 */
export function assertCanManageSeller(user: SessionUser, sellerId: number): void {
  if (user.role === "admin") return;
  if (user.sellerId !== sellerId) {
    throw new Error("Acceso denegado: este registro no pertenece a tu cuenta.");
  }
}

/**
 * The seller a new record must belong to. Dealers can only create rows under
 * their own seller; admins pass an explicit sellerId from the form.
 */
export function resolveOwningSeller(
  user: SessionUser,
  requestedSellerId: number | undefined,
): number {
  if (user.role === "dealer") {
    if (!user.sellerId) {
      throw new Error("Tu usuario no tiene una concesionaria asignada.");
    }
    return user.sellerId;
  }
  if (!requestedSellerId) {
    throw new Error("Elegí una concesionaria para el aviso.");
  }
  return requestedSellerId;
}
