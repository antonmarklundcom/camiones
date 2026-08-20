/**
 * Seed financing_programs for the cuota engine.
 *
 * ⚠️  EVERY RATE/TERM BELOW IS A PLACEHOLDER — invented, plausible-looking
 * figures. Phase 4 replaces them with verified bank/financiera terms for
 * commercial vehicles BEFORE launch. The "(PLACEHOLDER)" suffix in each name is
 * NOT cosmetic: `usablePrograms()` in src/lib/cuota.ts filters on exactly that
 * marker, so while it is there no cuota renders anywhere and no cuota is
 * cached. Removing it from a name is the act of declaring a rate verified —
 * only do that with a real quote in hand, and set `rateConvention` to match
 * what the lender actually quoted (TEA vs nominal, F26).
 *
 * Idempotent (upsert by primary-key code), safe to re-run:
 *   npx tsx scripts/seed-financing.ts
 */
import { db } from "../src/db";
import { financingPrograms } from "../src/db/schema";

const PROGRAMS = [
  {
    code: "credito_prendario_bancario",
    name: "Crédito prendario bancario (PLACEHOLDER)",
    annualRate: "9.50", // PLACEHOLDER — verify with banks in Phase 4
    rateConvention: "tea" as const, // F26 — PY quotes are normally TEA; confirm per program
    maxTermMonths: 60,
    maxAmountGs: "1500000000", // PLACEHOLDER cap ₲1.500M
    minDownPct: "20.00",
    active: true,
  },
  {
    code: "financiera_vehiculos_trabajo",
    name: "Financiera de vehículos de trabajo (PLACEHOLDER)",
    annualRate: "13.00", // PLACEHOLDER — verify with financieras in Phase 4
    rateConvention: "tea" as const,
    maxTermMonths: 48,
    maxAmountGs: "800000000", // PLACEHOLDER cap ₲800M
    minDownPct: "30.00",
    active: true,
  },
  {
    code: "leasing_maquinaria",
    name: "Leasing de maquinaria y transporte (PLACEHOLDER)",
    annualRate: "11.00", // PLACEHOLDER — verify leasing terms in Phase 4
    rateConvention: "tea" as const,
    maxTermMonths: 60,
    maxAmountGs: null,
    minDownPct: "25.00",
    active: true,
  },
];

async function main() {
  const now = new Date();
  for (const p of PROGRAMS) {
    await db
      .insert(financingPrograms)
      .values({ ...p, status: "published", publishedAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { ...p, updatedAt: now } });
    console.log(`upserted ${p.code}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
