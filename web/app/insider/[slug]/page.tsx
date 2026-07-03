import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getInsiderProfile, positionReturn } from "@/lib/insiders";
import { normalizeCikParam } from "@/lib/insiders";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, insiderPath, tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDate,
  formatDateRange,
  formatNumber,
  formatSharePrice,
  formatSignedPercent,
} from "@/lib/format";

type Params = { slug: string };

// Public, no per-viewer state — cacheable like the other programmatic pages.
export const revalidate = 3600;

// One DB read per request, shared between generateMetadata and the page.
const load = cache((cik: string) => getInsiderProfile(cik));

/** Resolve the [slug] param to a CIK, or null when it can't be one. */
function cikFromSlug(slug: string): string | null {
  const m = slug.match(/^(\d+)(?:-.*)?$/);
  return m ? normalizeCikParam(m[1]!) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cik = cikFromSlug(slug);
  const data = cik ? await load(cik) : null;
  if (!data) {
    return { title: "Insider not found", robots: { index: false, follow: false } };
  }

  const topTickers = data.positions.slice(0, 2).map((p) => p.ticker).join(", ");
  const title = `${data.name} — Insider Trading & Form 4 Buys${topTickers ? ` (${topTickers})` : ""}`;
  const description =
    `${data.name} has bought ${formatMoneyCompact(data.totalValue)} of stock across ` +
    `${data.buyCount} open-market Form 4 ${data.buyCount === 1 ? "purchase" : "purchases"} ` +
    `in ${data.tickerCount} ${data.tickerCount === 1 ? "company" : "companies"}. ` +
    `Latest buy ${formatDate(data.lastBuyDate)}. Full SEC filing history, prices paid, and cluster activity.`;
  const canonical = insiderPath(data.cik, data.name);

  return {
    title,
    description,
    alternates: { canonical },
    // Below the substance bar: keep the page for visitors and link equity
    // (follow), but don't ask Google to index it.
    robots: data.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "profile",
    },
  };
}

export default async function InsiderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const cik = cikFromSlug(slug);
  if (!cik) notFound();
  const data = await load(cik);
  if (!data) notFound();

  // Canonicalize: /insider/1234567-anything → /insider/1234567-real-name-slug.
  const canonical = insiderPath(data.cik, data.name);
  if (`/insider/${slug}` !== canonical) permanentRedirect(canonical);

  const clusterCount = data.clusters.length;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Insiders", item: `${SITE_URL}/insiders` },
        { "@type": "ListItem", position: 3, name: data.name, item: `${SITE_URL}${canonical}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      dateModified: data.lastBuyDate,
      mainEntity: {
        "@type": "Person",
        name: data.name,
        identifier: `SEC CIK ${data.cik}`,
        ...(data.latestRole
          ? {
              jobTitle: data.latestRole,
              ...(data.latestRoleCompany
                ? { worksFor: { "@type": "Organization", name: data.latestRoleCompany } }
                : {}),
            }
          : {}),
      },
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
          <Link href="/insiders" className="hover:text-foreground">
            Insiders
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{data.name}</span>
        </nav>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
            {data.isSenior && <ConvictionBadge size="xs" />}
          </div>
          {data.latestRole && (
            <p className="mt-1 text-lg text-muted">
              {data.latestRole}
              {data.latestRoleCompany ? ` · ${data.latestRoleCompany}` : ""}
            </p>
          )}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Every open-market stock purchase {data.name} has reported to the SEC
            on Form 4 that met our signal bar, parsed straight from the filings.
            Insiders sell for many reasons, but they buy with their own money
            for one — this page tracks where{" "}
            {clusterCount > 0
              ? "those buys landed inside insider clusters and"
              : ""}{" "}
            how the prices paid compare to where the stock trades now.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total bought" value={formatMoneyCompact(data.totalValue)} />
          <Stat label="Open-market buys" value={formatNumber(data.buyCount)} />
          <Stat label="Companies" value={formatNumber(data.tickerCount)} />
          <Stat label="Last buy" value={formatDate(data.lastBuyDate)} />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Where the buys stand today</h2>
          <ul className="mt-4 space-y-4">
            {data.positions.map((p) => {
              const ret = positionReturn(p);
              return (
                <li
                  key={p.ticker}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={tickerPath(p.ticker)}
                        className="font-mono text-lg font-bold hover:text-accent"
                      >
                        {p.ticker}
                      </Link>
                      <div className="text-sm text-muted">{p.issuerName}</div>
                    </div>
                    {ret != null && (
                      <Badge tone={ret >= 0 ? "accent" : "neutral"}>
                        {formatSignedPercent(ret)} vs price paid
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {p.buyCount === 1 ? "One purchase" : `${p.buyCount} purchases`}{" "}
                    totalling {formatMoneyCompact(p.totalValue)}
                    {p.avgPrice != null && (
                      <> at an average of {formatSharePrice(p.avgPrice)} per share</>
                    )}
                    {p.lastPrice != null && (
                      <>
                        ; the stock last traded at {formatSharePrice(p.lastPrice)}
                      </>
                    )}
                    .{" "}
                    <Link
                      href={tickerPath(p.ticker)}
                      className="text-accent hover:underline"
                    >
                      See all insider buying in {p.ticker} →
                    </Link>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <Stat label="Avg price paid" value={formatSharePrice(p.avgPrice)} />
                    <Stat label="Latest price" value={formatSharePrice(p.lastPrice)} />
                    <Stat label="Market cap" value={formatMarketCap(p.marketCap)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {clusterCount > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Cluster participation</h2>
            <p className="mt-2 text-sm text-muted">
              Buys that landed within days of other insiders buying the same
              stock — the pattern this site exists to catch.
            </p>
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
                        <span className="text-sm text-muted">
                          {formatDateRange(c.windowStart, c.windowEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{c.insiderCount} insiders</Badge>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoneyCompact(c.totalValue)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold">All reported buys</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Ticker</th>
                    <th className="px-4 py-3 text-right font-medium">Shares</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Filing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.buys.map((b) => (
                    <tr key={b.id} className="bg-surface">
                      <td className="px-4 py-3 tabular-nums text-muted">
                        {formatDate(b.transactionDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={tickerPath(b.ticker)}
                            className="font-mono font-medium hover:text-accent"
                          >
                            {b.ticker}
                          </Link>
                          {b.clusterId != null && (
                            <Badge tone="accent" className="text-[10px]">
                              cluster
                            </Badge>
                          )}
                        </div>
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
        </section>

        <section className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-sm font-medium">
            Get alerted the next time {data.name} — or any insider — buys
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            We watch every Form 4 as it hits SEC EDGAR and alert you when
            insiders cluster into the same small-cap stock.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <ButtonLink href="/login">Get alerts free</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              See pricing
            </ButtonLink>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">About this data</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Figures are parsed from {data.name}&apos;s Form 4 filings on SEC
            EDGAR (CIK {data.cik}) and cover open-market purchases (transaction
            code <span className="font-mono">P</span>) above our signal
            threshold — grants, option exercises, and sales are excluded, which
            is why totals here can differ from raw filing counts. Every row
            links to its source document.
          </p>
          <p className="mt-3 text-xs text-muted">
            This page is informational and reflects public filing data. It is
            not investment advice.
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
