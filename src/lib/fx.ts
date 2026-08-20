/**
 * F11 — the USD→PYG rate lives in the DB, not in a build-time env constant.
 *
 * USD is the primary price (Decisions Log). `listings.price_gs` is a DERIVED
 * cache, exactly like `cuota_gs`: it is recomputed from `price_usd × rate`
 * whenever the rate changes (src/lib/jobs/money.ts), so a guaraní figure on a
 * card can never drift away from the dollar figure next to it.
 *
 * `USD_TO_PYG` survives only as the bootstrap fallback for a database that has
 * no rate row yet (fresh install, seeds). Once a row exists, the env var is
 * ignored — deliberately, so nobody "fixes" the rate by editing an env var and
 * wonders why nothing changed.
 *
 * No `import "server-only"` here on purpose: `server-only` only resolves inside
 * Next's bundler, and the tsx scripts (`cron:cuotas`, `import:csv`) need this
 * module. Importing `@/db` already makes it unusable in a client bundle.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fxRates } from "@/db/schema";

export const FX_BASE = "USD";
export const FX_QUOTE = "PYG";

/** Bootstrap-only. Not a source of truth once fx_rates has a row. */
export const FX_ENV_FALLBACK = Number(process.env.USD_TO_PYG ?? 7300);

export interface FxRate {
  id: number | null;
  rate: number;
  source: string;
  note: string | null;
  createdAt: Date | null;
  /** True when this came from USD_TO_PYG because the table is empty. */
  fallback: boolean;
}

export async function getActiveFxRate(): Promise<FxRate> {
  const [row] = await db
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, FX_BASE),
        eq(fxRates.quote, FX_QUOTE),
        eq(fxRates.active, true),
      ),
    )
    .orderBy(desc(fxRates.createdAt))
    .limit(1);

  if (!row) {
    return {
      id: null,
      rate: FX_ENV_FALLBACK,
      source: `USD_TO_PYG (env, provisorio)`,
      note: null,
      createdAt: null,
      fallback: true,
    };
  }
  return {
    id: row.id,
    rate: Number(row.rate),
    source: row.source,
    note: row.note,
    createdAt: row.createdAt,
    fallback: false,
  };
}

export async function listFxRates(limit = 30) {
  return db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, FX_BASE), eq(fxRates.quote, FX_QUOTE)))
    .orderBy(desc(fxRates.createdAt))
    .limit(limit);
}

/**
 * Rates are append-only: deactivate whatever is active, insert the new row.
 * The caller is responsible for kicking off the price recompute afterwards
 * (`recomputeMoney()` in src/lib/jobs/money.ts) — the two are separate so the
 * cron can recompute without writing a rate.
 */
export async function setActiveFxRate(input: {
  rate: number;
  source: string;
  note?: string | null;
  createdBy?: number | null;
}): Promise<number> {
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("La cotización tiene que ser un número mayor a cero.");
  }
  await db
    .update(fxRates)
    .set({ active: false })
    .where(
      and(
        eq(fxRates.base, FX_BASE),
        eq(fxRates.quote, FX_QUOTE),
        eq(fxRates.active, true),
      ),
    );
  const res = await db.insert(fxRates).values({
    base: FX_BASE,
    quote: FX_QUOTE,
    rate: input.rate.toFixed(4),
    source: input.source.slice(0, 140) || "manual",
    note: input.note?.slice(0, 255) || null,
    active: true,
    createdBy: input.createdBy ?? null,
  });
  return Number(res[0].insertId);
}

/** ₲ from US$ at a given rate. The one place the multiplication happens. */
export function priceGsFromUsd(priceUsd: number | string, rate: number): number {
  return Math.round(Number(priceUsd) * rate);
}
