"use client";
import { useMemo, useState } from "react";
import {
  frenchAmortization,
  type FinancingProgram,
} from "@/lib/cuota";
import { formatGs } from "@/lib/format";

/**
 * Live cuota calculator — down-payment % + term sliders → monthly ₲ using
 * the selected financing program (French amortization, same math as the
 * nightly cache cron). Rates are PLACEHOLDERS until Phase 4 verifies real
 * bank terms; the disclaimer is not optional.
 */
export function CuotaCalculator({
  priceGs,
  programs,
}: {
  priceGs: number;
  programs: FinancingProgram[];
}) {
  const active = useMemo(() => programs.filter((p) => p.active), [programs]);
  const [codeIdx, setCodeIdx] = useState(0);
  const program = active[Math.min(codeIdx, active.length - 1)];

  const [downPct, setDownPct] = useState(() =>
    program ? Math.max(20, Math.ceil(program.minDownPct)) : 20,
  );
  const [term, setTerm] = useState(() =>
    program ? Math.min(48, program.maxTermMonths) : 48,
  );

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
    : Math.round(frenchAmortization(financedGs, program.annualRate, effTerm));

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
              Cuota mensual estimada
            </p>
            <p className="font-heading text-3xl font-extrabold text-amber-deep">
              {formatGs(monthly)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Financiás {formatGs(financedGs)} a {effTerm} meses ·{" "}
              {program.annualRate}% anual
            </p>
          </>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Cálculo referencial con tasas de ejemplo (placeholder) — no constituye
        una oferta de crédito. Consultá las condiciones vigentes con tu banco o
        financiera.
      </p>
    </section>
  );
}
