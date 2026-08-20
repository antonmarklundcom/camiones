import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import {
  analyticsTotals,
  hasAnalytics,
  listingStats,
  sellerStats,
} from "@/lib/analytics/queries";
import { formatInt } from "@/lib/format";
import { listingPath, sellerPath } from "@/lib/urls";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

/** Clicks per view. The number a dealer should actually be judged on. */
function conversion(clicks: number, views: number): string {
  if (!views) return "—";
  return `${Math.round((clicks / views) * 100)}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.dias) as (typeof RANGES)[number])
    ? Number(sp.dias)
    : 30;

  const [totals, listings, sellersRows, any] = await Promise.all([
    analyticsTotals(user, days),
    listingStats(user, days),
    sellerStats(user, days),
    hasAnalytics(),
  ]);

  const cards = [
    { label: "Visitas", value: totals.pageViews, hint: `${formatInt(totals.visitors)} personas` },
    { label: "Clics a WhatsApp", value: totals.waClicks, hint: "la conversión real" },
    { label: "Consultas por formulario", value: totals.leads, hint: "" },
    {
      label: "Clics / visita",
      value: null,
      text: conversion(totals.waClicks, totals.pageViews),
      hint: "",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Estadísticas</h1>
        <nav aria-label="Rango" className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?dias=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                r === days
                  ? "bg-charcoal-950 text-white"
                  : "border border-charcoal-100 bg-white text-ink hover:bg-charcoal-100"
              }`}
            >
              {r} días
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-1 max-w-2xl text-ink-soft">
        Medición propia, sin Google ni scripts de terceros. Los números se
        consolidan una vez por día, así que el día de hoy aparece recién mañana.
      </p>

      {!any && (
        <p className="mt-4 rounded-lg bg-amber-soft px-4 py-3 text-sm text-ink">
          Todavía no hay datos consolidados. Se generan con{" "}
          <code>npm run analytics:rollup</code> o con el cron
          (<code>/api/cron?job=analytics</code>) — mirá <code>docs/cron.md</code>.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-charcoal-100 bg-white p-5">
            <p className="text-sm text-ink-soft">{c.label}</p>
            <p className="mt-1 font-heading text-3xl font-extrabold text-ink">
              {c.text ?? formatInt(c.value ?? 0)}
            </p>
            {c.hint && <p className="mt-0.5 text-xs text-ink-soft">{c.hint}</p>}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold text-ink">Por aviso</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Ordenado por clics a WhatsApp. Un aviso con muchas visitas y cero clics
        suele ser un problema de precio o de fotos, no de tráfico.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-charcoal-100 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Aviso</th>
              {user.role === "admin" && <th className="px-4 py-3 font-medium">Vendedor</th>}
              <th className="px-4 py-3 font-medium text-right">Visitas</th>
              <th className="px-4 py-3 font-medium text-right">WhatsApp</th>
              <th className="px-4 py-3 font-medium text-right">Consultas</th>
              <th className="px-4 py-3 font-medium text-right">Conversión</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((r) => (
              <tr key={r.listingId} className="border-b border-charcoal-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={listingPath(r.slug)}
                    target="_blank"
                    className="font-semibold text-ink hover:text-amber-deep"
                  >
                    {r.title}
                  </Link>
                </td>
                {user.role === "admin" && (
                  <td className="px-4 py-3 text-ink-soft">{r.sellerName}</td>
                )}
                <td className="px-4 py-3 text-right">{formatInt(r.pageViews)}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  {formatInt(r.waClicks)}
                </td>
                <td className="px-4 py-3 text-right">{formatInt(r.leads)}</td>
                <td className="px-4 py-3 text-right text-ink-soft">
                  {conversion(r.waClicks, r.pageViews)}
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                  Sin datos en este rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {user.role === "admin" && (
        <>
          <h2 className="mt-8 font-heading text-lg font-bold text-ink">Por vendedor</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-charcoal-100 text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium text-right">Visitas</th>
                  <th className="px-4 py-3 font-medium text-right">WhatsApp</th>
                  <th className="px-4 py-3 font-medium text-right">Consultas</th>
                </tr>
              </thead>
              <tbody>
                {sellersRows.map((r) => (
                  <tr key={r.sellerId} className="border-b border-charcoal-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={sellerPath(r.slug)}
                        target="_blank"
                        className="font-semibold text-ink hover:text-amber-deep"
                      >
                        {r.name}
                      </Link>
                      {r.verifiedAt && (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          ✓ verificado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatInt(r.pageViews)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatInt(r.waClicks)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatInt(r.leads)}</td>
                  </tr>
                ))}
                {sellersRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink-soft">
                      Sin datos en este rango.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
