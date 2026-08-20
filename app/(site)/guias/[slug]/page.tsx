import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideBySlug } from "@/lib/content/queries";
import { renderMarkdown } from "@/lib/content/markdown";
import { imageUrl } from "@/lib/r2";
import { absoluteUrl, guidePath, ventaPath } from "@/lib/urls";
import { categoryByValue } from "@/lib/taxonomy";
import { articleJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@site.config";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGuideBySlug(slug);
  if (!g) return { title: "Guía no encontrada" };
  const path = guidePath(g.slug);
  const description = (g.excerpt ?? g.title).slice(0, 155);
  const hero = imageUrl(g.heroR2Key);
  return {
    // 42 chars, matching the seller-page rule: the root layout appends
    // " | camiones.com.py" (18 chars), so a 60-char slice produced 78-char
    // <title> tags that search results truncate.
    title: g.title.length > 42 ? `${g.title.slice(0, 41).trimEnd()}…` : g.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${g.title} | ${siteConfig.name}`,
      description,
      url: path,
      type: "article",
      images: hero ? [{ url: hero.startsWith("/") ? absoluteUrl(hero) : hero }] : undefined,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const g = await getGuideBySlug(slug);
  if (!g) notFound();

  const hero = imageUrl(g.heroR2Key);
  const html = renderMarkdown(g.body);

  // Brand hubs / category intros link out to matching stock.
  const category = g.category ? categoryByValue(g.category) : undefined;
  const stockHref =
    g.kind === "marca" && g.brand
      ? ventaPath({ category: categoryByValue("camion"), brand: g.brand })
      : g.kind === "categoria" && category
        ? ventaPath({ category })
        : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={articleJsonLd(g)} />

      <nav aria-label="Ruta" className="text-xs text-ink-soft">
        <Link href="/" className="hover:text-amber-deep">Inicio</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/guias" className="hover:text-amber-deep">Guías</Link>
      </nav>

      <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight text-ink">
        {g.title}
      </h1>
      {g.excerpt && <p className="mt-3 text-lg text-ink-soft">{g.excerpt}</p>}

      {hero && (
        <div className="mt-6 overflow-hidden rounded-xl bg-charcoal-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={g.title} className="w-full object-cover" />
        </div>
      )}

      <div
        className="guide-prose mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {stockHref && (
        <div className="mt-10 rounded-xl border border-amber-brand/40 bg-amber-soft p-6 text-center">
          <p className="font-heading text-lg font-bold text-ink">
            ¿Listo para ver camiones?
          </p>
          <Link
            href={stockHref}
            className="mt-3 inline-flex h-12 items-center rounded-lg bg-amber-brand px-6 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
          >
            Ver avisos disponibles
          </Link>
        </div>
      )}
    </article>
  );
}
