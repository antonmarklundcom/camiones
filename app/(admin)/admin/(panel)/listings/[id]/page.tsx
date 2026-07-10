import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import {
  getAdminListing,
  getBrandOptions,
  getCityOptions,
  getSellerOptions,
} from "@/lib/admin/queries";
import { imageUrl } from "@/lib/r2";
import { listingPath } from "@/lib/urls";
import { ListingForm } from "@/components/admin/ListingForm";
import { ImageManager } from "@/components/admin/ImageManager";
import { updateListingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const listing = await getAdminListing(user, id);
  if (!listing) notFound();

  const [brands, cities, sellers] = await Promise.all([
    getBrandOptions(),
    getCityOptions(),
    user.role === "admin" ? getSellerOptions() : Promise.resolve([]),
  ]);

  const sp = await searchParams;
  const justCreated = "nuevo" in sp;

  const images = listing.images.map((img) => ({
    id: img.id,
    url: imageUrl(img.r2Key),
    alt: img.alt,
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link href="/admin/listings" className="text-sm text-ink-soft hover:text-ink">
          ← Volver a avisos
        </Link>
        {listing.status === "published" && (
          <Link
            href={listingPath(listing.slug)}
            target="_blank"
            className="text-sm font-medium text-amber-deep hover:underline"
          >
            Ver publicado ↗
          </Link>
        )}
      </div>
      <h1 className="mb-1 font-heading text-2xl font-bold text-ink">{listing.title}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        ID {listing.publicId} · actualizado {new Date(listing.updatedAt).toLocaleString("es-PY")}
      </p>

      {justCreated && (
        <p className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Aviso creado. Ahora subí las fotos abajo y, cuando esté listo, cambiá el
          estado a <strong>Publicado</strong>.
        </p>
      )}

      <div className="mb-8">
        <ImageManager listingId={listing.id} images={images} />
      </div>

      <ListingForm
        action={updateListingAction.bind(null, id)}
        brands={brands}
        cities={cities}
        sellers={sellers}
        role={user.role}
        values={{
          condition: listing.condition,
          category: listing.category,
          brandId: listing.brandId,
          model: listing.model,
          year: listing.year,
          km: listing.km,
          priceUsd: listing.priceUsd,
          priceGs: listing.priceGs,
          transmission: listing.transmission,
          fuel: listing.fuel,
          traction: listing.traction,
          capacityKg: listing.capacityKg,
          description: listing.description,
          locationId: listing.locationId,
          sellerId: listing.sellerId,
          featured: listing.featured,
          status: listing.status,
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
