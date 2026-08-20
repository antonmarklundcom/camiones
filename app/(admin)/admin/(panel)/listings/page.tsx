import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { listAdminListings } from "@/lib/admin/queries";
import { formatUsd } from "@/lib/format";
import { ListingStatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmSubmit } from "@/components/admin/ui";
import { canTransition } from "@/lib/admin/constants";
import { changeStatusAction, deleteListingAction } from "./actions";

export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  guardado: "Aviso guardado.",
  borrado: "Aviso borrado.",
  nuevo: "Aviso creado.",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rows = await listAdminListings(user);
  const sp = await searchParams;
  const flashKey = Object.keys(FLASH).find((k) => k in sp);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Avisos</h1>
        <Link
          href="/admin/listings/new"
          className="inline-flex h-11 items-center rounded-lg bg-amber-brand px-5 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
        >
          + Nuevo aviso
        </Link>
      </div>

      {flashKey && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          {FLASH[flashKey]}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-100 bg-white px-4 py-12 text-center text-ink-soft">
          Todavía no hay avisos. Creá el primero con “Nuevo aviso”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-charcoal-100 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Aviso</th>
                {user.role === "admin" && (
                  <th className="px-4 py-3 font-medium">Concesionaria</th>
                )}
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-charcoal-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/listings/${r.id}`}
                      className="font-semibold text-ink hover:text-amber-deep"
                    >
                      {r.title}
                    </Link>
                    {r.featured && (
                      <span className="ml-2 rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber-deep">
                        Destacado
                      </span>
                    )}
                    <div className="text-xs text-ink-soft">{r.brandName}</div>
                  </td>
                  {user.role === "admin" && (
                    <td className="px-4 py-3 text-ink-soft">{r.sellerName}</td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">{formatUsd(r.priceUsd)}</td>
                  <td className="px-4 py-3">
                    <ListingStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/listings/${r.id}`}
                        className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                      >
                        Editar
                      </Link>
                      {/* F27: a sold/removed listing can't jump straight back
                          to published — it goes through borrador first. */}
                      {r.status === "published" ? (
                        <form action={changeStatusAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="paused" />
                          <button
                            type="submit"
                            className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                          >
                            Pausar
                          </button>
                        </form>
                      ) : canTransition(r.status, "published") ? (
                        <form action={changeStatusAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="published" />
                          <button
                            type="submit"
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700"
                          >
                            Publicar
                          </button>
                        </form>
                      ) : (
                        <form action={changeStatusAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="draft" />
                          <button
                            type="submit"
                            className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                          >
                            Pasar a borrador
                          </button>
                        </form>
                      )}
                      <form action={deleteListingAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit
                          message={`¿Borrar “${r.title}”? Esta acción no se puede deshacer.`}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Borrar
                        </ConfirmSubmit>
                      </form>
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
