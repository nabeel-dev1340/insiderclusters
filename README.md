# InsiderClusters

SaaS that monitors SEC EDGAR Form 4 filings in real time, detects **cluster buys**
(2+ distinct insiders buying open-market shares of the same small/micro-cap stock
within a rolling window), and delivers alerts via web dashboard, email, and Discord.

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

## Build order

Phases 1–8 are built in sequence per the PRD; each must pass its acceptance
criteria before the next begins.

1. **Phase 1** — Scraper core (poller, parser, signal filter, market-cap gate, cluster detection)
2. **Phase 2** — Magic-link auth
3. **Phase 3** — Web dashboard
4. **Phase 4** — Billing (Lemon Squeezy)
5. **Phase 5** — Email alerts
6. **Phase 6** — Discord bot
7. **Phase 7** — SEO / content layer
8. **Phase 8** — Ops / deployment (Coolify on Hetzner)
