# InsiderClusters — Session Handoff / Context

Everything a fresh session needs to continue. Pairs with [PRD.md](../PRD.md)
(product spec) and [DEPLOY.md](./DEPLOY.md) (deploy runbook).

_Last updated: 2026-07-02 — UI/branding polish, conviction badge, NONE data-quality fix, isSignal ticker-gate, and all four competitor-insight features DONE + committed. Coolify auto-deploys on push to `main`, so shipped in TWO pushes to order the schema change ahead of the scraper: web+migration 0004 first, then scraper. See the "Session 2026-07-02" section below._

## What this is

SaaS that monitors SEC EDGAR Form 4 filings, detects **cluster buys** (2+ distinct
insiders buying the same sub-$2B stock within a rolling 15-day window), and alerts
via dashboard / email / Discord. Free tier = delayed + limited; paid = real-time.

## Stack (as built — note the deviation)

- **Monorepo**, npm workspaces. One Node/TypeScript toolchain.
- **Scraper: TypeScript** (PRD said Python "locked" — user approved switching to
  TS to unify the toolchain and share the DB layer + types).
- **web/**: Next.js **16** (App Router) — dashboard, magic-link auth, landing.
- **packages/db/**: shared `pg` pool + numbered SQL migrations.
- **DB**: PostgreSQL (self-hosted).
- Deploy: **Coolify** on a **Hetzner** VPS. Repo: github.com/nabeel-dev1340/insiderclusters (branch `main`).

## Structure

```
web/                 Next.js app (proxy.ts, app/, lib/, components/)
scraper/             EDGAR poller/parser/signal/market-cap/cluster detection
packages/db/         pool.ts (lazy) + migrations/*.sql + migrate.mjs
scripts/seed-demo.mjs   local demo data (npm run seed)
Dockerfile           one image, runs web (default) or scraper (cmd override)
docs/DEPLOY.md       Coolify deploy runbook
```

## Phase status

- ✅ **Phase 1 — Scraper core.** Poller (getcurrent Atom feed, dedupe by
  accession), Form 4 parser, signal filter (`P` & value ≥ MIN_SIGNAL_VALUE),
  market-cap enrichment (stockanalysis.com `/overview`, 24h cache, MAX_MARKET_CAP
  gate), cluster detection (rolling window, overlap-aware upsert), JSON logging +
  retry/backoff. 12 node:test cases; verified live vs EDGAR.
- ✅ **Phase 2 — Magic-link auth.** request-link (hashed token, rate-limited),
  verify (single-use, sets httpOnly cookie), sessions, proxy.ts gate + dashboard
  DB validation, logout. Tokens SHA-256 hashed at rest.
- ✅ **Phase 3 — Web dashboard.** Landing (SSR/ISR), cluster feed (free/paid
  gating), cluster detail (transactions + EDGAR links), settings (email toggle,
  plan, billing/Discord placeholders). Emerald design system in
  `web/app/globals.css` + `web/components/ui/*`.
- ✅ **Deployed** to production on Coolify. **web** app live at
  `https://insiderclusters.com` + `https://www.insiderclusters.com` (both
  Let's Encrypt TLS, "allow www & non-www"). **scraper** worker deployed and
  running every 5 min, writing real filings/transactions to prod Postgres
  (verified: `errors: 0`).
- ⏭️ **Phase 4 — Billing (Lemon Squeezy).** Needs LS store + API key + webhook
  secret (user doesn't have yet). `web/lib/plan.ts` `effectivePlan()` already
  cross-checks plan + subscription_status; settings has a `BillingButton`
  placeholder ready to wire.
- ✅ **Phase 5 — Email alerts (Resend).** SDK-free transport (single `fetch`) in
  both `scraper/src/email.ts` and `web/lib/email.ts`. Dispatcher
  (`scraper/src/alerts.ts`) runs each cycle: **real-time** — every undispatched
  cluster emails paid+active+alerts-on users, then stamps `clusters.alert_sent_at`
  (dedupe, zero double-sends on re-run); **weekly digest** — the top cluster of the
  last 7 days to free users, ≤ once/week each via `users.last_digest_sent_at`
  (migration `0003`). Magic-link auth now actually delivers (was a console stub).
  Dispatch is gated on `RESEND_API_KEY` at the pipeline level, so deploying before
  email is configured is a no-op (never consumes the pending-cluster backlog).
  Sender: `support@beelodev.com` (beelodev.com verified in Resend). 2 node:test
  cases for dispatch idempotency; DB tests forced serial (`--test-concurrency=1`).
- ✅ **Phase 7 — SEO / content layer.** Public, server-rendered per-ticker pages
  at `/stock/{TICKER}/insider-cluster-buys` (gated to last 3 clusters for
  anonymous visitors, full history when logged in), each with unique
  title/description/canonical + BreadcrumbList & Dataset JSON-LD. Auto-updating
  `app/sitemap.ts` (all static pages + one URL per ticker, hourly revalidate) and
  `app/robots.ts` (disallows `/dashboard`, `/api`, `/auth`, `/login`). Root
  `layout.tsx` now sets `metadataBase`, title template, default OG/Twitter,
  Organization JSON-LD, and optional Google Search Console meta verification via
  `GOOGLE_SITE_VERIFICATION`. Also shipped **/pricing** (Free vs Pro $19/mo cards +
  comparison table + FAQPage JSON-LD), **/terms**, **/privacy** — Lemon Squeezy
  intentionally NOT wired (Pro CTAs start the free signup). Shared marketing
  chrome extracted to `web/components/site-chrome.tsx`; pricing copy in
  `web/components/pricing.tsx`; legal shell in `web/components/legal-page.tsx`.
