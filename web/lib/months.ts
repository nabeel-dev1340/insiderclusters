import "server-only";
import { pool } from "./db";
import {
  filingIndexUrl,
  getClustersInRange,
  type ClusterSummary,
} from "./clusters";

// Monthly insider-buying archives (SEO plan P5): /insider-buying/2026-06.
// One page per month of coverage, generated entirely from data we already
// hold — "biggest insider buys of <month>" is an evergreen long-tail query.

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYm(ym: string): boolean {
  return YM_RE.test(ym);
}

/** "2026-06" → ["2026-06-01", "2026-07-01") date-range bounds. */
export function ymRange(ym: string): { start: string; endExclusive: string } {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return {
    start: `${ym}-01`,
    endExclusive: `${nextY}-${String(nextM).padStart(2, "0")}-01`,
  };
}

/** "2026-06" → "June 2026". */
export function ymLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export interface MonthSummary {
  ym: string; // "2026-06"
  buyCount: number; // qualifying open-market buys dated in the month
  totalValue: number; // Σ value of those buys
  tickerCount: number; // distinct tickers bought
  clusterCount: number; // clusters whose window ended in the month
}

/** All months with at least one qualifying buy, newest first. */
export async function getArchiveMonths(): Promise<MonthSummary[]> {
  const { rows } = await pool.query<{
    ym: string;
    buy_count: number;
    total_value: string | null;
    ticker_count: number;
    cluster_count: number;
  }>(
    `WITH buys AS (
       SELECT to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') AS ym,
              count(*)::int AS buy_count,
              sum(t.value) AS total_value,
              count(DISTINCT f.ticker)::int AS ticker_count
         FROM transactions t
         JOIN filings f ON f.id = t.filing_id
        WHERE t.is_signal = TRUE AND f.ticker IS NOT NULL AND f.ticker <> ''
        GROUP BY 1
     ), cl AS (
       SELECT to_char(date_trunc('month', window_end), 'YYYY-MM') AS ym,
              count(*)::int AS cluster_count
         FROM clusters
        GROUP BY 1
     )
     SELECT b.ym, b.buy_count, b.total_value, b.ticker_count,
            coalesce(cl.cluster_count, 0) AS cluster_count
       FROM buys b
       LEFT JOIN cl USING (ym)
      ORDER BY b.ym DESC`
  );
  return rows.map((r) => ({
    ym: r.ym,
    buyCount: r.buy_count,
    totalValue: r.total_value == null ? 0 : Number(r.total_value),
    tickerCount: r.ticker_count,
    clusterCount: r.cluster_count,
  }));
}

export interface MonthTopBuy {
  id: number;
  insiderCik: string | null;
  insiderName: string;
  insiderRole: string | null;
  ticker: string;
  issuerName: string;
  transactionDate: string;
  value: number | null;
  filingUrl: string;
}

export interface MonthArchive {
  ym: string;
  summary: MonthSummary;
  clusters: ClusterSummary[]; // biggest first
  topBuys: MonthTopBuy[]; // biggest individual purchases
  prevYm: string | null; // adjacent months that actually have data
  nextYm: string | null;
}

const TOP_BUYS_LIMIT = 15;

export async function getMonthArchive(ym: string): Promise<MonthArchive | null> {
  if (!isValidYm(ym)) return null;
  const months = await getArchiveMonths();
  const idx = months.findIndex((m) => m.ym === ym);
  if (idx === -1) return null;

  const { start, endExclusive } = ymRange(ym);
  const [clusters, { rows: buyRows }] = await Promise.all([
    getClustersInRange(start, endExclusive),
    pool.query<{
      id: number;
      insider_cik: string | null;
      insider_name: string;
      insider_role: string | null;
      ticker: string;
      issuer_name: string;
      transaction_date: string;
      value: string | null;
      raw_xml_url: string;
    }>(
      `SELECT t.id, t.insider_cik, t.insider_name, t.insider_role,
              f.ticker, f.issuer_name, t.transaction_date::text, t.value,
              f.raw_xml_url
         FROM transactions t
         JOIN filings f ON f.id = t.filing_id
        WHERE t.is_signal = TRUE
          AND f.ticker IS NOT NULL AND f.ticker <> ''
          AND t.transaction_date >= $1 AND t.transaction_date < $2
        ORDER BY t.value DESC NULLS LAST
        LIMIT ${TOP_BUYS_LIMIT}`,
      [start, endExclusive]
    ),
  ]);

  return {
    ym,
    summary: months[idx]!,
    clusters,
    topBuys: buyRows.map((b) => ({
      id: b.id,
      insiderCik: b.insider_cik,
      insiderName: b.insider_name,
      insiderRole: b.insider_role,
      ticker: b.ticker,
      issuerName: b.issuer_name,
      transactionDate: b.transaction_date,
      value: b.value == null ? null : Number(b.value),
      filingUrl: filingIndexUrl(b.raw_xml_url),
    })),
    // months[] is newest-first: previous month in time is the next index.
    prevYm: months[idx + 1]?.ym ?? null,
    nextYm: months[idx - 1]?.ym ?? null,
  };
}
