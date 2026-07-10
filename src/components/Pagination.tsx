import Link from "next/link";
import type { VentaQuery } from "@/lib/venta-params";
import { queryString } from "@/lib/venta-params";

/** URL-driven pagination (no client JS). Page 1 drops the ?page param. */
export function Pagination({
  basePath,
  query,
  page,
  totalPages,
}: {
  basePath: string;
  query: VentaQuery;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) =>
    `${basePath}${queryString(query, { page: p > 1 ? p : undefined })}`;

  const pages: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
    pages.push(p);
  }

  const btn =
    "flex h-12 min-w-12 items-center justify-center rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-ink hover:border-amber-brand";

  return (
    <nav aria-label="Paginación" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className={btn}>
          ← Anterior
        </Link>
      )}
      {pages.map((p) =>
        p === page ? (
          <span
            key={p}
            aria-current="page"
            className="flex h-12 min-w-12 items-center justify-center rounded-lg bg-charcoal-950 px-3 text-sm font-bold text-white"
          >
            {p}
          </span>
        ) : (
          <Link key={p} href={href(p)} className={btn}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} rel="next" className={btn}>
          Siguiente →
        </Link>
      )}
    </nav>
  );
}
