/**
 * Dependency-free in-process rate limiter (F9).
 *
 * Scope and honesty about it: Hostinger runs ONE Node process per app, so a
 * module-level Map is a real limit here — but it resets on redeploy and would
 * not survive a move to multiple instances. It exists to stop trivial abuse
 * (credential stuffing, CRM flooding), not as a security boundary.
 *
 * Pure: `check` takes the clock so the tests don't sleep.
 */

export interface RateLimitRule {
  /** Max allowed hits inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Hits remaining in the current window (0 when blocked). */
  remaining: number;
  /** ms until the window frees up (0 when allowed). */
  retryAfterMs: number;
}

/** Exported for tests; the app uses the module-level singleton below. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private rule: RateLimitRule) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const cutoff = now - this.rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.rule.limit) {
      this.hits.set(key, recent);
      const retryAfterMs = recent[0] + this.rule.windowMs - now;
      return { ok: false, remaining: 0, retryAfterMs };
    }

    recent.push(now);
    this.hits.set(key, recent);
    // Opportunistic sweep so an attacker can't grow the map without bound.
    if (this.hits.size > 5_000) this.prune(now);
    return {
      ok: true,
      remaining: this.rule.limit - recent.length,
      retryAfterMs: 0,
    };
  }

  prune(now: number = Date.now()): void {
    const cutoff = now - this.rule.windowMs;
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) this.hits.set(key, recent);
      else this.hits.delete(key);
    }
  }

  /** Test seam. */
  reset(): void {
    this.hits.clear();
  }
}

/** 5 leads per IP per 10 minutes — generous for a human, useless for a bot. */
export const leadLimiter = new RateLimiter({ limit: 5, windowMs: 10 * 60_000 });

/** 8 login attempts per IP per 10 minutes. */
export const loginLimiter = new RateLimiter({ limit: 8, windowMs: 10 * 60_000 });
