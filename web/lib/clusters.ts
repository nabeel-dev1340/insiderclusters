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
  /**
   * "High conviction": at least one buyer in the cluster is a C-suite / named
   * executive officer (not just a director or passive 10% owner). Derived from
   * Form 4 role text — no schema change. This adapts the role-weighting idea
   * competitors use: a CEO/CFO buying alongside others is a stronger signal
   * than a cluster of only independent directors (PRD Feature 1.5).
   */
  hasSeniorInsider: boolean;
  /** Total shares bought across the cluster (Σ shares). Enables the VWAP. */
  totalShares: number | null;
  /** Distinct-insider counts bucketed by seniority — powers the role-mix label. */
  roleMix: RoleMix;
  /**
   * Latest known share price for the ticker (from the market-cap cache, so it
   * refreshes on the same cadence as market cap). Enables return-since-cluster.
   * Null when we haven't priced the ticker yet.
   */
  lastPrice: number | null;
  /** Company sector (e.g. "Healthcare"), from the market-cap cache. */
  sector: string | null;
}

/**
 * How the cluster's distinct insiders break down by seniority. Each insider is
 * counted in exactly one bucket (highest role wins: officer > director > owner),
 * so the four counts sum to `insiderCount`. Drives "2 officers · 1 director".
 */
export interface RoleMix {
  officer: number; // C-suite / named executive officer
  director: number; // board director (not also an officer)
  owner: number; // 10% owner (not also an officer/director)
  other: number; // role text we couldn't classify
}

/**
 * Volume-weighted avg price insiders paid = Σ(shares×price)/Σ(shares), which
 * equals totalValue/totalShares since value is already shares×price. Null when
 * shares are unknown. (13Radar surfaces this as "weighted avg purchase price".)
 */
export function avgBuyPrice(c: Pick<ClusterSummary, "totalValue" | "totalShares">): number | null {
  if (c.totalShares == null || c.totalShares <= 0) return null;
  return c.totalValue / c.totalShares;
}

/**
 * Rough scale of the buy vs. the company: dollars bought / market cap. For a
 * micro-cap this contextualizes how big the insider commitment is. Null when
 * market cap is unknown.
 */
export function buyFractionOfCompany(
  c: Pick<ClusterSummary, "totalValue" | "marketCap">
): number | null {
  if (c.marketCap == null || c.marketCap <= 0) return null;
  return c.totalValue / c.marketCap;
}

/**
 * SQL predicate: does any transaction in `transaction_ids` belong to a senior
 * executive? Matches C-suite / officer titles in the free-text Form 4 role and
 * deliberately excludes plain "director" and "10% owner". Referenced columns
 * (`transaction_ids`) must be in scope wherever this fragment is interpolated.
 */
// Keep this pattern in sync with SENIOR_ROLE_RE in lib/format.ts (used to flag
// the same rows on the detail page). Covers spelled-out and abbreviated C-suite
// titles; the \m…\M word boundaries stop short tokens like "vp"/"cao" matching
// inside unrelated words.
const SENIOR_ROLE_PATTERN = `(chief|officer|president|principal|vice[ -]?president|\\m(ceo|cfo|coo|cao|cio|cto|cmo|cro|caio|vp|svp|evp)\\M)`;

const HAS_SENIOR_INSIDER_SQL = `EXISTS (
  SELECT 1 FROM transactions st
  WHERE st.id = ANY(transaction_ids)
    AND st.insider_role ~* '${SENIOR_ROLE_PATTERN}'
)`;

// Director / 10%-owner patterns, used only to bucket the *remaining* insiders
// after officers are peeled off (officers take priority in the CASE below).
const DIRECTOR_PATTERN = `\\mdirector\\M`;
const OWNER_PATTERN = `10\\s*%|10 ?percent`;

// Bucket each distinct insider in the cluster by seniority (officer wins over
// director wins over 10% owner) and aggregate to a jsonb {officer, director, …}
// count map. `transaction_ids` binds to the enclosing row (clusters/weekly),
// matching the other correlated fragments in SELECT_COLS.
const ROLE_MIX_SQL = `coalesce((
  SELECT jsonb_object_agg(bucket, n) FROM (
    SELECT
      CASE
        WHEN rt.insider_role ~* '${SENIOR_ROLE_PATTERN}' THEN 'officer'
        WHEN rt.insider_role ~* '${DIRECTOR_PATTERN}' THEN 'director'
        WHEN rt.insider_role ~* '${OWNER_PATTERN}' THEN 'owner'
        ELSE 'other'
      END AS bucket,
      count(DISTINCT coalesce(rt.insider_cik, rt.insider_name)) AS n
    FROM transactions rt
    WHERE rt.id = ANY(transaction_ids)
    GROUP BY 1
  ) b
), '{}'::jsonb) AS role_mix`;

