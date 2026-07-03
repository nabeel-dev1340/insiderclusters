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

/** "DOE JANE A" → "doe-jane-a". ASCII-folds and hyphenates; never empty. */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

/**
 * Public SEO path for an insider profile. The CIK prefix is the identity (it's
 * what the page is looked up by); the name slug is for humans and keywords.
 * A request whose slug doesn't match is 301'd to this canonical form.
 */
export function insiderPath(cik: string, name: string): string {
  return `/insider/${cik}-${slugify(name)}`;
}

/** Public SEO path for a sector hub, e.g. "Consumer Discretionary" → /sectors/consumer-discretionary. */
export function sectorPath(sectorOrSlug: string): string {
  return `/sectors/${slugify(sectorOrSlug)}`;
}

/** Public path for a monthly insider-buying archive, ym = "2026-06". */
export function monthPath(ym: string): string {
  return `/insider-buying/${ym}`;
}

/** Public path for a glossary / education article. */
export function learnPath(slug: string): string {
  return `/learn/${slug}`;
}
