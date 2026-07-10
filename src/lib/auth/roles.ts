/**
 * Role constants — shared by session, guards and UI. Kept in its own module
 * (no "server-only") so client components can import the type/labels too.
 */
export const ROLES = ["admin", "dealer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  dealer: "Concesionaria",
};
