/**
 * Dealer-inventory CSV importer (propia pattern).
 *
 *   npx tsx scripts/import-csv.ts <file.csv> <seller-slug> [--publish]
 *   npm run import:csv -- data/dealer-x.csv dealer-x --publish
 *
 * Without --publish, rows land as drafts (review in Drizzle Studio until the
 * Build-2 admin exists). Idempotent: each row gets a deterministic import_key
 * = sha1(seller|marca|modelo|año|km); re-running the same file updates
 * instead of duplicating. The seller is upserted by slug.
 *
 * Expected columns (header row, case-insensitive; * = required):
 *   marca* modelo* anio* km precio_usd* precio_gs condicion* categoria*
 *   transmision combustible traccion capacidad_kg ciudad* descripcion fotos
 * - categoria accepts DB values (camion, tractocamion…) or URL plurals
 *   (camiones, tractocamiones…).
 * - fotos = R2 keys separated by "|" (optional).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  brands,
  images,
  listings,
  locations,
  sellers,
  financingPrograms,
  CATEGORY_VALUES,
  CONDITION_VALUES,
  FUEL_VALUES,
  TRACTION_VALUES,
  TRANSMISSION_VALUES,
  type Category,
} from "../src/db/schema";
import { parseCsv } from "../src/lib/csv";
import { slugify } from "../src/lib/slug";
import { bestCuota, type FinancingProgram } from "../src/lib/cuota";
import { categoryBySlug } from "../src/lib/taxonomy";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

function parseCategory(raw: string): Category | null {
  const v = slugify(raw);
  if ((CATEGORY_VALUES as readonly string[]).includes(v)) return v as Category;
  return categoryBySlug(v)?.value ?? null;
}

function oneOf<T extends string>(raw: string, values: readonly T[], fallback: T): T {
  const v = slugify(raw) as T;
  return values.includes(v) ? v : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [file, sellerSlugArg] = positional;
  if (!file || !sellerSlugArg) {
    console.error("usage: tsx scripts/import-csv.ts <file.csv> <seller-slug> [--publish]");
    process.exit(1);
  }
  const sellerSlug = slugify(sellerSlugArg);

  // --- seller (upsert by slug) --------------------------------------------
  const sellerName = sellerSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  await db
    .insert(sellers)
    .values({
      name: sellerName,
      slug: sellerSlug,
      type: "dealer",
      status: "published",
      publishedAt: new Date(),
    })
    .onDuplicateKeyUpdate({ set: { slug: sellerSlug } });
  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.slug, sellerSlug))
    .limit(1);

  // --- lookups ---------------------------------------------------------------
  const brandRows = await db
    .select({ id: brands.id, slug: brands.slug, name: brands.name })
    .from(brands);
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));
  const cityRows = await db
    .select({ id: locations.id, slug: locations.slug })
    .from(locations)
    .where(eq(locations.level, "ciudad"));
  const cityBySlug = new Map(cityRows.map((c) => [c.slug, c]));

  const programRows = await db.select().from(financingPrograms);
  const programs: FinancingProgram[] = programRows.map((p) => ({
    code: p.code,
    name: p.name,
    annualRate: Number(p.annualRate),
    maxTermMonths: p.maxTermMonths,
    maxAmountGs: p.maxAmountGs != null ? Number(p.maxAmountGs) : null,
    minDownPct: Number(p.minDownPct),
    active: p.active,
  }));

  // --- rows --------------------------------------------------------------------
  const records = parseCsv(readFileSync(file, "utf8"));
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, rec] of records.entries()) {
    const rowNo = i + 2; // header is row 1
    try {
      const brand = brandBySlug.get(slugify(rec.marca ?? ""));
      if (!brand) throw new Error(`marca desconocida '${rec.marca}'`);
      const city = cityBySlug.get(slugify(rec.ciudad ?? ""));
      if (!city) throw new Error(`ciudad desconocida '${rec.ciudad}'`);
      const category = parseCategory(rec.categoria ?? "");
      if (!category) throw new Error(`categoria desconocida '${rec.categoria}'`);
      const condition = oneOf(rec.condicion ?? "", CONDITION_VALUES, "usado");

      const model = (rec.modelo ?? "").trim();
      if (!model) throw new Error("modelo vacío");
      const year = Number(rec.anio ?? rec["año"] ?? rec.ano);
      if (!Number.isInteger(year) || year < 1970 || year > 2035) {
        throw new Error(`año inválido '${rec.anio}'`);
      }
      const km = Math.max(0, Math.round(Number(rec.km ?? 0) || 0));
      const priceUsd = Number(rec.precio_usd);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        throw new Error(`precio_usd inválido '${rec.precio_usd}'`);
      }
      const priceGs = Math.round(Number(rec.precio_gs) || priceUsd * USD_TO_PYG);

      const importKey = createHash("sha1")
        .update(`${sellerSlug}|${brand.slug}|${model.toLowerCase()}|${year}|${km}`)
        .digest("hex");
      const publicId = `I${importKey.slice(0, 9).toUpperCase()}`;
      const title = `${brand.name} ${model} ${year}`;
      const slug = `${slugify(title)}-${publicId.toLowerCase()}`;
      const cuota = bestCuota(priceGs, programs);

      const [existing] = await db
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.importKey, importKey))
        .limit(1);

      const values = {
        publicId,
        slug,
        title,
        condition,
        category,
        brandId: brand.id,
        model,
        year,
        km,
        priceUsd: priceUsd.toFixed(2),
        priceGs: String(priceGs),
        cuotaGs: cuota ? String(cuota.monthlyGs) : null,
        transmission: oneOf(rec.transmision ?? "", TRANSMISSION_VALUES, "manual"),
        fuel: oneOf(rec.combustible ?? "", FUEL_VALUES, "diesel"),
        traction: oneOf(rec.traccion ?? "", TRACTION_VALUES, "4x2"),
        capacityKg: Number(rec.capacidad_kg) > 0 ? Math.round(Number(rec.capacidad_kg)) : undefined,
        description: (rec.descripcion ?? "").trim() || null,
        locationId: city.id,
        sellerId: seller.id,
        importKey,
        status: publish ? ("published" as const) : ("draft" as const),
        publishedAt: publish ? new Date() : null,
      };

      await db
        .insert(listings)
        .values(values)
        .onDuplicateKeyUpdate({ set: { ...values } });
      if (existing) updated++;
      else created++;

      // photos: replace deterministically when the column is present
      const fotos = (rec.fotos ?? "")
        .split("|")
        .map((k) => k.trim())
        .filter(Boolean);
      if (fotos.length) {
        const [row] = await db
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.importKey, importKey))
          .limit(1);
        await db.delete(images).where(eq(images.listingId, row.id));
        for (const [s, key] of fotos.entries()) {
          await db.insert(images).values({
            listingId: row.id,
            r2Key: key,
            sortOrder: s,
            alt: `${title} — foto ${s + 1}`,
          });
        }
      }
    } catch (e) {
      errors.push(`fila ${rowNo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\nimport '${file}' → seller '${sellerSlug}'${publish ? " (published)" : " (draft)"}\n` +
      `  creados:      ${created}\n` +
      `  actualizados: ${updated}\n` +
      `  con error:    ${errors.length}`,
  );
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(errors.length && !created && !updated ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
