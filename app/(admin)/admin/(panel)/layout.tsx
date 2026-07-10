import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "./actions";

/**
 * Auth gate + shell for the whole panel. `requireUser()` redirects to
 * /admin/login when there's no session, so every page/action below inherits a
 * logged-in user. The `(panel)` route group keeps this away from /admin/login
 * itself (which must stay reachable while logged out).
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-offwhite text-ink">
      <header className="bg-charcoal-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-heading text-lg font-extrabold">
              camiones<span className="text-amber-brand">.py</span>{" "}
              <span className="text-white/60">panel</span>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">
              {user.name ?? user.email} · {ROLE_LABELS[user.role]}
            </span>
            <Link
              href="/"
              target="_blank"
              className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
            >
              Ver sitio ↗
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md bg-white/10 px-3 py-1.5 font-medium text-white hover:bg-white/20"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-1.5">
            <AdminNav role={user.role} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
