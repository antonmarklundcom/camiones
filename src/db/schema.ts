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
  uniqueIndex,
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
    /**
     * Dealer-side identity anchor (chapa / stock id), normalised by
     * `src/lib/import/identity.ts`. NULL for admin-created rows and for
     * imports from a CSV without the column. When present it is the ONLY
     * thing the importer matches on, so a mileage or price update can never
     * mint a second listing for the same physical truck (F2).
     */
    externalId: varchar("external_id", { length: 60 }),
    /**
     * Stable key for idempotent CSV re-imports (F2). Derived by
     * `importIdentity()`: sha1 over `seller|ext|<externalId>` when the CSV
     * carries an anchor, else `seller|spec|brand|model|year` — km is
     * deliberately NOT part of the key.
     */
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
    // F14 — indexes shaped like the real /venta queries. Every public grid is
    // `status='published' AND <one facet> ORDER BY featured DESC, published_at
    // DESC`, so each facet gets a covering prefix ending in the sort columns.
    // idx_search can't serve brand-without-category (/venta/scania) because
    // category sits ahead of brand_id in its column order.
    index("idx_brand_fresh").on(t.status, t.brandId, t.featured, t.publishedAt),
    index("idx_city_fresh").on(t.status, t.locationId, t.featured, t.publishedAt),
    index("idx_cat_fresh").on(t.status, t.category, t.featured, t.publishedAt),
    index("idx_condition_fresh").on(t.status, t.condition, t.featured, t.publishedAt),
    index("idx_seller_fresh").on(t.status, t.sellerId, t.featured, t.publishedAt),
    // Range facets (year/km) and the two low-cardinality spec filters are only
    // ever combined with the above, so they get plain secondary indexes the
    // optimizer can use for index-merge or as a fallback driving index.
    index("idx_year").on(t.status, t.year),
    index("idx_km").on(t.status, t.km),
    index("idx_transmission").on(t.status, t.transmission),
    index("idx_traction").on(t.status, t.traction),
    // One dealer stock id / plate per seller. MySQL ignores NULLs in unique
    // indexes, so admin rows and anchorless imports coexist freely.
    uniqueIndex("uq_seller_external").on(t.sellerId, t.externalId),
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
  // F20: NOT NULL. MySQL's UNIQUE index ignores NULLs, so a nullable email
  // allowed unlimited credential-less users past the "unique email" rule, and
  // a NULL password_hash meant a row that login logic had to special-case.
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "dealer"]).notNull().default("dealer"),
  // NULL only for admins. A dealer with NULL seller_id is a broken row: the
  // admin read scope fails closed on it (src/lib/admin/queries.ts).
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

/* ------------------------------------------------------------------ */
/* Import journal: import_jobs + import_rows (F12)                     */
/* ------------------------------------------------------------------ */

export const IMPORT_MODE_VALUES = ["dry-run", "commit"] as const;
export type ImportMode = (typeof IMPORT_MODE_VALUES)[number];

export const IMPORT_ACTION_VALUES = ["create", "update", "skip", "error"] as const;
export type ImportAction = (typeof IMPORT_ACTION_VALUES)[number];

/**
 * One row per `npm run import:csv` invocation — dry runs included, because a
 * dry run is the record of what a commit *would* have done and is worth
 * keeping when the commit later surprises someone.
 */
export const importJobs = mysqlTable(
  "import_jobs",
  {
    id: id(),
    sellerId: fk("seller_id"), // NULL when the run aborted before resolving the seller
    sellerSlug: varchar("seller_slug", { length: 180 }).notNull(),
    file: varchar("file", { length: 500 }).notNull(),
    fileSha1: char("file_sha1", { length: 40 }).notNull(), // re-run detection
    mode: mysqlEnum("mode", IMPORT_MODE_VALUES).notNull(),
    // Whether the CSV carried a chapa/stock_id column. Anchorless runs may
    // never publish (F2), and that fact is worth keeping in the journal.
    anchored: boolean("anchored").notNull().default(false),
    publishRequested: boolean("publish_requested").notNull().default(false),
    rowsTotal: int("rows_total", { unsigned: true }).notNull().default(0),
    rowsCreated: int("rows_created", { unsigned: true }).notNull().default(0),
    rowsUpdated: int("rows_updated", { unsigned: true }).notNull().default(0),
    rowsSkipped: int("rows_skipped", { unsigned: true }).notNull().default(0),
    rowsErrored: int("rows_errored", { unsigned: true }).notNull().default(0),
    status: mysqlEnum("status", ["planned", "committed", "failed"])
      .notNull()
      .default("planned"),
    notes: text("notes"),
    startedAt: createdAt(),
    finishedAt: datetime("finished_at"),
  },
  (t) => [index("idx_import_job_seller").on(t.sellerSlug, t.startedAt)],
);

/**
 * One row per CSV data row per job. `previous_json` is the pre-change listing
 * snapshot — the only thing that makes an import reversible without guessing
 * (propia lesson 5). Written inside the same transaction as the listing write.
 */
export const importRows = mysqlTable(
  "import_rows",
  {
    id: id(),
    jobId: fk("job_id").notNull(),
    rowNo: int("row_no", { unsigned: true }).notNull(), // CSV line number, header = 1
    action: mysqlEnum("action", IMPORT_ACTION_VALUES).notNull(),
    importKey: char("import_key", { length: 40 }),
    externalId: varchar("external_id", { length: 60 }),
    listingId: fk("listing_id"),
    changedFields: varchar("changed_fields", { length: 500 }), // comma-separated
    previousJson: text("previous_json"),
    error: varchar("error", { length: 500 }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_import_row_job").on(t.jobId, t.rowNo)],
);
