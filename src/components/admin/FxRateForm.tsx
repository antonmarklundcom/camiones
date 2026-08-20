"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/ui";
import { setFxRateAction, type FxFormState } from "@app/(admin)/admin/(panel)/cotizacion/actions";

const initial: FxFormState = {};

export function FxRateForm({ currentRate }: { currentRate: number }) {
  const [state, action] = useActionState(setFxRateAction, initial);

  return (
    <form
      action={action}
      className="rounded-xl border border-charcoal-100 bg-white p-5"
    >
      <h2 className="font-heading text-lg font-bold text-ink">Cargar nueva cotización</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Guardar recalcula el precio en ₲ y la cuota cacheada de todos los avisos.
        Las cotizaciones no se editan: cada cambio queda como una fila nueva.
      </p>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-ink">₲ por US$ 1</span>
        <input
          name="rate"
          inputMode="decimal"
          required
          defaultValue={String(Math.round(currentRate))}
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-100 px-3"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-ink">Fuente</span>
        <input
          name="source"
          maxLength={140}
          placeholder="BCP — tipo de cambio de referencia"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-100 px-3"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-ink">Nota (opcional)</span>
        <input
          name="note"
          maxLength={255}
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-100 px-3"
        />
      </label>

      <div className="mt-4">
        <SubmitButton pendingLabel="Guardando y recalculando…">
          Guardar y recalcular
        </SubmitButton>
      </div>
    </form>
  );
}
