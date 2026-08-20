/**
 * Role constants — shared by session, guards and UI. Kept in its own module
 * (no "server-only") so client components can import the type/labels too.
 *
 * Three roles (Decisions Log):
 *  - `admin`  — everything, including users, roles and the money settings.
 *  - `staff`  — operational: listings, sellers, guides across ALL sellers, but
 *               NOT users/roles and NOT the FX/financing controls. This is the
 *               role a hired moderator gets; handing them `admin` so they can
 *               approve listings is how a portal ends up with five admins who
 *               can each delete the others.
 *  - `dealer` — scoped to their own seller.
 *
 * There are deliberately NO buyer accounts (WhatsApp-first).
 */
export const ROLES = ["admin", "staff", "dealer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  staff: "Staff",
  dealer: "Concesionaria",
};

/** Roles that see every seller's rows rather than just their own. */
export const CROSS_SELLER_ROLES: readonly Role[] = ["admin", "staff"];

export function isCrossSeller(role: Role): boolean {
  return CROSS_SELLER_ROLES.includes(role);
}

/**
 * Capabilities, named so a guard reads as intent rather than as a role list.
 * Adding a role means filling this table in, not hunting for `=== "admin"`.
 */
export const CAPABILITIES = {
  /** Create/edit/delete users and change roles. */
  manageUsers: ["admin"],
  /** Edit the FX rate and mark financing programs verified. */
  manageMoney: ["admin"],
  /** Feature a listing on the home page (a paid upsell later). */
  featureListing: ["admin"],
  /** Create/edit listings and sellers beyond your own. */
  manageAllListings: ["admin", "staff"],
  /** Write guides. */
  manageContent: ["admin", "staff"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}
