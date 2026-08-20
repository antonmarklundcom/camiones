import Link from "next/link";
import type { Metadata } from "next";
import {
  categoryCounts,
  getCities,
  getFeaturedListings,
  getPublishedBrands,
  getRecentListings,
} from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd } from "@/lib/jsonld";
import { CATEGORIES } from "@/lib/taxonomy";
import { formatInt } from "@/lib/format";
import { siteConfig } from "@site.config";

// Reads the live DB on every request (Hostinger builds before it can connect).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Root page keeps the full default title from layout.tsx.
  title: {
    absolute: `Camiones nuevos y usados en ${siteConfig.country} | ${siteConfig.name}`,
  },
  description:
    "Encontrá tu camión en Paraguay: nuevos y usados con precios en US$ y ₲. Financiación disponible — consultá por WhatsApp.",
  alternates: { canonical: "/" },
};

const TRUST_ITEMS = [
  {
    // NO claim of "verificados" here: there is no verification field or process
    // in the schema yet (audit F18). Restore the stronger wording only once
    // sellers.verifiedAt and a real check exist.
    icon: "✓",
    title: "Contacto directo",
    text: "Concesionarias y dueños con sus datos de contacto publicados.",
  },
  {
    icon: "₲",
    title: "Precios claros",
    text: "En dólares y guaraníes, con cuota estimada por financiación.",
  },
  {
    icon: "💬",
    title: "Consultá por WhatsApp",
    text: "Hablá directo con el vendedor, sin intermediarios.",
  },
];

export default async function HomePage() {
  const [featured, recent, brands, cities, counts] = await Promise.all([
    getFeaturedListings(4),
    getRecentListings(8),
    getPublishedBrands(),
    getCities(),
    categoryCounts(),
  ]);

  const selectCls =
    "h-12 w-full rounded-lg border border-white/15 bg-charcoal-800 px-3 text-sm text-white focus:border-amber-brand focus:outline-none";

  return (
    <>
      <JsonLd data={organizationJsonLd()} />

      {/* Hero + search */}
      <section className="bg-charcoal-950 text-white">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
          <h1 className="max-w-2xl font-heading text-4xl font-extrabold leading-tight sm:text-5xl">
            Encontrá tu camión en{" "}
            <span className="text-amber-brand">{siteConfig.country}</span>
          </h1>
          <p className="mt-3 max-w-xl text-white/70">
            Camiones, tractocamiones y utilitarios de trabajo, nuevos y usados.
            Compará precios y consultá directo por WhatsApp.
          </p>

          <form
            method="get"
            action="/buscar"
            className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-4"
            aria-label="Buscar camiones"
          >
            <select name="categoria" aria-label="Categoría" defaultValue="" className={selectCls}>
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.plural}
                </option>
              ))}
            </select>
            <select name="marca" aria-label="Marca" defaultValue="" className={selectCls}>
              <option value="">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
            <select name="ciudad" aria-label="Ciudad" defaultValue="" className={selectCls}>
              <option value="">Todo el país</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-12 rounded-lg bg-amber-brand px-6 font-heading font-bold text-charcoal-950 transition-colors hover:bg-amber-deep"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* Category tiles */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-heading text-2xl font-bold text-ink">
          Buscá por categoría
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/venta/${c.slug}`}
              className="group rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-heading font-bold text-ink group-hover:text-amber-deep">
                {c.plural}
              </p>
              <p className="mt-1 text-xs text-ink-soft">{c.tileDesc}</p>
              <p className="mt-2 text-xs font-semibold text-amber-deep">
                {formatInt(counts[c.value] ?? 0)} avisos
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-2xl font-bold text-ink">
              Destacados
            </h2>
            <Link href="/venta" className="text-sm font-semibold text-amber-deep hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((l, i) => (
              <ListingCard key={l.slug} listing={l} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-2xl font-bold text-ink">
            Últimos publicados
          </h2>
          <Link href="/venta" className="text-sm font-semibold text-amber-deep hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recent.map((l) => (
            <ListingCard key={l.slug} listing={l} />
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-soft font-heading font-bold text-amber-deep"
              >
                {t.icon}
              </span>
              <div>
                <p className="font-heading font-bold text-ink">{t.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
