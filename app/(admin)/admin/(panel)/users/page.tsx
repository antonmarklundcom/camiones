import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { listAdminUsers } from "@/lib/admin/queries";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ConfirmSubmit } from "@/components/admin/ui";
import { deleteUserAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireAdmin();
  const rows = await listAdminUsers();
  const sp = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Usuarios</h1>
        <Link
          href="/admin/users/new"
          className="inline-flex h-11 items-center rounded-lg bg-amber-brand px-5 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
        >
          + Nuevo usuario
        </Link>
      </div>

      {sp.guardado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Cambios guardados.</p>
      )}
      {sp.borrado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Usuario borrado.</p>
      )}
      {sp.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{sp.error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-charcoal-100 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Concesionaria</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-charcoal-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${r.id}`} className="font-semibold text-ink hover:text-amber-deep">
                    {r.email}
                  </Link>
                  {r.id === me.id && (
                    <span className="ml-2 rounded bg-charcoal-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                      vos
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{r.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-soft">{ROLE_LABELS[r.role]}</td>
                <td className="px-4 py-3 text-ink-soft">{r.sellerName ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/users/${r.id}`}
                      className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                    >
                      Editar
                    </Link>
                    {r.id !== me.id && (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit
                          message={`¿Borrar al usuario ${r.email}?`}
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
    </div>
  );
}
