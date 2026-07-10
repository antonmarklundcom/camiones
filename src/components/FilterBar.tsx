import type { Condition } from "@/db/schema";
import { CATEGORIES, TRANSMISSION_LABELS } from "@/lib/taxonomy";
import { TRACTION_VALUES, TRANSMISSION_VALUES } from "@/db/schema";
import type { VentaQuery } from "@/lib/venta-params";

interface Option {
  value: string;
  label: string;
}

/**
 * Server-rendered filter bar. Plain GET form → /buscar, which 302s to the
 * canonical /venta/... segment URL with query-param filters — works with
 * ZERO client JS (Android on prepaid data is the majority device).
 */
export function FilterBar({
  brands,
  cities,
  categorySlug,
  brandSlug,
  citySlug,
  condition,
  query,
}: {
  brands: Option[];
  cities: Option[];
  categorySlug?: string;
  brandSlug?: string;
  citySlug?: string;
  condition?: Condition;
  query: VentaQuery;
}) {
  const selectCls =
    "h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-ink focus:border-amber-brand focus:outline-none";
  const inputCls = selectCls;
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <form
      method="get"
      action="/buscar"
      className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
      aria-label="Filtrar resultados"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="f-categoria" className={labelCls}>
            Categoría
          </label>
          <select id="f-categoria" name="categoria" defaultValue={categorySlug ?? ""} className={selectCls}>
            <option value="">Todas</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.plural}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-marca" className={labelCls}>
            Marca
          </label>
          <select id="f-marca" name="marca" defaultValue={brandSlug ?? ""} className={selectCls}>
            <option value="">Todas</option>
            {brands.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-ciudad" className={labelCls}>
            Ciudad
          </label>
          <select id="f-ciudad" name="ciudad" defaultValue={citySlug ?? ""} className={selectCls}>
            <option value="">Todo el país</option>
            {cities.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-condicion" className={labelCls}>
            Condición
          </label>
          <select id="f-condicion" name="condicion" defaultValue={condition ?? ""} className={selectCls}>
            <option value="">Todas</option>
            <option value="nuevo">Nuevos</option>
            <option value="usado">Usados</option>
          </select>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <div>
          <label htmlFor="f-year-min" className={labelCls}>
            Año desde
          </label>
          <input id="f-year-min" name="year_min" type="number" inputMode="numeric" min={1980} max={2030} placeholder="2015" defaultValue={query.yearMin ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-year-max" className={labelCls}>
            Año hasta
          </label>
          <input id="f-year-max" name="year_max" type="number" inputMode="numeric" min={1980} max={2030} placeholder="2026" defaultValue={query.yearMax ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-price-min" className={labelCls}>
            Precio mín. US$
          </label>
          <input id="f-price-min" name="price_min" type="number" inputMode="numeric" min={0} step={1000} placeholder="10.000" defaultValue={query.priceMin ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-price-max" className={labelCls}>
            Precio máx. US$
          </label>
          <input id="f-price-max" name="price_max" type="number" inputMode="numeric" min={0} step={1000} placeholder="80.000" defaultValue={query.priceMax ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-km-max" className={labelCls}>
            Km máx.
          </label>
          <input id="f-km-max" name="km_max" type="number" inputMode="numeric" min={0} step={10000} placeholder="300.000" defaultValue={query.kmMax ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-transmission" className={labelCls}>
            Transmisión
          </label>
          <select id="f-transmission" name="transmission" defaultValue={query.transmission ?? ""} className={selectCls}>
            <option value="">Todas</option>
            {TRANSMISSION_VALUES.map((t) => (
              <option key={t} value={t}>
                {TRANSMISSION_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-traction" className={labelCls}>
            Tracción
          </label>
          <select id="f-traction" name="traction" defaultValue={query.traction ?? ""} className={selectCls}>
            <option value="">Todas</option>
            {TRACTION_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-12 w-full rounded-lg bg-amber-brand px-4 font-heading font-bold text-charcoal-950 transition-colors hover:bg-amber-deep"
          >
            Filtrar
          </button>
        </div>
      </div>
    </form>
  );
}
