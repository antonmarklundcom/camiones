import Link from "next/link";
import { CATEGORIES } from "@/lib/taxonomy";
import { siteConfig } from "@site.config";

const CITIES = [
  { slug: "asuncion", name: "Asunción" },
  { slug: "ciudad-del-este", name: "Ciudad del Este" },
  { slug: "encarnacion", name: "Encarnación" },
  { slug: "san-lorenzo", name: "San Lorenzo" },
  { slug: "luque", name: "Luque" },
  { slug: "coronel-oviedo", name: "Coronel Oviedo" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-charcoal-950 text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-heading text-xl font-extrabold text-white">
            {siteConfig.wordmark.lead}
            <span className="text-amber-brand">{siteConfig.wordmark.accent}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            El portal de camiones y vehículos de trabajo de Paraguay. Encontrá
            tu próximo camión y consultá directo por WhatsApp.
          </p>
        </div>
        <div>
          <p className="font-heading font-bold text-white">Categorías</p>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/venta/${c.slug}`} className="hover:text-amber-brand">
                  {c.plural}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-heading font-bold text-white">Ciudades</p>
          <ul className="mt-3 space-y-2 text-sm">
            {CITIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/venta/camiones/${c.slug}`} className="hover:text-amber-brand">
                  Camiones en {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {/*
            F30 — an unconfirmed mailbox on every page is a dead-end contact
            path. Lines come from site.config.ts and a null value is OMITTED
            rather than printed as "(a confirmar)": say less, but say nothing
            untrue.
          */}
          <p className="font-heading font-bold text-white">Contacto</p>
          <address className="mt-3 space-y-2 text-sm not-italic">
            <p>{siteConfig.name}</p>
            <p>
              {[siteConfig.contact.city, siteConfig.country].filter(Boolean).join(", ")}
            </p>
            {siteConfig.contact.address && <p>{siteConfig.contact.address}</p>}
            {siteConfig.contact.email && (
              <p>
                <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-amber-brand">
                  {siteConfig.contact.email}
                </a>
              </p>
            )}
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/50">
          <p>
            Los precios y cuotas publicados son referenciales y pueden variar —
            confirmá cada operación con el vendedor o la financiera.
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} camiones.com.py — Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
