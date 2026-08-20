"use client";
import { useMemo, useState } from "react";
import {
  RATE_CONVENTION_LABELS,
  defaultProgram,
  defaultTerm,
  frenchAmortization,
  type FinancingProgram,
} from "@/lib/cuota";
import { formatGs } from "@/lib/format";

/**
 * Live cuota calculator — down-payment % + term sliders → monthly ₲ using the
 * selected financing program (French amortization, same math as the cron).
 *
 * F5: it OPENS on `defaultProgram()` / `defaultTerm()` — the exact program and
 * term the cron cached on the card the buyer just clicked. It used to open on
 * 48 months against whichever program MySQL returned first, so the number on
 * the card and the number on the page disagreed.
 *
 * F26: the monthly rate honours each program's stored convention (TEA vs
 * nominal) instead of always dividing by 12.
 *
 * The caller only ever passes verified programs (`usablePrograms()` filters
 * placeholders out), and the whole section is behind the `financing` flag.
 */
export function CuotaCalculator({
  priceGs,
  programs,
}: {
  priceGs: number;
  programs: FinancingProgram[];
}) {
  const active = useMemo(() => programs.filter((p) => p.active), [programs]);
  const initialIdx = useMemo(() => {
    const preferred = defaultProgram(priceGs, active);
    const i = preferred ? active.findIndex((p) => p.code === preferred.code) : -1;
    return i >= 0 ? i : 0;
  }, [active, priceGs]);

  const [codeIdx, setCodeIdx] = useState(initialIdx);
  const program = active[Math.min(codeIdx, active.length - 1)];

  const [downPct, setDownPct] = useState(() =>
    program ? Math.ceil(program.minDownPct) : 20,
  );
  const [term, setTerm] = useState(() => (program ? defaultTerm(program) : 48));

  if (!program) return null;

  const minDown = Math.ceil(program.minDownPct);
  const effDownPct = Math.max(downPct, minDown);
  const downGs = Math.round(priceGs * (effDownPct / 100));
  const financedGs = priceGs - downGs;
  const effTerm = Math.min(term, program.maxTermMonths);
  const overCap =
    program.maxAmountGs !== null && financedGs > program.maxAmountGs;
  const monthly = overCap
    ? 0
    : Math.round(
        frenchAmortization(
          financedGs,
          program.annualRate,
          effTerm,
          program.rateConvention,
        ),
      );

  const selectProgram = (i: number) => {
    const p = active[i];
    setCodeIdx(i);
    setDownPct((d) => Math.max(d, Math.ceil(p.minDownPct)));
    setTerm((t) => Math.min(t, p.maxTermMonths));
  };

  return (
    <section
      aria-label="Calculadora de cuotas"
      className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
    >
      <h2 className="font-heading text-lg font-bold text-ink">
        Calculá tu cuota
      </h2>

      {active.length > 1 && (
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Programa
          </span>
          <select
            value={codeIdx}
            onChange={(e) => selectProgram(Number(e.target.value))}
            className="mt-1 h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-sm"
          >
            {active.map((p, i) => (
              <option key={p.code} value={i}>
                {p.name} — {p.annualRate}% anual
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-4 block">
        <span className="flex justify-between text-sm text-ink">
          <span>Entrega inicial</span>
          <strong>
            {effDownPct}% · {formatGs(downGs)}
          </strong>
        </span>
        <input
          type="range"
          min={minDown}
          max={70}
          step={5}
          value={effDownPct}
          onChange={(e) => setDownPct(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer accent-amber-deep"
          aria-label="Porcentaje de entrega inicial"
        />
      </label>

      <label className="mt-4 block">
        <span className="flex justify-between text-sm text-ink">
          <span>Plazo</span>
          <strong>{effTerm} meses</strong>
        </span>
        <input
          type="range"
          min={12}
          max={program.maxTermMonths}
          step={6}
          value={effTerm}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer accent-amber-deep"
          aria-label="Plazo en meses"
        />
      </label>

      <div className="mt-4 rounded-lg bg-amber-soft p-4 text-center">
        {overCap ? (
          <p className="text-sm text-ink">
            El monto a financiar supera el tope del programa — subí la entrega
            inicial o consultá otras opciones.
          </p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Cuota mensual estimada*
            </p>
            <p className="font-heading text-3xl font-extrabold text-amber-deep">
              {formatGs(monthly)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Financiás {formatGs(financedGs)} a {effTerm} meses ·{" "}
              {program.annualRate}%{" "}
              {program.rateConvention === "nominal" ? "nominal anual" : "TEA"}
            </p>
          </>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        * Cálculo referencial con {RATE_CONVENTION_LABELS[program.rateConvention ?? "nominal"]}
        {" "}— no constituye una oferta de crédito. Consultá las condiciones
        vigentes con tu banco o financiera.
      </p>
    </section>
  );
}
