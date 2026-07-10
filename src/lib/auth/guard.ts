import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth/session";

/** Current user or undefined — for conditional UI (nav, "mine only" filters). */
export async function getCurrentUser(): Promise<SessionUser | undefined> {
  const session = await getSession();
  return session.user;
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
