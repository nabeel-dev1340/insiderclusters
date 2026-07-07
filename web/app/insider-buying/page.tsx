import type { Metadata } from "next";
import Link from "next/link";
import { getArchiveMonths, ymLabel, type MonthSummary } from "@/lib/months";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { SITE_URL, monthPath } from "@/lib/site";
import { formatMoneyCompact, formatNumber } from "@/lib/format";

const TITLE = "Insider buying by month";
const DESCRIPTION =
  "Month-by-month archive of notable insider buying: the biggest Form 4 purchases and every detected cluster buy, back through our full coverage.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/insider-buying" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/insider-buying`,
    type: "website",
  },
};

export const revalidate = 3600;

export default async function InsiderBuyingIndexPage() {
  let months: MonthSummary[] = [];
  try {
    months = await getArchiveMonths();
  } catch {
    months = [];
  }

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
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/insider-buying`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: months.length,
        itemListElement: months.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Insider buying in ${ymLabel(m.ym)}`,
          url: `${SITE_URL}${monthPath(m.ym)}`,
        })),
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
          <span className="text-foreground">Insider buying by month</span>
        </nav>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider buying by month
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted">
            Every month of coverage, archived: the biggest open-market insider
            purchases and every cluster buy we detected,
            parsed from SEC Form 4 filings.
          </p>
        </header>

        {months.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">Archive fills in as data lands.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-120 text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 text-right font-medium">Clusters</th>
                    <th className="px-4 py-3 text-right font-medium">Notable buys</th>
                    <th className="px-4 py-3 text-right font-medium">Stocks</th>
                    <th className="px-4 py-3 text-right font-medium">Total bought</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {months.map((m) => (
                    <tr
                      key={m.ym}
                      className="bg-surface transition-colors hover:bg-surface-muted/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={monthPath(m.ym)}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {ymLabel(m.ym)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(m.clusterCount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(m.buyCount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(m.tickerCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoneyCompact(m.totalValue)}
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
