"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/ui";
import type { ContentFormState } from "@app/(admin)/admin/(panel)/guias/actions";
import { CONTENT_KIND_VALUES, CONTENT_KIND_LABELS } from "@/lib/content/constants";
import { CATEGORIES } from "@/lib/taxonomy";
import type { ContentKind } from "@/db/schema";

type Option = { id: number; name: string };

export interface ContentFormValues {
  title?: string;
  kind?: ContentKind;
  excerpt?: string | null;
  body?: string;
  brandId?: number | null;
  category?: string | null;
  status?: string;
}

interface Props {
  action: (prev: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  brands: Option[];
  values?: ContentFormValues;
  submitLabel: string;
}

const labelCls = "mb-1 block text-sm font-medium text-ink";
const inputCls =
  "h-11 w-full rounded-lg border border-charcoal-100 bg-white px-3 text-ink outline-none focus:border-amber-brand";

export function ContentForm({ action, brands, values = {}, submitLabel }: Props) {
  const [state, formAction] = useActionState<ContentFormState, FormData>(action, {});
  const [kind, setKind] = useState<ContentKind>(values.kind ?? "guia");
  const err = state.fieldErrors ?? {};
  const FieldError = ({ name }: { name: string }) =>
    err[name] ? <p className="mt-1 text-xs text-red-600">{err[name]}</p> : null;

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-charcoal-100 bg-white p-5">
        <div>
          <label htmlFor="title" className={labelCls}>Título</label>
          <input id="title" name="title" defaultValue={values.title ?? ""} className={inputCls} required maxLength={200} placeholder="Cómo financiar un camión en Paraguay" />
          <FieldError name="title" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className={labelCls}>Tipo</label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContentKind)}
              className={inputCls}
            >
              {CONTENT_KIND_VALUES.map((k) => (
                <option key={k} value={k}>{CONTENT_KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className={labelCls}>Estado</label>
            <select id="status" name="status" defaultValue={values.status ?? "draft"} className={inputCls}>
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
            </select>
          </div>

          {kind === "marca" && (
            <div>
              <label htmlFor="brandId" className={labelCls}>Marca vinculada</label>
              <select id="brandId" name="brandId" defaultValue={values.brandId ?? ""} className={inputCls}>
                <option value="">Sin vincular</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          {kind === "categoria" && (
            <div>
              <label htmlFor="category" className={labelCls}>Categoría vinculada</label>
              <select id="category" name="category" defaultValue={values.category ?? ""} className={inputCls}>
                <option value="">Sin vincular</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.plural}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="excerpt" className={labelCls}>Resumen (meta descripción)</label>
          <textarea id="excerpt" name="excerpt" rows={2} defaultValue={values.excerpt ?? ""} className="w-full rounded-lg border border-charcoal-100 bg-white p-3 text-ink outline-none focus:border-amber-brand" maxLength={320} placeholder="Se usa como descripción en Google y en las tarjetas. Si lo dejás vacío se genera del contenido." />
          <FieldError name="excerpt" />
        </div>

        <div>
          <label htmlFor="body" className={labelCls}>Contenido (Markdown)</label>
          <textarea id="body" name="body" rows={18} defaultValue={values.body ?? ""} className="w-full rounded-lg border border-charcoal-100 bg-white p-3 font-mono text-sm text-ink outline-none focus:border-amber-brand" required placeholder={"## Subtítulo\n\nEscribí en **Markdown**. Se permiten encabezados, listas, enlaces y tablas."} />
          <p className="mt-1 text-xs text-ink-soft">
            Markdown: `##` subtítulos, `**negrita**`, listas con `-`, enlaces `[texto](url)`. El HTML crudo se elimina por seguridad.
          </p>
          <FieldError name="body" />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/guias" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
