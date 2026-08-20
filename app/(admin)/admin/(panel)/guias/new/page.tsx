import Link from "next/link";
import { requireCapability } from "@/lib/auth/guard";
import { getBrandOptions } from "@/lib/admin/queries";
import { ContentForm } from "@/components/admin/ContentForm";
import { createContentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  await requireCapability("manageContent");
  const brands = await getBrandOptions();

  return (
    <div>
      <Link href="/admin/guias" className="text-sm text-ink-soft hover:text-ink">
        ← Volver a guías
      </Link>
      <h1 className="mb-1 mt-2 font-heading text-2xl font-bold text-ink">Nueva guía</h1>
      <p className="mb-6 text-ink-soft">
        Después de crearla vas a poder subir la imagen de portada.
      </p>
      <ContentForm action={createContentAction} brands={brands} submitLabel="Crear guía" />
    </div>
  );
}
