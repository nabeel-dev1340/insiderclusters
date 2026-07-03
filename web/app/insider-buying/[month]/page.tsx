import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthArchive, ymLabel } from "@/lib/months";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, insiderPath, monthPath, tickerPath } from "@/lib/site";
import {
  formatDate,
  formatDateRange,
  formatMarketCap,
  formatMoneyCompact,
  formatNumber,
} from "@/lib/format";

type Params = { month: string };

export const revalidate = 3600;

const load = cache((ym: string) => getMonthArchive(ym));

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { month } = await params;
  const data = await load(month);
  if (!data) {
    return { title: "Month not found", robots: { index: false, follow: false } };
  }

  const label = ymLabel(data.ym);
  const title = `Biggest Insider Buys of ${label} — Clusters & Form 4 Purchases`;
  const description =
    `${formatMoneyCompact(data.summary.totalValue)} of notable open-market insider buying across ` +
    `${data.summary.tickerCount} small-cap stocks in ${label}, including ` +
    `${data.summary.clusterCount} cluster ${data.summary.clusterCount === 1 ? "buy" : "buys"} — ` +
    `every figure parsed from SEC Form 4 filings.`;
  const canonical = monthPath(data.ym);

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

export default async function MonthArchivePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { month } = await params;
  const data = await load(month);
  if (!data) notFound();

  const label = ymLabel(data.ym);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Insider buying by month",
          item: `${SITE_URL}/insider-buying`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: label,
          item: `${SITE_URL}${monthPath(data.ym)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `Insider buying in ${label}`,
      description: `Notable open-market insider purchases and cluster buys in small-cap stocks during ${label}, derived from public SEC Form 4 filings.`,
      url: `${SITE_URL}${monthPath(data.ym)}`,
      creator: { "@type": "Organization", name: "InsiderClusters" },
      isBasedOn: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4",
      temporalCoverage: data.ym,
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
          <Link href="/insider-buying" className="hover:text-foreground">
            Insider buying
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{label}</span>
        </nav>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider buying in {label}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted">
            What corporate insiders bought with their own money in {label}:
            every qualifying open-market purchase in small-caps, and the
            stocks where two or more insiders bought within the same 15-day
            window. Parsed from SEC Form 4 filings, linked to the source.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total bought" value={formatMoneyCompact(data.summary.totalValue)} />
          <Stat label="Notable buys" value={formatNumber(data.summary.buyCount)} />
          <Stat label="Stocks" value={formatNumber(data.summary.tickerCount)} />
          <Stat label="Clusters" value={formatNumber(data.summary.clusterCount)} />
        </section>

        {data.clusters.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">
              Cluster buys detected in {label}
            </h2>
            <ul className="mt-4 space-y-3">
              {data.clusters.map((c) => (
                <li key={c.id}>
                  <Link
                    href={tickerPath(c.ticker)}
                    className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{c.ticker}</span>
                        <span className="hidden text-sm text-muted sm:inline">
                          {c.issuerName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.hasSeniorInsider && <ConvictionBadge size="xs" />}
                        <Badge tone="neutral">{c.insiderCount} insiders</Badge>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoneyCompact(c.totalValue)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{formatDateRange(c.windowStart, c.windowEnd)}</span>
                      <span>{formatMarketCap(c.marketCap)} market cap</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.topBuys.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">
              Biggest individual buys of {label}
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Insider</th>
                      <th className="px-4 py-3 font-medium">Ticker</th>
                      <th className="px-4 py-3 text-right font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Filing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topBuys.map((b) => (
                      <tr key={b.id} className="bg-surface">
                        <td className="px-4 py-3">
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
                          {b.insiderRole && (
                            <div className="mt-0.5 text-xs text-muted">
                              {b.insiderRole}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={tickerPath(b.ticker)}
                            className="font-mono font-medium hover:text-accent"
                          >
                            {b.ticker}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {formatDate(b.transactionDate)}
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
          </section>
        )}

        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Adjacent months">
          {data.prevYm ? (
            <Link href={monthPath(data.prevYm)} className="text-accent hover:underline">
              ← {ymLabel(data.prevYm)}
            </Link>
          ) : (
            <span />
          )}
          {data.nextYm ? (
            <Link href={monthPath(data.nextYm)} className="text-accent hover:underline">
              {ymLabel(data.nextYm)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <section className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-sm font-medium">
            Don&apos;t wait for the month-end recap
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Paid subscribers get an alert the moment a new cluster forms —
            while the buying window is still open.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <ButtonLink href="/login">Get alerts free</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              See pricing
            </ButtonLink>
          </div>
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
