/**
 * Batch 4 — the `staff` role. The whole point is that a hired moderator can
 * approve listings WITHOUT being handed the keys to users, roles and money,
 * so these pin exactly where the line is.
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  ROLES,
  ROLE_LABELS,
  can,
  isCrossSeller,
} from "@/lib/auth/roles";
import { canSetFeatured, resolveFeatured } from "@/lib/admin/listing-policy";

describe("roles", () => {
  it("has exactly the three locked roles — no buyer accounts", () => {
    expect([...ROLES]).toEqual(["admin", "staff", "dealer"]);
  });

  it("labels every role (an unlabelled role renders as blank in the panel)", () => {
    for (const r of ROLES) expect(ROLE_LABELS[r]).toBeTruthy();
  });
});

describe("capabilities", () => {
  it("keeps users, money and featuring admin-only", () => {
    for (const cap of ["manageUsers", "manageMoney", "featureListing"] as const) {
      expect(can("admin", cap)).toBe(true);
      expect(can("staff", cap)).toBe(false);
      expect(can("dealer", cap)).toBe(false);
    }
  });

  it("lets staff do the operational work", () => {
    for (const cap of ["manageAllListings", "manageContent"] as const) {
      expect(can("staff", cap)).toBe(true);
      expect(can("admin", cap)).toBe(true);
      expect(can("dealer", cap)).toBe(false);
    }
  });

  it("grants dealers nothing beyond their own seller scope", () => {
    for (const cap of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      expect(can("dealer", cap)).toBe(false);
    }
  });

  it("gives admin every capability — no accidental lockout", () => {
    for (const cap of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      expect(can("admin", cap)).toBe(true);
    }
  });
});

describe("isCrossSeller", () => {
  it("is true for admin and staff, false for dealer", () => {
    expect(isCrossSeller("admin")).toBe(true);
    expect(isCrossSeller("staff")).toBe(true);
    expect(isCrossSeller("dealer")).toBe(false);
  });
});

describe("featured stays a paid upsell", () => {
  it("only an admin can set it", () => {
    expect(resolveFeatured("admin", true, false)).toBe(true);
    expect(resolveFeatured("staff", true, false)).toBe(false);
    expect(resolveFeatured("dealer", true, false)).toBe(false);
  });

  it("non-admins keep whatever an admin last chose", () => {
    expect(resolveFeatured("staff", false, true)).toBe(true);
    expect(resolveFeatured("dealer", false, true)).toBe(true);
  });

  it("the UI helper agrees with the server rule", () => {
    for (const r of ROLES) {
      expect(canSetFeatured(r)).toBe(resolveFeatured(r, true, false));
    }
  });
});
