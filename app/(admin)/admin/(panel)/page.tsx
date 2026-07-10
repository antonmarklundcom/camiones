import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { dashboardCounts } from "@/lib/admin/queries";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireUser();
  const counts = await dashboardCounts(user);

  const cards = [
    { label: "Avisos totales", value: counts.total },
    { label: "Publicados", value: counts.published },
    { label: "Borradores", value: counts.drafts },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-ink">
        Hola, {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-ink-soft">
        {ROLE_LABELS[user.role]}
        {user.role === "dealer"
          ? " — estás viendo solo los avisos de tu concesionaria."
          : " — tenés acceso completo al panel."}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-charcoal-100 bg-white p-5">
            <p className="text-sm text-ink-soft">{c.label}</p>
            <p className="mt-1 font-heading text-3xl font-extrabold text-ink">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/listings/new"
          className="inline-flex h-11 items-center rounded-lg bg-amber-brand px-5 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
        >
          + Nuevo aviso
        </Link>
        <Link
          href="/admin/listings"
          className="inline-flex h-11 items-center rounded-lg border border-charcoal-100 bg-white px-5 font-heading font-bold text-ink hover:bg-charcoal-100"
        >
          Ver avisos
        </Link>
      </div>
    </div>
  );
}