function toRoleMix(raw: Record<string, number> | null): RoleMix {
  return {
    officer: raw?.officer ?? 0,
    director: raw?.director ?? 0,
    owner: raw?.owner ?? 0,
    other: raw?.other ?? 0,
  };
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
  has_senior_insider: boolean;
  total_shares: string | null;
  role_mix: Record<string, number> | null;
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
    hasSeniorInsider: r.has_senior_insider,
    totalShares: r.total_shares == null ? null : Number(r.total_shares),
    roleMix: toRoleMix(r.role_mix),
    lastPrice: null, // populated by attachMarketData
    sector: null,
  };
}

/**
 * Fill in `lastPrice`/`sector` from the market-cap cache for a set of already
 * mapped clusters (one round-trip for all their tickers). Kept out of
 * SELECT_COLS so the shared column list stays free of a join whose alias would
 * clash with the `weekly` subquery in the free feed. Mutates and returns.
 */
async function attachMarketData<T extends ClusterSummary>(clusters: T[]): Promise<T[]> {
  if (clusters.length === 0) return clusters;
  const tickers = [...new Set(clusters.map((c) => c.ticker))];
  const { rows } = await pool.query<{
    ticker: string;
    price: string | null;
    sector: string | null;
  }>(
    `SELECT ticker, price, sector FROM market_cap_cache WHERE ticker = ANY($1)`,
    [tickers]
  );
  const byTicker = new Map(rows.map((r) => [r.ticker, r]));
  for (const c of clusters) {
    const m = byTicker.get(c.ticker);
    c.lastPrice = m?.price == null ? null : Number(m.price);
    c.sector = m?.sector ?? null;
  }
  return clusters;
}

/**
 * % return from the cluster's volume-weighted avg buy price to the latest known
 * price ("Price < Cost 🔥" analog). Positive = insiders are up. Null when we
 * lack a price or a VWAP.
 */
export function returnSinceCluster(
  c: Pick<ClusterSummary, "lastPrice" | "totalValue" | "totalShares">
): number | null {
  const avg = avgBuyPrice(c);
  if (avg == null || avg <= 0 || c.lastPrice == null) return null;
  return (c.lastPrice - avg) / avg;
}

const SELECT_COLS = `id, ticker, issuer_name, market_cap, insider_count,
  total_value, window_start::text, window_end::text, detected_at,
  ${HAS_SENIOR_INSIDER_SQL} AS has_senior_insider,
  (SELECT sum(ts.shares) FROM transactions ts WHERE ts.id = ANY(transaction_ids)) AS total_shares,
  ${ROLE_MIX_SQL}`;

export interface FeedResult {
  clusters: ClusterSummary[];
  total: number; // visible-to-this-plan total (for pagination)
  hiddenCount: number; // clusters this plan can't see (upgrade prompt)
}

/** How the feed is ordered. Mapped to a fixed ORDER BY — never interpolate raw. */
export type FeedSort = "newest" | "biggest";

export interface FeedOptions {
  sort: FeedSort;
  /** Only clusters with at least this many insiders (size tier: 2 / 3 / 5). */
  minInsiders: number;
}

export const DEFAULT_FEED_OPTIONS: FeedOptions = { sort: "newest", minInsiders: 2 };

// Whitelist of orderings — keeps the sort key out of string interpolation.
const FEED_ORDER_BY: Record<FeedSort, string> = {
  newest: "detected_at DESC",
  biggest: "total_value DESC",
};

/**
 * Cluster feed for a user, gated by plan (PRD 3.2) and filtered/sorted by the
 * caller's options.
 * - paid: every cluster matching the size tier, ordered by `sort`.
 * - free: delayed FREE_DELAY_HOURS and capped to one (highest-value) per ISO week.
 * The size-tier filter applies to both tiers; `hiddenCount` is relative to the
 * filtered set so the upgrade prompt stays accurate under any filter.
 */
