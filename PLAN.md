# camiones.com.py — Build Plan & Progress Tracker

> **How to use this file:** This lives in the repo root of `antonmarklundcom/camiones`.
> At the end of every build/session, Claude (or Anton) updates the checkboxes and the
> STATUS line below, and commits it. Next session starts by reading this file — no
> re-discovery from zero.
>
> **STATUS: `PHASE 1 — DONE` — last updated 2026-07-10**
>
> Skills to load each session: `nodejs-mysql-hostinger-stack` + `nextjs-deploy-hostinger`
> (+ `camiones-dev` once it exists, created in Phase 5). Pattern reference: `propia-dev`.

---

## Model & effort guide (which Claude for which step)

| Model | Use for | Why |
|---|---|---|
| **Fable 5 (high)** | Phase 0 planning, schema/spec review, gap analysis, writing/updating skills, reviewing big diffs before merge | Best reasoning; expensive — don't burn it on mechanical work |
| **Opus 4.8 (high)** | Phase 1 & 2 (the two big code builds in Claude Code) | Strongest at large multi-file implementation against a fixed spec |
| **Sonnet 4.6 (low–medium)** | Phase 3 & 4 (deploy ops, seed/import runs, env vars, small fixes, content batch jobs) | Fast + cheap; these steps are procedural, the skills already contain the answers |

*(Note: there is no "Sonnet 5.0" yet — current Sonnet is 4.6. If a newer Sonnet ships, substitute it in the Sonnet rows.)*

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

## Phase 2 — BUILD 2: Admin panel + dealer flow (Claude Code, **Opus 4.8, HIGH**) — ONE build

- [ ] Auth: iron-session + bcrypt (lighter option per stack skill — no social login needed)
- [ ] `requireRole()` server-side on every mutation; dealers scoped to `sellerId = session.user.sellerId`
- [ ] `/admin/listings` CRUD (shared form for create+edit), image upload to R2 with drag-sort (upload helper already in `src/lib/r2.ts`)
- [ ] `/admin/sellers`, `/admin/users`, publish/unpublish workflow (`status` + `published_at`)
- [ ] Audit: `updated_by/updated_at` on listings (money-adjacent) — columns exist, wire them
- [ ] Dealer-facing simplified panel (their listings only)
- [ ] `npm run build` passes ✅ — **update this file + commit**

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

## Phase 4 — Content, SEO & supply ramp (**Sonnet 4.6, LOW–MED**; Fable 5 HIGH only for content strategy)

- [ ] Import first real inventory (CSV per dealer, `--publish` flag pattern — column contract in `data/ejemplo-inventario.csv`)
- [ ] Batch content via Anthropic API (propia pattern — batch jobs, never in request path): brand hub pages, buying guides ("Cómo financiar un camión en Paraguay", "Scania vs Volvo usados"), category intros
- [ ] Verify real financing rates (banks/financieras/AFD-equivalent for commercial vehicles) — **replace the (PLACEHOLDER) programs before launch** and re-run `cron:cuotas`
- [ ] Replace Demo Dealer sample listings once real inventory exists
- [ ] GBP not applicable (portal, not local business) but: dealer outreach one-pager using their `/vendedor/[slug]` page as the pitch
- [ ] **Update this file + commit**

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
