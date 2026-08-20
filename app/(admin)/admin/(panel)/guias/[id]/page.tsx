import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/guard";
import { getAdminContent } from "@/lib/content/queries";
import { getBrandOptions } from "@/lib/admin/queries";
import { imageUrl } from "@/lib/r2";
import { guidePath } from "@/lib/urls";
import { ContentForm } from "@/components/admin/ContentForm";
import { HeroUpload } from "@/components/admin/HeroUpload";
import { updateContentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCapability("manageContent");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const [content, brands] = await Promise.all([
    getAdminContent(id),
    getBrandOptions(),
  ]);
  if (!content) notFound();
  const sp = await searchParams;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link href="/admin/guias" className="text-sm text-ink-soft hover:text-ink">
          ← Volver a guías
        </Link>
        {content.status === "published" && (
          <Link
            href={guidePath(content.slug)}
            target="_blank"
            className="text-sm font-medium text-amber-deep hover:underline"
          >
            Ver publicada ↗
          </Link>
        )}
      </div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-ink">{content.title}</h1>

      {sp.nuevo && (
        <p className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Guía creada. Subí la portada y, cuando esté lista, publicala.
        </p>
      )}

      <div className="mb-8">
        <HeroUpload contentId={content.id} heroUrl={imageUrl(content.heroR2Key)} />
      </div>

      <ContentForm
        action={updateContentAction.bind(null, id)}
        brands={brands}
        values={{
          title: content.title,
          kind: content.kind,
          excerpt: content.excerpt,
          body: content.body,
          brandId: content.brandId,
          category: content.category,
          status: content.status,
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