- ⏭️ Phases 6 (Discord), 8 (ops/backups).

## Session 2026-07-02 — UI polish + competitor insights (IN PROGRESS, uncommitted)

Everything below is in the **working tree, not committed and not deployed**. The
scraper fixes here (NONE ticker, isSignal ticker-gate) require a **scraper
redeploy** to take effect in prod; the prod data was already cleaned manually.

### ✅ Done & verified this session
1. **Logo unified across every screen.** New `web/components/logo.tsx` `LogoTile`
   (BrandMark glyph on accent gradient) now used by both marketing chrome
   (`site-chrome.tsx`) and the dashboard nav (`dashboard-nav.tsx`, which used to
   render a flat "IC" text tile). One source of truth.
2. **"High conviction" badge (competitor-inspired, 13Radar/InsiderAction).** A
   cluster is flagged when any buyer is a C-suite/officer (not just a director /
   10% owner), derived from `insider_role` — **no schema change**. New
   `web/components/conviction-badge.tsx`; SQL predicate `HAS_SENIOR_INSIDER_SQL`
   in `web/lib/clusters.ts` (`hasSeniorInsider` on `ClusterSummary` +
   `hasSeniorInsider` on the /stocks directory via `bool_or`); matching JS
   `isSeniorInsiderRole()` in `web/lib/format.ts` (keep the two patterns in sync).
   Rendered on: cluster cards, cluster detail header, ticker pages, /stocks hub,
   landing live-clusters; detail page also dots senior rows in the tx table.
   Verified live on prod: NVCT correctly flags high-conviction.
3. **NONE / junk-cluster data-quality fix.** Root cause: a Blackstone fund LP's
   Form 4 put `NONE` in `<issuerTradingSymbol>`, treated as a real ticker →
   junk cluster + junk public SEO page. Fix: `normalizeTicker()` in
   `scraper/src/form4.parse.ts` maps placeholders (NONE/N/A/-/…) and non-symbols
   to null; the pipeline `if (parsed.ticker)` guard drops them. Tests added.
   **Prod cleaned manually** (via ssh+docker exec): deleted the NONE cluster,
   nulled 17 placeholder filing tickers, dropped NONE/N-A cache rows → prod = 1
   clean cluster (NVCT).
4. **`isSignal` now requires a real ticker.** `scraper/src/signal.ts` gained a
   `ticker` param; a code-P purchase with no ticker (non-traded funds/BDCs — e.g.
   the $100M TPG Twin Brook capital subscription) is no longer counted as a
   signal. Verified the $100M tx is arithmetically correct (not a mis-parse), it
   just isn't an open-market small-cap buy. `pipeline.ts` passes `parsed.ticker`.
   17/17 scraper tests pass, typecheck clean.

### ✅ Competitor-insight bundles — all four DONE, verified, committed
Source: what InsiderAction.io + 13Radar surface, filtered to what's cheap given
our schema. All verified against the 5 local demo clusters (rendered HTML via the
dev magic-link, free + Pro) and a prod `next build`.

- **Bundle 1 — Cluster depth (web only).** `ClusterSummary` now carries
  `totalShares`, `roleMix` (a `ROLE_MIX_SQL` aggregate bucketing distinct
  insiders officer > director > owner, summing to `insiderCount`), plus helpers
  `avgBuyPrice()` (VWAP), `buyFractionOfCompany()`. Surfaced on `cluster-card.tsx`
  (avg paid, role-mix, % of company) and the detail page (those + total shares +
  role-mix subtitle). New `format.ts` helpers: `formatSharePrice`,
  `formatPercent`, `formatSignedPercent`, `formatRoleMix`. **Note:** role-mix
  went on the *card* too (needed the SQL aggregate) — a slight expansion of the
  "no new SQL" note in the original plan.
