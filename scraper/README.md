# @insiderclusters/scraper

Standalone service that polls SEC EDGAR for Form 4 filings, parses them, applies
the signal filter, enriches with market cap, and detects insider **cluster buys**
(PRD Phase 1). No dependency on the web app — it only talks to Postgres via
`@insiderclusters/db`.

## Pipeline (one cycle)

```
getcurrent Atom feed ──> dedupe by accession ──> fetch submission .txt
   └─ Feature 1.1                                     └─ Feature 1.2
        parse Form 4 XML ──> write filings + transactions
             signal filter (P & value >= MIN_SIGNAL_VALUE)      ── Feature 1.3
                for each signalled ticker:
                   market cap (24h cache) + MAX_MARKET_CAP gate  ── Feature 1.4
                   cluster detection (>=2 insiders, 15-day win)  ── Feature 1.5
```

Structured JSON logs, retry/backoff, and never-crash resilience are Feature 1.6.

## Run

Requires Node ≥ 22, a running Postgres, and migrations applied (see repo root).
Config comes from the repo-root `.env` (see `.env.example`).

```bash
npm run once   --workspace @insiderclusters/scraper   # single cycle (great for testing)
npm run start  --workspace @insiderclusters/scraper   # poll loop forever
npm run dev    --workspace @insiderclusters/scraper   # loop + file watch
```

## Test

```bash
npm test       --workspace @insiderclusters/scraper   # node:test suite
npm run typecheck --workspace @insiderclusters/scraper
```

The parser / signal / market-cap tests are pure (fixtures in `fixtures/`). The
cluster-detection test is an integration test and needs the local Postgres with
migrations applied.

## Key files

| File | Responsibility |
| --- | --- |
| `src/sec/feed.ts` | Poll + parse the getcurrent Atom feed (1.1) |
| `src/form4.parse.ts` | Pure Form 4 XML → structured filing (1.2) |
| `src/sec/form4.ts` | Fetch wrapper around the parser |
| `src/signal.ts` | Signal filter (1.3) |
| `src/marketcap.ts` | Market-cap fetch + cache + gate (1.4) |
| `src/clusters.ts` | Cluster detection + upsert (1.5) |
| `src/sec/client.ts` | HTTP client: UA header, retry/backoff (1.6) |
| `src/pipeline.ts` | Orchestrates one cycle |
| `src/index.ts` | Poll loop + graceful shutdown |

## Notes / decisions

- **Market cap source:** stockanalysis.com `/api/symbol/s/{TICKER}/overview`
  (`marketCap` field, e.g. `"6.39B"`). Unofficial/undocumented; we keep usage
  light (one request per uncached ticker per 24h) and send a contact UA.
- **Unknown market cap is treated as within-cap** so genuine micro-caps the
  data source doesn't cover aren't silently dropped.
- **Signal threshold is per-transaction** `value >= MIN_SIGNAL_VALUE`, per the PRD.
