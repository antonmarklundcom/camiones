/**
 * F27: any→any used to be legal, so sold → published kept the original
 * published_at and the truck resurfaced in "Últimos publicados" as fresh stock.
 */
import { describe, expect, it } from "vitest";
import {
  canTransition,
  LISTING_STATUS_TRANSITIONS,
  LISTING_STATUS_VALUES,
} from "@/lib/admin/constants";

describe("LISTING_STATUS_TRANSITIONS", () => {
  it("covers every status", () => {
    for (const s of LISTING_STATUS_VALUES) {
      expect(LISTING_STATUS_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("always allows staying put (a plain edit is not a transition)", () => {
    for (const s of LISTING_STATUS_VALUES) expect(canTransition(s, s)).toBe(true);
  });

  it("blocks the resurrection paths that lie about freshness", () => {
    expect(canTransition("sold", "published")).toBe(false);
    expect(canTransition("sold", "paused")).toBe(false);
    expect(canTransition("removed", "published")).toBe(false);
  });

  it("routes a sold or removed listing back through borrador", () => {
    expect(canTransition("sold", "draft")).toBe(true);
    expect(canTransition("removed", "draft")).toBe(true);
    expect(canTransition("draft", "published")).toBe(true);
  });

  it("keeps the everyday publish/pause loop open", () => {
    expect(canTransition("published", "paused")).toBe(true);
    expect(canTransition("paused", "published")).toBe(true);
    expect(canTransition("published", "sold")).toBe(true);
  });

  it("lets anything be removed except an already-removed row's re-removal path", () => {
    expect(canTransition("draft", "removed")).toBe(true);
    expect(canTransition("published", "removed")).toBe(true);
    expect(canTransition("paused", "removed")).toBe(true);
    expect(canTransition("sold", "removed")).toBe(true);
  });
});
