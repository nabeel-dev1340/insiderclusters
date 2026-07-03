import "server-only";
import { pool } from "./db";
import { filingIndexUrl, SENIOR_ROLE_PATTERN } from "./clusters";

// Data layer for the public /insider/[cik]-[name] profile pages (SEO plan P1).
// Identity is the SEC CIK, stored canonically unpadded (migration 0005 +
// scraper normalizeCik), so lookups are a plain equality match.

/** "0001234567" or "1234567" (or a full slug "1234567-jane-doe") → "1234567". */
export function normalizeCikParam(raw: string): string | null {
  const m = raw.trim().match(/^0*(\d+)/);
  return m && m[1] !== "0" ? m[1] : null;
}

export interface InsiderBuy {
  id: number;
  ticker: string;
  issuerName: string;
  role: string | null; // role text on this filing (roles change across companies)
  transactionDate: string;
  shares: number | null;
  pricePerShare: number | null;
  value: number | null;
  filingUrl: string;
  clusterId: number | null; // set when the buy is part of a detected cluster
}

/** Per-ticker aggregate of an insider's buys, with current-price context. */
export interface InsiderPosition {
  ticker: string;
  issuerName: string;
  buyCount: number;
  totalShares: number | null; // null when any buy lacks a share count
  totalValue: number;
  avgPrice: number | null; // Σvalue/Σshares
  lastPrice: number | null; // latest cached price
  sector: string | null;
  marketCap: number | null;
}

export interface InsiderClusterRef {
  id: number;
  ticker: string;
  issuerName: string;
  windowStart: string;
  windowEnd: string;
  insiderCount: number;
  totalValue: number;
}

export interface InsiderProfile {
  cik: string;
  name: string; // most recently filed name spelling
  latestRole: string | null;
  latestRoleCompany: string | null;
  isSenior: boolean;
  totalValue: number;
  buyCount: number;
  tickerCount: number;
  firstBuyDate: string;
  lastBuyDate: string;
  /**
   * Below this bar the page renders but is noindexed: a single small buy and
   * no cluster participation isn't enough unique substance to ask Google to
   * index (thin-content control from the SEO plan).
   */
  indexable: boolean;
  buys: InsiderBuy[]; // newest first
  positions: InsiderPosition[]; // by total value desc
  clusters: InsiderClusterRef[]; // newest first
}

/** % move from the insider's avg buy price to the latest price, or null. */
export function positionReturn(p: InsiderPosition): number | null {
  if (p.avgPrice == null || p.avgPrice <= 0 || p.lastPrice == null) return null;
  return (p.lastPrice - p.avgPrice) / p.avgPrice;
}

