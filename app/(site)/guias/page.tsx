import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedGuides } from "@/lib/content/queries";
import { imageUrl } from "@/lib/r2";
import { guidePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guías para comprar camiones en Paraguay",
  description:
    "Guías prácticas para comprar, financiar y elegir camiones y vehículos de trabajo en Paraguay: precios, marcas, usados y financiación.",
  alternates: { canonical: "/guias" },
};

export default async function GuidesIndex() {
  const guides = await getPublishedGuides();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="max-w-2xl">
        <h1 className="font-heading text-3xl font-extrabold text-ink">
          Guías para comprar tu camión
        </h1>
        <p className="mt-3 text-ink-soft">
          Consejos prácticos sobre precios, marcas, usados y financiación de
          camiones y vehículos de trabajo en Paraguay.
        </p>
      </header>

      {guides.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-black/10 bg-white px-4 py-12 text-center text-ink-soft">
          Pronto vamos a publicar nuestras primeras guías.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => {
            const hero = imageUrl(g.heroR2Key);
            return (
              <Link
                key={g.slug}
                href={guidePath(g.slug)}
                className="group flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-[16/9] overflow-hidden bg-charcoal-100">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hero}
                      alt={g.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-charcoal-950">
                      <span className="font-heading text-lg font-bold text-amber-brand">
                        Guía
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-heading text-lg font-bold text-ink group-hover:text-amber-deep">
                    {g.title}
                  </h2>
                  {g.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{g.excerpt}</p>
                  )}
                  <span className="mt-4 text-sm font-semibold text-amber-deep">
                    Leer guía →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
