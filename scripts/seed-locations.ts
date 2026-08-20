/**
 * Seed the location hierarchy: Paraguay → all 17 departamentos → the main
 * cities with real commercial-vehicle volume. Asunción (capital district)
 * hangs directly off the país node, like in propia.
 *
 * Idempotent (upsert by unique full_slug), safe to re-run:
 *   npx tsx scripts/seed-locations.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { brands, locations } from "../src/db/schema";
import { joinSlug, slugify } from "../src/lib/slug";
import { assertSegmentAvailable } from "../src/lib/venta-namespace";

type Level = "pais" | "departamento" | "ciudad";

interface Node {
  name: string;
  level: Level;
  children?: Node[];
}

const TREE: Node = {
  name: "Paraguay",
  level: "pais",
  children: [
    { name: "Asunción", level: "ciudad" }, // capital district = its own city
    {
      name: "Central",
      level: "departamento",
      children: [
        { name: "San Lorenzo", level: "ciudad" },
        { name: "Luque", level: "ciudad" },
        { name: "Lambaré", level: "ciudad" },
        { name: "Fernando de la Mora", level: "ciudad" },
        { name: "Capiatá", level: "ciudad" },
        { name: "Mariano Roque Alonso", level: "ciudad" },
      ],
    },
    {
      name: "Alto Paraná",
      level: "departamento",
      children: [{ name: "Ciudad del Este", level: "ciudad" }],
    },
    {
      name: "Itapúa",
      level: "departamento",
      children: [{ name: "Encarnación", level: "ciudad" }],
    },
    {
      name: "Caaguazú",
      level: "departamento",
      children: [{ name: "Coronel Oviedo", level: "ciudad" }],
    },
    {
      name: "Amambay",
      level: "departamento",
      children: [{ name: "Pedro Juan Caballero", level: "ciudad" }],
    },
    {
      name: "Guairá",
      level: "departamento",
      children: [{ name: "Villarrica", level: "ciudad" }],
    },
    // Departamentos without seeded cities yet — pages appear when supply does.
    { name: "Concepción", level: "departamento" },
    { name: "San Pedro", level: "departamento" },
    { name: "Cordillera", level: "departamento" },
    { name: "Caazapá", level: "departamento" },
    { name: "Misiones", level: "departamento" },
    { name: "Paraguarí", level: "departamento" },
    { name: "Ñeembucú", level: "departamento" },
    { name: "Canindeyú", level: "departamento" },
    { name: "Presidente Hayes", level: "departamento" },
    { name: "Boquerón", level: "departamento" },
    { name: "Alto Paraguay", level: "departamento" },
  ],
};

let upserted = 0;

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

async function insertNode(
  node: Node,
  parentId: number | null,
  parentFullSlug: string,
): Promise<void> {
  const slug = slugify(node.name);
  const fullSlug = joinSlug(parentFullSlug, slug);
  const now = new Date();

  // F24: only `ciudad` rows become /venta segments (getCities filters on it),
  // so only they can collide with a category/brand/condition word.
  if (node.level === "ciudad") {
    assertSegmentAvailable(slug, await namespace(), { kind: "city", slug });
  }

  await db
    .insert(locations)
    .values({
      parentId: parentId ?? undefined,
      level: node.level,
      name: node.name,
      slug,
      fullSlug,
      status: "published",
      publishedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: { name: node.name, level: node.level, status: "published" },
    });

  // Re-read for the id (onDuplicateKeyUpdate doesn't return it portably).
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.fullSlug, fullSlug))
    .limit(1);
  if (!row) throw new Error(`failed to read back location ${fullSlug}`);
  upserted++;

  for (const child of node.children ?? []) {
    await insertNode(child, row.id, fullSlug);
  }
}

async function main() {
  await insertNode(TREE, null, "");
  console.log(`seeded ${upserted} locations`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
