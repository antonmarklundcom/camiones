/**
 * camiones.com.py — schema v1 (PLAN.md "Agreed schema").
 *
 * Conventions carried over from propia:
 *  - All filtering happens on indexed scalar columns.
 *  - Every public-facing table carries `status` + `published_at` so Build 2's
 *    publish/unpublish workflow needs zero migrations.
 *  - listings carry `updated_by`/`updated_at` (money-adjacent audit trail).
 */
import {
  bigint,
  boolean,
  char,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

const id = () =>
  bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
const createdAt = () =>
  datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const publishedAt = () => datetime("published_at");

/* Enum values exported so taxonomy/URL code shares one source of truth. */
export const CATEGORY_VALUES = [
  "camion", // camión rígido
  "tractocamion",
  "furgon",
  "volquete",
  "frigorifico",
  "camioneta", // camioneta de trabajo
  "bus",
] as const;
export const CONDITION_VALUES = ["nuevo", "usado"] as const;
export const TRANSMISSION_VALUES = [
  "manual",
  "automatica",
  "automatizada",
] as const;
export const FUEL_VALUES = ["diesel", "nafta", "electrico", "hibrido"] as const;
export const TRACTION_VALUES = ["4x2", "4x4", "6x2", "6x4", "8x2", "8x4"] as const;

export type Category = (typeof CATEGORY_VALUES)[number];
export type Condition = (typeof CONDITION_VALUES)[number];
export type Transmission = (typeof TRANSMISSION_VALUES)[number];
export type Fuel = (typeof FUEL_VALUES)[number];
export type Traction = (typeof TRACTION_VALUES)[number];

/* ------------------------------------------------------------------ */
/* Core: listings                                                      */
/* ------------------------------------------------------------------ */

export const listings = mysqlTable(
  "listings",
  {
    id: id(),
    publicId: char("public_id", { length: 10 }).notNull().unique(),
    // Detail URL is /camion/{slug}; slug embeds the publicId so it is unique
    // and never recomputed (stable inbound SEO links).
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),

    condition: mysqlEnum("condition", CONDITION_VALUES).notNull(),
    category: mysqlEnum("category", CATEGORY_VALUES).notNull(),
    brandId: fk("brand_id").notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    year: smallint("year", { unsigned: true }).notNull(),
    km: int("km", { unsigned: true }).notNull().default(0),

    priceUsd: decimal("price_usd", { precision: 12, scale: 2 }).notNull(),
    priceGs: decimal("price_gs", { precision: 14, scale: 0 }).notNull(),
    // Cached monthly payment, recomputed by scripts/recompute-cuotas.ts.
    cuotaGs: decimal("cuota_gs", { precision: 14, scale: 0 }),

    transmission: mysqlEnum("transmission", TRANSMISSION_VALUES).notNull(),
    fuel: mysqlEnum("fuel", FUEL_VALUES).notNull().default("diesel"),
    traction: mysqlEnum("traction", TRACTION_VALUES).notNull().default("4x2"),
    capacityKg: int("capacity_kg", { unsigned: true }),

    description: text("description"),

    locationId: fk("location_id").notNull(), // ciudad-level node
    sellerId: fk("seller_id").notNull(),

    featured: boolean("featured").notNull().default(false), // home "destacados"
    // Stable key for idempotent CSV re-imports: sha1(seller|brand|model|year|km).
    importKey: char("import_key", { length: 40 }).unique(),

    status: mysqlEnum("status", [
      "draft",
      "published",
      "paused",
      "sold",
      "removed",
    ])
      .notNull()
      .default("draft"),
    publishedAt: publishedAt(),
    createdAt: createdAt(),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    updatedBy: fk("updated_by"), // users.id; NULL for scripts/imports
  },
  (t) => [
    index("idx_search").on(
      t.status,
      t.category,
      t.brandId,
      t.locationId,
      t.priceUsd,
    ),
    index("idx_fresh").on(t.status, t.featured, t.publishedAt),
    index("idx_seller").on(t.sellerId, t.status),
    index("idx_brand").on(t.brandId, t.status),
  ],
);

