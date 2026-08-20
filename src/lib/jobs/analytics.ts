/**
 * Nightly analytics rollup.
 *
 * Raw `analytics_events` rows are append-only and never queried per request.
 * This folds them into `analytics_daily` (one row per day/kind/listing/seller)
 * so a dealer opening their stats reads a handful of indexed rows instead of
 * scanning months of raw events on shared MySQL, and so the raw table can be
 * pruned without losing history.
 *
 * The aggregation runs as SQL — pulling every event into Node to count them
 * would defeat the purpose. It is idempotent: re-running a day recomputes and
 * upserts the same rows.
 *
 * No `import "server-only"` — the tsx CLI needs this (see src/lib/fx.ts).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Keep this many days of RAW events; the daily rollup is kept forever. */
export const RAW_RETENTION_DAYS = 90;

export interface RollupResult {
  daysProcessed: number;
  rowsWritten: number;
  rawPruned: number;
}

/**
 * @param days how many days back to (re)aggregate. 2 by default so a run that
 *   fires just after midnight still closes out the previous day.
 */
export async function rollupAnalytics(days = 2): Promise<RollupResult> {
  const window = Math.max(1, Math.min(365, Math.floor(days)));

  // COUNT(DISTINCT visitor_hash) is what makes "visitas" mean people rather
  // than refreshes. NULL listing/seller are grouped as-is, which is how a
  // site-wide event (no listing attached) keeps its own row.
  const written = await db.execute(sql`
    INSERT INTO analytics_daily (day, kind, listing_id, seller_id, events, visitors)
    SELECT
      DATE(created_at)                AS day,
      kind,
      listing_id,
      seller_id,
      COUNT(*)                        AS events,
      COUNT(DISTINCT visitor_hash)    AS visitors
    FROM analytics_events
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${window} DAY)
    GROUP BY DATE(created_at), kind, listing_id, seller_id
    ON DUPLICATE KEY UPDATE
      events   = VALUES(events),
      visitors = VALUES(visitors)
  `);

  const pruned = await db.execute(sql`
    DELETE FROM analytics_events
    WHERE created_at < DATE_SUB(CURDATE(), INTERVAL ${RAW_RETENTION_DAYS} DAY)
  `);

  return {
    daysProcessed: window,
    rowsWritten: affectedRows(written),
    rawPruned: affectedRows(pruned),
  };
}

function affectedRows(res: unknown): number {
  const header = Array.isArray(res) ? res[0] : res;
  return (header as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}
