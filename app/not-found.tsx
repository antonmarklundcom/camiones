import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Root-level not-found renders under the bare root layout (the public chrome
// lives in the (site) group), so it pulls in the header/footer itself.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center">
      <p className="font-heading text-6xl font-extrabold text-amber-brand">404</p>
      <h1 className="mt-4 font-heading text-2xl font-bold text-ink">
        No encontramos esa página
      </h1>
      <p className="mt-2 max-w-md text-ink-soft">
        Puede que el aviso ya no esté disponible. Buscá entre todos los
        camiones publicados — seguro encontrás uno parecido.
      </p>
      <Link
        href="/venta"
        className="mt-6 flex h-12 items-center rounded-lg bg-amber-brand px-6 font-heading font-bold text-charcoal-950 hover:bg-amber-deep"
      >
        Ver todos los camiones
      </Link>
      </div>
      <SiteFooter />
    </>
  );
}
