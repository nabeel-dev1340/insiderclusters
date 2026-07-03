import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTickerPage, PUBLIC_TICKER_CLUSTER_LIMIT } from "@/lib/clusters";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, insiderPath, sectorPath, tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatDate,
  formatNumber,
  formatSharePrice,
} from "@/lib/format";

type Params = { ticker: string };

// Anonymous visitors see the newest N buys; signing in reveals the rest.
const PUBLIC_TICKER_BUY_LIMIT = 25;

// One DB read per request, shared between generateMetadata and the page.
const load = cache((ticker: string) => getTickerPage(ticker, null));

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const data = await load(ticker);
  if (!data) {
    return { title: "Ticker not found", robots: { index: false, follow: false } };
  }

  const t = data.ticker;
  const title = `${t} Insider Buying — Cluster Buys & Form 4 History | ${data.issuerName}`;
  const description =
    data.totalClusters > 0
      ? `${data.insiderCount} insiders have bought ${t} (${data.issuerName}) on the open market, ` +
        `including ${data.totalClusters} cluster ${data.totalClusters === 1 ? "buy" : "buys"} — ` +
        `parsed from SEC Form 4 filings. Latest activity ${formatDate(data.lastActivityAt)}. ` +
        `See who bought, at what price, and when.`
      : `${data.insiderCount} ${data.insiderCount === 1 ? "insider has" : "insiders have"} bought ` +
        `${t} (${data.issuerName}) on the open market — every buy parsed from SEC Form 4 filings. ` +
        `Latest activity ${formatDate(data.lastActivityAt)}. See who bought, at what price, and when.`;
  const canonical = tickerPath(t);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "article",
    },
  };
}

