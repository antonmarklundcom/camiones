/**
 * Money recompute, from the shell.
 *
 *   npm run cron:cuotas
 *
 * Thin CLI over recomputeMoney() in src/lib/jobs/money.ts — the SAME function
 * the guarded /api/cron route runs, so a manual run and a scheduled run can
 * never diverge. Scheduling lives in docs/cron.md (external pinger, not a
 * Hostinger per-slot cron).
 *
 * tsx does NOT auto-load .env — export DATABASE_URL in your shell first.
 */
import { recomputeMoney } from "../src/lib/jobs/money";

async function main() {
  const r = await recomputeMoney();

  console.log(
    [
      "",
      `cotización:        ${r.rate} ₲/US$  (${r.rateSource})`,
      `programas usables: ${r.usableProgramCount}`,
      `avisos revisados:  ${r.listingsScanned}`,
      `precio ₲ ajustado: ${r.priceGsUpdated}`,
      `cuota recalculada: ${r.cuotaUpdated}`,
      `cuota borrada:     ${r.cuotaCleared}`,
    ].join("\n"),
  );
  for (const n of r.notes) console.log(`\n⚠ ${n}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