export async function getClusterFeed(
  plan: EffectivePlan,
  page: number,
  pageSize: number,
  options: FeedOptions = DEFAULT_FEED_OPTIONS
): Promise<FeedResult> {
  const offset = (page - 1) * pageSize;
  const orderBy = FEED_ORDER_BY[options.sort];
  const minInsiders = options.minInsiders;

  const { rows: totalRows } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM clusters WHERE insider_count >= $1`,
    [minInsiders]
  );
  const grandTotal = totalRows[0]!.c;

  if (plan === "paid") {
    const { rows } = await pool.query<ClusterRow>(
      `SELECT ${SELECT_COLS} FROM clusters
        WHERE insider_count >= $1
        ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
      [minInsiders, pageSize, offset]
    );
    return {
      clusters: await attachMarketData(rows.map(mapCluster)),
      total: grandTotal,
      hiddenCount: 0,
    };
  }

  // Free tier: one per week, delayed.
  const freeBase = `
    SELECT ${SELECT_COLS} FROM (
      SELECT DISTINCT ON (date_trunc('week', detected_at)) *
      FROM clusters
      WHERE detected_at <= now() - ($1 || ' hours')::interval
        AND insider_count >= $2
      ORDER BY date_trunc('week', detected_at) DESC, total_value DESC
    ) weekly`;

  const { rows: visibleTotalRows } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM (${freeBase}) v`,
    [FREE_DELAY_HOURS, minInsiders]
  );
  const visibleTotal = visibleTotalRows[0]!.c;

  const { rows } = await pool.query<ClusterRow>(
    `${freeBase} ORDER BY ${orderBy} LIMIT $3 OFFSET $4`,
    [FREE_DELAY_HOURS, minInsiders, pageSize, offset]
  );

  return {
    clusters: await attachMarketData(rows.map(mapCluster)),
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
  return attachMarketData(rows.map(mapCluster));
}

/** Non-gated visitors on the public ticker pages see only the most recent few. */
export const PUBLIC_TICKER_CLUSTER_LIMIT = 3;

export interface TickerPage {
  ticker: string;
  issuerName: string;
  marketCap: number | null; // latest known cap for the ticker
  clusters: ClusterSummary[]; // newest first, already sliced for the viewer
  totalClusters: number; // across all history (for the "hidden" prompt)
  insiderCount: number; // distinct insiders across all clusters
  lastDetectedAt: Date;
}

/**
 * Public per-ticker cluster history (Feature 7.1). Non-gated: anonymous
 * visitors get the newest `limit` clusters, logged-in visitors get all of them.
 * Returns null when the ticker has never appeared in a cluster.
 */
export async function getTickerPage(
  ticker: string,
  limit: number | null
): Promise<TickerPage | null> {
  const normalized = ticker.toUpperCase();
  const { rows } = await pool.query<ClusterRow>(
    `SELECT ${SELECT_COLS} FROM clusters WHERE ticker = $1 ORDER BY detected_at DESC`,
    [normalized]
  );
  if (rows.length === 0) return null;

  const all = await attachMarketData(rows.map(mapCluster));
  const clusters = limit == null ? all : all.slice(0, limit);

  // Distinct insiders across the ticker's clusters (union of transaction sets).
  const { rows: insiderRows } = await pool.query<{ c: number }>(
    `SELECT count(DISTINCT coalesce(t.insider_cik, t.insider_name))::int AS c
       FROM clusters c
       JOIN transactions t ON t.id = ANY(c.transaction_ids)
      WHERE c.ticker = $1`,
    [normalized]
  );

  const latest = all[0]!;
  return {
    ticker: normalized,
    issuerName: latest.issuerName,
    marketCap: latest.marketCap,
    clusters,
    totalClusters: all.length,
    insiderCount: insiderRows[0]?.c ?? 0,
    lastDetectedAt: latest.detectedAt,
  };
}

export interface TickerDirectoryEntry {
  ticker: string;
  issuerName: string;
  marketCap: number | null;
  totalClusters: number;
  insiderCount: number; // distinct insiders across the ticker's clusters
  lastDetectedAt: Date;
  hasSeniorInsider: boolean; // any C-suite/officer buyer across the ticker's clusters
}

/**
 * Every ticker that has ever appeared in a cluster, with aggregate stats, for
 * the public /stocks hub. This hub is what makes the programmatic ticker pages
 * discoverable via crawlable internal links (not just the XML sitemap), so the
 * ordering is newest-activity-first to surface the freshest pages.
 */
export async function getTickerDirectory(): Promise<TickerDirectoryEntry[]> {
  const { rows } = await pool.query<{
    ticker: string;
    issuer_name: string;
    market_cap: string | null;
    total_clusters: number;
    insider_count: number;
    last_detected_at: Date;
    has_senior_insider: boolean;
  }>(
    `SELECT
       c.ticker,
       (array_agg(c.issuer_name ORDER BY c.detected_at DESC))[1] AS issuer_name,
       (array_agg(c.market_cap  ORDER BY c.detected_at DESC))[1] AS market_cap,
       count(DISTINCT c.id)::int AS total_clusters,
       count(DISTINCT coalesce(t.insider_cik, t.insider_name))::int AS insider_count,
       max(c.detected_at) AS last_detected_at,
       bool_or(t.insider_role ~* '${SENIOR_ROLE_PATTERN}') AS has_senior_insider
     FROM clusters c
     JOIN transactions t ON t.id = ANY(c.transaction_ids)
     WHERE c.ticker IS NOT NULL AND c.ticker <> ''
     GROUP BY c.ticker
     ORDER BY max(c.detected_at) DESC`
  );
  return rows.map((r) => ({
    ticker: r.ticker,
    issuerName: r.issuer_name,
    marketCap: r.market_cap == null ? null : Number(r.market_cap),
    totalClusters: r.total_clusters,
    insiderCount: r.insider_count,
    lastDetectedAt: r.last_detected_at,
    hasSeniorInsider: r.has_senior_insider ?? false,
  }));
}

export interface InsiderLeader {
  key: string; // dedupe key (CIK when known, else name)
  name: string;
  role: string | null; // most recent role text
  isSenior: boolean; // C-suite / officer (drives the conviction marker)
  buyCount: number; // number of qualifying open-market buys
  totalValue: number; // Σ value bought
  tickerCount: number; // distinct tickers bought
  tickers: string[]; // the distinct tickers (for tag display)
  lastBuyDate: string; // most recent transaction_date
}

/**
 * Most-active insiders across all qualifying open-market buys (is_signal =
 * P-code purchases with a real ticker at or above the signal threshold),
 * ranked by total dollars bought. Powers the public /insiders leaderboard — a
 * crawlable surface and a "who's buying" view competitors (13Radar) lean on.
 */
export async function getMostActiveInsiders(limit: number): Promise<InsiderLeader[]> {
  const { rows } = await pool.query<{
    key: string;
    name: string;
    role: string | null;
    is_senior: boolean;
    buy_count: number;
    total_value: string | null;
    ticker_count: number;
    tickers: string[];
    last_buy_date: string;
  }>(
    `SELECT
       coalesce(t.insider_cik, t.insider_name) AS key,
       (array_agg(t.insider_name ORDER BY f.filed_at DESC))[1] AS name,
       (array_agg(t.insider_role ORDER BY f.filed_at DESC))[1] AS role,
       bool_or(t.insider_role ~* '${SENIOR_ROLE_PATTERN}') AS is_senior,
       count(*)::int AS buy_count,
       sum(t.value) AS total_value,
       count(DISTINCT f.ticker)::int AS ticker_count,
       array_agg(DISTINCT f.ticker) AS tickers,
       max(t.transaction_date)::text AS last_buy_date
     FROM transactions t
     JOIN filings f ON f.id = t.filing_id
     WHERE t.is_signal = TRUE AND f.ticker IS NOT NULL AND f.ticker <> ''
     GROUP BY coalesce(t.insider_cik, t.insider_name)
     ORDER BY sum(t.value) DESC NULLS LAST, count(*) DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    role: r.role,
    isSenior: r.is_senior ?? false,
    buyCount: r.buy_count,
    totalValue: r.total_value == null ? 0 : Number(r.total_value),
    tickerCount: r.ticker_count,
    tickers: r.tickers ?? [],
    lastBuyDate: r.last_buy_date,
  }));
}

/** Every ticker that has appeared in a cluster, with its latest activity (for the sitemap). */
export async function getSitemapTickers(): Promise<
  { ticker: string; lastModified: Date }[]
> {
  const { rows } = await pool.query<{ ticker: string; last_modified: Date }>(
    `SELECT ticker, max(detected_at) AS last_modified
       FROM clusters
      WHERE ticker IS NOT NULL AND ticker <> ''
      GROUP BY ticker
      ORDER BY ticker`
  );
  return rows.map((r) => ({ ticker: r.ticker, lastModified: r.last_modified }));
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
  await attachMarketData([cluster]);
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
