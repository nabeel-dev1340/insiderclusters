import "server-only";
import { pool } from "./db";
import { FREE_DELAY_HOURS, type EffectivePlan } from "./plan";

export interface ClusterSummary {
  id: number;
  ticker: string;
  issuerName: string;
  marketCap: number | null;
  insiderCount: number;
  totalValue: number;
  windowStart: string;
  windowEnd: string;
  detectedAt: Date;
}

export interface ClusterTransaction {
  id: number;
  insiderName: string;
  insiderRole: string | null;
  transactionCode: string;
  transactionDate: string;
  shares: number | null;
  pricePerShare: number | null;
  value: number | null;
  accessionNumber: string;
  filingUrl: string;
}

interface ClusterRow {
  id: number;
  ticker: string;
  issuer_name: string;
  market_cap: string | null;
  insider_count: number;
  total_value: string;
  window_start: string;
  window_end: string;
  detected_at: Date;
}

function mapCluster(r: ClusterRow): ClusterSummary {
  return {
    id: r.id,
    ticker: r.ticker,
    issuerName: r.issuer_name,
    marketCap: r.market_cap == null ? null : Number(r.market_cap),
    insiderCount: r.insider_count,
    totalValue: Number(r.total_value),
    windowStart: r.window_start,
    windowEnd: r.window_end,
    detectedAt: r.detected_at,
  };
}

const SELECT_COLS = `id, ticker, issuer_name, market_cap, insider_count,
  total_value, window_start::text, window_end::text, detected_at`;

export interface FeedResult {
  clusters: ClusterSummary[];
  total: number; // visible-to-this-plan total (for pagination)
  hiddenCount: number; // clusters this plan can't see (upgrade prompt)
}

/**
 * Cluster feed for a user, gated by plan (PRD 3.2).
 * - paid: every cluster, newest first.
 * - free: delayed FREE_DELAY_HOURS and capped to one (highest-value) per ISO week.
 */
export async function getClusterFeed(
  plan: EffectivePlan,
  page: number,
  pageSize: number
): Promise<FeedResult> {
  const offset = (page - 1) * pageSize;
  const { rows: totalRows } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM clusters`
  );
  const grandTotal = totalRows[0]!.c;

  if (plan === "paid") {
    const { rows } = await pool.query<ClusterRow>(
      `SELECT ${SELECT_COLS} FROM clusters ORDER BY detected_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    return { clusters: rows.map(mapCluster), total: grandTotal, hiddenCount: 0 };
  }

  // Free tier: one per week, delayed.
  const freeBase = `
    SELECT ${SELECT_COLS} FROM (
      SELECT DISTINCT ON (date_trunc('week', detected_at)) *
      FROM clusters
      WHERE detected_at <= now() - ($1 || ' hours')::interval
      ORDER BY date_trunc('week', detected_at) DESC, total_value DESC
    ) weekly`;

  const { rows: visibleTotalRows } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM (${freeBase}) v`,
    [FREE_DELAY_HOURS]
  );
  const visibleTotal = visibleTotalRows[0]!.c;

  const { rows } = await pool.query<ClusterRow>(
    `${freeBase} ORDER BY detected_at DESC LIMIT $2 OFFSET $3`,
    [FREE_DELAY_HOURS, pageSize, offset]
  );

  return {
    clusters: rows.map(mapCluster),
    total: visibleTotal,
    hiddenCount: Math.max(0, grandTotal - visibleTotal),
  };
}

/** Newest clusters for the public landing page (social proof). */
export async function getRecentClusters(limit: number): Promise<ClusterSummary[]> {
  const { rows } = await pool.query<ClusterRow>(
    `SELECT ${SELECT_COLS} FROM clusters ORDER BY detected_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(mapCluster);
}

export type ClusterAccess =
  | { status: "not_found" }
  | { status: "locked"; cluster: ClusterSummary } // real-time cluster, free user
  | { status: "ok"; cluster: ClusterSummary; transactions: ClusterTransaction[] };

/** Derive the human-facing EDGAR filing index URL from the stored submission URL. */
function filingIndexUrl(rawUrl: string): string {
  return rawUrl.replace(/\.txt$/i, "-index.htm");
}

/** Fetch a single cluster + its transactions, enforcing the free-tier delay. */
export async function getClusterForUser(
  id: number,
  plan: EffectivePlan
): Promise<ClusterAccess> {
  const { rows } = await pool.query<
    ClusterRow & { is_delayed: boolean; transaction_ids: number[] }
  >(
    `SELECT ${SELECT_COLS}, transaction_ids,
            (detected_at <= now() - ($2 || ' hours')::interval) AS is_delayed
     FROM clusters WHERE id = $1`,
    [id, FREE_DELAY_HOURS]
  );
  const row = rows[0];
  if (!row) return { status: "not_found" };

  const cluster = mapCluster(row);
  if (plan === "free" && !row.is_delayed) {
    return { status: "locked", cluster };
  }

  const { rows: txRows } = await pool.query<{
    id: number;
    insider_name: string;
    insider_role: string | null;
    transaction_code: string;
    transaction_date: string;
    shares: string | null;
    price_per_share: string | null;
    value: string | null;
    accession_number: string;
    raw_xml_url: string;
  }>(
    `SELECT t.id, t.insider_name, t.insider_role, t.transaction_code,
            t.transaction_date::text, t.shares, t.price_per_share, t.value,
            f.accession_number, f.raw_xml_url
     FROM transactions t
     JOIN filings f ON f.id = t.filing_id
     WHERE t.id = ANY($1)
     ORDER BY t.value DESC NULLS LAST`,
    [row.transaction_ids]
  );

  const transactions: ClusterTransaction[] = txRows.map((t) => ({
    id: t.id,
    insiderName: t.insider_name,
    insiderRole: t.insider_role,
    transactionCode: t.transaction_code,
    transactionDate: t.transaction_date,
    shares: t.shares == null ? null : Number(t.shares),
    pricePerShare: t.price_per_share == null ? null : Number(t.price_per_share),
    value: t.value == null ? null : Number(t.value),
    accessionNumber: t.accession_number,
    filingUrl: filingIndexUrl(t.raw_xml_url),
  }));

  return { status: "ok", cluster, transactions };
}
