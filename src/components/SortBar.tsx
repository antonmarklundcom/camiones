import Link from "next/link";
import { SORT_LABELS, SORT_SHORT_LABELS, SORT_VALUES } from "@/lib/sort";
import type { VentaQuery } from "@/lib/venta-params";
import { queryString } from "@/lib/venta-params";

/**
 * I5 — sort controls. Plain links, zero client JS: this has to work on a phone
 * with JS off and cost nothing on prepaid data.
 *
 * `rel="nofollow"` on every option: a sort order is a duplicate slice of the
 * same segment page (the page itself is already noindex,follow with a canonical
 * back to the clean URL), so there is no reason to let a crawler spend its
 * budget on five reorderings of every facet page it finds.
 *
 * Changing the sort always returns to page 1 — staying on page 7 of a
 * differently-ordered list shows the buyer a random slice.
 */
export function SortBar({ basePath, query }: { basePath: string; query: VentaQuery }) {
  return (
    <nav aria-label="Ordenar resultados" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Ordenar por
      </span>
      <div className="flex flex-wrap gap-1.5">
        {SORT_VALUES.map((s) => {
          const active = query.sort === s;
          return (
            <Link
              key={s}
              href={`${basePath}${queryString({ ...query, sort: s, page: 1 })}`}
              rel="nofollow"
              aria-current={active ? "true" : undefined}
              title={SORT_LABELS[s]}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-charcoal-950 text-white"
                  : "border border-black/10 bg-white text-ink hover:border-charcoal-950"
              }`}
            >
              {SORT_SHORT_LABELS[s]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
