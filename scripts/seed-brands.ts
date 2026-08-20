/**
 * Seed truck brands — the ones that actually move in Paraguay (European
 * heavies + the Chinese brands that dominate new-unit imports).
 * Idempotent (upsert by unique slug), safe to re-run:
 *   npx tsx scripts/seed-brands.ts
 */
import { db } from "../src/db";
import { brands } from "../src/db/schema";
import { slugify } from "../src/lib/slug";
import { assertSegmentFree } from "../src/lib/segment-registry";

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

async function main() {
  const now = new Date();
  for (const name of BRAND_NAMES) {
    const slug = slugify(name);
    // F24: /venta/{slug} is one namespace — a brand that collides with a city
    // or a category slug would silently make the other unreachable.
    await assertSegmentFree(slug, "marca");
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
