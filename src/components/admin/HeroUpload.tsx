"use client";
import { useActionState } from "react";
import {
  uploadHeroAction,
  removeHeroAction,
  type HeroActionState,
} from "@app/(admin)/admin/(panel)/guias/actions";

interface Props {
  contentId: number;
  heroUrl: string | null;
}

export function HeroUpload({ contentId, heroUrl }: Props) {
  const [state, action, pending] = useActionState<HeroActionState, FormData>(
    uploadHeroAction.bind(null, contentId),
    {},
  );

  return (
    <section className="rounded-xl border border-charcoal-100 bg-white p-5">
      <h2 className="mb-1 font-heading text-lg font-bold text-ink">Imagen de portada</h2>
      <p className="mb-4 text-sm text-ink-soft">
        Aparece arriba de la guía y en las tarjetas. Se convierte a WebP.
      </p>

      {heroUrl && (
        <div className="mb-4">
          <div className="overflow-hidden rounded-lg border border-charcoal-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="Portada actual" className="max-h-56 w-full object-cover" />
          </div>
          <form action={removeHeroAction.bind(null, contentId)} className="mt-2">
            <button
              type="submit"
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Quitar portada
            </button>
          </form>
        </div>
      )}

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="hero"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal-100 file:px-4 file:py-2 file:font-heading file:font-bold file:text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-amber-brand px-4 font-heading font-bold text-charcoal-950 hover:bg-amber-deep disabled:opacity-60"
        >
          {pending ? "Subiendo…" : heroUrl ? "Reemplazar" : "Subir portada"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
