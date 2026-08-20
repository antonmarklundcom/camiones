/**
 * Re-deliver leads the CRM webhook never took (F1).
 *
 *   DATABASE_URL=... GHL_WEBHOOK_URL=... npx tsx scripts/retry-leads.ts
 *
 * Safe to run repeatedly: only `pending`/`failed` rows under the attempt cap
 * are picked up, and each attempt updates the row. Batch 3 wires this to the
 * guarded cron route + external pinger; until then it is manual.
 */
import { retryLeads } from "../src/lib/leads";

async function main() {
  const { tried, sent } = await retryLeads(200);
  console.log(`leads reintentados: ${tried} · entregados: ${sent}`);
  if (tried > sent) {
    console.error(`${tried - sent} siguen sin entregar — revisá GHL_WEBHOOK_URL.`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
