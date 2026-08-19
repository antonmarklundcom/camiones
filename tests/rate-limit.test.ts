import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimits, rateLimit } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimits());

describe("rateLimit", () => {
  const WINDOW = 60_000;

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("ip", 3, WINDOW, 1000).allowed).toBe(true);
    }
  });

  it("blocks the request after the limit", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip", 3, WINDOW, 1000);
    expect(rateLimit("ip", 3, WINDOW, 1000).allowed).toBe(false);
  });

  it("reports seconds until the window resets", () => {
    for (let i = 0; i < 4; i++) rateLimit("ip", 3, WINDOW, 1000);
    expect(rateLimit("ip", 3, WINDOW, 31_000).retryAfter).toBe(30);
  });

  it("starts a fresh window once the old one expires", () => {
    for (let i = 0; i < 4; i++) rateLimit("ip", 3, WINDOW, 1000);
    expect(rateLimit("ip", 3, WINDOW, 62_000).allowed).toBe(true);
  });

  it("keeps separate counters per key", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, WINDOW, 1000);
    expect(rateLimit("a", 3, WINDOW, 1000).allowed).toBe(false);
    expect(rateLimit("b", 3, WINDOW, 1000).allowed).toBe(true);
  });
});
