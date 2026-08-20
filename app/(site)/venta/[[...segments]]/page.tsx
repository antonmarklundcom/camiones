import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countListings, getListingCards, PER_PAGE } from "@/lib/queries";
import {
  parseVentaQuery,
  resolveSegments,
  toFilters,
} from "@/lib/venta-params";
import { ventaH1, ventaPath } from "@/lib/urls";
import {
  paginatedCanonical,
  paginationIndexability,
  robotsFor,
  segmentIndexability,
} from "@/lib/indexability";
import { ListingCard } from "@/components/ListingCard";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { JsonLd } from "@/components/JsonLd";
import { itemListJsonLd } from "@/lib/jsonld";
import { formatInt } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { segments = [] } = await params;
  const sp = await searchParams;
  const resolved = await resolveSegments(segments);
  if (!resolved) return { title: "Página no encontrada" };

  const q = parseVentaQuery(sp);
  const h1 = ventaH1(resolved.selection);
  const basePath = ventaPath(resolved.selection);

  // Faceted-URL discipline: segment pages may index (thin-page rule applies
  // in the page body via count); ANY query-param filter → noindex,follow and
  // canonical points at the clean segment URL, because a filtered view really
  // is a duplicate slice of that page.
  //
  // F16: pagination is NOT that case. Page ≥2 is different content, so it
  // canonicalises to itself and only carries noindex — the old "noindex +
  // canonical → page 1" pair contradicted itself.
  const count = await countListings(toFilters(resolved.selection, q));
  const canonical = q.hasFilters
    ? basePath
    : paginatedCanonical(basePath, q.page);
  const ix = q.hasFilters
    ? { state: "noindex" as const }
    : paginationIndexability(q.page, segmentIndexability(count));

  // ≤60 chars incl. suffix — trim the H1, not the brand.
  const title = h1.length > 42 ? `${h1.slice(0, 41).trimEnd()}…` : h1;
  const description = (
    `${h1}: ${formatInt(count)} avisos con precio en US$ y ₲. ` +
    `Compará y consultá por WhatsApp al toque.`
  ).slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical },
    robots: robotsFor(ix),
    openGraph: { title: `${title} | camiones.com.py`, description, url: canonical },
  };
}

export default async function VentaPage({ params, searchParams }: Props) {
  const { segments = [] } = await params;
  const sp = await searchParams;

  const resolved = await resolveSegments(segments);
  if (!resolved) notFound();

  const q = parseVentaQuery(sp);
  const filters = toFilters(resolved.selection, q);

  const [total, cards] = await Promise.all([
    countListings(filters),
    getListingCards(filters, q.page),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const h1 = ventaH1(resolved.selection);
  const basePath = ventaPath(resolved.selection);

  const sel = resolved.selection;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={itemListJsonLd(cards, h1)} />

      <nav aria-label="Ruta" className="text-xs text-ink-soft">
        <Link href="/" className="hover:text-amber-deep">Inicio</Link>
        <span aria-hidden="true"> / </span>
        <span>Venta</span>
      </nav>
      <h1 className="mt-2 font-heading text-3xl font-extrabold text-ink">{h1}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {formatInt(total)} {total === 1 ? "aviso publicado" : "avisos publicados"}
      </p>

      <div className="mt-5">
        <FilterBar
          brands={resolved.brands.map((b) => ({ value: b.slug, label: b.name }))}
          cities={resolved.cities.map((c) => ({ value: c.slug, label: c.name }))}
          categorySlug={sel.category?.slug}
          brandSlug={sel.brand?.slug}
          citySlug={sel.city?.slug}
          condition={sel.condition}
          query={q}
        />
      </div>

      {cards.length === 0 ? (
        <div className="mt-10 rounded-xl border border-black/5 bg-white p-10 text-center">
          <p className="font-heading text-lg font-bold text-ink">
            No encontramos avisos con esos filtros
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Probá ampliar el rango de precio o año, o mirá{" "}
            <Link href="/venta" className="font-semibold text-amber-deep hover:underline">
              todos los camiones publicados
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((l, i) => (
            <ListingCard key={l.slug} listing={l} priority={i < 3 && q.page === 1} />
          ))}
        </div>
      )}

      <Pagination basePath={basePath} query={q} page={q.page} totalPages={totalPages} />
    </div>
  );
}
