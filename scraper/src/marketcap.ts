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

/** What we extract from one /overview response. */
export interface TickerOverview {
  marketCap: number | null;
  price: number | null; // latest traded price
  sector: string | null; // e.g. "Healthcare"
}

interface OverviewData {
  marketCap?: unknown;
  chart?: { data?: { c?: unknown }[] };
  infoTable?: { t?: unknown; v?: unknown }[];
}

/**
 * Latest price = the close of the last point in the intraday `chart.data`
 * series. Null when the chart is missing/empty (e.g. an untraded ticker).
 */
export function extractLatestPrice(data: OverviewData): number | null {
  const points = data.chart?.data;
  if (!Array.isArray(points) || points.length === 0) return null;
  const c = points[points.length - 1]?.c;
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  return parseAbbreviatedNumber(c);
}

/** Sector from the overview `infoTable` (row where t === "Sector"). */
export function extractSector(data: OverviewData): string | null {
  const info = data.infoTable;
  if (!Array.isArray(info)) return null;
  const row = info.find(
    (r) => typeof r?.t === "string" && r.t.toLowerCase() === "sector"
  );
  const v = row?.v;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s === "" || /^n\/?a$/i.test(s)) return null;
  return s;
}

/** Parse a raw /overview body into the fields we persist. */
export function parseOverview(body: string): TickerOverview {
  const json = JSON.parse(body) as { data?: OverviewData };
  const data = json.data ?? {};
  return {
    marketCap: parseAbbreviatedNumber(data.marketCap),
    price: extractLatestPrice(data),
    sector: extractSector(data),
  };
}

const EMPTY_OVERVIEW: TickerOverview = { marketCap: null, price: null, sector: null };

async function fetchOverview(ticker: string): Promise<TickerOverview> {
  const url = `https://stockanalysis.com/api/symbol/s/${encodeURIComponent(
    ticker
  )}/overview`;
  try {
    const body = await fetchText(url, { retries: 2 });
    return parseOverview(body);
  } catch (err) {
    log.warn("overview fetch failed", { ticker, error: (err as Error).message });
    return EMPTY_OVERVIEW;
  }
}

/**
 * Return the market cap for a ticker, using the DB cache when fresh. Each
 * refresh also captures the latest price and sector (same HTTP call) so the web
 * layer can show return-since-cluster and a sector tag. Returns null market cap
 * when unknown (caller decides how to treat unknowns).
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

  const overview = await fetchOverview(key);

  await pool.query(
    `INSERT INTO market_cap_cache (ticker, market_cap, price, sector, source, fetched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (ticker)
     DO UPDATE SET market_cap = EXCLUDED.market_cap,
                   price = EXCLUDED.price,
                   sector = EXCLUDED.sector,
                   source = EXCLUDED.source,
                   fetched_at = now()`,
    [key, overview.marketCap, overview.price, overview.sector, SOURCE]
  );

  return overview.marketCap;
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
