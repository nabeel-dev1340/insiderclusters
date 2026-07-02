-- 0004_market_cap_price_sector.sql
-- Bundle 2 — "Return since cluster". The stockanalysis /overview call we already
-- make for market cap also carries the latest price and the company's sector, so
-- we capture both in the same per-ticker cache (no extra HTTP). The web layer
-- reads `price` to compute % return vs. the cluster's avg buy price, and shows
-- `sector` as a context tag. Both nullable — older cache rows and lookup misses
-- simply have no price/sector until the next refresh.

ALTER TABLE market_cap_cache ADD COLUMN IF NOT EXISTS price  NUMERIC;
ALTER TABLE market_cap_cache ADD COLUMN IF NOT EXISTS sector TEXT;
