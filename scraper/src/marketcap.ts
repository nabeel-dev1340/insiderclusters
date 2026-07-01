// Feature 1.4 — Market-cap enrichment.
//
// Source: stockanalysis.com overview endpoint, which returns marketCap as a
// human-formatted string like "6.39B". We parse it to a number, cache per
// ticker for MARKET_CAP_CACHE_HOURS in Postgres, and gate cluster detection on
// MAX_MARKET_CAP.
//
// Rate limits: stockanalysis.com is unofficial and undocumented. We keep usage
// light (one request per uncached ticker per 24h) and send our contact UA.

import { pool } from "@insiderclusters/db";
import { config } from "./config.ts";
import { fetchText } from "./sec/client.ts";
import { log } from "./logger.ts";

const SOURCE = "stockanalysis";

/** Parse "6.39B" / "44.83M" / "1.2T" / "n/a" into an absolute number. */
export function parseAbbreviatedNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "" || /n\/?a/i.test(s)) return null;
  const m = s.match(/^\$?\s*(-?[\d,]*\.?\d+)\s*([KMBT])?$/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult: Record<string, number> = {
    K: 1e3,
    M: 1e6,
    B: 1e9,
    T: 1e12,
  };
  const suffix = m[2]?.toUpperCase();
  return suffix ? n * mult[suffix]! : n;
}

async function fetchFromSource(ticker: string): Promise<number | null> {
  const url = `https://stockanalysis.com/api/symbol/s/${encodeURIComponent(
    ticker
  )}/overview`;
  try {
    const body = await fetchText(url, { retries: 2 });
    const json = JSON.parse(body) as { data?: { marketCap?: unknown } };
    return parseAbbreviatedNumber(json.data?.marketCap);
  } catch (err) {
    log.warn("market cap fetch failed", { ticker, error: (err as Error).message });
    return null;
  }
}

/**
 * Return the market cap for a ticker, using the DB cache when fresh.
 * Returns null when unknown (caller decides how to treat unknowns).
 */
export async function getMarketCap(ticker: string): Promise<number | null> {
  const key = ticker.toUpperCase();

  const cached = await pool.query<{ market_cap: string | null; fetched_at: Date }>(
    `SELECT market_cap, fetched_at FROM market_cap_cache WHERE ticker = $1`,
    [key]
  );

  const row = cached.rows[0];
  if (row) {
    const ageHours = (Date.now() - row.fetched_at.getTime()) / 3_600_000;
    if (ageHours < config.marketCapCacheHours) {
      return row.market_cap == null ? null : Number(row.market_cap);
    }
  }

  const marketCap = await fetchFromSource(key);

  await pool.query(
    `INSERT INTO market_cap_cache (ticker, market_cap, source, fetched_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (ticker)
     DO UPDATE SET market_cap = EXCLUDED.market_cap,
                   source = EXCLUDED.source,
                   fetched_at = now()`,
    [key, marketCap, SOURCE]
  );

  return marketCap;
}

/**
 * Whether a ticker is within the cluster-eligible market-cap ceiling.
 * Unknown market cap (null) is treated as eligible so we don't silently drop
 * small/new tickers the data source doesn't cover — better a false include than
 * to miss a genuine micro-cap cluster.
 */
export function isWithinCap(marketCap: number | null): boolean {
  if (marketCap == null) return true;
  return marketCap <= config.maxMarketCap;
}
