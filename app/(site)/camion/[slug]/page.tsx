import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivePrograms, getListingBySlug } from "@/lib/queries";
import { imageUrl } from "@/lib/r2";
import { formatGs, formatKm, formatUsd, formatInt } from "@/lib/format";
import {
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  categoryByValue,
  conditionLabel,
} from "@/lib/taxonomy";
import { waLink, waListingText, waNumber } from "@/lib/whatsapp";
import { listingPath, sellerPath, ventaPath, absoluteUrl } from "@/lib/urls";
import { vehicleJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Gallery } from "@/components/Gallery";
import { CuotaCalculator } from "@/components/CuotaCalculator";
import { ContactForm } from "@/components/ContactForm";
import { StickyCtaBar } from "@/components/StickyCtaBar";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { enviarConsulta } from "./actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListingBySlug(slug);
  if (!l) return { title: "Aviso no encontrado" };

  const path = listingPath(l.slug);
  // Title ≤60 incl. " | camiones.com.py" (18 chars) → cap the listing part at 42.
  const title = l.title.length > 42 ? `${l.title.slice(0, 41).trimEnd()}…` : l.title;
  const description = (
    `${l.title} ${l.condition === "nuevo" ? "0 km" : `con ${formatKm(l.km)}`} en ${l.city.name}. ` +
    `${formatUsd(l.priceUsd)}. Consultá por WhatsApp y encontrá tu camión.`
  ).slice(0, 155);
  const cover = imageUrl(l.images[0]?.r2Key);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | camiones.com.py`,
      description,
      url: path,
      images: cover ? [{ url: cover.startsWith("/") ? absoluteUrl(cover) : cover }] : undefined,
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const [l, programs] = await Promise.all([
    getListingBySlug(slug),
    getActivePrograms(),
  ]);
  if (!l) notFound();

  const category = categoryByValue(l.category);
  const waHref = waLink(l.seller.phoneWhatsapp, waListingText(l.title));
  const phoneDigits = waNumber(l.seller.phoneWhatsapp);
  const telHref = `tel:+${phoneDigits}`;
  const phoneText = l.seller.phoneDisplay ?? `+${phoneDigits}`;

  const galleryImages = l.images
    .map((img) => ({ url: imageUrl(img.r2Key)!, alt: img.alt ?? l.title }))
    .filter((img) => !!img.url);

  const specs: [string, string][] = [
    ["Marca", l.brand.name],
    ["Modelo", l.model],
    ["Año", String(l.year)],
    ["Condición", conditionLabel(l.condition)],
    ["Kilometraje", formatKm(l.km)],
    ["Transmisión", TRANSMISSION_LABELS[l.transmission]],
    ["Combustible", FUEL_LABELS[l.fuel]],
    ["Tracción", l.traction],
    ...(l.capacityKg
      ? ([["Capacidad de carga", `${formatInt(l.capacityKg)} kg`]] as [string, string][])
      : []),
    ["Categoría", category.singular],
    ["Ubicación", l.city.name],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd data={vehicleJsonLd(l)} />

      <nav aria-label="Ruta" className="text-xs text-ink-soft">
        <Link href="/" className="hover:text-amber-deep">Inicio</Link>
        <span aria-hidden="true"> / </span>
        <Link href={ventaPath({ category })} className="hover:text-amber-deep">
          {category.plural}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href={ventaPath({ category, brand: l.brand })}
          className="hover:text-amber-deep"
        >
          {l.brand.name}
        </Link>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: gallery + specs + description */}
        <div>
          <Gallery images={galleryImages} title={l.title} />

          <section className="mt-8">
            <h2 className="font-heading text-xl font-bold text-ink">
              Ficha técnica
            </h2>
            <dl className="mt-3 overflow-hidden rounded-xl border border-black/5 bg-white">
              {specs.map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex justify-between gap-4 px-4 py-3 text-sm ${
                    i % 2 ? "bg-offwhite/60" : ""
                  }`}
                >
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="text-right font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {l.description && (
            <section className="mt-8">
              <h2 className="font-heading text-xl font-bold text-ink">
                Descripción
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                {l.description}
              </p>
            </section>
          )}
        </div>

        {/* Right: price, CTAs, cuota, seller, form */}
        <div className="space-y-5">
          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h1 className="font-heading text-2xl font-bold leading-snug text-ink">
              {l.title}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {l.year} · {formatKm(l.km)} · {l.city.name}
            </p>
            <p className="mt-4 font-heading text-3xl font-extrabold text-amber-deep">
              {formatUsd(l.priceUsd)}
            </p>
            <p className="text-sm text-ink-soft">{formatGs(l.priceGs)}</p>

            <div className="mt-5 space-y-2.5">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-wa font-heading font-bold text-white transition-colors hover:bg-wa-dark"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Escribinos por WhatsApp
              </a>
              <a
                href={telHref}
                className="flex h-12 w-full items-center justify-center rounded-lg border border-charcoal-950/20 font-heading font-bold text-ink transition-colors hover:border-charcoal-950"
              >
                Llamanos · {phoneText}
              </a>
            </div>
          </div>

          <CuotaCalculator priceGs={Number(l.priceGs)} programs={programs} />

          {/* Seller card */}
          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {l.seller.type === "dealer" ? "Concesionaria" : "Vendedor particular"}
            </p>
            <p className="mt-1 font-heading text-lg font-bold text-ink">
              {l.seller.name}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">Tel: {phoneText}</p>
            <Link
              href={sellerPath(l.seller.slug)}
              className="mt-3 inline-block text-sm font-semibold text-amber-deep hover:underline"
            >
              Ver todos sus avisos →
            </Link>
          </div>

          <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-heading text-lg font-bold text-ink">
              Consultá por este camión
            </h2>
            <ContactForm
              action={enviarConsulta.bind(null, {
                id: l.id,
                publicId: l.publicId,
                slug: l.slug,
                title: l.title,
                priceUsd: Number(l.priceUsd),
                sellerId: l.seller?.id,
              })}
              listingTitle={l.title}
            />
          </div>
        </div>
      </div>

      <StickyCtaBar priceUsd={l.priceUsd} waHref={waHref} telHref={telHref} />
    </div>
  );
}