export const images = mysqlTable(
  "images",
  {
    id: id(),
    listingId: fk("listing_id").notNull(),
    // R2 object key, or a "/..."-prefixed path served from /public (seed
    // placeholders). src/lib/r2.ts owns the URL building.
    r2Key: varchar("r2_key", { length: 500 }).notNull(),
    sortOrder: tinyint("sort_order", { unsigned: true }).notNull().default(0), // 0 = cover
    alt: varchar("alt", { length: 180 }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_listing").on(t.listingId, t.sortOrder)],
);

/* ------------------------------------------------------------------ */
/* Taxonomy: brands + hierarchical locations                           */
/* ------------------------------------------------------------------ */

export const brands = mysqlTable("brands", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  status: mysqlEnum("status", ["draft", "published"])
    .notNull()
    .default("published"),
  publishedAt: publishedAt(),
  createdAt: createdAt(),
});

export const locations = mysqlTable(
  "locations",
  {
    id: id(),
    parentId: fk("parent_id"),
    level: mysqlEnum("level", ["pais", "departamento", "ciudad"]).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    fullSlug: varchar("full_slug", { length: 300 }).notNull().unique(), // 'paraguay/central/luque'
    status: mysqlEnum("status", ["draft", "published"])
      .notNull()
      .default("published"),
    publishedAt: publishedAt(),
  },
  (t) => [index("idx_parent").on(t.parentId, t.level)],
);

/* ------------------------------------------------------------------ */
/* Supply side: sellers + users (auth lands in Build 2)                */
/* ------------------------------------------------------------------ */

export const sellers = mysqlTable(
  "sellers",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    type: mysqlEnum("type", ["dealer", "particular"]).notNull().default("dealer"),
    // Digits only with country code (5959...). NULL → CTAs fall back to
    // NEXT_PUBLIC_DEFAULT_WHATSAPP; never invent numbers in seeds.
    phoneWhatsapp: varchar("phone_whatsapp", { length: 30 }),
    phoneDisplay: varchar("phone_display", { length: 40 }), // human format "(0981) 123 456"
    email: varchar("email", { length: 190 }),
    address: varchar("address", { length: 255 }),
    locationId: fk("location_id"),
    description: text("description"),
    logoR2Key: varchar("logo_r2_key", { length: 500 }),
    status: mysqlEnum("status", ["draft", "published"])
      .notNull()
      .default("published"),
    publishedAt: publishedAt(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_location").on(t.locationId)],
);

/**
 * Users exist from day one (PLAN.md / stack skill §1.5) even though login
 * ships in Build 2. Dealers are scoped to their seller via `seller_id`.
 */
export const users = mysqlTable("users", {
  id: id(),
  name: varchar("name", { length: 140 }),
  email: varchar("email", { length: 190 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: mysqlEnum("role", ["admin", "dealer"]).notNull().default("dealer"),
  sellerId: fk("seller_id"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Money math: financing programs (cuota engine)                       */
/* ------------------------------------------------------------------ */

export const financingPrograms = mysqlTable("financing_programs", {
  code: varchar("code", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  annualRate: decimal("annual_rate", { precision: 5, scale: 2 }).notNull(),
  maxTermMonths: smallint("max_term_months").notNull(),
  maxAmountGs: decimal("max_amount_gs", { precision: 14, scale: 0 }),
  minDownPct: decimal("min_down_pct", { precision: 5, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  status: mysqlEnum("status", ["draft", "published"])
    .notNull()
    .default("published"),
  publishedAt: publishedAt(),
  updatedAt: datetime("updated_at"),
});

/* ------------------------------------------------------------------ */
/* Content: SEO guides, brand hubs, category intros (/guias)           */
/* ------------------------------------------------------------------ */

export const CONTENT_KIND_VALUES = ["guia", "marca", "categoria"] as const;
export type ContentKind = (typeof CONTENT_KIND_VALUES)[number];

/**
 * Editorial content behind /guias/[slug] (buying guides), plus optional brand
 * hubs (kind=marca, linked to a brand) and category intros (kind=categoria).
 * Body is Markdown, rendered + sanitised server-side. Drafts can be produced by
 * the Anthropic batch job (scripts/generate-guides.ts) and reviewed in /admin
 * before publish — `source` records provenance.
 */
export const contentPages = mysqlTable(
  "content_pages",
  {
    id: id(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    kind: mysqlEnum("kind", CONTENT_KIND_VALUES).notNull().default("guia"),
    title: varchar("title", { length: 200 }).notNull(),
    // Short summary — doubles as meta description (≤155 shown) and card text.
    excerpt: varchar("excerpt", { length: 320 }),
    body: text("body").notNull(), // Markdown
    heroR2Key: varchar("hero_r2_key", { length: 500 }),
    // Optional links so brand hubs / category intros can surface matching stock.
    brandId: fk("brand_id"),
    category: mysqlEnum("category", CATEGORY_VALUES),
    source: varchar("source", { length: 40 }).notNull().default("manual"),
    status: mysqlEnum("status", ["draft", "published"])
      .notNull()
      .default("draft"),
    publishedAt: publishedAt(),
    createdAt: createdAt(),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    updatedBy: fk("updated_by"),
  },
  (t) => [index("idx_content_list").on(t.status, t.kind, t.publishedAt)],
);
