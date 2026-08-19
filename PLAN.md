# camiones.com.py — Build Plan & Progress Tracker

> **How to use this file:** This lives in the repo root of `antonmarklundcom/camiones`.
> At the end of every build/session, Claude (or Anton) updates the checkboxes and the
> STATUS line below, and commits it. Next session starts by reading this file — no
> re-discovery from zero.
>
> **STATUS: `PHASE 2 — DONE` · `PHASE 4 content system (BUILD 3) — DONE` · `PHASE 6 hardening+template — PLANNED, ready to build` — last updated 2026-08-19**
> Remaining Phase 4 items are blocked on real data (dealer inventory, verified financing rates) — see Phase 4.
> **Next work = Phase 6** (batches 0–7 below), driven by `docs/audit-camiones.md` + the Decisions Log.
> Read `CLAUDE.md` first in every session.
>
> Skills to load each session: `nodejs-mysql-hostinger-stack` + `nextjs-deploy-hostinger`
> (+ `camiones-dev` once it exists, created in Phase 5). Pattern reference: `propia-dev`.

---

## Model & effort guide (which Claude for which step)

| Model | Use for | Why |
|---|---|---|
| **Fable 5 (high)** | Planning, schema/spec review, gap analysis, audits, writing/updating skills, reviewing big diffs before merge | Best reasoning; expensive — don't burn it on mechanical work |
| **Opus 5 (high)** | Phase 6 batches 0–4 + 6 and the template cut (the big code builds) | Strongest at large multi-file implementation against a fixed spec |
| **Sonnet 5 (low–medium)** | Phase 3 deploy ops, Phase 4 content/seed runs, Phase 6 batches 5 + 7, small fixes | Fast + cheap; these steps are procedural, the skills already contain the answers |

*(Updated 2026-08-19: Claude 5 family is current — substitute newer models in kind if they ship.)*

**Build philosophy:** as few Claude Code builds as possible = **2 big code builds + 1 ops session + 1 content session**. Each build gets the FULL spec from this file pasted in, plus the guardrails block (bottom of this file).

---

## Phase 0 — Spec & decisions (Fable 5, HIGH) — do in chat, no code

- [x] Confirm stack: Next.js 15 App Router + Drizzle + Hostinger MySQL (per `nodejs-mysql-hostinger-stack`)
- [ ] **Hostinger slot check**: which account (LATAM/EU/USA)? Slots remaining? Record here: `______`
- [ ] **Supply decision** (BLOCKER — see Gap Analysis): where do the first 200 truck listings come from?
      Options: (a) manual dealer outreach + admin entry, (b) CSV import from dealer inventory sheets,
      (c) self-serve dealer accounts. Decision: `______`
- [ ] **Monetization decision**: lead-gen to GHL (webhooks, like propia) / dealer subscription / featured listings. Decision: `______`
- [ ] **Domain**: camiones.com.py registered at NIC.py? DNS where? `______`
- [x] Approve schema + routes spec (below) — implemented in Build 1
- [ ] R2 bucket created (`camiones-images`, public base URL e.g. `img.camiones.com.py`) — creds ready BEFORE Build 2's upload UI (read/write helpers already shipped in Build 1)

### Agreed schema (v1) — as built in `src/db/schema.ts`
- `listings`: id, public_id, slug, title, **condition** (nuevo/usado), **brand_id, model, year, km, price_usd, price_gs, cuota_gs**, transmission, fuel, traction (4x2/4x4/6x2…), **category** (camión rígido, tracto, furgón, volquete, frigorífico, camioneta de trabajo, bus), capacity_kg, location_id, seller_id, featured, import_key, status, published_at, updated_by/updated_at
- `brands`: id, name, slug (Mercedes-Benz, Scania, Volvo, Hyundai, Foton, JAC, Kia — Chinese brands matter in PY)
- `locations`: propia's hierarchical table (pais/departamento/ciudad)
- `sellers`: id, name, type (dealer/particular), phone_whatsapp, location, user-linked via users.seller_id
- `users`: with `role` enum `admin | dealer` from day one (stack skill §1.5)
- `financing_programs`: propia pattern — rates are PLACEHOLDERS (name-suffixed "(PLACEHOLDER)"; BLOCKER: verify real rates before launch)
- `images`: listing_id, r2_key, sort_order
- `leads` NOT stored — fire GHL webhook only (propia pattern)
- Every public-facing table carries `status` + `published_at`

