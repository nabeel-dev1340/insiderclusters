import type { Metadata } from "next";
import Link from "next/link";
import { getMostActiveInsiders, type InsiderLeader } from "@/lib/clusters";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, insiderPath, tickerPath } from "@/lib/site";
import { formatMoneyCompact, formatDate, formatNumber } from "@/lib/format";

const TITLE = "Most active insiders";
const DESCRIPTION =
  "The insiders buying the most stock on the open market, ranked by total dollars purchased across SEC Form 4 filings. See who's backing their own small-cap companies.";

const LIMIT = 100;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/insiders" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/insiders`,
    type: "website",
  },
};

// Rebuild hourly — the ranking shifts slowly and we don't want a DB hit per hit.
export const revalidate = 3600;

export default async function InsidersPage() {
  let leaders: InsiderLeader[] = [];
  try {
    leaders = await getMostActiveInsiders(LIMIT);
  } catch {
    leaders = [];
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Insiders", item: `${SITE_URL}/insiders` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: TITLE,
      description: DESCRIPTION,
      numberOfItems: leaders.length,
      itemListElement: leaders.slice(0, 50).map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: l.name,
        ...(l.cik ? { url: `${SITE_URL}${insiderPath(l.cik, l.name)}` } : {}),
      })),
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
          <span className="text-foreground">Insiders</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Most active insiders
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            The corporate insiders buying the most stock on the open market,
            ranked by total dollars purchased across the Form 4 filings we track.
            A <span className="font-medium text-foreground">High conviction</span>{" "}
            tag marks C-suite officers backing their own companies.
          </p>
        </header>

        {leaders.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              No insider buys recorded yet. This leaderboard fills in as Form 4
              purchases are detected.
            </p>
            <div className="mt-5">
              <ButtonLink href="/login">Get alerted first</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Insider</th>
                    <th className="px-4 py-3 font-medium">Tickers</th>
                    <th className="px-4 py-3 text-right font-medium">Buys</th>
                    <th className="px-4 py-3 text-right font-medium">Total bought</th>
                    <th className="px-4 py-3 text-right font-medium">Last buy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaders.map((l, i) => (
                    <tr
                      key={l.key}
                      className="bg-surface transition-colors hover:bg-surface-muted/50"
                    >
                      <td className="px-4 py-3 tabular-nums text-muted">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {l.cik ? (
                            <Link
                              href={insiderPath(l.cik, l.name)}
                              className="font-medium hover:text-accent hover:underline"
                            >
                              {l.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{l.name}</span>
                          )}
                          {l.isSenior && <ConvictionBadge size="xs" />}
                        </div>
                        {l.role && (
                          <div className="mt-0.5 text-xs text-muted">{l.role}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {l.tickers.slice(0, 4).map((t) => (
                            <Link key={t} href={tickerPath(t)}>
                              <Badge tone="neutral" className="font-mono hover:border-accent/40">
                                {t}
                              </Badge>
                            </Link>
                          ))}
                          {l.tickerCount > 4 && (
                            <span className="text-xs text-muted">
                              +{l.tickerCount - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(l.buyCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoneyCompact(l.totalValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {formatDate(l.lastBuyDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
