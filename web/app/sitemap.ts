import type { MetadataRoute } from "next";
import { getSitemapTickers } from "@/lib/clusters";
import { getSitemapInsiders } from "@/lib/insiders";
import { getSectorDirectory } from "@/lib/sectors";
import { getArchiveMonths, ymRange } from "@/lib/months";
import { LEARN_ARTICLES } from "@/lib/learn";
import {
  SITE_URL,
  insiderPath,
  learnPath,
  monthPath,
  sectorPath,
  tickerPath,
} from "@/lib/site";

// One sitemap per page type (served at /sitemap/<id>.xml) so Search Console
// reports indexation per type — the plan's early-warning signal for thin
// content. robots.ts lists all of them; Next generates no index sitemap.
const SITEMAP_IDS = ["core", "stocks", "insiders", "sectors", "learn", "months"] as const;
export type SitemapId = (typeof SITEMAP_IDS)[number];

export async function generateSitemaps(): Promise<{ id: SitemapId }[]> {
  return SITEMAP_IDS.map((id) => ({ id }));
}

// Rebuild at most hourly so new pages appear well within the "24 hours of
// first cluster" acceptance target without a DB hit per request.
export const revalidate = 3600;

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = (await props.id) as SitemapId;

  // Degrade gracefully if the DB is unreachable (e.g. at build time): emit an
  // empty section rather than failing the whole sitemap.
  try {
    switch (id) {
      case "core":
        // Only index-worthy, crawlable pages. /login is intentionally omitted —
        // it's Disallow-ed in robots.txt and has no organic value.
        return [
          { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
          { url: `${SITE_URL}/stocks`, changeFrequency: "daily", priority: 0.9 },
          { url: `${SITE_URL}/insiders`, changeFrequency: "daily", priority: 0.8 },
          { url: `${SITE_URL}/sectors`, changeFrequency: "daily", priority: 0.8 },
          { url: `${SITE_URL}/learn`, changeFrequency: "weekly", priority: 0.7 },
          { url: `${SITE_URL}/insider-buying`, changeFrequency: "daily", priority: 0.7 },
          { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
          { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
          { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
        ];

      case "stocks": {
        const tickers = await getSitemapTickers();
        return tickers.map((t) => ({
          url: `${SITE_URL}${tickerPath(t.ticker)}`,
          lastModified: t.lastModified,
          changeFrequency: "weekly",
          priority: 0.7,
        }));
      }

      case "insiders": {
        const insiders = await getSitemapInsiders();
        return insiders.map((i) => ({
          url: `${SITE_URL}${insiderPath(i.cik, i.name)}`,
          lastModified: i.lastModified,
          changeFrequency: "weekly",
          priority: 0.6,
        }));
      }

      case "sectors": {
        const sectors = await getSectorDirectory();
        return sectors.map((s) => ({
          url: `${SITE_URL}${sectorPath(s.slug)}`,
          lastModified: s.lastDetectedAt,
          changeFrequency: "daily",
          priority: 0.7,
        }));
      }

      case "learn":
        return LEARN_ARTICLES.map((a) => ({
          url: `${SITE_URL}${learnPath(a.slug)}`,
          lastModified: new Date(a.updated),
          changeFrequency: "monthly",
          priority: 0.6,
        }));

      case "months": {
        const months = await getArchiveMonths();
        return months.map((m) => {
          // A past month's page stops changing once the month (plus filing
          // lag) is over; the current month updates as filings land.
          const end = new Date(`${ymRange(m.ym).endExclusive}T00:00:00Z`);
          const isClosed = Date.now() > end.getTime() + 7 * 24 * 3600 * 1000;
          return {
            url: `${SITE_URL}${monthPath(m.ym)}`,
            lastModified: isClosed ? end : new Date(),
            changeFrequency: isClosed ? "yearly" : "daily",
            priority: 0.5,
          };
        });
      }

      default:
        return [];
    }
  } catch {
    return [];
  }
}