- **Feed sorting/ranking.** `getClusterFeed` takes `FeedOptions {sort, minInsiders}`
  (whitelisted ORDER BY; size-tier filter applied to both plan tiers and to
  `hiddenCount`). `app/dashboard/page.tsx` has Newest/Biggest + All/3+/5+ toggles
  that persist across pagination via a `feedUrl()` builder.
- **Most-active insiders leaderboard.** `getMostActiveInsiders()` groups
  `is_signal` buys by `coalesce(insider_cik, insider_name)` (total $, # buys,
  distinct tickers, senior flag). Public **`/insiders`** route (SEO meta +
  ItemList/Breadcrumb JSON-LD, hourly revalidate), linked from header/footer nav
  and `sitemap.ts`.
- **Bundle 2 — Return since cluster.** Migration **`0004`** adds
  `market_cap_cache.price` + `.sector` (nullable, additive). `marketcap.ts` now
  `parseOverview()`s price (last intraday `chart.data[].c`) + sector (infoTable)
  from the same `/overview` call and upserts all three (3 new unit tests). Web
  enriches clusters via `attachMarketData()` (one round-trip, kept out of
  SELECT_COLS to avoid the `weekly`-subquery alias clash) + `returnSinceCluster()`
  helper; new `return-badge.tsx` (accent up / danger down) + sector tag on card &
  detail. `scripts/seed-demo.mjs` now seeds price/sector so this renders locally.
  **Deploy order: web (runs migration 0004) FIRST, then scraper** (the scraper's
  new price/sector INSERT needs the columns to exist).

### State of the working tree right now
- **Committed to `main` in two commits, pushed in order** (Coolify auto-deploys
  on push, so the push order enforces the deploy order):
  1. **web + migration 0004** — branding, conviction badge, and all four insight
     bundles (`clusters.ts`, `format.ts`, pages, new components, `/insiders`,
     `sitemap.ts`, migration `0004`, `seed-demo.mjs`, this doc). Push #1; wait
     until prod `/insiders` returns 200 (⇒ new web live ⇒ migration applied).
  2. **scraper** — `marketcap.ts` price/sector capture + NONE fix + isSignal gate
     + tests. Push #2, only after #1 is live, so the scraper's price/sector INSERT
     always finds the columns.
  The branding/conviction and bundle changes share several web files, so they
  landed together rather than as a separate branding commit.
- **Verification:** web `tsc --noEmit` clean, `next build` green (20 routes incl.
  `/insiders`), scraper **20/20** node:tests pass.

## Local dev

Docker is NOT installed on the dev Mac. Local Postgres = **Homebrew
`postgresql@15`** (binaries at `/opt/homebrew/opt/postgresql@15/bin`, keg-only).
Role/db: `insider` / `insider` / `insiderclusters`.

```bash
brew services start postgresql@15
npm install
cp .env.example .env            # already contains local DATABASE_URL etc.
npm run migrate                 # apply SQL migrations
npm run seed                    # 5 demo clusters (local only)
npm run dev:web                 # http://localhost:3000
npm run dev:scraper             # scraper watch
npm test --workspace @insiderclusters/scraper
```

- Web loads env via `web/.env.local` → symlink to root `.env`.
- **Dev login trick:** no email provider yet, so `POST /api/auth/request-link`
  returns the magic link in the JSON (and the login UI shows it) when
  `NODE_ENV !== production`. Click it to reach the dashboard.
- Local UI screenshots: headless Chrome against `next start` (the dev server's
  HMR socket makes headless capture hang).

## Production / deploy

