-- 0002_market_cap_cache.sql
-- Per-ticker market-cap cache (Feature 1.4). Avoids re-fetching the market cap
-- for every transaction; entries older than the configured TTL are refreshed.

CREATE TABLE IF NOT EXISTS market_cap_cache (
  ticker      TEXT PRIMARY KEY,
  market_cap  NUMERIC,            -- null when the source had no value / lookup failed
  source      TEXT,               -- provider identifier, e.g. 'stockanalysis'
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
