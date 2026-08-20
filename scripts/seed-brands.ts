/**
 * Seed truck brands — the ones that actually move in Paraguay (European
 * heavies + the Chinese brands that dominate new-unit imports).
 * Idempotent (upsert by unique slug), safe to re-run:
 *   npx tsx scripts/seed-brands.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { brands, locations } from "../src/db/schema";
import { slugify } from "../src/lib/slug";
import { assertSegmentAvailable } from "../src/lib/venta-namespace";

const BRAND_NAMES = [
  "Mercedes-Benz",
  "Scania",
  "Volvo",
  "Iveco",
  "MAN",
  "DAF",
  "Ford",
  "Hyundai",
  "Kia",
  "Foton",
  "JAC",
  "Sinotruk/Howo",
  "Shacman",
  "Volkswagen",
];

/**
 * F24: brand slugs share the /venta segment namespace with categories, cities
 * and condition words. A brand that collides silently shadows whichever facet
 * resolves first, so refuse the write instead of shipping a dead URL.
 */
async function namespace() {
  const [brandRows, cityRows] = await Promise.all([
    db.select({ slug: brands.slug }).from(brands),
    db
      .select({ slug: locations.slug })
      .from(locations)
      .where(eq(locations.level, "ciudad")),
  ]);
  return {
    brandSlugs: brandRows.map((b) => b.slug),
    citySlugs: cityRows.map((c) => c.slug),
  };
}

async function main() {
  const now = new Date();
  const ns = await namespace();
  for (const name of BRAND_NAMES) {
    const slug = slugify(name);
    assertSegmentAvailable(slug, ns, { kind: "brand", slug });
    await db
      .insert(brands)
      .values({ name, slug, status: "published", publishedAt: now })
      .onDuplicateKeyUpdate({ set: { name, status: "published" } });
    console.log(`upserted brand ${slug}`);
  }
  console.log(`done — ${BRAND_NAMES.length} brands`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
