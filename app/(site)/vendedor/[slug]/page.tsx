import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { countListings, getListingCards, getSellerBySlug, PER_PAGE } from "@/lib/queries";
import { sellerPath } from "@/lib/urls";
import { recordRequestEvent } from "@/lib/analytics/request";
import { VerifiedBadge } from "@/components/Badges";
import { waLink, waNumber } from "@/lib/whatsapp";
import { ListingCard } from "@/components/ListingCard";
import { Pagination } from "@/components/Pagination";
import { JsonLd } from "@/components/JsonLd";
import { itemListJsonLd } from "@/lib/jsonld";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { formatInt } from "@/lib/format";
import { pageOnly, parseVentaQuery } from "@/lib/venta-params";
import { imageUrl } from "@/lib/r2";
import { paginatedCanonical, robotsFor } from "@/lib/indexability";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);
  if (!seller) return { title: "Vendedor no encontrado" };
  const title = seller.name.length > 42 ? `${seller.name.slice(0, 41).trimEnd()}…` : seller.name;

  // F15: this ignored searchParams entirely, so /vendedor/x?page=3 was
  // INDEXABLE with a canonical claiming it was page 1. Page ≥2 now
  // self-canonicalises and is noindex,follow like every other paginated view.
  const { page } = parseVentaQuery(await searchParams);
  const path = paginatedCanonical(sellerPath(seller.slug), page);
  const description = (
    `Camiones y vehículos de trabajo de ${seller.name}` +
    `${seller.cityName ? ` en ${seller.cityName}` : ""}. Mirá su stock y consultá por WhatsApp.`
  ).slice(0, 155);
  // Seller pages had no openGraph block at all, so WhatsApp shares fell back to
  // the generic site preview. The seller logo is a poor OG image (transparent,
  // wrong aspect), so these inherit the site default from the root layout.
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: robotsFor(page > 1 ? { state: "noindex" } : { state: "index" }),
    openGraph: {
      title: `${title} | camiones.com.py`,
      description,
      url: path,
      type: "profile",
    },
  };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  // I8 — first-party page view (see the note on the listing page).
  await recordRequestEvent({
    kind: "page_view",
    sellerId: seller.id,
    path: sellerPath(seller.slug),
  });

  const q = parseVentaQuery(sp);
  const [total, cards] = await Promise.all([
    countListings({ sellerId: seller.id }),
    getListingCards({ sellerId: seller.id }, q.page),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const phoneDigits = waNumber(seller.phoneWhatsapp);
  const phoneText = seller.phoneDisplay ?? `+${phoneDigits}`;
  const waHref = waLink(
    seller.phoneWhatsapp,
    `Hola, vi su página en camiones.com.py y quiero consultar por su stock`,
  );
  const logo = imageUrl(seller.logoR2Key);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={itemListJsonLd(cards, `Avisos de ${seller.name}`)} />

      {/* Seller header card */}
      <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-4">
          {logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logo}
              alt={`Logo de ${seller.name}`}
              width={72}
              height={72}
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {seller.type === "dealer" ? "Concesionaria" : "Vendedor particular"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-extrabold text-ink">
                {seller.name}
              </h1>
              <VerifiedBadge verifiedAt={seller.verifiedAt} />
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {[seller.cityName, seller.address].filter(Boolean).join(" · ") || "Paraguay"}
              {" · "}
              {formatInt(total)} avisos
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5 sm:mt-0">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center gap-2 rounded-lg bg-wa px-5 font-heading font-bold text-white transition-colors hover:bg-wa-dark"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Escribinos
          </a>
          <a
            href={`tel:+${phoneDigits}`}
            className="flex h-12 items-center rounded-lg border border-charcoal-950/20 px-5 font-heading font-bold text-ink hover:border-charcoal-950"
          >
            {phoneText}
          </a>
        </div>
      </div>

      {seller.description && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink">
          {seller.description}
        </p>
      )}

      <h2 className="mt-8 font-heading text-xl font-bold text-ink">
        Sus avisos publicados
      </h2>
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          Este vendedor no tiene avisos activos por el momento.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((l, i) => (
            <ListingCard key={l.slug} listing={l} priority={i < 3 && q.page === 1} />
          ))}
        </div>
      )}

      {/* F15: pageOnly() strips venta filter params — the seller page never
          applies them, and echoing them into hrefs minted crawlable duplicates. */}
      <Pagination
        basePath={sellerPath(seller.slug)}
        query={pageOnly(q)}
        page={q.page}
        totalPages={totalPages}
      />
    </div>
  );
}
