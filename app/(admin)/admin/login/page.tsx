"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center font-heading text-2xl font-extrabold tracking-tight text-white"
        >
          camiones<span className="text-amber-brand">.com.py</span>
        </Link>
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h1 className="font-heading text-xl font-bold text-ink">
            Panel de gestión
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Ingresá con tu usuario de administrador o concesionaria.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            {state.error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {state.error}
              </p>
            )}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className="h-11 w-full rounded-lg border border-charcoal-100 px-3 text-ink outline-none focus:border-amber-brand"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-charcoal-100 px-3 text-ink outline-none focus:border-amber-brand"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-lg bg-amber-brand font-heading font-bold text-charcoal-950 transition-colors hover:bg-amber-deep disabled:opacity-60"
            >
              {pending ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
