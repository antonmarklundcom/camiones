# Audit — camiones.com.py (2026-08-17)

Read-only audit of `antonmarklundcom/camiones` at commit `429ad6a`. Every finding was verified against the actual code. `npx tsc --noEmit` and `npm run build` both pass clean (Next 15.5.20, 111 kB first-load JS as PLAN.md claims).

---

## 1. Executive summary

1. **The lead pipeline can silently discard 100% of leads while telling the buyer "¡Gracias!"** — leads are fire-and-forget to a GHL webhook, never stored, and an unset `GHL_WEBHOOK_URL` in production reports *success* (`src/lib/crm.ts:29-32`). For a lead-gen business this is existential.
2. **The CSV import's identity key includes `km`** — the routine act of a dealer updating mileage in next month's sheet creates a *duplicate* listing of the same physical truck under a new URL, and re-running an import without `--publish` demotes every published imported listing back to draft.
3. **Money figures go stale by design**: cached `cuota_gs` is only refreshed by a script nobody has wired to cron, disabling all financing programs leaves stale cuotas forever, and the ₲ price never tracks the USD/PYG rate. Cards show a placeholder financing rate with no "estimado" marker.
4. **The brand identity and canonical host are hardcoded/build-time-inlined in ~12 places** — the exact propia lesson-7/8/10 trap. Fixing this *before* cutting the template is the single highest-leverage templatization move.
5. **The bones are genuinely good**: auth guarding is airtight across all 21 server actions, dealer scoping is correct, the SEO indexability contract between pages and sitemap actually holds, there are no N+1s, and the markdown/AI-content pipeline is sanitized in the right order. This is a fix-and-cut situation, not a rebuild.

---

## 2. Findings table

