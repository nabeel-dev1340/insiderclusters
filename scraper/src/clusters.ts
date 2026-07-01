// Feature 1.5 — Cluster detection.
//
// For a ticker that received new signal transactions this cycle, look at all
// signal transactions within a rolling window anchored on the most recent one.
// If >= 2 distinct insiders participated, upsert a cluster. Upsert semantics:
// if an undispatched cluster for the ticker overlaps the window, update it in
// place (merging the window) instead of creating a duplicate.

import { pool } from "@insiderclusters/db";
import { config } from "./config.ts";
import { log } from "./logger.ts";

interface QualifyingSet {
  transactionIds: number[];
  insiderCount: number;
  totalValue: number;
  windowStart: string; // YYYY-MM-DD
  windowEnd: string;
  issuerName: string;
}

/** Gather signal transactions for a ticker within the rolling window. */
async function qualifyingSet(ticker: string): Promise<QualifyingSet | null> {
  const { rows } = await pool.query<{
    transaction_ids: number[];
    insider_count: string;
    total_value: string | null;
    window_start: string;
    window_end: string;
    issuer_name: string;
  }>(
    `WITH latest AS (
       SELECT max(t.transaction_date) AS anchor
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
       WHERE f.ticker = $1 AND t.is_signal
     ),
     windowed AS (
       SELECT t.id, t.value, t.transaction_date, f.issuer_name,
              COALESCE(t.insider_cik, t.insider_name) AS insider_key
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id, latest
       WHERE f.ticker = $1
         AND t.is_signal
         AND t.transaction_date > latest.anchor - ($2 || ' days')::interval
         AND t.transaction_date <= latest.anchor
     )
     SELECT array_agg(id ORDER BY id)                AS transaction_ids,
            count(DISTINCT insider_key)              AS insider_count,
            sum(value)                               AS total_value,
            min(transaction_date)::text              AS window_start,
            max(transaction_date)::text              AS window_end,
            max(issuer_name)                         AS issuer_name
     FROM windowed`,
    [ticker, config.clusterWindowDays]
  );

  const r = rows[0];
  if (!r || !r.transaction_ids || Number(r.insider_count) < 2) return null;

  return {
    transactionIds: r.transaction_ids,
    insiderCount: Number(r.insider_count),
    totalValue: Number(r.total_value ?? 0),
    windowStart: r.window_start,
    windowEnd: r.window_end,
    issuerName: r.issuer_name,
  };
}

export interface ClusterResult {
  clusterId: number;
  created: boolean;
  insiderCount: number;
}

/**
 * Detect and upsert a cluster for one ticker. `marketCap` is stored on the
 * cluster row (the caller has already applied the MAX_MARKET_CAP gate).
 * Returns null when there is no qualifying cluster.
 */
export async function detectCluster(
  ticker: string,
  marketCap: number | null
): Promise<ClusterResult | null> {
  const set = await qualifyingSet(ticker);
  if (!set) return null;

  // Find an existing undispatched cluster whose window overlaps.
  const existing = await pool.query<{ id: number }>(
    `SELECT id FROM clusters
     WHERE ticker = $1
       AND alert_sent_at IS NULL
       AND window_start <= $2::date
       AND window_end   >= $3::date
     ORDER BY detected_at DESC
     LIMIT 1`,
    [ticker, set.windowEnd, set.windowStart]
  );

  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE clusters
         SET insider_count = $2,
             total_value = $3,
             market_cap = $4,
             window_start = LEAST(window_start, $5::date),
             window_end = GREATEST(window_end, $6::date),
             transaction_ids = $7
       WHERE id = $1`,
      [
        id,
        set.insiderCount,
        set.totalValue,
        marketCap,
        set.windowStart,
        set.windowEnd,
        set.transactionIds,
      ]
    );
    log.info("cluster updated", { ticker, clusterId: id, insiderCount: set.insiderCount });
    return { clusterId: id, created: false, insiderCount: set.insiderCount };
  }

  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO clusters
       (ticker, issuer_name, market_cap, insider_count, total_value,
        window_start, window_end, transaction_ids)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8)
     RETURNING id`,
    [
      ticker,
      set.issuerName,
      marketCap,
      set.insiderCount,
      set.totalValue,
      set.windowStart,
      set.windowEnd,
      set.transactionIds,
    ]
  );

  const id = inserted.rows[0]!.id;
  log.info("cluster detected", {
    ticker,
    clusterId: id,
    insiderCount: set.insiderCount,
    totalValue: set.totalValue,
  });
  return { clusterId: id, created: true, insiderCount: set.insiderCount };
}
