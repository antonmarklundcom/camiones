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
  date,
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
    /**
     * I5 — the previous US$ price and when it changed, so a card can say
     * "precio bajó". Written by the importer and by admin edits whenever
     * price_usd actually moves. NOT touched by the FX recompute: that only
     * re-derives price_gs, so a guaraní move can never fake a price drop.
     */
    priceUsdPrev: decimal("price_usd_prev", { precision: 12, scale: 2 }),
    priceChangedAt: datetime("price_changed_at"),
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
     * F2 — identity anchor for CSV re-imports. The dealer's own plate (chapa)
     * or stock/row ID, normalised. When present the import identity is
     * sha1(v2|seller|ext:<externalId>), so a mileage or price change updates
     * the SAME listing instead of minting a second one. NULL for
     * admin-created rows and for anchorless imports (which are refused
     * `--publish`). See src/lib/import/identity.ts.
     */
    externalId: varchar("external_id", { length: 120 }),
    /**
     * Stable key for idempotent CSV re-imports. Derived by
     * src/lib/import/identity.ts — anchored on external_id when available,
     * otherwise a bucket key WITHOUT km (a mileage update must never mint a
     * second listing).
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
    // Sort controls (I5): ORDER BY price_usd / year / km with only the status
    // filter applied can't use idx_search, whose leading columns are facets.
    index("idx_price_sort").on(t.status, t.priceUsd),
    // Import anchor lookups (seller + dealer's own ID) during planImport().
    index("idx_external").on(t.sellerId, t.externalId),
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
    /**
     * I6/F18 — when a human verified this seller (RUC + WhatsApp ownership).
     * NULL = not verified. The home trust strip claims "vendedores
     * verificados"; this column is what finally makes that claim true, and the
     * badge renders from it, never from a hardcoded assumption.
     */
    verifiedAt: datetime("verified_at"),
    verifiedBy: fk("verified_by"), // users.id
    verifiedNote: varchar("verified_note", { length: 255 }),
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

export const RATE_CONVENTION_VALUES = ["tea", "nominal"] as const;

