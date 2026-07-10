import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import {
  getBrandOptions,
  getCityOptions,
  getSellerOptions,
} from "@/lib/admin/queries";
import { ListingForm } from "@/components/admin/ListingForm";
import { createListingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const user = await requireUser();
  const [brands, cities, sellers] = await Promise.all([
    getBrandOptions(),
    getCityOptions(),
    user.role === "admin" ? getSellerOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/listings" className="text-sm text-ink-soft hover:text-ink">
        ← Volver a avisos
      </Link>
      <h1 className="mb-1 mt-2 font-heading text-2xl font-bold text-ink">Nuevo aviso</h1>
      <p className="mb-6 text-ink-soft">
        Cargá los datos del vehículo. Después de guardar vas a poder subir las fotos.
      </p>
      <ListingForm
        action={createListingAction}
        brands={brands}
        cities={cities}
        sellers={sellers}
        role={user.role}
        submitLabel="Crear aviso"
      />
    </div>
  );
}
