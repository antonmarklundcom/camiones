import Link from "next/link";
import { waLink, WA_GENERIC_TEXT } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const NAV = [
  { href: "/venta/camiones", label: "Camiones" },
  { href: "/venta/tractocamiones", label: "Tractocamiones" },
  { href: "/venta/camionetas", label: "Camionetas" },
  { href: "/venta/usados", label: "Usados" },
  { href: "/venta/nuevos", label: "0 km" },
  { href: "/venta", label: "Ver todo" },
];

export function SiteHeader() {
  return (
    <header className="bg-charcoal-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-heading text-2xl font-extrabold tracking-tight">
          camiones<span className="text-amber-brand">.com.py</span>
        </Link>
        <a
          href={waLink(null, WA_GENERIC_TEXT)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-lg bg-wa px-4 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-wa-dark sm:flex"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Escribinos
        </a>
      </div>
      <nav
        aria-label="Categorías principales"
        className="border-t border-white/10"
      >
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
