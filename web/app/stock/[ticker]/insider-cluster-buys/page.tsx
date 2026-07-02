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
import { SITE_URL, tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatDate,
  formatNumber,
} from "@/lib/format";

type Params = { ticker: string };

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
  const title = `${t} Insider Cluster Buys — ${data.issuerName}`;
  const description =
    `${data.insiderCount} insiders across ${data.totalClusters} cluster ` +
    `${data.totalClusters === 1 ? "buy" : "buys"} in ${t} (${data.issuerName}), ` +
    `parsed from SEC Form 4 filings. Latest activity ${formatDate(
      data.lastDetectedAt
    )}. See who bought, how much, and when.`;
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

  const totalBought = data.clusters.reduce((s, c) => s + c.totalValue, 0);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: `${data.ticker} insider cluster buys`,
          item: `${SITE_URL}${tickerPath(data.ticker)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${data.ticker} insider cluster buys`,
      description: `History of clustered insider open-market purchases in ${data.ticker} (${data.issuerName}), derived from public SEC Form 4 filings.`,
      url: `${SITE_URL}${tickerPath(data.ticker)}`,
      creator: { "@type": "Organization", name: "InsiderClusters" },
      isBasedOn: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4",
      dateModified: data.lastDetectedAt.toISOString(),
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
          <span className="text-foreground">
            {data.ticker} insider cluster buys
          </span>
        </nav>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-bold tracking-tight">
              {data.ticker}
            </h1>
            <Badge tone="accent">
              {data.totalClusters} cluster {data.totalClusters === 1 ? "buy" : "buys"}
            </Badge>
          </div>
          <p className="mt-1 text-lg text-muted">{data.issuerName}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            When two or more insiders at {data.issuerName} buy {data.ticker} on
            the open market within days of each other, that clustered conviction
            is one of the highest-signal patterns in SEC filing data. Below is
            every such cluster we&apos;ve detected in {data.ticker}, each parsed
            directly from Form 4 filings and linked back to the source on SEC
            EDGAR.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Clusters" value={formatNumber(data.totalClusters)} />
          <Stat label="Distinct insiders" value={formatNumber(data.insiderCount)} />
          <Stat label="Total bought" value={formatMoneyCompact(totalBought)} />
          <Stat label="Market cap" value={formatMarketCap(data.marketCap)} />
        </section>

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

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">
            How we detect cluster buys in {data.ticker}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We continuously poll SEC EDGAR for new Form 4 filings and parse every
            open-market purchase (transaction code <span className="font-mono">P</span>).
            A cluster is recorded when two or more <em>distinct</em> insiders —
            officers, directors, or 10% owners — each buy {data.ticker} within a
            rolling 15-day window. We focus on companies under a $2B market cap,
            where insider conviction historically carries the most signal. Every
            figure on this page traces back to an official filing; open any
            cluster to see the individual transactions and jump straight to the
            source document.
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
