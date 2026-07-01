import type { Metadata } from "next";
import Link from "next/link";
import { getTickerDirectory, type TickerDirectoryEntry } from "@/lib/clusters";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SITE_URL, tickerPath } from "@/lib/site";
import { formatMarketCap, formatDate, formatNumber } from "@/lib/format";

const TITLE = "Stocks with insider cluster buys";
const DESCRIPTION =
  "Browse every small-cap stock where two or more insiders bought on the open market within days, detected from SEC Form 4 filings. See each ticker's full cluster-buy history.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/stocks" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/stocks`,
    type: "website",
  },
};

// Rebuild hourly so newly-detected tickers appear as crawlable links well
// within the "24h from first cluster" target, without a DB hit per request.
export const revalidate = 3600;

export default async function StocksPage() {
  // Degrade gracefully if the DB is unreachable at build time.
  let tickers: TickerDirectoryEntry[] = [];
  try {
    tickers = await getTickerDirectory();
  } catch {
    tickers = [];
  }

  const totalClusters = tickers.reduce((s, t) => s + t.totalClusters, 0);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Stocks",
          item: `${SITE_URL}/stocks`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/stocks`,
      // The list of ticker pages this hub links to — helps crawlers understand
      // the collection and each member's URL.
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: tickers.length,
        itemListElement: tickers.slice(0, 100).map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${t.ticker} insider cluster buys`,
          url: `${SITE_URL}${tickerPath(t.ticker)}`,
        })),
      },
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <nav className="text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">Stocks</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stocks with insider cluster buys
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            Every small-cap company where two or more insiders bought stock on
            the open market within a rolling 15-day window — the highest-signal
            pattern in SEC filing data. Each ticker links to its full cluster
            history, parsed directly from Form 4 filings.
          </p>
          {tickers.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Tracking{" "}
              <span className="font-medium text-foreground">
                {formatNumber(tickers.length)}
              </span>{" "}
              {tickers.length === 1 ? "ticker" : "tickers"} across{" "}
              <span className="font-medium text-foreground">
                {formatNumber(totalClusters)}
              </span>{" "}
              detected {totalClusters === 1 ? "cluster" : "clusters"}.
            </p>
          )}
        </header>

        {tickers.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              No cluster buys detected yet. New tickers appear here the moment a
              cluster forms.
            </p>
            <div className="mt-5">
              <ButtonLink href="/login">Get alerted first</ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tickers.map((t) => (
              <li key={t.ticker}>
                <Link
                  href={tickerPath(t.ticker)}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-lg font-bold">
                      {t.ticker}
                    </span>
                    <Badge tone="accent" className="shrink-0">
                      {t.totalClusters}{" "}
                      {t.totalClusters === 1 ? "cluster" : "clusters"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {t.issuerName}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>
                      {formatNumber(t.insiderCount)} insiders ·{" "}
                      {formatMarketCap(t.marketCap)} cap
                    </span>
                    <span>{formatDate(t.lastDetectedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
