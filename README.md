# InsiderClusters

SaaS that monitors SEC EDGAR Form 4 filings in real time, detects **cluster buys**
(2+ distinct insiders buying open-market shares of the same small/micro-cap stock
within a rolling window), and delivers alerts via web dashboard, email, and Telegram.

See [PRD.md](./PRD.md) for the full product spec and phased build order.

## Monorepo layout

This is an npm-workspaces monorepo. Each deployable service lives in its own
directory and shares the database layer.

```
insiderclusters/
├── web/                 # Next.js (App Router) app — dashboard, auth, billing, SEO pages
├── scraper/             # TypeScript service — EDGAR poller, Form 4 parser, cluster detection
├── packages/
│   └── db/              # Shared Postgres pool + versioned SQL migrations
├── docker-compose.yml   # Local Postgres for development
└── .env.example         # Copy to .env; Coolify injects these per-service in prod
```

> **Note on the stack:** the scraper is TypeScript (not Python as the PRD's
> "locked" stack states) so the whole repo is one Node toolchain with a shared
> DB layer and shared types. Everything else follows the PRD.

## Local setup

Requires Node ≥ 22 and Docker (for local Postgres).

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create your local env file
cp .env.example .env

# 3. Start Postgres
npm run db:up

# 4. Apply database migrations
npm run migrate
```

Then, per service:

```bash
npm run dev:web        # Next.js dev server (http://localhost:3000)
npm run dev:scraper    # scraper in watch mode
```

## Database migrations

Plain, version-numbered SQL files in [`packages/db/migrations/`](./packages/db/migrations/),
applied by a small idempotent runner. No ORM auto-sync. See
[packages/db/README.md](./packages/db/README.md).

```bash
npm run migrate        # applies any pending *.sql migrations
```

## Deploying

Production runs on Coolify on the RackNerd VPS. The web app deploys from a
bare repository on the box, not from GitHub: Coolify's GitHub App lost access
to this repository (every native deployment since 12 October 2026 failed with
"installation token could not access the repository"), so the app now clones
`git@192.236.217.45:/opt/git/insiderclusters.git` like the other sites on the
box, and a push there triggers the deploy through a post-receive hook:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/insiderclusters_vps" git push vps main   # deploy
git push origin main                                                    # GitHub backup
```

The scraper also uses the bare VPS repository and is deployed by hand through
Coolify (application `2002nxlu0cvuijdjnlgpmdwx`). Deploy it after the web app
when shared database or alert eligibility changes.

## Search engines

The IndexNow key is served from `web/public/b48b74afdc5441e99eb19d09a8363ee2.txt`.
The Coolify task `indexnow-daily` runs `npm run indexnow` in the web container
every morning (06:00 UTC) and submits the sitemap URLs whose `lastmod` moved
since yesterday; after a deploy that changed many pages, run it by hand with
`--all` (every URL) or `--dry-run` (list without sending).

## Build order

Phases 1–8 are built in sequence per the PRD; each must pass its acceptance
criteria before the next begins.

1. **Phase 1** — Scraper core (poller, parser, signal filter, market-cap gate, cluster detection)
2. **Phase 2** — Magic-link auth
3. **Phase 3** — Web dashboard
4. **Phase 4** — Billing (Creem)
5. **Phase 5** — Email alerts
6. **Phase 6** — Telegram alerts
7. **Phase 7** — SEO / content layer
8. **Phase 8** — Ops / deployment (Coolify on Hetzner)

## Payments

Creem handles Basic ($9/month or $86.40/year) and Pro ($19/month or $182.40/year),
each with a seven-day free trial. `/checkout?plan=basic|pro&interval=month|year`
requires a signed-in account. `/billing` opens that account's customer portal;
`/billing/change` confirms changes to an existing subscription before charging.

Set `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, and `CREEM_TEST_MODE=false` as
runtime secrets in Coolify. The live webhook is
`https://insiderclusters.com/api/webhook/creem` and subscribes to checkout
completion and all subscription lifecycle events. Fulfillment uses verified
webhooks and retrieves current subscription state from Creem. Duplicate events
are transactional; a late event cannot restore a canceled subscription.
The success redirect never grants access. The database migration runs on startup.

For sandbox testing, use a test API key, a test webhook signing secret,
`CREEM_TEST_MODE=true`, and all four `CREEM_TEST_*_PRODUCT_ID` variables from
`.env.example`. Live IDs are never used in test mode. Run `npm test --workspace web`
with a local PostgreSQL connection in `.env`; tests use an isolated temporary schema.
