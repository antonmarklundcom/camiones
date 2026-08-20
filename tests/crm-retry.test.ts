/**
 * F1 — the delivery retry policy. These decide whether a lead that the CRM
 * refused once gets another chance, or is parked forever.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  isDue,
  isPermanentStatus,
  retryDelayMinutes,
} from "@/lib/crm/types";

describe("retryDelayMinutes", () => {
  it("backs off, and plateaus instead of growing without bound", () => {
    const delays = [0, 1, 2, 3, 4, 5, 9].map(retryDelayMinutes);
    expect(delays.slice(0, 5)).toEqual([1, 5, 15, 60, 240]);
    // Past the schedule it holds at the longest delay rather than exploding.
    expect(delays[5]).toBe(240);
    expect(delays[6]).toBe(240);
  });

  it("retries the first failure quickly — most outages are blips", () => {
    expect(retryDelayMinutes(0)).toBeLessThanOrEqual(5);
  });
});

describe("isDue", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("is due immediately when never attempted", () => {
    expect(isDue({ attempts: 0, lastAttemptAt: null }, now)).toBe(true);
  });

  it("waits out the backoff", () => {
    const lastAttemptAt = new Date("2026-08-20T11:59:30Z"); // 30s ago, needs 1min
    expect(isDue({ attempts: 1, lastAttemptAt }, now)).toBe(false);
  });

  it("becomes due once the backoff has elapsed", () => {
    const lastAttemptAt = new Date("2026-08-20T11:50:00Z"); // 10min ago
    expect(isDue({ attempts: 1, lastAttemptAt }, now)).toBe(true);
  });

  it("stops entirely once attempts are exhausted", () => {
    const lastAttemptAt = new Date("2020-01-01T00:00:00Z");
    expect(isDue({ attempts: MAX_ATTEMPTS, lastAttemptAt }, now)).toBe(false);
  });
});

describe("isPermanentStatus", () => {
  it("does not retry a rejected payload or bad credentials", () => {
    for (const s of [400, 401, 403, 422]) expect(isPermanentStatus(s)).toBe(true);
  });

  it("does retry rate limits and server errors", () => {
    for (const s of [429, 500, 502, 503, 504]) expect(isPermanentStatus(s)).toBe(false);
  });
});
