/**
 * The scheduled money work, in ONE place so the CLI (`npm run cron:cuotas`) and
 * the guarded cron route (`/api/cron`) can never drift apart.
 *
 * Two derived caches are kept honest here:
 *   - `listings.price_gs`  = price_usd × the active DB FX rate (F11)
 *   - `listings.cuota_gs`  = defaultCuota() at the shared default program/term (F5)
 *
 * F4: with no usable financing program, cached cuotas are NULLED rather than
 * left behind. Exiting early there was the old bug — "turn off financing" left
 * fabricated "₲ X/mes" figures on every card forever.
 *
 * Shared-MySQL manners: rows are only written when a value actually changes.
 *
 * No `import "server-only"` here on purpose — see the note in src/lib/fx.ts.
 */
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { financingPrograms, listings } from "@/db/schema";
import {
  defaultCuota,
  usablePrograms,
  type FinancingProgram,
  type RateConvention,
} from "@/lib/cuota";
import { getActiveFxRate, priceGsFromUsd } from "@/lib/fx";

export interface MoneyJobResult {
  rate: number;
  rateSource: string;
  rateIsFallback: boolean;
  usableProgramCount: number;
  listingsScanned: number;
  priceGsUpdated: number;
  cuotaUpdated: number;
  cuotaCleared: number;
  notes: string[];
}

export async function loadPrograms(): Promise<FinancingProgram[]> {
  const rows = await db.select().from(financingPrograms);
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active && p.status === "published",
    rateConvention: p.rateConvention as RateConvention,
  }));
}

export async function recomputeMoney(): Promise<MoneyJobResult> {
  const fx = await getActiveFxRate();
  const programs = await loadPrograms();
  const usable = usablePrograms(programs);
  const notes: string[] = [];

  if (fx.fallback) {
    notes.push(
      "No hay cotización cargada en fx_rates — se usó USD_TO_PYG del entorno. " +
        "Cargá la cotización real en /admin/cotizacion.",
    );
  }
  if (!usable.length) {
    notes.push(
      programs.some((p) => p.active)
        ? "Los programas activos siguen siendo PLACEHOLDER: no se puede mostrar " +
            "ninguna cuota, las cacheadas se borran."
        : "No hay programas de financiación activos: las cuotas cacheadas se borran.",
    );
  }

  const rows = await db
    .select({
      id: listings.id,
      priceUsd: listings.priceUsd,
      priceGs: listings.priceGs,
      cuotaGs: listings.cuotaGs,
    })
    .from(listings);

  const result: MoneyJobResult = {
    rate: fx.rate,
    rateSource: fx.source,
    rateIsFallback: fx.fallback,
    usableProgramCount: usable.length,
    listingsScanned: rows.length,
    priceGsUpdated: 0,
    cuotaUpdated: 0,
    cuotaCleared: 0,
    notes,
  };

  // Fast path: nothing to quote from, so clear every cached cuota in one
  // statement and still refresh the ₲ prices below.
  if (!usable.length) {
    const cleared = await db
      .update(listings)
      .set({ cuotaGs: null })
      .where(isNotNull(listings.cuotaGs));
    result.cuotaCleared =
      (cleared as unknown as { rowsAffected?: number }).rowsAffected ?? 0;
  }

  for (const row of rows) {
    const set: { priceGs?: string; cuotaGs?: string | null } = {};

    const nextPriceGs = priceGsFromUsd(row.priceUsd, fx.rate);
    if (Number(row.priceGs) !== nextPriceGs) {
      set.priceGs = String(nextPriceGs);
      result.priceGsUpdated++;
    }

    if (usable.length) {
      const cuota = defaultCuota(nextPriceGs, usable);
      const nextCuota = cuota ? String(cuota.monthlyGs) : null;
      const prev = row.cuotaGs == null ? null : String(Number(row.cuotaGs));
      if (prev !== (nextCuota == null ? null : String(Number(nextCuota)))) {
        set.cuotaGs = nextCuota;
        if (nextCuota === null) result.cuotaCleared++;
        else result.cuotaUpdated++;
      }
    }

    if (Object.keys(set).length) {
      await db.update(listings).set(set).where(eq(listings.id, row.id));
    }
  }

  return result;
}

export interface LeadSweepResult {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: string | null;
}

/**
 * Lead delivery retry sweep.
 *
 * DELIBERATE NO-OP FOR NOW. The write-ahead `leads` table is audit F1, which
 * belongs to Batch 1 and has not landed yet (PLAN.md marks it NOT STARTED), so
 * there is nothing to retry: leads are still fire-and-forget at
 * src/lib/crm.ts. The seam exists here so wiring F1 is a body swap in one
 * function rather than a change to the cron contract, the route, the auth or
 * the response shape.
 */
export async function sweepLeads(): Promise<LeadSweepResult> {
  return {
    attempted: 0,
    delivered: 0,
    failed: 0,
    skipped:
      "La tabla `leads` todavía no existe (F1 / Batch 1). Cuando exista, " +
      "implementá el reintento acá y el cron ya lo ejecuta.",
  };
}
