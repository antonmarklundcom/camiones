import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { listAdminSellers } from "@/lib/admin/queries";
import { PublishBadge } from "@/components/admin/StatusBadge";
import { ConfirmSubmit } from "@/components/admin/ui";
import { SELLER_TYPE_LABELS } from "@/lib/admin/sellers";
import { sellerPath } from "@/lib/urls";
import { deleteSellerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const rows = await listAdminSellers(user);
  const sp = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">
          {isAdmin ? "Concesionarias" : "Mi concesionaria"}
        </h1>
        {isAdmin && (
          <Link
            href="/admin/sellers/new"
            className="inline-flex h-11 items-center rounded-lg bg-amber-brand px-5 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
          >
            + Nueva concesionaria
          </Link>
        )}
      </div>

      {sp.guardado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Cambios guardados.</p>
      )}
      {sp.borrado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Concesionaria borrada.</p>
      )}
      {sp.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{sp.error}</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-100 bg-white px-4 py-12 text-center text-ink-soft">
          No hay concesionarias todavía.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-charcoal-100 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Ciudad</th>
                <th className="px-4 py-3 font-medium">Avisos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-charcoal-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/sellers/${r.id}`} className="font-semibold text-ink hover:text-amber-deep">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {SELLER_TYPE_LABELS[r.type]}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{r.cityName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.listingCount}</td>
                  <td className="px-4 py-3">
                    <PublishBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "published" && (
                        <Link
                          href={sellerPath(r.slug)}
                          target="_blank"
                          className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                        >
                          Ver ↗
                        </Link>
                      )}
                      <Link
                        href={`/admin/sellers/${r.id}`}
                        className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                      >
                        Editar
                      </Link>
                      {isAdmin && (
                        <form action={deleteSellerAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmSubmit
                            message={`¿Borrar “${r.name}”?`}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Borrar
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
