import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { getAdminSeller, getCityOptions } from "@/lib/admin/queries";
import { SellerForm } from "@/components/admin/SellerForm";
import { SellerLogoUpload } from "@/components/admin/SellerLogoUpload";
import { imageUrl } from "@/lib/r2";
import { sellerPath } from "@/lib/urls";
import { updateSellerAction } from "../actions";

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
