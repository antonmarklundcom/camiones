import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { revalidateSessionUser } from "@/lib/auth/revalidate";
import { can, isCrossSeller, type Capability } from "@/lib/auth/roles";

/**
 * Current user or undefined — for conditional UI (nav, "mine only" filters).
 *
 * F8: the cookie is only a claim of identity. The role/sellerId returned here
 * always come from the DB row, so demotions, dealer reassignments and user
 * deletions take effect on the next request instead of up to 30 days later.
 */
export async function getCurrentUser(): Promise<SessionUser | undefined> {
  const session = await getSession();
  const claimed = session.user;
  if (!claimed) return undefined;

  const result = await revalidateSessionUser(claimed);
  if (!result.ok) {
    // Best-effort revoke. Server components can't mutate cookies in Next 15
    // (it throws during render), so a failure here is expected and harmless:
    // the guard still refuses the request.
    try {
      session.destroy();
      await session.save();
    } catch {
      /* read-only render context — the rejection below is what matters */
    }
    return undefined;
  }
  return result.user;
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

/** Admin-only gate (user management, roles, money settings). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Acceso denegado: se requiere rol de administrador.");
  }
  return user;
}

/**
 * Capability gate — prefer this over `requireAdmin()` for anything `staff`
 * should be able to do. Adding a role then means editing CAPABILITIES, not
 * hunting for `=== "admin"` across the tree.
 */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) {
    throw new Error("Acceso denegado: tu rol no permite esta acción.");
  }
  return user;
}

/**
 * Row-level scope check for mutations. Admins may touch any seller's data;
 * dealers only their own. Throws (not redirect) — reaching here means a
 * tampered request, not a missing login.
 */
export function assertCanManageSeller(user: SessionUser, sellerId: number): void {
  if (isCrossSeller(user.role)) return;
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
  if (!isCrossSeller(user.role)) {
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
