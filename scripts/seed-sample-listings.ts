/**
 * Seed 30 realistic sample trucks so every public route renders with data
 * from day one. All belong to the "Demo Dealer" seller and are explicitly
 * marked as demo inventory in their descriptions — prices/kms are plausible
 * ballparks, NOT real market quotes.
 *
 * Idempotent: listings upsert by deterministic public_id (CAM0000001…),
 * images are replaced per listing on each run. Requires seed-brands,
 * seed-locations and seed-financing to have run first.
 *
 *   npx tsx scripts/seed-sample-listings.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  brands,
  images,
  listings,
  locations,
  sellers,
  financingPrograms,
  type Category,
  type Condition,
  type Fuel,
  type Traction,
  type Transmission,
} from "../src/db/schema";
import { slugify } from "../src/lib/slug";
import { bestCuota, type FinancingProgram } from "../src/lib/cuota";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

interface SampleTruck {
  brand: string; // brand slug
  model: string;
  year: number;
  km: number;
  priceUsd: number;
  category: Category;
  condition: Condition;
  transmission: Transmission;
  fuel: Fuel;
  traction: Traction;
  capacityKg: number | null;
  city: string; // city slug
  featured?: boolean;
}

const TRUCKS: SampleTruck[] = [
  // --- camiones rígidos -------------------------------------------------
  { brand: "mercedes-benz", model: "Atego 1726", year: 2019, km: 210000, priceUsd: 52000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 10500, city: "asuncion", featured: true },
  { brand: "scania", model: "P310", year: 2017, km: 300000, priceUsd: 54000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "6x2", capacityKg: 16000, city: "luque" },
  { brand: "volvo", model: "FM 370", year: 2018, km: 350000, priceUsd: 64000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "6x2", capacityKg: 17000, city: "capiata" },
  { brand: "iveco", model: "Tector 170E22", year: 2019, km: 190000, priceUsd: 45000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 9500, city: "fernando-de-la-mora" },
  { brand: "ford", model: "Cargo 1723", year: 2018, km: 245000, priceUsd: 42000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 10000, city: "lambare" },
  { brand: "hyundai", model: "HD78", year: 2020, km: 110000, priceUsd: 34500, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 4500, city: "san-lorenzo" },
  { brand: "jac", model: "N90", year: 2024, km: 0, priceUsd: 36900, category: "camion", condition: "nuevo", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 5700, city: "mariano-roque-alonso", featured: true },
  { brand: "volkswagen", model: "Constellation 24.280", year: 2019, km: 310000, priceUsd: 56000, category: "camion", condition: "usado", transmission: "manual", fuel: "diesel", traction: "6x2", capacityKg: 16000, city: "asuncion" },

  // --- tractocamiones ---------------------------------------------------
  { brand: "mercedes-benz", model: "Actros 2545", year: 2021, km: 380000, priceUsd: 95000, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x2", capacityKg: 23000, city: "ciudad-del-este", featured: true },
  { brand: "scania", model: "R450", year: 2020, km: 450000, priceUsd: 98000, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x2", capacityKg: 25000, city: "asuncion", featured: true },
  { brand: "scania", model: "G410", year: 2018, km: 520000, priceUsd: 78500, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x4", capacityKg: 25000, city: "villarrica" },
  { brand: "volvo", model: "FH 460", year: 2019, km: 480000, priceUsd: 88000, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x4", capacityKg: 26000, city: "ciudad-del-este" },
  { brand: "daf", model: "XF 480", year: 2020, km: 390000, priceUsd: 92000, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x2", capacityKg: 25000, city: "asuncion" },
  { brand: "foton", model: "Auman EST", year: 2022, km: 180000, priceUsd: 58500, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x4", capacityKg: 25000, city: "ciudad-del-este" },
  { brand: "sinotruk-howo", model: "Howo TX", year: 2022, km: 125000, priceUsd: 61000, category: "tractocamion", condition: "usado", transmission: "automatizada", fuel: "diesel", traction: "6x4", capacityKg: 25000, city: "encarnacion" },

  // --- furgones ----------------------------------------------------------
  { brand: "iveco", model: "Daily 70C16 Furgón", year: 2021, km: 95000, priceUsd: 36500, category: "furgon", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 3500, city: "asuncion" },
  { brand: "mercedes-benz", model: "Sprinter 415 Furgón", year: 2020, km: 120000, priceUsd: 32000, category: "furgon", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 1600, city: "fernando-de-la-mora" },
  { brand: "ford", model: "Transit Furgón 2.2", year: 2019, km: 160000, priceUsd: 24500, category: "furgon", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 1400, city: "capiata" },

  // --- volquetes ----------------------------------------------------------
  { brand: "man", model: "TGS 33.440 Volquete", year: 2019, km: 260000, priceUsd: 84000, category: "volquete", condition: "usado", transmission: "manual", fuel: "diesel", traction: "6x4", capacityKg: 18000, city: "pedro-juan-caballero" },
  { brand: "sinotruk-howo", model: "Howo A7 Volquete", year: 2021, km: 150000, priceUsd: 54000, category: "volquete", condition: "usado", transmission: "manual", fuel: "diesel", traction: "6x4", capacityKg: 20000, city: "pedro-juan-caballero" },
  { brand: "shacman", model: "X3000 Volquete", year: 2024, km: 0, priceUsd: 69000, category: "volquete", condition: "nuevo", transmission: "manual", fuel: "diesel", traction: "8x4", capacityKg: 25000, city: "ciudad-del-este", featured: true },

  // --- frigoríficos -------------------------------------------------------
  { brand: "hyundai", model: "Mighty EX8 Frío", year: 2021, km: 82000, priceUsd: 41000, category: "frigorifico", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 4800, city: "luque" },
  { brand: "kia", model: "K2500 Frío", year: 2022, km: 38000, priceUsd: 24500, category: "frigorifico", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 1200, city: "asuncion" },
  { brand: "iveco", model: "Daily 50C Frío", year: 2020, km: 130000, priceUsd: 29500, category: "frigorifico", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 2300, city: "san-lorenzo" },

  // --- camionetas de trabajo ----------------------------------------------
  { brand: "ford", model: "F-4000", year: 2019, km: 135000, priceUsd: 33000, category: "camioneta", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x4", capacityKg: 3900, city: "coronel-oviedo" },
  { brand: "hyundai", model: "Porter H100", year: 2022, km: 48000, priceUsd: 19500, category: "camioneta", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 1500, city: "asuncion" },
  { brand: "kia", model: "K2700", year: 2021, km: 62000, priceUsd: 18500, category: "camioneta", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: 1300, city: "encarnacion" },
  { brand: "jac", model: "X200", year: 2024, km: 0, priceUsd: 16900, category: "camioneta", condition: "nuevo", transmission: "manual", fuel: "nafta", traction: "4x2", capacityKg: 1500, city: "san-lorenzo" },

  // --- buses ---------------------------------------------------------------
  { brand: "scania", model: "K360 Bus", year: 2016, km: 420000, priceUsd: 84000, category: "bus", condition: "usado", transmission: "automatica", fuel: "diesel", traction: "4x2", capacityKg: null, city: "asuncion" },
  { brand: "volkswagen", model: "Volksbus 17.230 OD", year: 2018, km: 350000, priceUsd: 52000, category: "bus", condition: "usado", transmission: "manual", fuel: "diesel", traction: "4x2", capacityKg: null, city: "lambare" },
];

const CATEGORY_NOTES: Record<Category, string> = {
  camion: "Camión rígido listo para trabajar, con mantenimiento al día.",
  tractocamion: "Tractocamión para larga distancia, ideal ruta y frontera.",
  furgon: "Furgón de reparto urbano, caja seca en buen estado.",
  volquete: "Volquete para obra y áridos, hidráulica funcionando al 100%.",
  frigorifico: "Equipo de frío operativo, apto cadena de frío.",
  camioneta: "Camioneta de trabajo económica para reparto diario.",
  bus: "Unidad de pasajeros con documentación al día.",
};

async function main() {
  if (TRUCKS.length !== 30) {
    throw new Error(`expected 30 sample trucks, got ${TRUCKS.length}`);
  }

  // --- Demo Dealer (upsert by slug) --------------------------------------
  const now = new Date();
  const [asuncion] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.slug, "asuncion"))
    .limit(1);
  if (!asuncion) throw new Error("run seed-locations.ts first");

  await db
    .insert(sellers)
    .values({
      name: "Demo Dealer",
      slug: "demo-dealer",
      type: "dealer",
      // phone_whatsapp intentionally NULL → CTAs fall back to
      // NEXT_PUBLIC_DEFAULT_WHATSAPP. Never seed invented real-looking numbers.
      phoneWhatsapp: null,
      locationId: asuncion.id,
      description:
        "Concesionaria de demostración: estos avisos son datos de ejemplo cargados por el seed para desarrollo y pruebas.",
      status: "published",
      publishedAt: now,
    })
    .onDuplicateKeyUpdate({ set: { name: "Demo Dealer", status: "published" } });
  const [dealer] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.slug, "demo-dealer"))
    .limit(1);

  // --- lookups -------------------------------------------------------------
  const brandRows = await db.select({ id: brands.id, slug: brands.slug, name: brands.name }).from(brands);
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));
  const cityRows = await db.select({ id: locations.id, slug: locations.slug }).from(locations).where(eq(locations.level, "ciudad"));
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
  if (!programs.length) {
    console.warn("no financing programs found — run seed-financing.ts for cuotas");
  }

  // --- listings --------------------------------------------------------------
  let n = 0;
  for (const [i, t] of TRUCKS.entries()) {
    const brand = brandBySlug.get(t.brand);
    if (!brand) throw new Error(`unknown brand slug '${t.brand}' — run seed-brands.ts`);
    const city = cityBySlug.get(t.city);
    if (!city) throw new Error(`unknown city slug '${t.city}' — run seed-locations.ts`);

    const publicId = `CAM${String(i + 1).padStart(7, "0")}`;
    const title = `${brand.name} ${t.model} ${t.year}`;
    const slug = `${slugify(title)}-${publicId.toLowerCase()}`;
    const priceGs = Math.round(t.priceUsd * USD_TO_PYG);
    const cuota = bestCuota(priceGs, programs);
    // Staggered publish dates keep the "Últimos publicados" ordering stable.
    const published = new Date(now.getTime() - i * 36e5 * 6);

    const values = {
      publicId,
      slug,
      title,
      condition: t.condition,
      category: t.category,
      brandId: brand.id,
      model: t.model,
      year: t.year,
      km: t.km,
      priceUsd: t.priceUsd.toFixed(2),
      priceGs: String(priceGs),
      cuotaGs: cuota ? String(cuota.monthlyGs) : null,
      transmission: t.transmission,
      fuel: t.fuel,
      traction: t.traction,
      capacityKg: t.capacityKg ?? undefined,
      description:
        `${CATEGORY_NOTES[t.category]} ` +
        `Único dueño de flota, se entrega con revisión. ` +
        `Aviso de demostración con datos ilustrativos.`,
      locationId: city.id,
      sellerId: dealer.id,
      featured: !!t.featured,
      status: "published" as const,
      publishedAt: published,
    };

    await db
      .insert(listings)
      .values(values)
      .onDuplicateKeyUpdate({ set: { ...values } });

    const [row] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.publicId, publicId))
      .limit(1);

    // Replace images deterministically (3 rotating placeholders per listing).
    await db.delete(images).where(eq(images.listingId, row.id));
    for (let s = 0; s < 3; s++) {
      await db.insert(images).values({
        listingId: row.id,
        r2Key: `/placeholder-truck-${(((i + s) % 6) + 1)}.webp`,
        sortOrder: s,
        alt: `${title} — foto ${s + 1}`,
      });
    }
    n++;
  }

  console.log(`seeded ${n} sample listings for Demo Dealer`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
