import Link from "next/link";
import { requireCapability } from "@/lib/auth/guard";
import { listAdminContent } from "@/lib/content/queries";
import { CONTENT_KIND_LABELS } from "@/lib/content/constants";
import { PublishBadge } from "@/components/admin/StatusBadge";
import { ConfirmSubmit } from "@/components/admin/ui";
import { guidePath } from "@/lib/urls";
import { changeContentStatusAction, deleteContentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCapability("manageContent");
  const rows = await listAdminContent();
  const sp = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Guías y contenido</h1>
        <Link
          href="/admin/guias/new"
          className="inline-flex h-11 items-center rounded-lg bg-amber-brand px-5 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
        >
          + Nueva guía
        </Link>
      </div>

      {sp.guardado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Cambios guardados.</p>
      )}
      {sp.borrado && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Página borrada.</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-100 bg-white px-4 py-12 text-center text-ink-soft">
          No hay contenido todavía. Creá la primera guía o generá borradores con el
          script <code>content:guias</code>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal-100 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-charcoal-100 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-charcoal-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/guias/${r.id}`} className="font-semibold text-ink hover:text-amber-deep">
                      {r.title}
                    </Link>
                    <div className="text-xs text-ink-soft">/guias/{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{CONTENT_KIND_LABELS[r.kind]}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {r.source === "manual" ? "Manual" : r.source}
                  </td>
                  <td className="px-4 py-3">
                    <PublishBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "published" && (
                        <Link
                          href={guidePath(r.slug)}
                          target="_blank"
                          className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                        >
                          Ver ↗
                        </Link>
                      )}
                      <Link
                        href={`/admin/guias/${r.id}`}
                        className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100"
                      >
                        Editar
                      </Link>
                      {r.status === "published" ? (
                        <form action={changeContentStatusAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="draft" />
                          <button type="submit" className="rounded-md border border-charcoal-100 px-2.5 py-1 text-xs font-medium text-ink hover:bg-charcoal-100">
                            Despublicar
                          </button>
                        </form>
                      ) : (
                        <form action={changeContentStatusAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="published" />
                          <button type="submit" className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700">
                            Publicar
                          </button>
                        </form>
                      )}
                      <form action={deleteContentAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit
                          message={`¿Borrar “${r.title}”?`}
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
