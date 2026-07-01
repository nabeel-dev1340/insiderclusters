# @insiderclusters/db

Shared database layer for the monorepo: a single Postgres connection pool and
the versioned SQL migrations that define the schema (PRD §1).

## Migrations

- Plain SQL files in [`migrations/`](./migrations/), named `NNNN_description.sql`.
- Applied in ascending filename order by [`migrate.mjs`](./migrate.mjs).
- Each applied file is recorded in a `schema_migrations` table, so re-running is
  a no-op (idempotent). The SQL itself also uses `IF NOT EXISTS` throughout.
- Each file runs in its own transaction; a failure rolls back and aborts.

### Run

From the repo root (loads `DATABASE_URL` from `.env`):

```bash
npm run migrate
```

Or from this package:

```bash
npm run migrate --workspace @insiderclusters/db
```

### Add a migration

Create the next-numbered file, e.g. `0002_add_something.sql`. Never edit a
migration that has already been applied in an environment you can't reset —
write a new one instead.

## Connection pool

`import { pool, query } from "@insiderclusters/db"` — both web and scraper use
this shared pool rather than constructing their own. Requires `DATABASE_URL`.
