import { requireAdmin } from "@/lib/auth/guard";
import { getActiveFxRate, listFxRates } from "@/lib/fx";
import { formatInt } from "@/lib/format";
import { FEATURE_FINANCING } from "@/lib/flags";
import { FxRateForm } from "@/components/admin/FxRateForm";
import { SubmitButton } from "@/components/admin/ui";
import { recomputeMoneyAction } from "./actions";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("es-PY", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CotizacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const [active, history, sp] = await Promise.all([
    getActiveFxRate(),
    listFxRates(30),
    searchParams,
  ]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">Cotización US$ → ₲</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">
        Los precios se cargan en dólares; el monto en guaraníes de cada aviso se
        deriva de esta cotización. Al guardarla se recalculan todos los avisos en
        el momento — no hay que esperar al cron.
      </p>

      {sp.guardado && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Cotización guardada y precios recalculados.
        </p>
      )}
      {sp.recalculado && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Precios y cuotas recalculados.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-charcoal-100 bg-white p-5">
          <p className="text-sm text-ink-soft">Cotización vigente</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-ink">
            ₲ {formatInt(active.rate)}{" "}
            <span className="font-heading text-base font-semibold text-ink-soft">
              por US$ 1
            </span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Fuente: {active.source}
            {active.createdAt ? ` · ${dt.format(active.createdAt)}` : ""}
          </p>
          {active.fallback && (
            <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink">
              Todavía no hay ninguna cotización cargada: se está usando el valor
              provisorio de la variable de entorno <code>USD_TO_PYG</code>.
              Cargá la real acá al lado.
            </p>
          )}
          {!FEATURE_FINANCING && (
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              La financiación está apagada (<code>NEXT_PUBLIC_FEATURE_FINANCING</code>)
              hasta que existan tasas verificadas, así que ningún aviso muestra
              cuotas. Los precios en ₲ sí se muestran.
            </p>
          )}

          <form action={recomputeMoneyAction} className="mt-4">
            <SubmitButton variant="ghost" pendingLabel="Recalculando…">
              Recalcular sin cambiar la cotización
            </SubmitButton>
          </form>
        </section>

        <FxRateForm currentRate={active.rate} />
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold text-ink">Historial</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-charcoal-100 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">₲ por US$</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id} className="border-b border-charcoal-100 last:border-0">
                <td className="px-4 py-3">
                  {dt.format(r.createdAt)}
                  {r.active && (
                    <span className="ml-2 rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-ink">
                      vigente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-ink">{formatInt(r.rate)}</td>
                <td className="px-4 py-3 text-ink-soft">{r.source}</td>
                <td className="px-4 py-3 text-ink-soft">{r.note ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-soft">
                  Todavía no cargaste ninguna cotización.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
