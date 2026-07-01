// Canonical public origin for absolute URLs (sitemap, robots, canonical tags,
// OG). Mirrors the APP_URL fallback used across the auth routes, defaulting to
// the production domain so metadata is correct even without the env var.
export const SITE_URL = (
  process.env.APP_URL ?? "https://insiderclusters.com"
).replace(/\/+$/, "");

/** Public SEO path for a ticker's cluster-buy page. Ticker is uppercased. */
export function tickerPath(ticker: string): string {
  return `/stock/${encodeURIComponent(ticker.toUpperCase())}/insider-cluster-buys`;
}
