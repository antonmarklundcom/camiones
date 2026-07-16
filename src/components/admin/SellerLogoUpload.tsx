"use client";
import { useActionState } from "react";
import {
  uploadSellerLogoAction,
  removeSellerLogoAction,
  type LogoActionState,
} from "@app/(admin)/admin/(panel)/sellers/actions";

interface Props {
  sellerId: number;
  logoUrl: string | null;
}

export function SellerLogoUpload({ sellerId, logoUrl }: Props) {
  const [state, action, pending] = useActionState<LogoActionState, FormData>(
    uploadSellerLogoAction.bind(null, sellerId),
    {},
  );

  return (
    <section className="rounded-xl border border-charcoal-100 bg-white p-5">
      <h2 className="mb-1 font-heading text-lg font-bold text-ink">Logo</h2>
      <p className="mb-4 text-sm text-ink-soft">
        Aparece en la página pública de la concesionaria. Se convierte a WebP.
      </p>

      {logoUrl && (
        <div className="mb-4">
          <div className="inline-block overflow-hidden rounded-lg border border-charcoal-100 bg-offwhite p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo actual" className="h-24 w-24 object-contain" />
          </div>
          <form action={removeSellerLogoAction.bind(null, sellerId)} className="mt-2">
            <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
              Quitar logo
            </button>
          </form>
        </div>
      )}

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal-100 file:px-4 file:py-2 file:font-heading file:font-bold file:text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-amber-brand px-4 font-heading font-bold text-charcoal-950 hover:bg-amber-deep disabled:opacity-60"
        >
          {pending ? "Subiendo…" : logoUrl ? "Reemplazar" : "Subir logo"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