export const financingPrograms = mysqlTable("financing_programs", {
  code: varchar("code", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  annualRate: decimal("annual_rate", { precision: 5, scale: 2 }).notNull(),
  /**
   * F26 — a rate is meaningless without its convention. Paraguayan quotes are
   * usually TEA (tasa efectiva anual), so that is the default; "nominal" means
   * a tasa nominal anual capitalizable mensualmente. src/lib/cuota.ts converts.
   */
  rateConvention: mysqlEnum("rate_convention", RATE_CONVENTION_VALUES)
    .notNull()
    .default("tea"),
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

export const IMPORT_MODE_VALUES = ["dry_run", "commit"] as const;
export type ImportMode = (typeof IMPORT_MODE_VALUES)[number];

export const IMPORT_ACTION_VALUES = [
  "create",
  "update",
  "skip",
  "error",
] as const;
export type ImportAction = (typeof IMPORT_ACTION_VALUES)[number];

/**
 * One row per `npm run import:csv` invocation — dry runs included, because the
 * whole point of the journal is being able to answer "what did that run do (or
 * would it have done) to my inventory?" months later. `blocked` marks a run
 * that was refused before touching anything (missing seller, `--publish`
 * without an identity anchor).
 */
export const importJobs = mysqlTable(
  "import_jobs",
  {
    id: id(),
    sourceFile: varchar("source_file", { length: 300 }).notNull(),
    sellerSlug: varchar("seller_slug", { length: 180 }).notNull(),
    sellerId: fk("seller_id"),
    mode: mysqlEnum("mode", IMPORT_MODE_VALUES).notNull().default("dry_run"),
    // Exact CLI flags, so a run is reproducible from the journal alone.
    flags: varchar("flags", { length: 300 }).notNull().default(""),
    // Whether every row carried an identity anchor (F2). Anchorless runs may
    // never publish.
    anchored: boolean("anchored").notNull().default(false),
    status: mysqlEnum("status", ["running", "ok", "partial", "failed", "blocked"])
      .notNull()
      .default("running"),
    rowsTotal: int("rows_total", { unsigned: true }).notNull().default(0),
    rowsCreated: int("rows_created", { unsigned: true }).notNull().default(0),
    rowsUpdated: int("rows_updated", { unsigned: true }).notNull().default(0),
    rowsSkipped: int("rows_skipped", { unsigned: true }).notNull().default(0),
    rowsError: int("rows_error", { unsigned: true }).notNull().default(0),
    message: text("message"),
    startedAt: datetime("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    finishedAt: datetime("finished_at"),
  },
  (t) => [index("idx_job_seller").on(t.sellerSlug, t.startedAt)],
);

/**
 * One row per CSV data row per job. `previous_json` is the pre-change listing
 * (NULL on create) — the rollback story F12 asked for: everything needed to
 * put a clobbered row back is in this table.
 */
export const importRows = mysqlTable(
  "import_rows",
  {
    id: id(),
    jobId: fk("job_id").notNull(),
    rowNo: int("row_no", { unsigned: true }).notNull(), // 1-based CSV line (header = 1)
    action: mysqlEnum("action", IMPORT_ACTION_VALUES).notNull(),
    importKey: char("import_key", { length: 40 }),
    externalId: varchar("external_id", { length: 120 }),
    listingId: fk("listing_id"),
    // Fields the run actually changed, e.g. "price_usd, km".
    changed: varchar("changed", { length: 500 }),
    message: text("message"),
    previousJson: text("previous_json"),
    nextJson: text("next_json"),
    createdAt: createdAt(),
  },
  (t) => [index("idx_row_job").on(t.jobId, t.rowNo)],
);

/* ------------------------------------------------------------------ */
/* Money: FX rates (F11)                                               */
/* ------------------------------------------------------------------ */

/**
 * USD → PYG, one active row plus full history.
 *
 * The rate used to be the build-time env constant `USD_TO_PYG=7300`. The
 * guaraní moved ~13% over 2022-24, so ₲ prices drifted visibly and silently
 * and only a redeploy could fix them. Now: USD stays the primary price, ₲ is a
 * DERIVED cache (like cuota_gs) recomputed whenever the rate changes.
 *
 * Rows are never edited — setting a new rate deactivates the old one and
 * inserts a new one, so "what was the rate when we quoted that truck?" stays
 * answerable.
 */
export const fxRates = mysqlTable(
  "fx_rates",
  {
    id: id(),
    base: char("base", { length: 3 }).notNull().default("USD"),
    quote: char("quote", { length: 3 }).notNull().default("PYG"),
    rate: decimal("rate", { precision: 14, scale: 4 }).notNull(),
    // Free text: "BCP tipo de cambio de referencia", "promedio casas de cambio",
    // "manual". Not an enum — the source will change before the schema should.
    source: varchar("source", { length: 140 }).notNull().default("manual"),
    note: varchar("note", { length: 255 }),
    active: boolean("active").notNull().default(false),
    createdAt: createdAt(),
    createdBy: fk("created_by"), // users.id; NULL when set by a script/cron
  },
  (t) => [index("idx_fx_active").on(t.base, t.quote, t.active, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* First-party analytics (I8 + Decisions Log: no third-party scripts)  */
/* ------------------------------------------------------------------ */

export const EVENT_KIND_VALUES = ["page_view", "wa_click", "lead"] as const;
export type EventKind = (typeof EVENT_KIND_VALUES)[number];

/**
 * Raw event log. No Google, no Plausible, no third-party script — that is a
 * locked decision, and it also means zero extra JS on a prepaid-data Android.
 *
 * Deliberately narrow: no cookies, no user id, no full IP. `visitor_hash` is a
 * daily-rotating hash of IP + user-agent used ONLY to collapse a refresh
 * frenzy into one visit; it is not stable across days and identifies nobody.
 *
 * Rows are written in batches by src/lib/analytics/record.ts and rolled up
 * nightly into analytics_daily, which is what the admin dashboard reads —
 * this table is append-only and never queried per-request.
 */
export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: id(),
    kind: mysqlEnum("kind", EVENT_KIND_VALUES).notNull(),
    listingId: fk("listing_id"),
    sellerId: fk("seller_id"),
    path: varchar("path", { length: 255 }),
    // Referrer HOST only ("google.com"), never the full URL.
    referrerHost: varchar("referrer_host", { length: 120 }),
    visitorHash: char("visitor_hash", { length: 32 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_ev_rollup").on(t.createdAt, t.kind),
    index("idx_ev_listing").on(t.listingId, t.createdAt),
    index("idx_ev_seller").on(t.sellerId, t.createdAt),
  ],
);

/**
 * Nightly rollup — one row per day/kind/listing. The dashboard only ever reads
 * this, so a dealer opening their stats costs a handful of indexed rows
 * instead of a scan over months of raw events on shared MySQL.
 */
export const analyticsDaily = mysqlTable(
  "analytics_daily",
  {
    id: id(),
    day: date("day").notNull(),
    kind: mysqlEnum("kind", EVENT_KIND_VALUES).notNull(),
    listingId: fk("listing_id"),
    sellerId: fk("seller_id"),
    events: int("events", { unsigned: true }).notNull().default(0),
    visitors: int("visitors", { unsigned: true }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    // One row per (day, kind, listing) — the rollup upserts on this.
    uniqueIndex("uq_daily").on(t.day, t.kind, t.listingId, t.sellerId),
    index("idx_daily_seller").on(t.sellerId, t.day),
    index("idx_daily_listing").on(t.listingId, t.day),
  ],
);

/* ------------------------------------------------------------------ */
/* Leads: write-ahead log, then forward to the CRM (F1)                */
/* ------------------------------------------------------------------ */

export const LEAD_STATUS_VALUES = ["pending", "sent", "failed"] as const;
export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number];

/**
 * F1 — leads used to be fire-and-forget: the contact form POSTed a webhook and
 * kept nothing, so an unset `GHL_WEBHOOK_URL` in production silently dropped
 * every enquiry while telling the buyer "gracias, te contactamos". A truck
 * enquiry is the single most valuable event on this site.
 *
 * The row is written FIRST and committed before any network call. Delivery is
 * an attribute of the row, not a precondition for keeping it: `pending` rows
 * are retried by the cron sweep, `failed` rows are visible in /admin and can
 * be worked by hand. Nothing is ever lost to a webhook outage.
 */
export const leads = mysqlTable(
  "leads",
  {
    id: id(),
    name: varchar("name", { length: 140 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    message: text("message").notNull(),

    // Denormalised on purpose: the CRM payload must survive the listing being
    // edited, unpublished or deleted after the enquiry was made.
    listingId: fk("listing_id"),
    sellerId: fk("seller_id"),
    listingPublicId: char("listing_public_id", { length: 10 }),
    listingTitle: varchar("listing_title", { length: 180 }),
    listingUrl: varchar("listing_url", { length: 500 }),
    priceUsd: decimal("price_usd", { precision: 12, scale: 2 }),

    pageUrl: varchar("page_url", { length: 500 }),
    referrerHost: varchar("referrer_host", { length: 120 }),

    /**
     * Stable per submission: a double-click, or a retry after a timeout that
     * actually succeeded, must not create two contacts in the CRM.
     */
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull().unique(),

    status: mysqlEnum("status", LEAD_STATUS_VALUES).notNull().default("pending"),
    /** Which sink took it: "vendercrm" | "ghl" | "none". */
    sink: varchar("sink", { length: 30 }),
    attempts: int("attempts", { unsigned: true }).notNull().default(0),
    lastError: varchar("last_error", { length: 500 }),
    lastAttemptAt: datetime("last_attempt_at"),
    sentAt: datetime("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // The sweep's driving query: pending rows, oldest attempt first.
    index("idx_lead_delivery").on(t.status, t.lastAttemptAt),
    index("idx_lead_listing").on(t.listingId, t.createdAt),
    index("idx_lead_seller").on(t.sellerId, t.createdAt),
  ],
);