### Routes (SEO architecture) — as built
- `/` — home: hero search, category tiles, featured + recent, trust strip
- `/venta/[...segments]` — filter grid: `/venta/camiones`, `/venta/camiones/scania`, `/venta/camiones/scania/asuncion`, `/venta/tractocamiones/usados` (category → brand → city → condition as slug segments + query filters year/price/km/transmission/traction)
- `/camion/[slug]` — detail: gallery, specs table, cuota calculator, WhatsApp CTA (`wa.me` prefilled with listing title), `Vehicle`+`Offer` JSON-LD, sticky mobile CTA bar
- `/vendedor/[slug]` — dealer page (all their listings — this is the dealer's sales pitch to join)
- `/buscar` — no-JS form → 302 to canonical segment URL (robots-disallowed)
- `/guias/[slug]` — content pages (Phase 4)
- `sitemap.xml`, `robots.txt`, canonical host `camiones.com.py` from day one

---

## Phase 1 — BUILD 1: Full public site + data layer (Claude Code) — ✅ DONE 2026-07-10

Everything needed for a browsable, indexable site with seeded data:

- [x] Scaffold per stack skill §1 (Next 15 App Router + TS + Tailwind v4, drizzle config, pooled connection `connectionLimit: 8`, `.env.example` with a comment per variable)
- [x] Full schema above + migrations (`drizzle/0000_*.sql`; 7 tables)
- [x] Seed scripts (idempotent upsert, verified by double-run): `seed-brands.ts` (14 brands), `seed-locations.ts` (Paraguay → 17 departamentos → 12 cities), `seed-financing.ts` (3 programs, rates marked PLACEHOLDER in code + DB names), `seed-sample-listings.ts` (30 trucks, Demo Dealer), `import-csv.ts` (CSV + seller slug + `--publish`; idempotent via import_key)
- [x] All public routes above, mobile-first (Android/prepaid-data budget: ~111 kB first-load JS, WebP placeholders ~3 kB each, lazy-load below fold)
- [x] **Filters UI in v1**: category, brand, city, condition, year range, price range, km, transmission, traction. Server-side filtering; no-JS GET form via `/buscar`. Verified 3 filter combos against seed data.
- [x] **Listing cards wrapped in `<Link>`** — verified explicitly (12 `/camion/` hrefs for 12 cards on the grid)
- [x] R2 image upload/read helpers (`src/lib/r2.ts`, S3-compatible) + `next/image` pass-through loader for R2 public URLs (`src/lib/image-loader.ts`)
- [x] Cuota calculator component (propia math, down-payment + term sliders, live ₲) + `cron:cuotas` script (verified: US$52k → ₲6,2M/mes over 60m)
- [x] WhatsApp-first conversion: floating button (#25D366, aria-label "Escribinos por WhatsApp") on every page, prefilled URL-encoded `wa.me` per listing from seller phone (env fallback), visible phone + `tel:`, GHL webhook on 3-field contact form (logs + succeeds when env unset), voseo copy, `<html lang="es-PY">`
- [x] JSON-LD: `Vehicle`+`Offer` on detail, `ItemList` on grids, `Organization` on home — validated structurally on rendered pages
- [x] sitemap.xml (dynamic from DB: home, indexable segment pages ≥3 listings, all published listings, active sellers) / robots.txt (disallows `/buscar`) / canonicals / query-param filters and page≥2 are `noindex,follow` / es-PY meta ≤60/≤155
- [x] `npm run build` passes locally ✅ (typecheck clean; verified against a live MySQL: migrate + seeds + every route 200)
- [x] **Update this file + commit**

> **Build-1 notes / deviations:**
> - The app lives at the **root of the `antonmarklundcom/camiones` repo** (it was first
>   built inside propia.node, then copied out to its own repo). Hostinger's build points
>   at the repo root — no subfolder config needed.
> - Fuel + traction shipped as filterable enum columns (spec table needed them anyway).
> - `listings.featured` boolean powers the home "Destacados" grid (5 seeded).
> - Sample data is honest: Demo Dealer has no phone (falls back to
>   `NEXT_PUBLIC_DEFAULT_WHATSAPP`), descriptions say "aviso de demostración",
>   financing rates carry "(PLACEHOLDER)" in the DB.
> - `data/ejemplo-inventario.csv` documents the importer's column contract.

## Phase 2 — BUILD 2: Admin panel + dealer flow (Claude Code, **Opus 4.8, HIGH**) — ✅ DONE 2026-07-10

- [x] Auth: iron-session + **bcryptjs** (see deviation note) — encrypted httpOnly cookie, no server-side store
- [x] `requireUser()`/`requireAdmin()` + `assertCanManageSeller()`/`resolveOwningSeller()` server-side on every mutation; dealers scoped to `sellerId = session.user.sellerId` (verified: dealer can't see/edit/delete another seller's rows, tampered `sellerId` in create is ignored)
- [x] `/admin/listings` CRUD (shared `ListingForm` for create+edit), image upload to R2 with drag-sort (`ImageManager`, re-encodes to WebP via sharp, uses `src/lib/r2.ts`)
- [x] `/admin/sellers`, `/admin/users` (admin-only), publish/unpublish + status workflow (`status` + `published_at`, stamped on first publish)
- [x] Audit: `updated_by`/`updated_at` wired on every listing create/update/status change
- [x] Dealer-facing panel = same `/admin` tree, seller-scoped (dealers see only their listings + their own seller; no `/admin/users`, no create-seller)
- [x] `npm run build` passes ✅ (typecheck clean; verified against live MariaDB: migrate + seeds + 17-check server-logic suite + HTTP smoke of auth gate & public routes) — **update this file + commit**

> **Build-2 notes / deviations:**
> - **bcryptjs, not native `bcrypt`** — avoids compiling a binary addon on Hostinger shared hosting (known deploy trap). Same hashing, pure JS.
> - **Route groups**: public routes moved into `app/(site)/` (keeps the public header/footer/WhatsApp chrome); the panel lives in `app/(admin)/admin/` with its own chrome. URLs are unchanged. Root `app/layout.tsx` is now bare `<html><body>`; `not-found.tsx` pulls in the site chrome itself.
> - Login (`/admin/login`) sits OUTSIDE the auth-gated `(panel)` group so it stays reachable while logged out; the `(panel)/layout.tsx` calls `requireUser()` and redirects there.
> - New env var: **`SESSION_SECRET`** (≥32 chars in prod; dev fallback). Added to `.env.example`.
> - New script: **`npm run seed:admin`** (`ADMIN_EMAIL`/`ADMIN_PASSWORD` env, idempotent upsert; prints a generated password when unset). Rotate at go-live (Phase 3).
> - Admin-created listings use public_id `A` + 9 Crockford chars (`src/lib/public-id.ts`); slugs/public_ids are stable and never recomputed on edit.
> - Uploaded photos are re-encoded to WebP (long edge ≤1600px, q80) at ingest — matches the prepaid-data budget. `sharp` moved to runtime `dependencies`.
> - Client/server boundary: client-safe status/type constants live in `src/lib/admin/constants.ts` so form components don't pull the `server-only` data layer into the browser bundle. `@app/*` tsconfig alias added for client→action-type imports.
> - Last-admin safeguard: can't demote/delete the final admin; can't delete your own user.

## Phase 3 — Deploy & go-live (**Sonnet 4.6, MEDIUM**) — ops session, one command per message (Windows/PowerShell rule)

Follow `nextjs-deploy-hostinger` §1 + §6a exactly:

- [ ] Merge to `main`, hPanel → Import Git Repository (repo root), verify build/start commands
- [ ] Env vars in hPanel (raw VALUE only — not `KEY=value` in the value field!)
- [ ] Remote MySQL: whitelist current IP; run migrations + seeds LOCALLY with `$env:DATABASE_URL = "..."` set (tsx doesn't auto-load .env)
- [ ] **Do NOT change the DB password** without updating live env var + redeploy (§6a trap)
- [ ] Map camiones.com.py, SSL, update absolute-URL env vars, redeploy
- [ ] Set real `NEXT_PUBLIC_DEFAULT_WHATSAPP`, rotate seed admin credentials, test one live DB write, robots/sitemap reachable
- [ ] Google Search Console + GA4 (or Plausible) connected — sitemap submitted
- [ ] Record slot used (account + remaining) in Phase 0 line
- [ ] **Update this file + commit**

## BUILD 3 — Content/guides system (Claude Code, **Opus 4.8, HIGH**) — ✅ DONE 2026-07-10

The codeable half of Phase 4: the `/guias/[slug]` content architecture end-to-end,
so guides can be written/generated and indexed. (The rest of Phase 4 below is
blocked on real-world data, not code.)

- [x] Schema: `content_pages` table + migration (`drizzle/0001_*.sql`; kind = guia/marca/categoria, Markdown body, hero image, `source` provenance, `status`+`published_at`, `updated_by`)
- [x] Public routes (in the `(site)` group): `/guias` index + `/guias/[slug]` detail — Markdown rendered + **sanitised** server-side (`marked` + `sanitize-html`, tag allowlist), `Article` JSON-LD, es-PY meta ≤60/≤155, breadcrumb, brand/category → stock CTA
- [x] Sitemap: `/guias` + every published guide (shares the published-only rule); "Guías" added to public header nav
- [x] Admin (admin-only): `/admin/guias` CRUD (shared `ContentForm`, Markdown body, kind-aware brand/category link) + publish/unpublish + single hero upload to R2 (WebP re-encode)
- [x] `scripts/seed-guides.ts` (`npm run seed:guides`, in `seed:all`): 3 honest starter guides — financing, used-truck checklist, Scania vs Volvo (figures marked referential)
- [x] `scripts/generate-guides.ts` (`npm run content:guides`): **Anthropic Message Batches API** (`@anthropic-ai/sdk`, `claude-opus-4-8`, structured outputs, voseo system prompt) → writes DRAFTS (`source=anthropic-batch`) for human review in `/admin/guias`; never auto-publishes. Needs `ANTHROPIC_API_KEY` to run.
- [x] `npm run build` ✅ (typecheck clean; verified against live MariaDB: migrate + seed + `/guias`, `/guias/[slug]`, 404, Markdown/`<table>` render, Article JSON-LD, sitemap inclusion, admin gate)

> **Build-3 notes:** brand hubs (`kind=marca`) and category intros (`kind=categoria`)
> share the same table/route and link out to matching `/venta` stock; content
> authorship is admin-only (dealers don't get `/admin/guias`). Guide slugs are
> stable (never recomputed on edit).

## Phase 4 — Content, SEO & supply ramp (**Sonnet 4.6, LOW–MED**; Fable 5 HIGH only for content strategy)

- [ ] Import first real inventory (CSV per dealer, `--publish` flag pattern — column contract in `data/ejemplo-inventario.csv`) — **blocked: needs real dealer data (Phase 0 supply decision)**
- [x] Batch content via Anthropic API (propia pattern — batch jobs, never in request path): buying guides, brand hubs, category intros — **infra shipped in Build 3** (`content:guides`; run with an API key to generate drafts)
- [ ] Verify real financing rates (banks/financieras/AFD-equivalent for commercial vehicles) — **replace the (PLACEHOLDER) programs before launch** and re-run `cron:cuotas` — **blocked: needs verified external rates**
- [ ] Replace Demo Dealer sample listings once real inventory exists — **blocked on real inventory**
- [ ] GBP not applicable (portal, not local business) but: dealer outreach one-pager using their `/vendedor/[slug]` page as the pitch
- [ ] **Update this file + commit**

## Decisions Log — locked 2026-08-19 (Anton + Fable 5)

Business decisions (Anton):
- **Supply**: dealer outreach + CSV import to launch; self-serve signup built too (see Batch 6); admin "add from link" tool as helper (Batch 7).
- **Monetization**: free lead-gen for dealers first; featured placement + subscriptions become paid upsells later. Consequence: `featured` becomes **admin-only** (dealers can't self-feature).
- **Domain/hosting**: camiones.com.py as a Hostinger managed Node.js app (propia pattern). Account/slot/DNS details: record in Phase 3 checklist at deploy time.
- **Contact endpoints**: no confirmed WhatsApp number or mailbox yet — CTAs must hide gracefully when unset (Batch 1); real endpoints are a go-live gate.
- **Financing at launch**: hidden behind a feature flag until real verified rates exist. Never show placeholder numbers.

Technical decisions (locked on Fable 5's recommendation):
- Leads: **store in DB first** (write-ahead log), then forward to GHL with retry; fail loudly in prod when webhook unset.
- Import identity: plate/dealer-stock-ID CSV column strongly encouraged; without it import runs but **refuses `--publish`**.
- Import merge policy: import wins price/km/availability; admin wins description/photos/category; first `published_at` always preserved.
- Currency: USD-primary; ₲ derived from a **DB-stored FX rate**, recomputed on rate change.
- Scheduled jobs: guarded route handler + external pinger (not per-slot Hostinger cron).
- Foreign keys: **add real FK constraints** (CASCADE images, RESTRICT seller/brand/location).
- Interest rates: convention (TEA vs nominal) stored per program, converted in `cuota.ts`.
- Roles: add **`staff`** (listings/sellers/guias, not users/roles). **No buyer accounts** (WhatsApp-first; favorites via localStorage if ever needed).
- Verified sellers: `verifiedAt` column + badge now; manual verification process; no automated flow.
- Template: **GitHub template repo, forked per site** (own repo/DB/slot/legal regime per site). Not multi-host, not npm package.
- Taxonomy: categories move from schema enum to a **categories table** before the cut.
- Routes: localized folder names per fork; all links through path helpers.
- i18n: message catalogue, one locale per fork; visitor-facing switcher only when a site concretely needs it.
- Feature flags (exactly these, resist more): `financing`, `dualCurrency`, `guides`, `contactChannels`, `verifiedSellers`.
- Lead sink: config-chosen interface — GHL / VenderCRM / email.
- Tooling: ESLint; quality gate = typecheck + build + lint + vitest (money/URL/CSV logic), run **locally via a husky pre-push hook — NOT GitHub Actions**; no Playwright. **Squash-merge**; branch protection without a required-status check (there is no CI to require).

Additional decisions (locked 2026-08-19, round 2):
- **CI / GitHub Actions**: **zero runner minutes.** No `.github/workflows/` in this repo or any fork of the template. Correctness is enforced by a local husky pre-push hook (faster anyway: warm `node_modules` + `.next/cache`); deploys run on Hostinger's build servers via webhook, which is free and never appears in Actions billing. A workflow may only be added if Anton explicitly says so, case-by-case. Account backstops: billing spending limit $0, Actions disabled per repo, Copilot code review off on private repos.
- **Moderation strictness (Batch 6)**: EVERY listing from self-serve sellers is admin-reviewed before publish — no auto-publish trust level. (Revisit if volume makes it a bottleneck.)
- **Analytics**: NO third-party analytics at launch — no Google products, no Plausible. Build **first-party analytics** instead (events table: page views, WhatsApp clicks, leads; per-listing/per-seller admin dashboard — extends I8). Keep writes cheap on shared MySQL (async insert, daily aggregation). GA4 may be added later as an optional site.config choice. Phase 3's "GA4/Plausible" line is superseded; Search Console still connected (not analytics).
- **Design pass**: yes — dedicated batch restyling the public site to the web-design-system floor before launch (truck-vertical palette/type/motion, premium trust feel). Sonnet 5-friendly.
- **Site #2**: undecided — cut the template generically, pick the first fork later.

---

## Phase 6 — Hardening & template cut (Opus 5 chat = batches 0–4, 6 + cut · Sonnet 5 chat = batches 5, 7 + deploy/content)

Source of truth for findings: `docs/audit-camiones.md` (F-numbers below). Already fixed by PR #5: F7, F18, F22, F29, F30, F4-partial.
**Ordering rule:** Batch 0 first. Batches 1/2/3/5 may run as parallel PR streams (rebase after each auto-merge; never fire all PRs from one stale base). Batch 4 only after 1–3 are merged. Batch 6 after 4. Template cut after 6. Batch 7 any time after 0.

- [ ] **Batch 0 — local quality gate/foundations** (**zero GitHub Actions minutes**): husky `pre-push` running typecheck+build+lint+vitest, husky `pre-commit` blocking any `.github/workflows/` file, ESLint config, vitest skeleton for `cuota.ts`/`csv.ts`/`urls.ts`/`venta-params.ts`/`slug.ts`, CLAUDE.md kept current. Then Anton enables branch protection (no required status check) + auto-merge. **Never create `.github/workflows/` — see the zero-runner-deploy policy.**
- [ ] **Batch 1 — independent fixes** (one small PR each, parallel): leads write-ahead table + GHL retry (F1), contact-CTA hide/fallback when no phone (F6), session revalidation (F8), rate limit + honeypot (F9), serverActions bodySizeLimit + logo/hero caps (F10), runtime caching (F13), filter indexes (F14), pagination canonicals (F15/F16), users NOT NULL + dealer scope fail-closed (F20), seed-admin `--rotate` guard (F21), slug-namespace uniqueness (F24), status-transition rules + admin-only `featured` (F27).
- [ ] **Batch 2 — import rebuild** (one PR): identity anchor column, publish-state preservation, shared plan/commit with `--dry-run`, import journal (`import_jobs`/`import_rows` + previous_json), per-row transactions, non-zero exit on row errors, seller must pre-exist or `--create-seller` (F2/F3/F12/F28).
- [ ] **Batch 3 — money** (one PR): FX rate in DB + recompute (F11), cron route + pinger wiring (F4), shared card/calculator cuota default + "estimada*" marker (F5), per-program rate convention (F26), financing feature flag default-off until real rates.
- [ ] **Batch 4 — template seam** (one PR, after 1–3): `site.config.ts` (F17), message catalogue extraction, categories table (replaces enum), feature flags, `staff` role, lead-sink interface, FK constraints (F19).
- [ ] **Batch 5 — UX wins + first-party analytics** (parallel-safe small PRs): sort controls + "precio bajó" badge (I5), "Publicado hace X días" (I7), verified-seller badge (I6), capacity/vocation facets (I9, optional); **first-party analytics module**: `/wa/[publicId]` redirect logging (I8) + events table (view/wa_click/lead) + per-listing/per-seller admin dashboard; async writes + daily aggregation (shared-MySQL-friendly). No third-party analytics scripts.
- [ ] **Batch 6 — self-serve signup + moderation** (after 4): public "Vendé tu camión" registration (dealers AND particulares), email/WhatsApp-verified accounts; **every listing** from self-serve sellers goes through the admin moderation queue before publish — no auto-publish trust level (wp-to-native-admin pattern).
- [ ] **Batch 7 — admin "add from link"**: admin-only paste-URL → AI-extracted prefilled draft (title/specs/photos) for review, never auto-publish. Caveats: scraping fragility (FB blocks), only with seller's permission — note in UI.
- [ ] **Batch 8 — design pass** (Sonnet 5, before launch): restyle public site to the web-design-system floor — truck-vertical palette, type pairing, card/hero polish, subtle motion, premium trust feel. Must keep the prepaid-data budget (first-load JS ~111 kB) and WhatsApp-green rule intact.
- [ ] **Template cut**: new `marketplace-template` repo (GitHub template) from the cleaned tree; strip demo data/truck copy/PY-specific seeds; template README + "new site in one prompt" checklist + which-verticals-fit note; update generic skills with lessons.
- [ ] **Update this file + commit** at each batch end.

**Go-live gates (unchanged, business-side):** real inventory, real WhatsApp number + mailbox, financing rates verified (or flag stays off), Phase 3 deploy checklist.

## Phase 5 — Graduate (Fable 5, MEDIUM)

- [ ] Write `camiones-dev` project skill (schema as-built, routes, known-issues log, guardrails) per stack skill §4
- [ ] Post-mortem: update the generic skills with anything new learned (this is what makes site #3, #4 faster)

---

## Guardrails block (paste into EVERY Claude Code session)

```
- Don't touch drizzle.config.ts, src/db/index.ts, or DATABASE_URL handling once working.
- Run `npm run build` locally before telling me to push — Hostinger auto-deploys main, NO staging.
- One PowerShell command per message, wait for my output.
- Never commit .env; keep .env.example updated.
- All copy in Paraguayan Spanish with voseo (Escribinos, Consultá, Encontrá). Prices in US$ y ₲.
- WhatsApp green (#25D366) reserved exclusively for WhatsApp actions.
- Read PLAN.md first; update it + commit at session end.
```