export default async function TickerPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { ticker } = await params;
  const data = await load(ticker);
  if (!data) notFound();

  const user = await getCurrentUser();
  const isAuthed = Boolean(user);

  const visible = isAuthed
    ? data.clusters
    : data.clusters.slice(0, PUBLIC_TICKER_CLUSTER_LIMIT);
  const hidden = data.totalClusters - visible.length;

  const visibleBuys = isAuthed
    ? data.buys
    : data.buys.slice(0, PUBLIC_TICKER_BUY_LIMIT);
  const hiddenBuys = data.buys.length - visibleBuys.length;

  const totalBought = data.buys.reduce((s, b) => s + (b.value ?? 0), 0);
  const hasClusters = data.totalClusters > 0;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Stocks", item: `${SITE_URL}/stocks` },
        {
          "@type": "ListItem",
          position: 3,
          name: `${data.ticker} insider buying`,
          item: `${SITE_URL}${tickerPath(data.ticker)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${data.ticker} insider buying history`,
      description: `Open-market insider purchases${hasClusters ? " and cluster buys" : ""} in ${data.ticker} (${data.issuerName}), derived from public SEC Form 4 filings.`,
      url: `${SITE_URL}${tickerPath(data.ticker)}`,
      creator: { "@type": "Organization", name: "InsiderClusters" },
      isBasedOn: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4",
      dateModified: data.lastActivityAt.toISOString(),
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <nav className="text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <Link href="/stocks" className="hover:text-foreground">
            Stocks
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{data.ticker} insider buying</span>
        </nav>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="font-mono">{data.ticker}</span> insider buying
            </h1>
            {hasClusters && (
              <Badge tone="accent">
                {data.totalClusters} cluster {data.totalClusters === 1 ? "buy" : "buys"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-lg text-muted">
            {data.issuerName}
            {data.sector && (
              <>
                {" · "}
                <Link href={sectorPath(data.sector)} className="hover:text-foreground">
                  {data.sector}
                </Link>
              </>
            )}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {hasClusters ? (
              <>
                When two or more insiders at {data.issuerName} buy {data.ticker}{" "}
                on the open market within days of each other, that clustered
                conviction is one of the highest-signal patterns in SEC filing
                data. Below is every cluster we&apos;ve detected in{" "}
                {data.ticker} plus the full record of qualifying open-market
                buys, each parsed directly from Form 4 filings and linked back
                to the source on SEC EDGAR.
              </>
            ) : (
              <>
                Every qualifying open-market purchase of {data.ticker} reported
                to the SEC on Form 4, parsed directly from the filings and
                linked back to the source on EDGAR. No buying cluster — two or
                more distinct insiders inside a 15-day window — has been
                detected in {data.ticker} yet; if one forms, it appears here
                (and hits our alert subscribers in real time).
              </>
            )}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Clusters" value={formatNumber(data.totalClusters)} />
          <Stat label="Distinct insiders" value={formatNumber(data.insiderCount)} />
          <Stat label="Total bought" value={formatMoneyCompact(totalBought)} />
          <Stat label="Market cap" value={formatMarketCap(data.marketCap)} />
        </section>

        {hasClusters && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Detected clusters</h2>
            <ul className="mt-4 space-y-4">
              {visible.map((c) => {
                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">
                          {formatDateRange(c.windowStart, c.windowEnd)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          Detected {formatDate(c.detectedAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {c.hasSeniorInsider && <ConvictionBadge size="xs" />}
                        <Badge tone="neutral">{c.insiderCount} insiders</Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <Stat label="Total bought" value={formatMoneyCompact(c.totalValue)} />
                      <Stat label="Market cap" value={formatMarketCap(c.marketCap)} />
                    </div>
                  </>
                );
                return (
                  <li key={c.id}>
                    {isAuthed ? (
                      <Link
                        href={`/dashboard/clusters/${c.id}`}
                        className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {hidden > 0 && (
              <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
                <p className="text-sm font-medium">
                  {hidden} more {hidden === 1 ? "cluster" : "clusters"} in{" "}
                  {data.ticker}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                  Sign in free to see the full history, or go Pro for real-time
                  alerts the moment new insider clusters form.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <ButtonLink href="/login">Sign in free</ButtonLink>
                  <ButtonLink href="/pricing" variant="secondary">
                    See pricing
                  </ButtonLink>
                </div>
              </div>
            )}
          </section>
        )}

        {data.buys.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">
              All notable open-market buys in {data.ticker}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Every Form 4 purchase above our signal threshold, newest first.
              Click an insider to see their full buying record across companies.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Insider</th>
                      <th className="px-4 py-3 text-right font-medium">Shares</th>
                      <th className="px-4 py-3 text-right font-medium">Price</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Filing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleBuys.map((b) => (
                      <tr key={b.id} className="bg-surface">
                        <td className="px-4 py-3 tabular-nums text-muted">
                          {formatDate(b.transactionDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {b.insiderCik ? (
                              <Link
                                href={insiderPath(b.insiderCik, b.insiderName)}
                                className="font-medium hover:text-accent hover:underline"
                              >
                                {b.insiderName}
                              </Link>
                            ) : (
                              <span className="font-medium">{b.insiderName}</span>
                            )}
                            {b.inCluster && (
                              <Badge tone="accent" className="text-[10px]">
                                cluster
                              </Badge>
                            )}
                          </div>
                          {b.insiderRole && (
                            <div className="mt-0.5 text-xs text-muted">{b.insiderRole}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(b.shares)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatSharePrice(b.pricePerShare)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatMoneyCompact(b.value)}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={b.filingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            SEC ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {hiddenBuys > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
                {hiddenBuys} earlier {hiddenBuys === 1 ? "buy" : "buys"} hidden —{" "}
                <Link href="/login" className="text-accent hover:underline">
                  sign in free
                </Link>{" "}
                to see the full history.
              </div>
            )}
          </section>
        )}

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">
            How we track insider buying in {data.ticker}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We continuously poll SEC EDGAR for new Form 4 filings and parse every
            open-market purchase (transaction code <span className="font-mono">P</span>).
            A cluster is recorded when two or more <em>distinct</em> insiders —
            officers, directors, or 10% owners — each buy {data.ticker} within a
            rolling 15-day window. We focus on companies under a $2B market cap,
            where insider conviction historically carries the most signal. Every
            figure on this page traces back to an official filing; open any row
            to jump straight to the source document.{" "}
            <Link href="/learn/what-is-a-cluster-buy" className="text-accent hover:underline">
              What counts as a cluster buy?
            </Link>
          </p>
          <p className="mt-3 text-xs text-muted">
            This page is informational and reflects public filing data. It is not
            investment advice or a recommendation regarding {data.ticker}.
          </p>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
