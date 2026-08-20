/**
 * First-party event recording (I8 + the locked "no third-party analytics"
 * decision: no Google, no Plausible, no script tag at all — which also means
 * zero extra bytes on a prepaid-data Android).
 *
 * The constraint is shared Hostinger MySQL, so writes have to be cheap:
 *
 *  - `recordEvent()` never blocks a response. It pushes onto an in-process
 *    buffer and returns; the caller does not await a write.
 *  - The buffer flushes as ONE multi-row INSERT when it reaches BATCH_SIZE or
 *    after FLUSH_MS, so a busy minute costs a couple of inserts, not hundreds.
 *  - Nothing reads this table per request. The admin dashboard reads
 *    `analytics_daily`, filled nightly by the rollup.
 *
 * Trade-off, stated plainly: a process restart can drop up to BATCH_SIZE
 * buffered events. For view counts that is the right trade; for anything that
 * must not be lost (leads — audit F1) the answer is a write-ahead row in its
 * own table, not this buffer.
 *
 * Privacy: no cookies, no user id, no stored IP. `visitorHash` is a
 * daily-rotating hash of IP + user-agent used only to collapse a refresh
 * frenzy into one visitor; it is not stable across days and identifies nobody.
 */
import { createHash } from "node:crypto";
import { db } from "@/db";
import { analyticsEvents, type EventKind } from "@/db/schema";

const BATCH_SIZE = 25;
const FLUSH_MS = 5_000;

export interface EventInput {
  kind: EventKind;
  listingId?: number | null;
  sellerId?: number | null;
  path?: string | null;
  referrerHost?: string | null;
  visitorHash?: string | null;
}

type Buffered = EventInput & { createdAt: Date };

const buffer: Buffered[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget. Deliberately not async from the caller's point of view. */
export function recordEvent(input: EventInput): void {
  buffer.push({ ...input, createdAt: new Date() });

  if (buffer.length >= BATCH_SIZE) {
    void flushEvents();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => void flushEvents(), FLUSH_MS);
    // Never hold the process open just to write analytics.
    if (typeof timer === "object" && "unref" in timer) timer.unref();
  }
}

export async function flushEvents(): Promise<number> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return 0;

  const batch = buffer.splice(0, buffer.length);
  try {
    await db.insert(analyticsEvents).values(
      batch.map((e) => ({
        kind: e.kind,
        listingId: e.listingId ?? null,
        sellerId: e.sellerId ?? null,
        path: e.path?.slice(0, 255) ?? null,
        referrerHost: e.referrerHost?.slice(0, 120) ?? null,
        visitorHash: e.visitorHash ?? null,
        createdAt: e.createdAt,
      })),
    );
    return batch.length;
  } catch (e) {
    // Analytics must never take a page down with it.
    console.error("[analytics] flush failed, dropping batch", e);
    return 0;
  }
}

/* ------------------------------ request bits ----------------------------- */

/**
 * Cheap crawler filter. Not exhaustive by design — a heuristic that removes
 * the obvious bots keeps "visitas" honest enough to make decisions from, and
 * anything cleverer costs more than it is worth here.
 */
const BOT_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // no UA at all is not a person on a phone
  return BOT_RE.test(userAgent);
}

/** Salt rotates daily, so no hash is comparable across days. */
export function visitorHash(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${day}|${ip ?? ""}|${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

/** Referrer HOST only — we never store the full referring URL. */
export function referrerHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
