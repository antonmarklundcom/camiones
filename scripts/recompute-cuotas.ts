/**
 * Cuota recompute cron — caches listings.cuota_gs so cards render
 * "₲ 6,4 M/mes" at zero query cost. Reads the active financing programs
 * (PLACEHOLDER rates until Phase 4) and recomputes every published listing.
 *
 *   npx tsx scripts/recompute-cuotas.ts
 *
 * Wire as a Hostinger daily cron after Phase 3 go-live.
 */
import { eq, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { financingPrograms, listings } from "../src/db/schema";
import { bestCuota, type FinancingProgram } from "../src/lib/cuota";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

async function main() {
  const programRows = await db.select().from(financingPrograms);
  const programs: FinancingProgram[] = programRows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));

  // No active programs means no financing offer exists — every cached cuota is
  // now fiction and MUST be cleared. Exiting early here would leave fabricated
  // "₲ X/mes" figures on every card indefinitely.
  if (!programs.some((p) => p.active)) {
    const cleared = await db
      .update(listings)
      .set({ cuotaGs: null })
      .where(isNotNull(listings.cuotaGs));
    console.log(
      `no active financing programs — cached cuotas cleared (${
        (cleared as unknown as { rowsAffected?: number }).rowsAffected ?? "?"
      } filas)`,
    );
    process.exit(0);
  }

  const rows = await db
    .select({ id: listings.id, priceGs: listings.priceGs, priceUsd: listings.priceUsd })
    .from(listings);

  let updated = 0;
  for (const row of rows) {
    // price_gs is NOT NULL, but guard the derivation anyway (imports may
    // backfill from USD only).
    const priceGs = Number(row.priceGs) || Number(row.priceUsd) * USD_TO_PYG;
    const result = bestCuota(priceGs, programs);
    await db
      .update(listings)
      .set({ cuotaGs: result ? String(result.monthlyGs) : null })
      .where(eq(listings.id, row.id));
    updated++;
  }

  console.log(`recomputed cuota for ${updated} listings`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
