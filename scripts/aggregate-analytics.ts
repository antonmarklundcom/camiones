/**
 * Analytics rollup, from the shell.
 *
 *   npm run analytics:rollup            # last 2 days
 *   npm run analytics:rollup -- 30      # re-aggregate the last 30 days
 *
 * Thin CLI over rollupAnalytics() — the same function `GET /api/cron?job=analytics`
 * runs. tsx does NOT auto-load .env: export DATABASE_URL first.
 */
import { rollupAnalytics } from "../src/lib/jobs/analytics";

async function main() {
  const days = Number(process.argv[2] ?? 2);
  const r = await rollupAnalytics(Number.isFinite(days) ? days : 2);
  console.log(
    [
      "",
      `días agregados:   ${r.daysProcessed}`,
      `filas escritas:   ${r.rowsWritten}`,
      `eventos purgados: ${r.rawPruned}`,
    ].join("\n"),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