| ID | Sev | Area | Location | Description | TEMPLATE-CRITICAL |
|----|-----|------|----------|-------------|-------------------|
| F1 | P0 | Leads | `src/lib/crm.ts:29-48`, `app/(site)/camion/[slug]/actions.ts:41-55` | Fire-and-forget lead pipeline; unset webhook in prod = silent 100% lead loss with a success message; failed POST loses lead; no persistence, retry, or timeout | **YES** |
| F2 | P0 | Import | `scripts/import-csv.ts:139-142` | Identity key `sha1(seller\|brand\|model\|year\|km)` — km update duplicates the same truck; no plate/VIN anchor; no dedup vs admin-created rows | **YES** |
| F3 | P0 | Import | `scripts/import-csv.ts:174-181` | Re-import without `--publish` demotes published listings to draft and nulls `published_at`; `--publish` re-runs reset `published_at` to now (churns freshness ordering) | **YES** |
| F4 | P1 | Money | `scripts/recompute-cuotas.ts:29-32` | Cached `cuota_gs` has no automatic recompute (cron never wired); zero active programs → script exits without nulling, stale cuotas persist forever | **YES** |
| F5 | P1 | Money/UX | `src/components/ListingCard.tsx:59-61`, `src/components/CuotaCalculator.tsx:26-31` | Placeholder-rate cuota shown on every card with no "estimado" marker; card (60-month best program) and detail calculator (48 months, first program returned, no ORDER BY) show different numbers for the same truck | no |
| F6 | P1 | Conversion | `src/lib/whatsapp.ts:8-16`, `app/(site)/camion/[slug]/page.tsx:66-69`, `.env.example:37` | Seller without phone + unset env → `wa.me/?text=` broken link and a "Llamanos · +" button; `.env.example` ships placeholder `595000000000` that would route real buyers to a dead number | **YES** |
| F7 | P1 | Robustness | `src/components/JsonLd.tsx:6` | `JSON.stringify` output not `<`-escaped inside `<script>` — a dealer-authored `model`/title containing `</script>` becomes stored XSS on public pages | **YES** |
| F8 | P1 | Auth | `src/lib/auth/guard.ts:72-85`, `src/lib/auth/session.ts:47` | 30-day sessions bake in role/sellerId and are never revalidated against the DB — deleted/demoted users and reassigned dealers keep old privileges up to 30 days | no |
| F9 | P1 | Abuse | `app/(admin)/admin/login/actions.ts`, `app/(site)/camion/[slug]/actions.ts:25` | No rate limiting anywhere (login brute force; lead-form flooding into the CRM); the lead action's `listing` argument is client-forgeable and not re-verified against the DB | no |
| F10 | P1 | Uploads | `next.config.ts` (no `serverActions` config), `src/lib/admin/sellers.ts:339`, `src/lib/content/mutations.ts:209` | Next's default 1 MB server-action body limit almost certainly rejects normal phone photos before the 12 MB in-code cap is reached; seller-logo and guide-hero uploads have no size/MIME cap at all | no |
| F11 | P1 | Money | `.env.example:16`, `scripts/recompute-cuotas.ts:42` | USD→PYG rate is a static env constant (default 7300); `price_gs` is derived once and never refreshed for FX movement — ₲ prices drift indefinitely | **YES** |
| F12 | P1 | Import | `scripts/import-csv.ts:66-85, 205-217` | No transaction, no import journal, no dry-run, no rollback; a typo'd seller-slug arg silently creates a live *published* phantom seller and attributes the whole inventory to it; exit code 0 on a mostly-failed import | **YES** |
| F13 | P1 | Perf | `app/(site)/**/page.tsx` (`force-dynamic` everywhere), `src/lib/venta-params.ts:27-30` | Zero runtime caching: every anonymous page view = 4–7 MySQL queries; full brands + cities tables loaded twice per `/venta` request (metadata + body) | no |
| F14 | P1 | Perf | `src/db/schema.ts:116-127` vs `src/lib/queries.ts:39-54` | `condition`, `year`, `km`, `transmission`, `traction` unindexed; `idx_search` column order can't serve brand-without-category; every filtered grid risks scan + filesort at a few thousand rows | no |
| F15 | P2 | SEO | `app/(site)/vendedor/[slug]/page.tsx:22-35` | Seller page ≥2 is *indexable* with a canonical claiming it equals page 1; venta filter params echo into seller pagination links creating crawlable duplicate variants | no |
| F16 | P2 | SEO | `app/(site)/venta/[[...segments]]/page.tsx:34,40` | Paginated venta pages send conflicting signals: noindex + canonical to page 1 (should be self-referencing canonical) | no |
| F17 | P2 | Template | `src/lib/urls.ts:51-53` + ~12 sites (`app/layout.tsx:16-22`, `src/lib/jsonld.ts:102-115`, `src/lib/whatsapp.ts:20-25`, `src/components/SiteFooter.tsx`, OG titles) | Brand name "camiones.com.py" hardcoded across layout, JSON-LD, WhatsApp copy, footer; canonical host is a `NEXT_PUBLIC_` var inlined at build time — one build can never serve two hosts | **YES** |
| F18 | P2 | Trust | `app/(site)/page.tsx:31-34`, `src/db/schema.ts:181-204` | Home page claims "Vendedores verificados" but no verification field or process exists anywhere | no |
| F19 | P2 | Data | `drizzle/0000_*.sql`, `0001_*.sql` | Zero FK constraints in the DDL; all referential integrity app-side; `deleteSeller` check-then-delete is racy; brands/locations deletable (via SQL) while referenced | no |
| F20 | P2 | Data/Auth | `src/db/schema.ts:213-214`, `src/lib/admin/queries.ts:20-25` | `users.email` unique-but-NULLABLE and `password_hash` nullable; a dealer with NULL `sellerId` gets a fail-open read scope (sees ALL sellers' listings in admin) | no |
| F21 | P2 | Ops | `scripts/seed-admin.ts:19,28` | Re-running without env silently rotates the admin password; the upsert promotes any existing user at `ADMIN_EMAIL` to admin | no |
| F22 | P2 | SEO | `app/layout.tsx:21-25`, `app/robots.ts`, `app/(site)/vendedor/[slug]/page.tsx:27-34` | No default `og:image` (home/venta/seller share imageless); seller pages set no `openGraph` at all (WhatsApp shares show generic title); `/admin` neither disallowed in robots nor noindexed | no |
| F23 | P2 | Perf | `src/components/Gallery.tsx:29-36`, `src/lib/r2.ts:16`, `src/lib/image-loader.ts` | Thumbnail strip downloads full-size images at 96 px display width (pass-through loader, no variants); a real R2 key with `R2_PUBLIC_BASE_URL` unset silently 404s | no |
| F24 | P2 | URLs | `src/lib/venta-params.ts:40-63` | Brand/city/condition/category slugs share one URL namespace, resolved silently by precedence; no write-time cross-namespace uniqueness check — a colliding slug silently changes URL meaning | **YES** |
| F25 | P2 | Docs | repo root | No CLAUDE.md, no ARCHITECTURE.md — PLAN.md is a build tracker, not a state-of-the-world file; the traps in this audit live nowhere an agent would read them | **YES** |
| F26 | P3 | Money | `src/lib/cuota.ts:31-40` | Amortization treats `annualRate` as nominal/12; Paraguayan banks quote effective annual (TEA) — loading real TEA rates as-is will understate every cuota | no |
| F27 | P3 | Admin | `src/lib/admin/listings.ts:233, 242-264` | Status transitions unconstrained (sold→published legal, keeps year-old `published_at`); dealers can set `featured` on their own listings, buying home-page placement | no |
| F28 | P3 | Import | `scripts/import-csv.ts:142` | Import publicId = 36-bit hash prefix; a prefix collision makes `ON DUPLICATE KEY UPDATE` silently overwrite an unrelated seller's listing (unlikely at this scale, silent-corruption failure mode) | no |
| F29 | P3 | SEO | `app/(site)/guias/[slug]/page.tsx:26`, `src/lib/sitemap.ts:28-43` | Guide titles cut at 60 chars then get an 18-char suffix (78-char tags); unguarded `catSlug.get()` could emit `/venta/undefined` if enum and taxonomy drift | no |
| F30 | P3 | UX | `src/components/StickyCtaBar.tsx`, `src/components/SiteFooter.tsx:57` | Sticky bar lacks iOS safe-area-inset padding; footer ships `contacto@camiones.com.py (a confirmar)` — an unconfirmed mailbox on every public page | no |

---

## 3. Findings in detail

### P0

**F1 — Silent lead loss (`src/lib/crm.ts:29-48`).** Leads are deliberately not stored in the DB (PLAN.md decision); the contact form fires one POST at `GHL_WEBHOOK_URL` and forgets. Three failure modes: (a) env unset in production → `crm.ts:29-32` logs to stdout and returns `{ok:true}` — the buyer sees "¡Gracias por tu consulta!" and the lead evaporates; (b) GHL non-2xx or network error → lead lost, user at least gets the WhatsApp fallback message; (c) no fetch timeout — a hanging endpoint pins the server action. Also `sellerSlug` exists in `LeadPayload` but the action never sends it, so GHL can't route leads per dealer. *Fix approach:* add a `leads` table and insert **before** firing the webhook (write-ahead log), add a delivery-status column and a retry sweep; make the unset-env branch fail loudly when `NODE_ENV === "production"`; add an AbortSignal timeout; send `sellerSlug`. Who notices today: nobody — that is the problem. Confidence: high.

**F2 — No identity anchor in import dedup (`scripts/import-csv.ts:139-142`).** `import_key = sha1(sellerSlug|brandSlug|model|year|km)`. Two failure directions: a mileage update in the next monthly CSV changes the hash → the same physical truck gets a second listing (old URL keeps serving the stale one, still published); and two genuinely distinct trucks with identical model/year/km from one dealer collapse into one row. The CSV contract (`data/ejemplo-inventario.csv`) has no plate, VIN, chassis, or dealer-row-ID column at all, and admin-created listings (`import_key` NULL) are invisible to import dedup, so importing a truck the admin already entered always duplicates it. This is propia lesson 1 replayed. *Fix approach:* add an optional-but-strongly-recommended external ID column (chapa or dealer stock ID) to the CSV contract; when present, key on `sha1(seller|externalId)`; when absent, drop `km` from the bucket key and warn loudly (or refuse `--publish`) — exactly propia's "return null without the anchor" discipline. Confidence: high.

**F3 — Re-import clobbers publish state (`scripts/import-csv.ts:174-181`).** The upsert's `ON DUPLICATE KEY UPDATE` set includes `status` and `publishedAt` computed from the `--publish` flag. Re-running without the flag flips every published imported listing back to draft (vanishes from the site); re-running with it stamps `published_at = now()` on all rows, lying to the "Últimos publicados" ordering. It also overwrites any admin edits (price corrections, descriptions) made since the last run. *Fix approach:* on update, exclude `status`/`publishedAt` unless explicitly asked to change them (preserve first-publish timestamp, propia-style), and decide a field-level merge policy for admin-edited rows (e.g. import wins on price/km, admin wins on description — founder decision). Confidence: high.

### P1

**F4 — Stale cached cuotas (`scripts/recompute-cuotas.ts`).** `cuota_gs` is cached on rows and only written by the importer, the seed, admin edits, and the manually-run `npm run cron:cuotas` (the file's own comment says "wire as a Hostinger daily cron after go-live" — nothing wires it). Worse, with zero active programs the script exits early *without nulling* cached values, so "turn off financing" leaves fabricated cuotas on every card forever. *Fix approach:* wire the cron (Hostinger cron job or a guarded route handler hit by an external pinger); make the zero-programs path NULL the column; trigger recompute from the admin action that edits a financing program. Confidence: high.

**F5 — Cuota presentation inconsistency (`ListingCard.tsx:59-61`, `CuotaCalculator.tsx:26-31`).** Cards show the cached best cuota (60-month max term) with no "estimado"/asterisk while rates are placeholders; the detail calculator initializes at 48 months on whichever program the DB returns first (`getActivePrograms` has no ORDER BY), so the number a buyer clicked on is not the number they land on. *Fix approach:* one shared default (program + term) used by both; an "estimada*" marker on cards; deterministic program ordering. Confidence: high.

**F6 — Broken contact CTAs when phone missing (`whatsapp.ts:8-16`).** `waNumber` falls back to `NEXT_PUBLIC_DEFAULT_WHATSAPP`; with a phone-less seller and unset env, listings render `wa.me/?text=` (WhatsApp error page) and a literal `tel:+` / "Llamanos · +" button — the primary conversion path dead-ends visibly. The env-example placeholder `595000000000` invites the propia lesson-12 failure: set it to make links "work" and real buyers message a dead number, unrecoverable without a rebuild (build-time inlined). *Fix approach:* hide/replace phone CTAs when no valid number resolves (fall back to the contact form); validate the env at build (reject the `595000000000` sentinel in production). Confidence: high.

**F7 — JSON-LD script breakout (`src/components/JsonLd.tsx:6`).** `dangerouslySetInnerHTML={{__html: JSON.stringify(data)}}` — `JSON.stringify` does not escape `</script>`. Listing titles are built from the dealer's free-text `model` field, guide excerpts feed Article JSON-LD; a hostile or compromised dealer account gets stored XSS on the public site. One-line fix: `.replace(/</g, "\\u003c")`. Low likelihood, high severity, trivially cheap — and the component would be copied into every templated site. Confidence: high.

**F8 — Stale 30-day sessions (`guard.ts:72-85`).** The iron-session cookie bakes in `role` and `sellerId`; `requireUser`/`requireAdmin` never re-check the DB. Deleting a user, demoting an admin, reassigning a dealer, or changing a password leaves the old cookie fully privileged for up to 30 days (stateless cookies can't be revoked). The DB-level last-admin safeguards protect the data but not live sessions. *Fix approach:* re-fetch the user row in `requireUser` (one indexed PK read; F13's caching work can absorb it) or embed a token/updatedAt that mutations bump. Confidence: high.

**F9 — No abuse controls.** No middleware.ts exists; login (`login/actions.ts`) has good enumeration defense (dummy-hash verify, uniform error) but unlimited attempts; the public lead action can be hammered to flood the CRM with junk, and its bound `listing` argument (publicId/title/priceUsd/URL) is attacker-forgeable and forwarded to the CRM without a DB re-check — CRM data pollution and phishing-link injection into your own CRM notes. *Fix approach:* honeypot field + per-IP in-memory throttle on both actions; re-look-up the listing by `publicId` server-side and build the payload from DB values. Confidence: high.

**F10 — Upload size-limit contradiction (`next.config.ts`).** No `serverActions.bodySizeLimit` is configured, so Next's default 1 MB applies — the 12 MB check in `images.ts:55` is dead code, and normal phone photos (2–6 MB) are likely rejected in production with an opaque error before your code runs. Meanwhile seller-logo (`sellers.ts:339`) and guide-hero (`mutations.ts:209`) uploads buffer the whole file with no cap or MIME check of their own (the 1 MB default is currently the only thing saving memory). *Fix approach:* set `serverActions: { bodySizeLimit: "15mb" }` deliberately, and add explicit per-file caps + MIME checks to logo/hero paths. Verify against the live deploy first — if >1 MB uploads currently work, the limit was raised somewhere and the memory concern is live instead. Confidence: high on the code, medium on prod behavior.

**F11 — Static FX rate (`USD_TO_PYG=7300`).** ₲ prices and cuotas are derived from an env constant at import/seed time; the recompute script only re-derives `price_gs` when it's falsy (never, in practice). The guaraní moved ~13% over 2022-24; drift is unbounded and visible to any buyer doing the division. *Fix approach:* store the rate in the DB (admin-editable or fetched from BCP's published rate by the cron), recompute `price_gs` for USD-priced listings on rate change — founder decision on source of truth per listing (USD-primary vs Gs-primary). Confidence: high.

**F12 — Import has no safety rail (`import-csv.ts`).** No transaction (a crash between image delete and re-insert leaves a published listing with zero photos), no import-job journal, no previous-values capture, no dry-run flag (validation and writes interleave in one loop), no rollback story, and exit code 0 as long as *one* row succeeded. Plus: the seller is upserted from the CLI arg alone — a typo'd slug mints a brand-new *published* seller with a derived name and no phone, silently absorbing the whole inventory. This is propia lessons 4/5/6 wholesale. *Fix approach:* propia's `import_jobs` + `import_rows` (with `previous_json`) pattern, a shared `planImport`/`commitImport` path so `--dry-run` is the same code, require the seller to already exist (or an explicit `--create-seller` flag), wrap each row in a transaction, non-zero exit on any row error. Confidence: high.

**F13 — Zero runtime caching.** Every public page is `force-dynamic` with no `revalidate`, no `unstable_cache`, no `React.cache` — every anonymous view costs 4–7 MySQL queries on shared Hostinger MySQL, including loading the *entire* brands and cities tables twice per `/venta` view (once in `generateMetadata`, once in the body — Next dedupes fetch, not DB calls). The stated reason (Hostinger can't connect at build time) justifies skipping SSG, not runtime caching. *Fix approach:* wrap taxonomy lookups in `unstable_cache` with a 5-minute TTL, `React.cache` the per-request resolve, consider `revalidate = 300` on grids. Confidence: high.

**F14 — Missing filter indexes (`schema.ts:116-127`).** FilterBar filters on `condition`, `year`, `km`, `transmission`, `traction` — none indexed; `idx_search`'s order (`status, category, brand_id, location_id, price_usd`) can't efficiently serve brand-without-category (`/venta/scania`), and `ORDER BY featured DESC, published_at DESC` filesorts once any filter applies. Invisible at 30 seed rows; hurts at a few thousand listings. *Fix approach:* add indexes matching the real query shapes (e.g. `(status, brand_id, published_at)`, `(status, condition, published_at)`) after checking EXPLAIN on the actual queries. Confidence: high on shape, medium on when it bites.

### P2

**F15/F16 — Pagination canonicals.** Venta page≥2: noindex + canonical→page-1 is contradictory (canonical should be self-referencing with `?page=N`); seller page≥2 is worse — `generateMetadata` ignores `searchParams` entirely, so it's *indexable* with a wrong canonical, and venta filter params echo into seller pagination hrefs creating crawlable duplicates. *Fix:* self-canonical with page param on both; noindex seller page≥2; stop passing filter params through seller pagination.

**F17 — Brand/host hardcoding (~12 sites).** `siteOrigin()` reads `NEXT_PUBLIC_CANONICAL_HOST` (build-time inlined, module-load evaluated in `metadataBase`); the string "camiones.com.py" is hardcoded in the root layout titles/OG siteName, Organization/publisher JSON-LD, both WhatsApp prefill messages, the footer, and every OG title. Setting the env var to another host moves canonicals but leaves every visible name saying camiones.com.py. *Fix approach:* one `site.config.ts` exporting `SITE_NAME`, `CANONICAL_HOST`, default WhatsApp, contact email; everything imports from it. This is the cheapest possible version of propia's lesson 7 and the gateway to templatization. Do it before the cut.

**F18 — Unbacked "Vendedores verificados" claim.** The home trust strip asserts verification; no `verified` column, badge, or process exists. Either build a minimal verification flow (I6) or soften the copy — an unbacked trust claim on a used-truck site is a liability, not an asset.

**F19 — No FK constraints.** All `fk()` columns are bare bigints; both migrations contain zero `FOREIGN KEY` clauses. App code compensates (manual image deletes, check-then-delete on sellers — racy), but brands/locations can be orphaned via any manual SQL. *Fix approach:* founder decision — adding FKs now is cheap (data is small) and permanently converts a class of silent corruption into loud errors; at minimum add `images.listing_id → listings.id ON DELETE CASCADE` and `listings.seller_id/brand_id/location_id RESTRICT`.

**F20 — users table nullability + fail-open scope.** `email` unique-but-nullable (MySQL: unlimited NULL-email users) and `password_hash` nullable; a dealer with NULL `sellerId` (schema allows it; only zod prevents it) gets an *empty* filter in `listingScope` → sees every seller's listings in the admin read-only. *Fix:* `NOT NULL` both columns (data is tiny; backfill first), and make the null-sellerId dealer scope return an impossible condition.

**F21 — seed-admin foot-guns.** No-env re-run silently rotates the admin password (lockout if run casually, e.g. inside a seed-all); upsert promotes any existing user at `ADMIN_EMAIL` to admin. *Fix:* refuse to overwrite an existing user without an explicit `--rotate` flag.

**F22 — OG/robots gaps.** No default `og:image` anywhere (home/venta/seller share imageless on WhatsApp — the market's primary share channel); seller pages set no `openGraph` at all; `/admin` is neither disallowed in robots.ts nor noindexed. All small, all cheap.

**F23 — Image weight.** The gallery thumbnail strip loads the same full-size file as the hero (10-photo listing = 10 full downloads at 96 px display) on a prepaid-data Android market; pass-through loader means no variants exist. `r2.ts` read-path with unset `R2_PUBLIC_BASE_URL` yields `/${key}` → silent 404 for genuine R2 keys (upload path errors gracefully; read path doesn't). *Fix approach:* generate a thumb variant at ingest (sharp already in the pipeline) and store both keys; make `imageUrl` warn or fall back to placeholder on unset base URL.

**F24 — Slug namespace collisions (`venta-params.ts:40-63`).** Category/brand/city/condition share one segment namespace resolved by precedence; nothing at write time prevents a brand and city sharing a slug (the city silently becomes unreachable). Latent today, but the template multiplies taxonomies. *Fix:* cross-namespace uniqueness check in the admin create/update paths for brands, locations, and reserved segment words.

**F25 — No CLAUDE.md.** PLAN.md is a good build tracker but not a state-of-the-world file: nothing documents the deliberate non-features (leads not stored, R2 orphaning, no FKs), the placeholder-rates status, or the traps in this audit. Every future session re-derives or worse, guesses. The fix session's final task is writing it.

### P3

**F26** — `frenchAmortization` assumes nominal annual rate / 12; Paraguayan quotes are typically TEA (effective). Loading real TEA values as-is understates every cuota. Decide the convention when real rates land; store it per program.
**F27** — Any status→status transition is legal (sold→published keeps the old `published_at`, sorting as year-old stock); dealers can set `featured` on their own listings — free home-page placement unless that's intended (founder decision).
**F28** — Import publicId = first 9 hex chars of the sha1 (36 bits); a prefix collision turns the upsert into a silent overwrite of an unrelated listing. Negligible probability at this scale; note it in CLAUDE.md, or derive publicId independently.
**F29** — Guide `<title>` can hit 78 chars (60-char slice + 18-char template suffix); sitemap's `catSlug.get()` unguarded against enum/taxonomy drift (`/venta/undefined`).
**F30** — StickyCtaBar lacks `env(safe-area-inset-bottom)` padding (iOS gesture bar overlap); footer ships `contacto@camiones.com.py (a confirmar)` — honest label, but an unconfirmed mailbox on every page is still a dead-end contact path (propia lesson 12).

---

## 4. Ideas (I1–I10)

| ID | Idea | Effort | Why it matters here |
|----|------|--------|---------------------|
| I1 | **Persist leads in MySQL before firing GHL** — `leads` table as write-ahead log, delivery status, retry sweep | S | Eliminates F1. For a lead-gen business the lead IS the product; GHL stays CRM-of-record, DB becomes the log |
| I2 | **"Cuota estimada\*" marker + shared card/calculator default** | S | Fixes the trust-eroding number mismatch (F5) the buyer sees on the single most-clicked path |
| I3 | **FX-aware ₲ prices** — rate in DB, nightly recompute from BCP's published rate | S/M | Guaraní volatility makes 7300 visibly wrong within months (F11); mechanical credibility |
| I4 | **Real financiera partnerships + "Solicitá pre-aprobación" lead type** | M | In Paraguay financing access, not discovery, is the truck buyer's bottleneck — owning that funnel is the revenue model, and it replaces the placeholder rates with the moat |
| I5 | **Sort controls (price/year/km) + "precio bajó" badge** on re-import price drops | S | Comparison shoppers are the audience; import_key already gives the identity to diff against |
| I6 | **Verified-seller program** — `sellers.verifiedAt`, verify RUC + WhatsApp ownership, badge on card/detail | M | Makes the currently-false home-page claim (F18) true; #1 trust gap for high-ticket used vehicles |
| I7 | **Listing freshness** — "Publicado hace 3 días" from already-fetched `publishedAt` | S | Staleness is the used-truck buyer's first question; also pressures dealers to keep stock current |
| I8 | **WhatsApp click tracking** — `/wa/[publicId]` redirect logging a contact event, then 302 to wa.me | S/M | The primary conversion is completely unmeasured today; "X contactos este mes" is the dealer sales pitch |
| I9 | **Capacity/vocation facets** — capacity-range filter + use-case tags (granelero, cisterna, ganadero) | M | Truck buyers think "8 toneladas de soja", not "Volvo FH"; `capacityKg` already exists, filterable nowhere |
| I10 | **Dealer WhatsApp stock-sheet export** — shareable per-seller PDF/image catalogue | M/L | PY truck commerce actually happens in WhatsApp groups; pulls dealers into keeping stock current on the platform |

---

## 5. Propia-lessons checklist

1. **Dedup needs an identity anchor — APPLIES (F2).** import_key is bucketed-only (`sha1(seller|brand|model|year|km)`), no plate/VIN/phone anchor, and `km` inside the bucket makes routine mileage updates *duplicate* rather than merge. The CSV contract has no candidate anchor column at all.
2. **NULLs in unique indexes — APPLIES (F20), one instance by design.** `listings.import_key` unique-nullable is intentional (admin rows carry NULL) and its idempotency guarantee holds for imported rows; but `users.email` unique-nullable is a real instance of the trap (unlimited NULL-email users, unreachable by the seed-admin upsert).
3. **Stamp ownership on import — ALREADY HANDLED, with a caveat (F12).** `seller_id` is NOT NULL and stamped on every imported row; the caveat is that a typo'd CLI slug silently *creates* the owner as a live published phantom seller.
4. **One planner for dry-run and commit — APPLIES.** There is no dry-run at all; validation and writes interleave in one loop. Building preview later as a separate path would repeat propia's drift bug — build `planImport`/`commitImport` shared-path from the start.
5. **Rollback must be real — APPLIES.** No `import_jobs`/`import_rows`, no `previous_json`, no transactions anywhere in the repo (grep: zero matches). Partial imports commit; the only undo is manual SQL.
6. **Import permission is a column, gate in the server action — APPLIES, latently.** Import is CLI-only (no admin surface), so today the gate is shell access — acceptable for an operator tool, but the moment the template grows a UI import (it will), the column + server-action gate must exist. Admin mutations already model the right pattern (`assertCanManageSeller`).
7. **Request-scoped vs module-load branding — APPLIES, latent (F17).** `siteOrigin()` reads a build-time-inlined `NEXT_PUBLIC_` var; `metadataBase` evaluates it at module load; the brand *name* isn't derived from config at all — it's a hardcoded string in ~12 files. Single-host today so nothing is broken; every one of these is a live bug the day the template serves two hosts.
8. **Brand suffix in one title.template — ALREADY HANDLED.** Root layout has `%s | camiones.com.py`; pages return bare titles; home uses `title.absolute`; OG titles spell the suffix out manually. Verified no double-suffix. (Minor: seller pages omit OG entirely — F22.)
9. **Sitemap only lists self-canonicalising URLs — ALREADY HANDLED.** `sitemap.ts` shares `MIN_INDEXABLE` with the page templates and builds paths with the same helpers pages canonicalise to. Two nits: `/venta` included unconditionally (noindex-while-sitemapped only during an empty-DB launch window), and indexable deep combos are never sitemapped (harmless asymmetry, worth documenting).
10. **One env var carrying hidden meaning — DOESN'T APPLY, today.** `NEXT_PUBLIC_CANONICAL_HOST` moves canonicals only; locale/currency/copy are hardcoded rather than host-derived, so there's no booby trap — the camiones failure mode is the opposite one (nothing is derived, everything is scattered). The template design must choose deliberately: derive from a host map (propia) or from one config module (recommended below) — not both.
11. **Interim image storage — PARTIALLY HANDLED.** Upload path with R2 unconfigured throws a clear Spanish error that every action catches into a form error — graceful. Read path degrades to `/${key}`, which works for seed placeholders (keys are `/`-prefixed public paths, a nice touch) but silently 404s for genuine R2 keys — propia's passthrough is more honest here (F23).
12. **Dead-end contact addresses — APPLIES (F6, F30).** Footer ships `contacto@camiones.com.py (a confirmar)`; `.env.example` ships `NEXT_PUBLIC_DEFAULT_WHATSAPP=595000000000`; seed-admin defaults to `admin@camiones.com.py`. All on a domain/number not yet confirmed live. Demo Dealer deliberately has no phone (good — no invented numbers), but the fallback chain ends in a broken `wa.me/?` link instead of hiding the CTA.
13. **Multi-vertical cheap up front — APPLIES.** Camiones has no `verticals.ts` and no config layer; category taxonomy, route nouns, currency, locale and CTA copy are all baked in. Honest assessment: camiones should NOT get propia's host-map multi-vertical engine — it should get a **single-site config module** (`site.config.ts`) before the cut, because the template strategy below is fork-per-site, not multi-host. What must not be skipped is the *seam*: every market-specific value behind one import.

---

## 6. Templatization plan

### Recommendation: GitHub template repo, forked per site — with a hard engine/instance seam

For this founder — solo operator, Hostinger managed Node hosting (one app per slot, auto-deploy from main, **no staging**), sites in different countries with different legal regimes — the three options rank:

- **Multi-vertical engine + host map (propia's model): no.** One deploy serving camiones.com.py and a Swedish car site means one blast radius across countries, one DB (or brittle host→DB routing), mixed GDPR/non-GDPR data in one place, and every deploy risking every market with no staging. Propia's host map is right for multiple *Paraguayan* verticals on one infrastructure; it is wrong across countries and hosting slots.
- **Extracted shared npm package: no, not yet.** Highest ongoing cost for a solo dev (versioning, publishing, cross-repo upgrades), and premature before a second consumer exists. Revisit after site #3 if merge-from-template becomes painful.
- **Template repo, forked per site: yes.** Each site = own repo, own Hostinger slot, own DB, own legal regime, isolated blast radius. Fixes flow by `git merge template/main` (or cherry-pick), which stays cheap exactly as long as the engine/instance seam is respected — instance files should be the *only* merge conflicts. Within one market, if the founder later wants many small Paraguayan verticals cheaply, a fork can internally adopt a host map; the seam below makes that possible.

### Engine vs. instance split (file level)

**Engine (template keeps, sites never edit):**
- `src/lib/`: `queries.ts`, `venta-params.ts` (renamed generic), `urls.ts` (reads config), `indexability.ts`, `sitemap.ts`, `jsonld.ts`, `slug.ts`, `public-id.ts`, `csv.ts`, `cuota.ts` (as an optional pricing plugin), `format.ts` (locale-parameterised), `image-loader.ts`, `r2.ts`, `crm.ts` (behind a lead-sink interface), `lead.ts`
- `src/lib/auth/*`, `src/lib/admin/*`, `src/lib/content/*` — the whole admin/auth/content machinery is market-agnostic already
- `src/components/*` (with copy extracted), `app/(admin)/*`, the route *handlers* (`buscar`, sitemap, robots)
- `scripts/import-csv.ts` (rebuilt per F2/F3/F12 as a planner/committer), `recompute-cuotas.ts`, `seed-admin.ts`
- `src/db/schema.ts` minus the vertical enums (see below)

**Instance (each fork owns):**
- `site.config.ts` (new — see below), `src/lib/taxonomy.ts`, seed data (`seed-brands.ts`, `seed-locations.ts`, `seed-financing.ts`), locale message files, `public/` assets (placeholders, og-default, icon), `.env`, legal pages (privacy/cookies — GDPR sites need real ones), `data/*.csv` contracts
- Route directory *names* (`/camion`, `/venta`, `/vendedor`, `/guias`) — see below

**Strip from the template:** Demo Dealer seed listings, camiones-specific guides, the placeholder financing programs (make financing an opt-in module — Sweden has no equivalent), the hardcoded voseo copy (moves to locale files).

### Hardcoded assumptions that must become config

| Assumption | Today | Template form |
|---|---|---|
| Site name + canonical host | Hardcoded ~12 places + `NEXT_PUBLIC_CANONICAL_HOST` (F17) | `site.config.ts`: `siteName`, `canonicalHost`; server-read (not NEXT_PUBLIC) wherever possible |
| Currency & formatting | USD primary + ₲ secondary, `es-PY` formats, `USD_TO_PYG` env | `currency: {primary, secondary?, fxSource?}` + locale-driven `Intl` formatting; Sweden = SEK only, no dual display |
| Locale & copy | `es-PY` voseo strings inline in every component | Message catalogue (even a plain `messages.ts` — full i18n framework optional for single-locale sites); `<html lang>` from config |
| Taxonomy | `CATEGORY_VALUES` enum in schema + `taxonomy.ts` | The hard one: category enum lives in the DB schema. Template form: `category varchar` + categories table (or per-fork enum accepted as a migration cost). Decide before cut — retrofit is a migration on every fork |
| Financing/cuota | Always-on, Paraguay-specific | Optional module: `features.financing: boolean`; card/calculator/cron all gate on it. Sweden: off |
| Contact channel | WhatsApp-first everywhere, `wa.me` links, float, sticky bar | `contactChannels: ["whatsapp"] \| ["phone","email","form"]`; the CTA layer (Float, StickyCtaBar, detail CTAs, ContactForm fallback copy) renders per config. This is the biggest UI seam |
| Route nouns | `/camion`, `/venta`, `/vendedor`, `/guias` directories | Keep as fork-renamed directories + a `paths.ts` mapping (`listingPath()` etc. already exists — extend it; only the folder names change per fork). Next.js can't config route names; the helper layer already isolates 90% of it |
| Locations | Paraguay 3-level hierarchy seeded | Level *names* config (`pais/departamento/ciudad` → `land/län/kommun`); structure generalises as-is |
| Legal/compliance | None (PY) | Per-fork: GDPR sites need cookie consent, privacy page, lead-retention policy — which **requires** F1's leads table to have a retention/deletion story from day one |
| Lead sink | GHL webhook hardcoded in `crm.ts` | `leadSink` interface: GHL / VenderCRM / email — crm.ts is already "the ONLY file that knows", the abstraction is 80% done |

### TEMPLATE-CRITICAL findings (fix in camiones BEFORE the cut)

**F1, F2, F3, F4, F6, F7, F11, F12, F17, F24, F25.** Each is a missing abstraction, not a local bug: lead persistence (F1), import identity + planner/journal (F2/F3/F12), config-driven money recompute (F4/F11), contact-channel fallback behavior (F6), a shared JsonLd component (F7), the site-config seam (F17), taxonomy namespace discipline (F24), and the state-of-the-world doc (F25). Fixed after the cut, each becomes N fixes across N forks.

### What camiones does BETTER than propia (carry back)

- **iron-session auth + role-scoped first-party admin** — propia lacks this; camiones' guard pattern (every server action self-guards, row-owner checked against the DB not the form, last-admin safeguards) is the template's auth story and should be back-ported to propia when it gets an admin.
- **The AI guide pipeline** — batch API, structured outputs, drafts-only with `source` provenance, human review before publish, correct sanitize-after-render markdown pipeline. Propia has nothing like it; it's a genuinely reusable content engine.
- **The shared indexability contract** (`indexability.ts` consumed by both page templates and sitemap) — cleaner than checking the rule in two places; propia's lesson 9 implemented as an actual mechanism.
- **Title discipline** — `title.template` in root layout + `title.absolute` on home + manual OG suffixes: exactly propia lesson 8, done right from day one.
- **`/buscar` no-JS GET→302→canonical-segment pattern** — zero-JS faceted search that never leaks query-URLs into the index.
- **Upload pipeline** — sharp WebP re-encode at ingest (EXIF stripped, long-edge capped), server-generated R2 keys (no filename input), graceful R2-unset upload errors.
- **Tailwind 4 + the mobile conversion chrome** (WhatsAppFloat/StickyCtaBar coordination, progressive-enhancement forms) — the prepaid-Android discipline (111 kB first load) is measurable and real.
- **Seed placeholder honesty** — `/`-prefixed public-path image keys that work without R2, "(PLACEHOLDER)" suffixes in DB names, Demo Dealer with deliberately no phone.

---

## 7. "No issues here" — inspected and genuinely fine

- **`npx tsc --noEmit` and `npm run build`**: both pass clean, zero warnings surfaced.
- **Server-action authorization**: all 21 panel actions individually call `requireUser`/`requireAdmin` — none rely on the layout gate. Dealer scoping (`assertCanManageSeller`/`resolveOwningSeller`) checked end-to-end across listings, images, sellers: a dealer cannot mutate another seller's rows, cannot reassign owners, cannot flip seller publish status.
- **SQL injection**: zero raw-string SQL; the single `sql``` template (queries.ts:304) interpolates only Drizzle identifiers. Whole data layer is parameterized.
- **Login**: user-enumeration defense (dummy-hash verify + uniform error), bcrypt cost 10, prod fail-closed SESSION_SECRET (≥32 chars or throw), correct cookie flags (httpOnly, secure-in-prod, sameSite lax).
- **Markdown/AI content**: marked → sanitize-html in the correct order, tight allowlist (no img/script/iframe/style), scheme whitelist blocks `javascript:`, `rel` hardening on links; AI drafts land as `draft` with provenance, never auto-publish; `ANTHROPIC_API_KEY` never near the client bundle. Only two `NEXT_PUBLIC_` vars, both genuinely public.
- **R2 key construction**: fully server-generated (publicId/slug + timestamp + random), no client filename input, no traversal.
- **Grid queries**: no N+1 (cover image via one LEFT JOIN), all grids LIMIT-paginated, all query params sanitized to enum/digit charsets; `/buscar` whitelists and 302s correctly.
- **Cuota math**: French amortization formula and rounding discipline correct (modulo the F26 rate-convention question).
- **Slug/publicId stability**: slugs embed the publicId (collisions impossible), never recomputed on edit — stable inbound links; prefix disciplines (CAM/I/A) disjoint by construction.
- **Users safeguards**: last-admin demote/delete guards and self-delete guard verified end-to-end, including the `ne(users.id, exceptId)` edge.
- **Seeds**: brands/locations/sample-listings idempotent by natural keys, double-run safe; location hierarchy wired by parent lookup, can't mis-link.
- **Title/OG/canonical plumbing**: template + absolute + manual OG suffixes, `metadataBase` set, every public page emits a canonical, `lang="es-PY"`, no hreflang needed.
- **CSV parser** (`csv.ts`): correct RFC-4180 quote/CRLF handling, no injection surface.
