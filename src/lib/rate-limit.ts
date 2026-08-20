/**
 * F9 — in-process rate limiting.
 *
 * The site runs as ONE Node process on a single Hostinger slot, so an
 * in-memory bucket is the right size of solution: no Redis to run, no extra
 * MySQL writes on every request. The trade-off, stated plainly: a restart
 * clears the counters, and a second process would count separately. For
 * "stop a script hammering the login form or flooding the CRM" that is enough;
 * it is NOT a defence against a distributed attack, and it should not be
 * mistaken for one.
 *
 * Pure and testable: the clock is injected.
 */

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export const LOGIN_LIMIT: RateLimitRule = { limit: 8, windowMs: 10 * 60_000 };
export const LEAD_LIMIT: RateLimitRule = { limit: 5, windowMs: 10 * 60_000 };

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
/** Stop an attacker growing the map without bound by rotating keys. */
const MAX_KEYS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Sliding window. Returns `allowed:false` once `limit` hits land inside
 * `windowMs`, with how long to wait before the oldest hit ages out.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - rule.windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= rule.limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return { allowed: false, remaining: 0, retryAfterMs: oldest + rule.windowMs - now };
  }

  bucket.hits.push(now);
  if (buckets.size >= MAX_KEYS && !buckets.has(key)) evictStale(cutoff);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: rule.limit - bucket.hits.length,
    retryAfterMs: 0,
  };
}

function evictStale(cutoff: number): void {
  for (const [k, b] of buckets) {
    if (!b.hits.some((t) => t > cutoff)) buckets.delete(k);
  }
}

/** Test seam — never call from application code. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/**
 * F9 — the honeypot. A field no human ever sees, so anything in it is a bot.
 * The caller must respond with the SAME success the real path returns: telling
 * a bot it was caught just teaches the next version of it.
 */
export const HONEYPOT_FIELD = "website";

export function isHoneypotTripped(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim() !== "";
}
