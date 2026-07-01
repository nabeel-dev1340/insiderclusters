# InsiderClusters — Session Handoff / Context

Everything a fresh session needs to continue. Pairs with [PRD.md](../PRD.md)
(product spec) and [DEPLOY.md](./DEPLOY.md) (deploy runbook).

_Last updated: 2026-07-01, after Phase 3 + first production deploy._

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
- ⏭️ Phases 5 (email/Resend), 6 (Discord), 8 (ops/backups).

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
  then `next start`).
- **Redeploy:** push to `main`, hit Redeploy in Coolify.
- **Prod DB starts empty** — no demo seed in prod; fills from the scraper.

### Deploy gotchas already solved (see Dockerfile comments)
1. `next: not found` → must carry ALL workspace `node_modules` (per-package
   `.bin`), not just root.
2. `Cannot find module lightningcss.linux-x64-gnu.node` → Tailwind v4 native
   binary; the macOS lockfile blocks the Linux binary. Fix: `rm -f
   package-lock.json && npm install` in the build (fresh platform resolution).
3. `DATABASE_URL is not set` during `next build` → made the pg pool lazy
   (`packages/db/src/pool.ts`) so importing has no side effects.

## Open items / tech debt

- **Prod login is non-functional until email (Phase 5)** — devLink is gated to
  non-production, so nobody can reach the dashboard in prod yet. By design. This
  is the main blocker to a usable prod site; likely the first thing to tackle.
  Needs Resend key + verified sender domain (DNS records in Hostinger).
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
- Phase 5: Resend (or SES) API key + verified sender domain.
- Phase 6: Discord bot token, OAuth2 client id/secret, guild/channel/role IDs.
- SEC User-Agent contact already set: `support@beelodev.com`.

## Next.js 16 gotchas (this is not the Next you remember)

- `middleware` → **`proxy.ts`** (Node runtime). We use it for the coarse
  `/dashboard` auth gate.
- `cookies()` is **async**; cookies for a redirect must be set on the
  `NextResponse`, not via `cookies()`.
- `searchParams` / `params` in pages are **promises**.
- Read `web/node_modules/next/dist/docs/` before adding framework code (AGENTS.md).
