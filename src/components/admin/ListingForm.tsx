"use client";
import { useActionState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/ui";
import type { ListingFormState } from "@app/(admin)/admin/(panel)/listings/actions";
import {
  CATEGORIES,
  TRANSMISSION_LABELS,
  FUEL_LABELS,
  conditionLabel,
} from "@/lib/taxonomy";
import {
  CONDITION_VALUES,
  FUEL_VALUES,
  TRACTION_VALUES,
  TRANSMISSION_VALUES,
} from "@/db/schema";
import {
  LISTING_STATUS_VALUES,
  LISTING_STATUS_LABELS,
} from "@/lib/admin/constants";
import type { Role } from "@/lib/auth/roles";

type Option = { id: number; name: string };

export interface ListingFormValues {
  condition?: string;
  category?: string;
  brandId?: number;
  model?: string;
  year?: number;
  km?: number;
  priceUsd?: string | number;
  priceGs?: string | number;
  transmission?: string;
  fuel?: string;
  traction?: string;
  capacityKg?: number | null;
  description?: string | null;
  locationId?: number;
  sellerId?: number;
  featured?: boolean;
  status?: string;
}

interface Props {
  action: (
    prev: ListingFormState,
    formData: FormData,
  ) => Promise<ListingFormState>;
  brands: Option[];
  cities: Option[];
  sellers: Option[];
  role: Role;
  values?: ListingFormValues;
  submitLabel: string;
}

const labelCls = "mb-1 block text-sm font-medium text-ink";
const inputCls =
  "h-11 w-full rounded-lg border border-charcoal-100 bg-white px-3 text-ink outline-none focus:border-amber-brand";

export function ListingForm({
  action,
  brands,
  cities,
  sellers,
  role,
  values = {},
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState<ListingFormState, FormData>(action, {});
  const err = state.fieldErrors ?? {};

  const FieldError = ({ name }: { name: string }) =>
    err[name] ? <p className="mt-1 text-xs text-red-600">{err[name]}</p> : null;

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* --- Clasificación --- */}
      <section className="rounded-xl border border-charcoal-100 bg-white p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">Clasificación</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelCls}>Categoría</label>
            <select id="category" name="category" defaultValue={values.category ?? ""} className={inputCls} required>
              <option value="" disabled>Elegí…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.singular}</option>
              ))}
            </select>
            <FieldError name="category" />
          </div>
          <div>
            <label htmlFor="condition" className={labelCls}>Condición</label>
            <select id="condition" name="condition" defaultValue={values.condition ?? ""} className={inputCls} required>
              <option value="" disabled>Elegí…</option>
              {CONDITION_VALUES.map((c) => (
                <option key={c} value={c}>{conditionLabel(c)}</option>
              ))}
            </select>
            <FieldError name="condition" />
          </div>
          <div>
            <label htmlFor="brandId" className={labelCls}>Marca</label>
            <select id="brandId" name="brandId" defaultValue={values.brandId ?? ""} className={inputCls} required>
              <option value="" disabled>Elegí…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <FieldError name="brandId" />
          </div>
          <div>
            <label htmlFor="model" className={labelCls}>Modelo</label>
            <input id="model" name="model" defaultValue={values.model ?? ""} className={inputCls} required maxLength={120} placeholder="Atego 1726" />
            <FieldError name="model" />
          </div>
        </div>
      </section>

      {/* --- Especificaciones --- */}
      <section className="rounded-xl border border-charcoal-100 bg-white p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">Especificaciones</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="year" className={labelCls}>Año</label>
            <input id="year" name="year" type="number" min={1970} max={2035} defaultValue={values.year ?? ""} className={inputCls} required />
            <FieldError name="year" />
          </div>
          <div>
            <label htmlFor="km" className={labelCls}>Kilómetros</label>
            <input id="km" name="km" type="number" min={0} defaultValue={values.km ?? 0} className={inputCls} />
            <FieldError name="km" />
          </div>
          <div>
            <label htmlFor="capacityKg" className={labelCls}>Capacidad (kg)</label>
            <input id="capacityKg" name="capacityKg" type="number" min={0} defaultValue={values.capacityKg ?? ""} className={inputCls} placeholder="opcional" />
            <FieldError name="capacityKg" />
          </div>
          <div>
            <label htmlFor="transmission" className={labelCls}>Transmisión</label>
            <select id="transmission" name="transmission" defaultValue={values.transmission ?? "manual"} className={inputCls} required>
              {TRANSMISSION_VALUES.map((t) => (
                <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>
              ))}
            </select>
            <FieldError name="transmission" />
          </div>
          <div>
            <label htmlFor="fuel" className={labelCls}>Combustible</label>
            <select id="fuel" name="fuel" defaultValue={values.fuel ?? "diesel"} className={inputCls} required>
              {FUEL_VALUES.map((f) => (
                <option key={f} value={f}>{FUEL_LABELS[f]}</option>
              ))}
            </select>
            <FieldError name="fuel" />
          </div>
          <div>
            <label htmlFor="traction" className={labelCls}>Tracción</label>
            <select id="traction" name="traction" defaultValue={values.traction ?? "4x2"} className={inputCls} required>
              {TRACTION_VALUES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <FieldError name="traction" />
          </div>
        </div>
      </section>

      {/* --- Precio + ubicación --- */}
      <section className="rounded-xl border border-charcoal-100 bg-white p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">Precio y ubicación</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="priceUsd" className={labelCls}>Precio (US$)</label>
            <input id="priceUsd" name="priceUsd" type="number" min={1} step="1" defaultValue={values.priceUsd ?? ""} className={inputCls} required />
            <FieldError name="priceUsd" />
          </div>
          <div>
            <label htmlFor="priceGs" className={labelCls}>Precio (₲)</label>
            <input id="priceGs" name="priceGs" type="number" min={0} step="1" defaultValue={values.priceGs ?? ""} className={inputCls} placeholder="vacío = se calcula por tipo de cambio" />
            <p className="mt-1 text-xs text-ink-soft">Dejalo vacío para calcular con el tipo de cambio configurado.</p>
            <FieldError name="priceGs" />
          </div>
          <div>
            <label htmlFor="locationId" className={labelCls}>Ciudad</label>
            <select id="locationId" name="locationId" defaultValue={values.locationId ?? ""} className={inputCls} required>
              <option value="" disabled>Elegí…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError name="locationId" />
          </div>
          {role === "admin" && (
            <div>
              <label htmlFor="sellerId" className={labelCls}>Concesionaria</label>
              <select id="sellerId" name="sellerId" defaultValue={values.sellerId ?? ""} className={inputCls} required>
                <option value="" disabled>Elegí…</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <FieldError name="sellerId" />
            </div>
          )}
        </div>
      </section>

      {/* --- Descripción + publicación --- */}
      <section className="rounded-xl border border-charcoal-100 bg-white p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">Descripción y estado</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="description" className={labelCls}>Descripción</label>
            <textarea id="description" name="description" rows={5} defaultValue={values.description ?? ""} className="w-full rounded-lg border border-charcoal-100 bg-white p-3 text-ink outline-none focus:border-amber-brand" maxLength={5000} placeholder="Estado general, mantenimiento, extras…" />
            <FieldError name="description" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className={labelCls}>Estado</label>
              <select id="status" name="status" defaultValue={values.status ?? "draft"} className={inputCls}>
                {LISTING_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>{LISTING_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 self-end pb-2">
              <input type="checkbox" name="featured" defaultChecked={values.featured ?? false} className="h-5 w-5 rounded border-charcoal-100 accent-amber-brand" />
              <span className="text-sm font-medium text-ink">Destacado (aparece en la home)</span>
            </label>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/listings" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
