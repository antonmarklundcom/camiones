/**
 * In-memory per-key rate limiter for server actions (audit F9).
 *
 * Deliberately process-local: Hostinger runs a single Node process per app, so
 * a Map is enough and costs no extra service. It resets on redeploy, which is
 * acceptable for abuse control — it exists to stop a script hammering the lead
 * form or the login, not to enforce billing quotas. Move to a shared store only
 * if the app is ever scaled to multiple instances.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a long-running process cannot grow without bound. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — for a "probá de nuevo en X" message. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Test seam — never call from application code. */
export function __resetRateLimits() {
  buckets.clear();
}
