import type { MetadataRoute } from "next";
import { getSitemapTickers } from "@/lib/clusters";
import { SITE_URL, tickerPath } from "@/lib/site";

// Rebuild the sitemap at most hourly so new ticker pages appear well within the
// "24 hours of first cluster" acceptance target without a DB hit per request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only index-worthy, crawlable pages belong here. /login is intentionally
  // omitted — it's Disallow-ed in robots.txt and has no organic value, so
  // listing it would send Google a contradictory signal.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stocks`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Degrade gracefully if the DB is unreachable (e.g. at build time): still
  // emit the static pages rather than failing the whole sitemap.
  let tickers: Awaited<ReturnType<typeof getSitemapTickers>> = [];
  try {
    tickers = await getSitemapTickers();
  } catch {
    tickers = [];
  }

  const tickerEntries: MetadataRoute.Sitemap = tickers.map((t) => ({
    url: `${SITE_URL}${tickerPath(t.ticker)}`,
    lastModified: t.lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...tickerEntries];
}