export async function getInsiderProfile(cik: string): Promise<InsiderProfile | null> {
  const { rows: buyRows } = await pool.query<{
    id: number;
    insider_name: string;
    insider_role: string | null;
    transaction_date: string;
    shares: string | null;
    price_per_share: string | null;
    value: string | null;
    ticker: string;
    issuer_name: string;
    raw_xml_url: string;
    filed_at: Date;
    cluster_id: number | null;
  }>(
    `SELECT t.id, t.insider_name, t.insider_role, t.transaction_date::text,
            t.shares, t.price_per_share, t.value,
            f.ticker, f.issuer_name, f.raw_xml_url, f.filed_at,
            (SELECT c.id FROM clusters c
              WHERE t.id = ANY(c.transaction_ids)
              ORDER BY c.detected_at DESC LIMIT 1) AS cluster_id
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
      WHERE t.insider_cik = $1
        AND t.is_signal = TRUE
        AND f.ticker IS NOT NULL AND f.ticker <> ''
      ORDER BY t.transaction_date DESC, f.filed_at DESC`,
    [cik]
  );
  if (buyRows.length === 0) return null;

  // Most recently *filed* row carries the current name spelling and role.
  const latestFiled = [...buyRows].sort(
    (a, b) => b.filed_at.getTime() - a.filed_at.getTime()
  )[0]!;

  const buys: InsiderBuy[] = buyRows.map((b) => ({
    id: b.id,
    ticker: b.ticker,
    issuerName: b.issuer_name,
    role: b.insider_role,
    transactionDate: b.transaction_date,
    shares: b.shares == null ? null : Number(b.shares),
    pricePerShare: b.price_per_share == null ? null : Number(b.price_per_share),
    value: b.value == null ? null : Number(b.value),
    filingUrl: filingIndexUrl(b.raw_xml_url),
    clusterId: b.cluster_id,
  }));

  // Per-ticker positions, aggregated in JS (an insider has a handful of rows).
  const byTicker = new Map<string, InsiderBuy[]>();
  for (const b of buys) {
    const list = byTicker.get(b.ticker);
    if (list) list.push(b);
    else byTicker.set(b.ticker, [b]);
  }
  const tickers = [...byTicker.keys()];
  const { rows: capRows } = await pool.query<{
    ticker: string;
    market_cap: string | null;
    price: string | null;
    sector: string | null;
  }>(
    `SELECT ticker, market_cap, price, sector FROM market_cap_cache WHERE ticker = ANY($1)`,
    [tickers]
  );
  const capByTicker = new Map(capRows.map((r) => [r.ticker, r]));

  const positions: InsiderPosition[] = tickers
    .map((ticker) => {
      const list = byTicker.get(ticker)!;
      const totalValue = list.reduce((s, b) => s + (b.value ?? 0), 0);
      const sharesKnown = list.every((b) => b.shares != null);
      const totalShares = sharesKnown
        ? list.reduce((s, b) => s + (b.shares ?? 0), 0)
        : null;
      const cap = capByTicker.get(ticker);
      return {
        ticker,
        issuerName: list[0]!.issuerName,
        buyCount: list.length,
        totalShares,
        totalValue,
        avgPrice:
          totalShares != null && totalShares > 0 ? totalValue / totalShares : null,
        lastPrice: cap?.price == null ? null : Number(cap.price),
        sector: cap?.sector ?? null,
        marketCap: cap?.market_cap == null ? null : Number(cap.market_cap),
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  const { rows: clusterRows } = await pool.query<{
    id: number;
    ticker: string;
    issuer_name: string;
    window_start: string;
    window_end: string;
    insider_count: number;
    total_value: string;
  }>(
    `SELECT c.id, c.ticker, c.issuer_name, c.window_start::text,
            c.window_end::text, c.insider_count, c.total_value
       FROM clusters c
      WHERE EXISTS (
        SELECT 1 FROM transactions t
         WHERE t.id = ANY(c.transaction_ids) AND t.insider_cik = $1
      )
      ORDER BY c.window_end DESC`,
    [cik]
  );

  const isSenior = buyRows.some(
    (b) => b.insider_role != null && seniorRoleRe.test(b.insider_role)
  );

  return {
    cik,
    name: latestFiled.insider_name,
    latestRole: latestFiled.insider_role,
    latestRoleCompany: latestFiled.issuer_name,
    isSenior,
    totalValue: buys.reduce((s, b) => s + (b.value ?? 0), 0),
    buyCount: buys.length,
    tickerCount: tickers.length,
    firstBuyDate: buyRows[buyRows.length - 1]!.transaction_date,
    lastBuyDate: buyRows[0]!.transaction_date,
    indexable: clusterRows.length > 0 || buys.length >= 2,
    buys,
    positions,
    clusters: clusterRows.map((c) => ({
      id: c.id,
      ticker: c.ticker,
      issuerName: c.issuer_name,
      windowStart: c.window_start,
      windowEnd: c.window_end,
      insiderCount: c.insider_count,
      totalValue: Number(c.total_value),
    })),
  };
}

// JS mirror of the SQL predicate — SENIOR_ROLE_PATTERN uses Postgres \m…\M
// word boundaries, so translate those for the JS regex.
const seniorRoleRe = new RegExp(
  SENIOR_ROLE_PATTERN.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"),
  "i"
);

/**
 * Insiders that get an indexable profile page (≥1 cluster participation or
 * ≥2 qualifying buys), for the sitemap and any "browse insiders" surfaces.
 */
export async function getSitemapInsiders(): Promise<
  { cik: string; name: string; lastModified: Date }[]
> {
  const { rows } = await pool.query<{
    cik: string;
    name: string;
    last_modified: Date;
  }>(
    `SELECT t.insider_cik AS cik,
            (array_agg(t.insider_name ORDER BY f.filed_at DESC))[1] AS name,
            max(f.filed_at) AS last_modified
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
      WHERE t.insider_cik IS NOT NULL
        AND t.is_signal = TRUE
        AND f.ticker IS NOT NULL AND f.ticker <> ''
      GROUP BY t.insider_cik
     HAVING count(*) >= 2
         OR bool_or(EXISTS (
              SELECT 1 FROM clusters c WHERE t.id = ANY(c.transaction_ids)
            ))
      ORDER BY max(f.filed_at) DESC`
  );
  return rows.map((r) => ({ cik: r.cik, name: r.name, lastModified: r.last_modified }));
}
