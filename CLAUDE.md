# CLAUDE.md — camiones.com.py

State-of-the-world file for every Claude session. Read this, then `PLAN.md`
(status + Phase 6 batch plan + Decisions Log), then `docs/audit-camiones.md`
(the finding numbers referenced everywhere). Update this file when a deliberate
behavior changes.

## What this is

Paraguay truck-listings portal (Next.js 15 App Router + TypeScript + Tailwind 4
+ Drizzle + MySQL on Hostinger managed Node.js; images on Cloudflare R2).
Mobile-first for prepaid-data Android; WhatsApp-first conversion; es-PY voseo
copy; prices in US$ + ₲. Not yet live. This repo is also the future source of a
`marketplace-template` repo (fork-per-site) — every fix here should respect the
engine/instance seam described in `docs/audit-camiones.md` §6.

## Commands

- `npm run dev` / `build` / `typecheck`
- `npm run lint` (ESLint flat config, `--max-warnings=0` in the gate) / `npm run test`
  (vitest, `tests/*.test.ts`) / `npm run verify` (typecheck + lint + test + build =
  exactly what the pre-push hook runs)
- `npm run db:generate` / `db:migrate` (drizzle-kit; migrations in `drizzle/`)
- `npm run seed:all` (brands, locations, financing, sample listings, guides — idempotent)
- `npm run seed:admin` (ADMIN_EMAIL/ADMIN_PASSWORD env). Creating a NEW admin is
  the default; touching an EXISTING user needs `-- --rotate` AND an explicit
  ADMIN_PASSWORD, and it announces any role promotion (F21 fixed).
- `npm run import:csv` (CSV contract: `data/ejemplo-inventario.csv`)
- `npm run cron:cuotas`, `npm run content:guides` (Anthropic batch → drafts only)
- tsx does NOT auto-load `.env` — set `DATABASE_URL` in the shell for scripts.

## Architecture map

- `app/(site)/` public routes (own chrome): `/`, `/venta/[[...segments]]`,
  `/camion/[slug]`, `/vendedor/[slug]`, `/guias`, `/buscar` (no-JS GET → 302 to
  canonical segment URL, robots-disallowed).
- `app/(admin)/admin/` panel; `login/` sits outside the auth-gated `(panel)` group.
- `src/lib/` engine logic: `queries.ts` (all public reads), `venta-params.ts`
  (segment-URL resolution — category/brand/city/condition share one namespace by
  precedence), `indexability.ts` (shared page/sitemap contract), `urls.ts`,
  `jsonld.ts`, `cuota.ts` (French amortization), `r2.ts` + `image-loader.ts`.
- `src/lib/auth/`: iron-session + bcryptjs (NOT native bcrypt — Hostinger can't
  compile addons). Every server action self-guards (`requireUser`/`requireAdmin`,
  `assertCanManageSeller`); dealers scoped to their `sellerId`.
- `src/db/schema.ts`: 8 tables. Roles: `admin | dealer` (staff planned, Batch 4).
- Uploads re-encode to WebP via sharp at ingest (long edge ≤1600, q80).

## Deliberate non-features & traps (do not "fix" casually)

- **Leads are NOT stored in the DB** — fire-and-forget GHL webhook (`src/lib/crm.ts`).
  This is audit F1 (P0) and changes in Batch 1 to store-then-forward. Until then:
  unset `GHL_WEBHOOK_URL` in prod silently drops leads while reporting success.
- **No FK constraints** — integrity is app-side until Batch 4 adds real FKs.
- **Financing rates are PLACEHOLDERS** ("(PLACEHOLDER)" in DB names). Decision:
  financing hides behind a feature flag until real verified rates exist. Never
  ship visible placeholder money figures.
- **`cuota_gs` and `price_gs` are cached snapshots** — only recomputed by
  `cron:cuotas` (not yet wired to any scheduler; Batch 3 wires a guarded route +
  external pinger). FX rate is a static env `USD_TO_PYG` until Batch 3 moves it
  to the DB.
- **Import re-runs are dangerous** (F2/F3/F12): identity key includes `km`
  (mileage update ⇒ duplicate listing), re-run without `--publish` demotes
  published rows, no transactions/journal/dry-run. Batch 2 rebuilds this.
  Until then: never re-run an import against real data without reading the audit.
- **Sessions no longer bake in privileges** (F8 fixed): the cookie is only a
  claim of identity — `getCurrentUser()` re-reads the user row on every guarded
  request and takes role/sellerId from the DB. One indexed PK read; do NOT cache
  it, that reintroduces the staleness window.
