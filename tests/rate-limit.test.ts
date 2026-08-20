/**
 * F9 — the abuse guards. A regression here either lets a bot flood the CRM or
 * locks a real buyer out of the only contact form on the page.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  HONEYPOT_FIELD,
  LEAD_LIMIT,
  LOGIN_LIMIT,
  __resetRateLimits,
  checkRateLimit,
  isHoneypotTripped,
} from "@/lib/rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit and blocks the next one", () => {
    const t = 1_000_000;
    expect(checkRateLimit("a", RULE, t).allowed).toBe(true);
    expect(checkRateLimit("a", RULE, t).allowed).toBe(true);
    expect(checkRateLimit("a", RULE, t).allowed).toBe(true);
    expect(checkRateLimit("a", RULE, t).allowed).toBe(false);
  });

  it("counts each key separately", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", RULE, t);
    expect(checkRateLimit("a", RULE, t).allowed).toBe(false);
    // A different visitor is unaffected by the first one's flood.
    expect(checkRateLimit("b", RULE, t).allowed).toBe(true);
  });

  it("slides: the oldest hit ages out and frees a slot", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", RULE, t);
    expect(checkRateLimit("a", RULE, t + 59_000).allowed).toBe(false);
    expect(checkRateLimit("a", RULE, t + 60_001).allowed).toBe(true);
  });

  it("reports how long to wait", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", RULE, t);
    const blocked = checkRateLimit("a", RULE, t + 10_000);
    expect(blocked.retryAfterMs).toBe(50_000);
  });

  it("reports the remaining allowance", () => {
    const t = 1_000_000;
    expect(checkRateLimit("a", RULE, t).remaining).toBe(2);
    expect(checkRateLimit("a", RULE, t).remaining).toBe(1);
    expect(checkRateLimit("a", RULE, t).remaining).toBe(0);
  });

  it("ships limits loose enough for a real person, tight enough to matter", () => {
    // A buyer asking about three trucks in ten minutes must not be blocked;
    // a script trying 100 passwords must be.
    expect(LEAD_LIMIT.limit).toBeGreaterThanOrEqual(3);
    expect(LEAD_LIMIT.limit).toBeLessThanOrEqual(10);
    expect(LOGIN_LIMIT.limit).toBeLessThanOrEqual(10);
  });
});

describe("honeypot", () => {
  it("trips on any non-empty value", () => {
    expect(isHoneypotTripped("http://spam.example")).toBe(true);
    expect(isHoneypotTripped(" x ")).toBe(true);
  });

  it("does not trip on empty, whitespace-only or missing", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped("   ")).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
  });

  it("uses a field name a bot will want to fill", () => {
    expect(HONEYPOT_FIELD).toBe("website");
  });
});
