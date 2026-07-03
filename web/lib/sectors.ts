import "server-only";
import { getTickerDirectory, type TickerDirectoryEntry } from "./clusters";
import { slugify } from "./site";

// Sector hubs (SEO plan P3). Sectors come from the market-cap cache via the
// ticker directory, so the set of pages is derived from live data — a sector
// page exists exactly when at least one cluster ticker carries that sector.

export interface SectorSummary {
  sector: string; // display name, e.g. "Consumer Discretionary"
  slug: string; // URL segment, e.g. "consumer-discretionary"
  tickerCount: number;
  clusterCount: number;
  totalInsiders: number;
  lastDetectedAt: Date;
}

export interface SectorPage extends SectorSummary {
  tickers: TickerDirectoryEntry[]; // newest cluster activity first
}

function groupBySector(entries: TickerDirectoryEntry[]): Map<string, TickerDirectoryEntry[]> {
  const bySector = new Map<string, TickerDirectoryEntry[]>();
  for (const e of entries) {
    if (!e.sector) continue;
    const list = bySector.get(e.sector);
    if (list) list.push(e);
    else bySector.set(e.sector, [e]);
  }
  return bySector;
}

function summarize(sector: string, tickers: TickerDirectoryEntry[]): SectorSummary {
  return {
    sector,
    slug: slugify(sector),
    tickerCount: tickers.length,
    clusterCount: tickers.reduce((s, t) => s + t.totalClusters, 0),
    totalInsiders: tickers.reduce((s, t) => s + t.insiderCount, 0),
    lastDetectedAt: tickers.reduce(
      (m, t) => (t.lastDetectedAt > m ? t.lastDetectedAt : m),
      tickers[0]!.lastDetectedAt
    ),
  };
}

/** All sectors with at least one cluster ticker, most clusters first. */
export async function getSectorDirectory(): Promise<SectorSummary[]> {
  const entries = await getTickerDirectory();
  return [...groupBySector(entries).entries()]
    .map(([sector, tickers]) => summarize(sector, tickers))
    .sort((a, b) => b.clusterCount - a.clusterCount);
}

/** One sector hub by slug, or null when no cluster ticker has that sector. */
export async function getSectorPage(slug: string): Promise<SectorPage | null> {
  const entries = await getTickerDirectory();
  for (const [sector, tickers] of groupBySector(entries)) {
    if (slugify(sector) === slug) {
      return { ...summarize(sector, tickers), tickers };
    }
  }
  return null;
}

/**
 * Hand-written intro per sector (slug-keyed) — the unique editorial layer on
 * top of the shared template. Sectors without an entry get a generic line.
 */
export const SECTOR_INTROS: Record<string, string> = {
  healthcare:
    "Healthcare small-caps — biotechs especially — are where insider buying carries unusual weight. Executives at development-stage companies know the trial timelines, enrollment pace, and cash runway long before the market does, and clinical setbacks make these some of the most beaten-down names on any exchange. When several of them step in to buy stock at once, it tends to precede binary events they're only allowed to trade ahead of during open windows.",
  technology:
    "Tech insiders are mostly sellers — equity comp means the default direction is out, not in. That's exactly what makes open-market buying in small-cap tech notable: an executive who already holds concentrated stock choosing to add with cash is swimming against the compensation current. Clusters of such buys often follow post-earnings drawdowns the insiders consider overdone.",
  financials:
    "Bank and insurance insiders read their own loan books, reserve levels, and rate sensitivity daily, and community-bank boards have a long tradition of buying their own shares through drawdowns. Clustered buying in small financials has historically marked credit-panic bottoms — insiders can see deposits and delinquencies stabilizing weeks before the quarterly filings say so.",
  energy:
    "Energy is a cyclical where management teams live the forward curve. Small E&P and service-company insiders buying together — usually after a commodity washout has taken their equity down harder than the underlying — is a bet on the cycle from the people who see well economics and hedge books first-hand.",
  industrials:
    "Industrial insiders sit on order books and backlog data that lead reported revenue by quarters. Clustered buying in small industrials often shows up mid-cycle, when the market is pricing a slowdown the people watching bookings simply don't see.",
  "consumer-discretionary":
    "Retail and consumer-discretionary insiders watch same-store traffic and weekly sell-through in close to real time. When several of them buy a beaten-down consumer name at once, it's frequently a read that demand is holding up better than the macro narrative assumes.",
  "consumer-staples":
    "Staples are the quiet corner of the market, which makes insider clusters here rarer and more informative — there's no story-stock momentum to trade, so buying is usually a plain valuation call from the people who know shelf velocity and input costs best.",
  materials:
    "Miners, chemicals, and packaging companies live and die by input-cost cycles the market chronically mistimes. Insider clusters in small materials names tend to appear near cost-curve inflections — the operators buying when spot prices still look terrible on a chart.",
  "real-estate":
    "REIT insiders know occupancy, releasing spreads, and refinancing terms well ahead of quarterly disclosure. Clustered buying in small real-estate names — often when the stock trades far below stated NAV — is a direct signal about where management thinks private-market value actually sits.",
  utilities:
    "Utility insiders rarely buy in size — the sector is owned for yield, not upside. That scarcity is the point: a cluster of open-market buys in a small utility usually accompanies a rate-case, regulatory, or balance-sheet turn the insiders consider mispriced.",
  "communication-services":
    "Media and telecom small-caps are narrative-driven, and insiders here have the subscriber and engagement numbers before anyone else. Clustered buying often lands after a subscriber-miss selloff the operators view as a one-quarter story.",
};

export const GENERIC_SECTOR_INTRO = (sector: string) =>
  `Insiders buy their own stock for one reason. This page tracks every ${sector.toLowerCase()} company where two or more insiders bought on the open market within days of each other — the cluster pattern — parsed from SEC Form 4 filings.`;
