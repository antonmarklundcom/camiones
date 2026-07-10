"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/ui";
import type { UserFormState } from "@app/(admin)/admin/(panel)/users/actions";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/auth/roles";

type Option = { id: number; name: string };

export interface UserFormValues {
  name?: string | null;
  email?: string | null;
  role?: Role;
  sellerId?: number | null;
}

interface Props {
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  sellers: Option[];
  values?: UserFormValues;
  submitLabel: string;
  isEdit?: boolean;
}

const labelCls = "mb-1 block text-sm font-medium text-ink";
const inputCls =
  "h-11 w-full rounded-lg border border-charcoal-100 bg-white px-3 text-ink outline-none focus:border-amber-brand";

export function UserForm({ action, sellers, values = {}, submitLabel, isEdit }: Props) {
  const [state, formAction] = useActionState<UserFormState, FormData>(action, {});
  const [role, setRole] = useState<Role>(values.role ?? "dealer");
  const err = state.fieldErrors ?? {};
  const FieldError = ({ name }: { name: string }) =>
    err[name] ? <p className="mt-1 text-xs text-red-600">{err[name]}</p> : null;

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <section className="space-y-4 rounded-xl border border-charcoal-100 bg-white p-5">
        <div>
          <label htmlFor="name" className={labelCls}>Nombre</label>
          <input id="name" name="name" defaultValue={values.name ?? ""} className={inputCls} maxLength={140} />
          <FieldError name="name" />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input id="email" name="email" type="email" defaultValue={values.email ?? ""} className={inputCls} required autoComplete="off" />
          <FieldError name="email" />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            className={inputCls}
            autoComplete="new-password"
            required={!isEdit}
            placeholder={isEdit ? "Dejá vacío para no cambiarla" : "Mínimo 8 caracteres"}
          />
          <FieldError name="password" />
        </div>
        <div>
          <label htmlFor="role" className={labelCls}>Rol</label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputCls}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        {role === "dealer" && (
          <div>
            <label htmlFor="sellerId" className={labelCls}>Concesionaria asignada</label>
            <select id="sellerId" name="sellerId" defaultValue={values.sellerId ?? ""} className={inputCls}>
              <option value="" disabled>Elegí…</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <FieldError name="sellerId" />
            <p className="mt-1 text-xs text-ink-soft">
              El usuario solo podrá ver y editar los avisos de esta concesionaria.
            </p>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/users" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
