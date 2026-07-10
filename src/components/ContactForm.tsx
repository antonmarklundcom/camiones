"use client";
import { useActionState } from "react";
import type { LeadState } from "@/lib/lead";

/**
 * 3-field contact form (nombre, teléfono, mensaje — PLAN.md max). Progressive
 * enhancement: it's a plain <form action={serverAction}>, so it submits even
 * before hydration; useActionState only adds the inline confirmation.
 */
export function ContactForm({
  action,
  listingTitle,
}: {
  action: (state: LeadState, formData: FormData) => Promise<LeadState>;
  listingTitle: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  const inputCls =
    "h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-ink focus:border-amber-brand focus:outline-none";

  if (state.status === "ok") {
    return (
      <div className="rounded-xl border border-wa/30 bg-wa/10 p-4 text-sm text-ink" role="status">
        <p className="font-heading font-bold">¡Gracias por tu consulta!</p>
        <p className="mt-1">Te contactamos en breve por teléfono o WhatsApp.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3" aria-label="Formulario de consulta">
      <div>
        <label htmlFor="lead-nombre" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Nombre
        </label>
        <input id="lead-nombre" name="nombre" required maxLength={140} autoComplete="name" className={inputCls} />
      </div>
      <div>
        <label htmlFor="lead-telefono" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Teléfono
        </label>
        <input
          id="lead-telefono"
          name="telefono"
          type="tel"
          required
          maxLength={30}
          autoComplete="tel"
          placeholder="09XX XXX XXX"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="lead-mensaje" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Mensaje
        </label>
        <textarea
          id="lead-mensaje"
          name="mensaje"
          required
          rows={3}
          maxLength={1000}
          defaultValue={`Hola, me interesa el ${listingTitle}. ¿Sigue disponible?`}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-ink focus:border-amber-brand focus:outline-none"
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.message ?? "No pudimos enviar tu consulta — probá de nuevo."}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-charcoal-950 font-heading font-bold text-white transition-colors hover:bg-charcoal-800 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Consultá ahora"}
      </button>
    </form>
  );
}
