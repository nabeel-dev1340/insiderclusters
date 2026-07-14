import "server-only";
import { pool } from "./db";

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
export const SENIOR_ROLE_PATTERN = `(chief|officer|president|principal|vice[ -]?president|\\m(ceo|cfo|coo|cao|cio|cto|cmo|cro|caio|vp|svp|evp)\\M)`;

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
  insiderCik: string | null; // links to the public insider profile page
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
  total: number; // total matching the filter (for pagination)
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
 * Cluster feed, filtered/sorted by the caller's options. Every subscriber sees
 * the full real-time feed — access itself is gated upstream by the dashboard
 * paywall (no free tier), and the Basic/Pro split is alert channels, not data.
 */
export async function getClusterFeed(
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

  const { rows } = await pool.query<ClusterRow>(
    `SELECT ${SELECT_COLS} FROM clusters
      WHERE insider_count >= $1
      ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
    [minInsiders, pageSize, offset]
  );
  return {
    clusters: await attachMarketData(rows.map(mapCluster)),
    total: totalRows[0]!.c,
  };
}

export interface ClusterStats {
  clusterCount: number;
  tickerCount: number;
  totalValue: number; // Σ insider dollars across all clusters
  since: string | null; // earliest cluster window start (ISO date)
}

/**
 * Aggregate track record for the public landing page. Includes the historical
 * backfill, so the numbers read "since <first window>" rather than "since we
 * launched" — that history is the credibility claim.
 */
export async function getClusterStats(): Promise<ClusterStats> {
  const { rows } = await pool.query<{
    cluster_count: number;
    ticker_count: number;
    total_value: string | null;
    since: string | null;
  }>(
    `SELECT count(*)::int AS cluster_count,
            count(DISTINCT ticker)::int AS ticker_count,
            sum(total_value) AS total_value,
            min(window_start)::text AS since
       FROM clusters`
  );
  const r = rows[0]!;
  return {
    clusterCount: r.cluster_count,
    tickerCount: r.ticker_count,
    totalValue: r.total_value == null ? 0 : Number(r.total_value),
    since: r.since,
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

/** One qualifying open-market buy on a ticker page's "all notable buys" list. */
export interface TickerBuy {
  id: number;
  insiderCik: string | null;
  insiderName: string;
  insiderRole: string | null;
  transactionDate: string;
  shares: number | null;
  pricePerShare: number | null;
  value: number | null;
  filingUrl: string;
  /** True when this buy is part of a detected cluster. */
  inCluster: boolean;
}

export interface TickerPage {
  ticker: string;
  issuerName: string;
  marketCap: number | null; // latest known cap for the ticker
  sector: string | null;
  lastPrice: number | null;
  clusters: ClusterSummary[]; // newest first, already sliced for the viewer
  totalClusters: number; // across all history (for the "hidden" prompt)
  insiderCount: number; // distinct insiders across all qualifying buys
  lastActivityAt: Date; // latest cluster detection or signal filing
  buys: TickerBuy[]; // every qualifying open-market buy, newest first
  /**
   * Below this bar (no cluster, single buy) the page renders but is noindexed
   * and left out of the sitemap — same thin-content control as insider
   * profiles. Concentrates crawl budget on pages with real substance.
   */
  indexable: boolean;
}

/**
 * Public per-ticker insider-buying history (Feature 7.1, broadened). The page
 * exists for any ticker with at least one qualifying open-market buy — not
 * just cluster tickers — because "[TICKER] insider buying" is the query people
 * actually search; clusters are the headline section when present.
 * Non-gated: anonymous visitors get the newest `limit` clusters, logged-in
 * visitors get all of them. Returns null when the ticker has no signal buys.
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

  // Every qualifying open-market buy for the ticker, cluster or not.
  const { rows: buyRows } = await pool.query<{
    id: number;
    insider_cik: string | null;
    insider_name: string;
    insider_role: string | null;
    transaction_date: string;
    shares: string | null;
    price_per_share: string | null;
    value: string | null;
    raw_xml_url: string;
    filed_at: Date;
    issuer_name: string;
    in_cluster: boolean;
  }>(
    `SELECT t.id, t.insider_cik, t.insider_name, t.insider_role,
            t.transaction_date::text, t.shares, t.price_per_share, t.value,
            f.raw_xml_url, f.filed_at, f.issuer_name,
            EXISTS (SELECT 1 FROM clusters c WHERE t.id = ANY(c.transaction_ids)) AS in_cluster
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
      WHERE f.ticker = $1 AND t.is_signal = TRUE
      ORDER BY t.transaction_date DESC, t.value DESC NULLS LAST`,
    [normalized]
  );

  if (rows.length === 0 && buyRows.length === 0) return null;

  const all = await attachMarketData(rows.map(mapCluster));
  const clusters = limit == null ? all : all.slice(0, limit);

  const buys: TickerBuy[] = buyRows.map((b) => ({
    id: b.id,
    insiderCik: b.insider_cik,
    insiderName: b.insider_name,
    insiderRole: b.insider_role,
    transactionDate: b.transaction_date,
    shares: b.shares == null ? null : Number(b.shares),
    pricePerShare: b.price_per_share == null ? null : Number(b.price_per_share),
    value: b.value == null ? null : Number(b.value),
    filingUrl: filingIndexUrl(b.raw_xml_url),
    inCluster: b.in_cluster,
  }));

  const insiderKeys = new Set(buyRows.map((b) => b.insider_cik ?? b.insider_name));

  // Market data for cluster-less tickers isn't attached via clusters — fetch it.
  let marketCap = all[0]?.marketCap ?? null;
  let sector = all[0]?.sector ?? null;
  let lastPrice = all[0]?.lastPrice ?? null;
  if (all.length === 0) {
    const { rows: capRows } = await pool.query<{
      market_cap: string | null;
      price: string | null;
      sector: string | null;
    }>(`SELECT market_cap, price, sector FROM market_cap_cache WHERE ticker = $1`, [
      normalized,
    ]);
    const cap = capRows[0];
    marketCap = cap?.market_cap == null ? null : Number(cap.market_cap);
    sector = cap?.sector ?? null;
    lastPrice = cap?.price == null ? null : Number(cap.price);
  }

  const latestFiledAt = buyRows[0]
    ? buyRows.reduce((m, b) => (b.filed_at > m ? b.filed_at : m), buyRows[0].filed_at)
    : null;
  const lastActivityAt =
    all[0] && (!latestFiledAt || all[0].detectedAt > latestFiledAt)
      ? all[0].detectedAt
      : latestFiledAt ?? new Date();

  return {
    ticker: normalized,
    issuerName: all[0]?.issuerName ?? buyRows[0]?.issuer_name ?? normalized,
    marketCap,
    sector,
    lastPrice,
    clusters,
    totalClusters: all.length,
    insiderCount: insiderKeys.size,
    lastActivityAt,
    buys,
    indexable: rows.length > 0 || buys.length >= 2,
  };
}

export interface TickerDirectoryEntry {
  ticker: string;
  issuerName: string;
  marketCap: number | null;
  sector: string | null; // from the market-cap cache; powers the sector hubs
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
    sector: string | null;
    total_clusters: number;
    insider_count: number;
    last_detected_at: Date;
    has_senior_insider: boolean;
  }>(
    `SELECT
       agg.*, m.sector
     FROM (
       SELECT
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
     ) agg
     LEFT JOIN market_cap_cache m ON m.ticker = agg.ticker
     ORDER BY agg.last_detected_at DESC`
  );
  return rows.map((r) => ({
    ticker: r.ticker,
    issuerName: r.issuer_name,
    marketCap: r.market_cap == null ? null : Number(r.market_cap),
    sector: r.sector,
    totalClusters: r.total_clusters,
    insiderCount: r.insider_count,
    lastDetectedAt: r.last_detected_at,
    hasSeniorInsider: r.has_senior_insider ?? false,
  }));
}

export interface SignalOnlyTicker {
  ticker: string;
  issuerName: string;
  buyCount: number;
  totalValue: number;
  lastBuyDate: string;
}

/**
 * Tickers with qualifying open-market buys but no detected cluster (yet).
 * Rendered as a compact secondary section on /stocks so the broadened ticker
 * pages (which now exist for these too) are reachable via crawlable links,
 * not only via the sitemap.
 */
export async function getSignalOnlyTickers(): Promise<SignalOnlyTicker[]> {
  const { rows } = await pool.query<{
    ticker: string;
    issuer_name: string;
    buy_count: number;
    total_value: string | null;
    last_buy_date: string;
  }>(
    `SELECT
       f.ticker,
       (array_agg(f.issuer_name ORDER BY f.filed_at DESC))[1] AS issuer_name,
       count(*)::int AS buy_count,
       sum(t.value) AS total_value,
       max(t.transaction_date)::text AS last_buy_date
     FROM transactions t
     JOIN filings f ON f.id = t.filing_id
     WHERE t.is_signal = TRUE
       AND f.ticker IS NOT NULL AND f.ticker <> ''
       AND NOT EXISTS (SELECT 1 FROM clusters c WHERE c.ticker = f.ticker)
     GROUP BY f.ticker
     ORDER BY max(t.transaction_date) DESC`
  );
  return rows.map((r) => ({
    ticker: r.ticker,
    issuerName: r.issuer_name,
    buyCount: r.buy_count,
    totalValue: r.total_value == null ? 0 : Number(r.total_value),
    lastBuyDate: r.last_buy_date,
  }));
}

export interface InsiderLeader {
  key: string; // dedupe key (CIK when known, else name)
  cik: string | null; // set when the key is a CIK — enables the profile-page link
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
 * P-code purchases with a real ticker and a positive dollar value),
 * ranked by total dollars bought. Powers the public /insiders leaderboard — a
 * crawlable surface and a "who's buying" view competitors (13Radar) lean on.
 */
export async function getMostActiveInsiders(limit: number): Promise<InsiderLeader[]> {
  const { rows } = await pool.query<{
    key: string;
    cik: string | null;
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
       max(t.insider_cik) AS cik,
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
    cik: r.cik,
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

/**
 * Every *indexable* ticker page (has a cluster or ≥2 qualifying buys), with
 * its latest activity, for the sitemap. Single-buy pages exist but are
 * noindexed, so listing them would just feed "discovered — not indexed".
 * Cluster detections and new filings both bump lastModified.
 */
export async function getSitemapTickers(): Promise<
  { ticker: string; lastModified: Date }[]
> {
  const { rows } = await pool.query<{ ticker: string; last_modified: Date }>(
    `SELECT f.ticker, greatest(max(f.filed_at), max(c.detected_at)) AS last_modified
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
       LEFT JOIN clusters c ON c.ticker = f.ticker
      WHERE t.is_signal = TRUE AND f.ticker IS NOT NULL AND f.ticker <> ''
      GROUP BY f.ticker
     HAVING count(DISTINCT t.id) >= 2 OR bool_or(c.id IS NOT NULL)
      ORDER BY f.ticker`
  );
  return rows.map((r) => ({ ticker: r.ticker, lastModified: r.last_modified }));
}

/**
 * Clusters whose buying window ended inside [start, endExclusive), biggest
 * first — powers the monthly archive pages. Window end (not detected_at) is
 * the semantic "when the buying happened" date.
 */
export async function getClustersInRange(
  start: string,
  endExclusive: string
): Promise<ClusterSummary[]> {
  const { rows } = await pool.query<ClusterRow>(
    `SELECT ${SELECT_COLS} FROM clusters
      WHERE window_end >= $1 AND window_end < $2
      ORDER BY total_value DESC`,
    [start, endExclusive]
  );
  return attachMarketData(rows.map(mapCluster));
}

export type ClusterAccess =
  | { status: "not_found" }
  | { status: "ok"; cluster: ClusterSummary; transactions: ClusterTransaction[] };

/** Derive the human-facing EDGAR filing index URL from the stored submission URL. */
export function filingIndexUrl(rawUrl: string): string {
  return rawUrl.replace(/\.txt$/i, "-index.htm");
}

/** Fetch a single cluster + its transactions. */
export async function getClusterForUser(id: number): Promise<ClusterAccess> {
  const { rows } = await pool.query<ClusterRow & { transaction_ids: number[] }>(
    `SELECT ${SELECT_COLS}, transaction_ids FROM clusters WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return { status: "not_found" };

  const cluster = mapCluster(row);
  await attachMarketData([cluster]);

  const { rows: txRows } = await pool.query<{
    id: number;
    insider_cik: string | null;
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
    `SELECT t.id, t.insider_cik, t.insider_name, t.insider_role, t.transaction_code,
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
    insiderCik: t.insider_cik,
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
