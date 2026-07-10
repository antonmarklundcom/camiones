import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { getCityOptions } from "@/lib/admin/queries";
import { SellerForm } from "@/components/admin/SellerForm";
import { createSellerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSellerPage() {
  await requireAdmin();
  const cities = await getCityOptions();

  return (
    <div>
      <Link href="/admin/sellers" className="text-sm text-ink-soft hover:text-ink">
        ← Volver a concesionarias
      </Link>
      <h1 className="mb-6 mt-2 font-heading text-2xl font-bold text-ink">
        Nueva concesionaria
      </h1>
      <SellerForm
        action={createSellerAction}
        cities={cities}
        role="admin"
        submitLabel="Crear concesionaria"
      />
    </div>
  );
}
