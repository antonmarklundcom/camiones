/**
 * F9. The limiter takes the clock as an argument precisely so this suite can
 * cover window expiry without sleeping.
 */
import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

const rule = { limit: 3, windowMs: 1000 };

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const rl = new RateLimiter(rule);
    expect(rl.check("a", 0).ok).toBe(true);
    expect(rl.check("a", 10).ok).toBe(true);
    expect(rl.check("a", 20).ok).toBe(true);
    expect(rl.check("a", 30).ok).toBe(false);
  });

  it("counts down the remaining allowance", () => {
    const rl = new RateLimiter(rule);
    expect(rl.check("a", 0).remaining).toBe(2);
    expect(rl.check("a", 1).remaining).toBe(1);
    expect(rl.check("a", 2).remaining).toBe(0);
  });

  it("keys are independent", () => {
    const rl = new RateLimiter(rule);
    rl.check("a", 0);
    rl.check("a", 0);
    rl.check("a", 0);
    expect(rl.check("a", 0).ok).toBe(false);
    expect(rl.check("b", 0).ok).toBe(true);
  });

  it("frees up as the window slides", () => {
    const rl = new RateLimiter(rule);
    rl.check("a", 0);
    rl.check("a", 100);
    rl.check("a", 200);
    expect(rl.check("a", 500).ok).toBe(false);
    // The first hit ages out at t=1000, so t=1001 has room again.
    expect(rl.check("a", 1001).ok).toBe(true);
  });

  it("reports how long the caller must wait", () => {
    const rl = new RateLimiter(rule);
    rl.check("a", 0);
    rl.check("a", 0);
    rl.check("a", 0);
    expect(rl.check("a", 400).retryAfterMs).toBe(600);
  });

  it("blocking does not extend the window (no lockout spiral)", () => {
    const rl = new RateLimiter(rule);
    rl.check("a", 0);
    rl.check("a", 0);
    rl.check("a", 0);
    rl.check("a", 900); // blocked
    expect(rl.check("a", 1001).ok).toBe(true);
  });

  it("prunes keys whose window has fully expired", () => {
    const rl = new RateLimiter(rule);
    rl.check("a", 0);
    rl.prune(5000);
    expect(rl.check("a", 5001).remaining).toBe(2);
  });
});
