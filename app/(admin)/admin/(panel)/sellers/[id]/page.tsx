import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { getAdminSeller, getCityOptions } from "@/lib/admin/queries";
import { SellerForm } from "@/components/admin/SellerForm";
import { SellerLogoUpload } from "@/components/admin/SellerLogoUpload";
import { imageUrl } from "@/lib/r2";
import { sellerPath } from "@/lib/urls";
import { toggleSellerVerifiedAction, updateSellerAction } from "../actions";
import { SubmitButton } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function EditSellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const seller = await getAdminSeller(user, id);
  if (!seller) notFound();
  const cities = await getCityOptions();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link href="/admin/sellers" className="text-sm text-ink-soft hover:text-ink">
          ← Volver a concesionarias
        </Link>
        {seller.status === "published" && (
          <Link
            href={sellerPath(seller.slug)}
            target="_blank"
            className="text-sm font-medium text-amber-deep hover:underline"
          >
            Ver página pública ↗
          </Link>
        )}
      </div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-ink">{seller.name}</h1>

      {/* I6/F18 — verification is manual and admin-only by decision: a human
          checks RUC + WhatsApp ownership. The public badge renders from this
          column alone, so the home page's "vendedores verificados" claim is
          finally backed by something. */}
      {user.role === "admin" && (
        <section className="mb-8 max-w-2xl rounded-xl border border-charcoal-100 bg-white p-5">
          <h2 className="font-heading text-lg font-bold text-ink">Verificación</h2>
          {seller.verifiedAt ? (
            <>
              <p className="mt-1 text-sm text-ink">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
                  ✓ Verificado
                </span>{" "}
                el {new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(seller.verifiedAt)}
                {seller.verifiedNote ? ` · ${seller.verifiedNote}` : ""}
              </p>
              <form action={toggleSellerVerifiedAction} className="mt-3">
                <input type="hidden" name="id" value={seller.id} />
                <input type="hidden" name="verified" value="0" />
                <SubmitButton variant="ghost" pendingLabel="Quitando…">
                  Quitar verificación
                </SubmitButton>
              </form>
            </>
          ) : (
            <form action={toggleSellerVerifiedAction} className="mt-3 space-y-3">
              <p className="text-sm text-ink-soft">
                Verificá el RUC y que el número de WhatsApp sea realmente suyo
                antes de marcarlo. El badge aparece en cada aviso.
              </p>
              <input type="hidden" name="id" value={seller.id} />
              <input type="hidden" name="verified" value="1" />
              <label className="block">
                <span className="text-sm font-medium text-ink">Nota (qué verificaste)</span>
                <input
                  name="note"
                  maxLength={255}
                  placeholder="RUC 80012345-6 · WhatsApp confirmado por llamada"
                  className="mt-1 h-11 w-full rounded-lg border border-charcoal-100 px-3"
                />
              </label>
              <SubmitButton pendingLabel="Verificando…">Marcar como verificado</SubmitButton>
            </form>
          )}
        </section>
      )}

      <div className="mb-8 max-w-2xl">
        <SellerLogoUpload sellerId={seller.id} logoUrl={imageUrl(seller.logoR2Key)} />
      </div>

      <SellerForm
        action={updateSellerAction.bind(null, id)}
        cities={cities}
        role={user.role}
        values={{
          name: seller.name,
          type: seller.type,
          phoneWhatsapp: seller.phoneWhatsapp,
          phoneDisplay: seller.phoneDisplay,
          email: seller.email,
          address: seller.address,
          locationId: seller.locationId,
          description: seller.description,
          status: seller.status,
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
