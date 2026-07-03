import type { Metadata } from "next";
import Link from "next/link";
import { getSectorDirectory, type SectorSummary } from "@/lib/sectors";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { SITE_URL, sectorPath } from "@/lib/site";
import { formatDate, formatNumber } from "@/lib/format";

const TITLE = "Insider buying by sector";
const DESCRIPTION =
  "Which sectors insiders are buying right now: cluster buys in healthcare, tech, financials, energy and more, detected from SEC Form 4 filings on small-cap stocks.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/sectors" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/sectors`,
    type: "website",
  },
};

// Rebuild hourly, same cadence as the other programmatic hubs.
export const revalidate = 3600;

export default async function SectorsPage() {
  let sectors: SectorSummary[] = [];
  try {
    sectors = await getSectorDirectory();
  } catch {
    sectors = [];
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Sectors", item: `${SITE_URL}/sectors` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/sectors`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: sectors.length,
        itemListElement: sectors.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Insider buying in ${s.sector} stocks`,
          url: `${SITE_URL}${sectorPath(s.slug)}`,
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
          <span className="text-foreground">Sectors</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider buying by sector
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            Where insiders are putting their own money, grouped by sector. Each
            hub lists every small-cap in the sector with a detected cluster buy
            — two or more insiders buying on the open market within days —
            parsed from SEC Form 4 filings.
          </p>
        </header>

        {sectors.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              Sector data fills in as tickers are enriched. Check back shortly.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((s) => (
              <li key={s.slug}>
                <Link
                  href={sectorPath(s.slug)}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold">{s.sector}</span>
                    <Badge tone="accent" className="shrink-0">
                      {formatNumber(s.clusterCount)}{" "}
                      {s.clusterCount === 1 ? "cluster" : "clusters"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>
                      {formatNumber(s.tickerCount)}{" "}
                      {s.tickerCount === 1 ? "stock" : "stocks"} ·{" "}
                      {formatNumber(s.totalInsiders)} insiders
                    </span>
                    <span>{formatDate(s.lastDetectedAt)}</span>
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