- **Coolify** (already installed; hosts another of the user's sites too) on
  **Hetzner** VPS `89.167.116.36`. Domain **insiderclusters.com** via Hostinger
  (`A @ → 89.167.116.36`, `CNAME www → insiderclusters.com`).
- **Web app**: Coolify Application, Dockerfile build pack, `/Dockerfile`, port
  3000, domain `https://insiderclusters.com`. Env: `DATABASE_URL` (internal
  Coolify Postgres), `SEC_USER_AGENT`, `APP_URL=https://insiderclusters.com`,
  `NODE_ENV=production`.
- **Migrations auto-run** on each web deploy (container CMD runs `npm run migrate`
  then `next start`). The **scraper** does NOT migrate.
- **Redeploy:** push to `main`, hit Redeploy in Coolify. When a change touches
  both a migration and the scraper (e.g. Phase 5's `0003` + digest query),
  **redeploy web first, then scraper**, so the scraper never queries a column the
  migration hasn't added yet.
- **Phase 5 env vars** (set on the relevant app before redeploy): web needs
  `RESEND_API_KEY` + `ALERT_FROM_EMAIL`; scraper needs those plus `APP_URL`.
- **Prod DB starts empty** — no demo seed in prod; fills from the scraper.

### Deploy gotchas already solved (see Dockerfile comments)
1. `next: not found` → must carry ALL workspace `node_modules` (per-package
   `.bin`), not just root.
2. `Cannot find module lightningcss.linux-x64-gnu.node` → Tailwind v4 native
   binary; the macOS lockfile blocks the Linux binary. Fix: `rm -f
   package-lock.json && npm install` in the build (fresh platform resolution).
3. `DATABASE_URL is not set` during `next build` → made the pg pool lazy
   (`packages/db/src/pool.ts`) so importing has no side effects.

### Scraper / EDGAR gotchas already solved
1. **`getcurrent` `type` is a PREFIX match, not exact.** `type=4` also returns
   `497K`, `497`, `424B2/3`, `40-F`, etc. — any form starting with "4". Those have
   no `<ownershipDocument>`, so the parser threw `No <ownershipDocument> element
   found` and (via whole-submission fallback parsing) `Maximum nested tags
   exceeded` — 53 errors/cycle, 0 real filings. Fix (`scraper/src/sec/feed.ts`):
   filter each Atom entry to `category term === "4" | "4/A"` before fetch/parse,
   and over-fetch (`count=300`) so real Form 4s aren't crowded out of the
   pre-filter window during heavy fund-filing periods.
2. **fast-xml-parser v5 default `maxNestedTags: 100`** is what surfaced the above
   as a thrown error (older versions parsed silently). Keep filings scoped to the
   extracted `<ownershipDocument>` slice, never the full SGML submission.

## Open items / tech debt

- **Prod login now works** via Resend magic links (Phase 5). Requires
  `RESEND_API_KEY` + `ALERT_FROM_EMAIL` set on the **web** app in Coolify. The
  non-prod devLink shortcut still exists for local dev.
- **Scraper start log noise (cosmetic)**: prints `../.env not found. Continuing
  without it.` from `--env-file-if-exists` in the scraper `start` script. Harmless;
  can drop the flag for prod if desired.
- **Non-deterministic prod install**: the Docker builds drop `package-lock.json`.
  Consider committing a multi-platform lockfile and restoring `npm ci` later.
- **Base image CVEs**: `node:22-slim` flags some criticals/highs. Harden later
  (pin patched digest / slimmer runtime).
- **Non-deterministic prod install**: the Docker build drops `package-lock.json`.
  Consider committing a multi-platform lockfile and restoring `npm ci` later.
- **Base image CVEs**: `node:22-slim` flags some criticals/highs. Harden later
  (pin patched digest / slimmer runtime).
- **Demo clusters** exist in the LOCAL db only.
- **Search Console submission (Phase 7 follow-ups):** (1) set
  `GOOGLE_SITE_VERIFICATION` env in Coolify to the token from
  search.google.com/search-console, redeploy, then verify + submit
  `https://insiderclusters.com/sitemap.xml`. (2) Support/legal contact is
  `support@beelodev.com` (Beelodev is the parent company; credited in the footer
  + Organization JSON-LD). (3) Ticker pages fill in as the scraper
  detects real clusters; sitemap already includes them within the hour.

## Credentials still needed (per phase)

- Phase 4: Lemon Squeezy — store, API key, webhook secret.
- ✅ Phase 5: Resend API key obtained; `beelodev.com` verified, sender
  `support@beelodev.com`. Key lives ONLY as a Coolify env var on **both** web and
  scraper apps (`RESEND_API_KEY`, `ALERT_FROM_EMAIL`; scraper also needs
  `APP_URL` for email links). Rotate if ever exposed.
- Phase 6: Discord bot token, OAuth2 client id/secret, guild/channel/role IDs.
- SEC User-Agent contact already set: `support@beelodev.com`.

## Next.js 16 gotchas (this is not the Next you remember)

- `middleware` → **`proxy.ts`** (Node runtime). We use it for the coarse
  `/dashboard` auth gate.
- `cookies()` is **async**; cookies for a redirect must be set on the
  `NextResponse`, not via `cookies()`.
- `searchParams` / `params` in pages are **promises**.
- Read `web/node_modules/next/dist/docs/` before adding framework code (AGENTS.md).