- **Admin read scopes fail closed** (F20): anything that isn't a confirmed admin,
  or is a dealer with NULL `sellerId`, gets a `1 = 0` filter. `users.email` and
  `users.password_hash` are NOT NULL as of `drizzle/0002_*`.
- **`/venta` segments share ONE namespace** — category, brand, city and condition
  slugs collide with each other (F24). Every write path for brands/cities must
  call `assertSegmentAvailable()` (`src/lib/venta-namespace.ts`); the seeds do.
- **Listing status is a state machine** (F27, `src/lib/admin/listing-policy.ts`):
  sold/removed can't jump straight back to `published` — they route through
  `draft`, which clears `published_at` so re-publishing stamps an honest date.
  `featured` is admin-only (it becomes a paid upsell); dealers never see the
  control and a tampered form field is ignored server-side.
- **Upload caps live in `src/lib/uploads.ts`** (F10) — 12 MB listing photos,
  8 MB guide heroes, 4 MB seller logos, MIME allowlist. `next.config.ts` raises
  `serverActions.bodySizeLimit` to 15 MB deliberately; keep the two in sync.
- **Public pages are `force-dynamic` with zero caching** (F13) — deliberate at
  build time (Hostinger can't reach DB during build); the runtime-caching fix is
  still OPEN (see PLAN.md Batch 1 remainder).
- Demo Dealer sample data is honest: no phone, "aviso de demostración" text.
- Slugs/public_ids are stable — NEVER recompute on edit (inbound links + SEO).

## Conventions & guardrails

- Don't touch `drizzle.config.ts`, `src/db/index.ts`, or `DATABASE_URL` handling.
- `npm run build` must pass locally before push — Hostinger auto-deploys `main`, NO staging.
- Never commit `.env`; keep `.env.example` updated with a comment per variable.
- All copy es-PY voseo (Escribinos, Consultá, Encontrá). WhatsApp green
  `#25D366` reserved exclusively for WhatsApp actions.
- Titles: root layout `title.template` adds "| camiones.com.py"; pages return
  bare titles; home uses `title.absolute`. Meta ≤60/≤155.
- Sitemap lists only self-canonicalising URLs (shared rule in `indexability.ts`).
- Paginated pages (venta + seller) self-canonicalise with `?page=N` and are
  `noindex,follow`; only query-param FILTER variants canonicalise back to the
  clean segment URL (F15/F16). Seller pagination strips filter params via
  `pageOnly()`.
- **ZERO GitHub Actions minutes.** Never create `.github/workflows/` — not for CI,
  not for lint/tests, not for deploy (Hostinger builds from a free webhook).
  Quality gate is the local husky pre-push hook. A workflow needs Anton's
  explicit case-by-case yes. See the `zero-runner-deploy` skill.
  **Enforced in code (Batch 0):** `.husky/pre-commit` blocks any staged
  `.github/workflows/**` file (and any `.env`); `.husky/pre-push` runs
  `typecheck → lint → test → build` and aborts the push on the first failure.
  `git push --no-verify` is the deliberate escape hatch — don't make it a habit.
- **Tests are logic-only, no DB, no browser**: `tests/` covers `cuota.ts`,
  `urls.ts`, `venta-params.ts` (queries mocked), `csv.ts`, `slug.ts` — the pure
  functions where a silent regression misquotes money or breaks canonical URLs.
  Keep the suite sub-second so the hook stays tolerable. No Playwright.
- `<img>` on R2 photos is deliberate (pass-through loader, prepaid-data budget) —
  keep the per-site `eslint-disable-next-line @next/next/no-img-element` comments.
- PR flow (once Batch 0 lands): squash-merge, pre-push hook green before push,
  auto-merge on (branch protection has NO required status check — there is no CI);
  parallel PRs must rebase after each merge; batch order per PLAN.md Phase 6.
- Update PLAN.md checkboxes + this file at session end; commit both.

## Known-decision quick reference

See PLAN.md "Decisions Log — 2026-08-19" for the full locked list (leads
store-then-forward, USD-primary + DB FX, categories table, `staff` role, no
buyer accounts, fork-per-site template, feature-flag set, ESLint/vitest CI,
admin-only `featured`, moderated self-serve signup in Batch 6 — every listing
reviewed, admin-only "add from link" in Batch 7, design pass in Batch 8,
first-party analytics only — no Google/Plausible scripts at launch).
