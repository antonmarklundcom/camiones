"use client";
import { useActionState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/ui";
import type { SellerFormState } from "@app/(admin)/admin/(panel)/sellers/actions";
import { SELLER_TYPE_LABELS } from "@/lib/admin/constants";
import type { Role } from "@/lib/auth/roles";

type Option = { id: number; name: string };

export interface SellerFormValues {
  name?: string;
  type?: string;
  phoneWhatsapp?: string | null;
  phoneDisplay?: string | null;
  email?: string | null;
  address?: string | null;
  locationId?: number | null;
  description?: string | null;
  status?: string;
}

interface Props {
  action: (prev: SellerFormState, formData: FormData) => Promise<SellerFormState>;
  cities: Option[];
  role: Role;
  values?: SellerFormValues;
  submitLabel: string;
}

const labelCls = "mb-1 block text-sm font-medium text-ink";
const inputCls =
  "h-11 w-full rounded-lg border border-charcoal-100 bg-white px-3 text-ink outline-none focus:border-amber-brand";

export function SellerForm({ action, cities, role, values = {}, submitLabel }: Props) {
  const [state, formAction] = useActionState<SellerFormState, FormData>(action, {});
  const err = state.fieldErrors ?? {};
  const FieldError = ({ name }: { name: string }) =>
    err[name] ? <p className="mt-1 text-xs text-red-600">{err[name]}</p> : null;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-charcoal-100 bg-white p-5">
        <div>
          <label htmlFor="name" className={labelCls}>Nombre</label>
          <input id="name" name="name" defaultValue={values.name ?? ""} className={inputCls} required maxLength={160} />
          <FieldError name="name" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="type" className={labelCls}>Tipo</label>
            <select id="type" name="type" defaultValue={values.type ?? "dealer"} className={inputCls}>
              {Object.entries(SELLER_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="locationId" className={labelCls}>Ciudad</label>
            <select id="locationId" name="locationId" defaultValue={values.locationId ?? ""} className={inputCls}>
              <option value="">Sin especificar</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="phoneWhatsapp" className={labelCls}>WhatsApp (solo dígitos)</label>
            <input id="phoneWhatsapp" name="phoneWhatsapp" defaultValue={values.phoneWhatsapp ?? ""} className={inputCls} placeholder="595981123456" />
            <p className="mt-1 text-xs text-ink-soft">Con código de país, sin espacios ni símbolos.</p>
            <FieldError name="phoneWhatsapp" />
          </div>
          <div>
            <label htmlFor="phoneDisplay" className={labelCls}>Teléfono (para mostrar)</label>
            <input id="phoneDisplay" name="phoneDisplay" defaultValue={values.phoneDisplay ?? ""} className={inputCls} placeholder="(0981) 123 456" />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" name="email" type="email" defaultValue={values.email ?? ""} className={inputCls} />
            <FieldError name="email" />
          </div>
          <div>
            <label htmlFor="address" className={labelCls}>Dirección</label>
            <input id="address" name="address" defaultValue={values.address ?? ""} className={inputCls} maxLength={255} />
          </div>
        </div>
        <div>
          <label htmlFor="description" className={labelCls}>Descripción</label>
          <textarea id="description" name="description" rows={4} defaultValue={values.description ?? ""} className="w-full rounded-lg border border-charcoal-100 bg-white p-3 text-ink outline-none focus:border-amber-brand" maxLength={5000} />
        </div>
        {role === "admin" && (
          <div>
            <label htmlFor="status" className={labelCls}>Estado</label>
            <select id="status" name="status" defaultValue={values.status ?? "published"} className={inputCls}>
              <option value="published">Publicada</option>
              <option value="draft">Borrador</option>
            </select>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/sellers" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
