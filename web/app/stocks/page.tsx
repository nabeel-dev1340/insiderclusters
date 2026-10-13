import { JsonLd } from "@/components/json-ld";
import { StockDirectory } from "@/components/stock-directory";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicTickerDirectory,
  getPublicSignalOnlyTickers,
} from "@/lib/public-directory";
import {
  directoryQuery,
  directorySlice,
  directoryUrl,
  matchesDirectoryQuery,
  type DirectoryParams,
} from "@/lib/directory-query";
import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ButtonLink } from "@/components/ui/button";
import { SITE_URL, tickerPath } from "@/lib/site";
import { formatDate, formatMoneyCompact, formatNumber } from "@/lib/format";

const TITLE = "Insider Buying Stocks & Cluster Buys";
const DESCRIPTION =
  "Research stocks with insider buying and cluster purchases. Browse recent detections, purchase histories, and original SEC Form 4 filings by ticker or company.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}): Promise<Metadata> {
  const query = directoryQuery(await searchParams);
  const canonical = directoryUrl("/stocks", query);
  if (query.page > 1 || query.buysPage > 1) {
    const [tickers, buys] = await Promise.all([
      getPublicTickerDirectory(),
      getPublicSignalOnlyTickers(),
    ]);
    if (
      query.page >
        directorySlice(
          tickers.filter((t) =>
            matchesDirectoryQuery(query.q, t.ticker, t.issuerName),
          ),
          query.page,
        ).pages ||
      query.buysPage >
        directorySlice(
          buys.filter((t) =>
            matchesDirectoryQuery(query.q, t.ticker, t.issuerName),
          ),
          query.buysPage,
        ).pages
    )
      notFound();
  }
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    robots:
      query.q || query.sort !== "recent"
        ? { index: false, follow: true }
        : undefined,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}${canonical}`,
      type: "website",
    },
  };
}

// Public directory data is cached hourly, including query-string pages.
export const revalidate = 3600;

export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const query = directoryQuery(await searchParams);
  const [allTickers, allSignalOnly] = await Promise.all([
    getPublicTickerDirectory(),
    getPublicSignalOnlyTickers(),
  ]);
  const tickers = allTickers
    .filter((t) => matchesDirectoryQuery(query.q, t.ticker, t.issuerName))
    .sort(
      (a, b) =>
        (query.sort === "name"
          ? a.ticker.localeCompare(b.ticker)
          : query.sort === "clusters"
            ? b.totalClusters - a.totalClusters
            : b.lastDetectedAt.getTime() - a.lastDetectedAt.getTime()) ||
        a.ticker.localeCompare(b.ticker),
    );
  const signalOnly = allSignalOnly
    .filter((t) => matchesDirectoryQuery(query.q, t.ticker, t.issuerName))
    .sort(
      (a, b) =>
        (query.sort === "name"
          ? a.ticker.localeCompare(b.ticker)
          : b.lastBuyDate.localeCompare(a.lastBuyDate)) ||
        a.ticker.localeCompare(b.ticker),
    );
  const clusterPage = directorySlice(tickers, query.page);
  const buyPage = directorySlice(signalOnly, query.buysPage);
  if (query.page > clusterPage.pages || query.buysPage > buyPage.pages)
    notFound();

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
      url: `${SITE_URL}${directoryUrl("/stocks", query)}`,
      // The list of ticker pages this hub links to — helps crawlers understand
      // the collection and each member's URL.
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: clusterPage.items.length,
        itemListElement: clusterPage.items.map((t, i) => ({
          "@type": "ListItem",
          position: clusterPage.offset + i + 1,
          name: `${t.ticker} insider cluster buys`,
          url: `${SITE_URL}${tickerPath(t.ticker)}`,
        })),
      },
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="editorial-main mx-auto w-full max-w-5xl px-6 py-12"
      >
        <nav className="text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">Stocks</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stocks with insider buying
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            Research companies where two or more insiders reported qualifying
            purchases within a rolling detection window. Each ticker links to
            its full cluster history, parsed directly from Form 4 filings.
          </p>
          <p className="mt-3 text-sm text-muted">
            Latest activity means when a cluster was detected. Purchase dates
            and filing dates appear on each stock page; a recent detection can
            include older trades.
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

        <DirectoryControls path="/stocks" query={query} />
        <p className="my-4 text-sm text-muted">
          {formatNumber(tickers.length)} cluster stocks ·{" "}
          {formatNumber(signalOnly.length)} other stocks
          {query.q && <> matching “{query.q}”</>}
        </p>

        {tickers.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              {query.q
                ? "No cluster stocks match this search. Check the other purchases below or try another ticker or company."
                : "No cluster buys detected yet. New tickers appear here after a cluster is detected."}
            </p>
            <div className="mt-5">
              <ButtonLink href="/login">Get alerted first</ButtonLink>
            </div>
          </div>
        ) : (
          <StockDirectory tickers={clusterPage.items} />
        )}
        <DirectoryPagination
          label="Cluster stock pages"
          page={query.page}
          pages={clusterPage.pages}
          href={(page) =>
            directoryUrl("/stocks", { ...query, page, buysPage: 1 })
          }
        />

        {signalOnly.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight">
              More stocks with notable insider buying
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Companies where insiders have made qualifying open-market buys but
              no cluster has formed (yet). Each page lists every buy, who made
              it, and the price paid.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <div className="responsive-records overflow-x-auto">
                <table role="table" className="w-full min-w-160 text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-4 py-3 font-medium">
                        Ticker
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Company
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Buys
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Total bought
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Last buy
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {buyPage.items.map((t) => (
                      <tr
                        key={t.ticker}
                        className="bg-surface transition-colors hover:bg-surface-muted/50"
                      >
                        <td data-label="Ticker" className="px-4 py-3">
                          <Link
                            prefetch={false}
                            href={tickerPath(t.ticker)}
                            className="font-mono font-semibold hover:text-accent"
                          >
                            {t.ticker}
                          </Link>
                        </td>
                        <td
                          data-label="Company"
                          className="max-w-64 truncate px-4 py-3 text-muted"
                        >
                          {t.issuerName}
                        </td>
                        <td
                          data-label="Buys"
                          className="px-4 py-3 text-right tabular-nums"
                        >
                          {formatNumber(t.buyCount)}
                        </td>
                        <td
                          data-label="Total bought"
                          className="px-4 py-3 text-right font-semibold tabular-nums"
                        >
                          {formatMoneyCompact(t.totalValue)}
                        </td>
                        <td
                          data-label="Last buy"
                          className="px-4 py-3 text-right tabular-nums text-muted"
                        >
                          {formatDate(t.lastBuyDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DirectoryPagination
              label="Other insider buying stock pages"
              page={query.buysPage}
              pages={buyPage.pages}
              href={(buysPage) =>
                directoryUrl("/stocks", { ...query, page: 1, buysPage })
              }
            />
          </section>
        )}
      </main>

      <SiteFooter />

      <JsonLd data={jsonLd} />
    </div>
  );
}
