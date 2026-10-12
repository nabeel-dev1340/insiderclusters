import { JsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { getSectorDirectory, type SectorSummary } from "@/lib/sectors";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { SITE_URL, sectorPath } from "@/lib/site";
import { formatDate, formatNumber } from "@/lib/format";

const TITLE = "Insider buying by sector";
const DESCRIPTION =
  "Which sectors insiders are buying right now: cluster buys in healthcare, tech, financials, energy and more, detected from SEC Form 4 filings.";

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
        {
          "@type": "ListItem",
          position: 2,
          name: "Sectors",
          item: `${SITE_URL}/sectors`,
        },
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
          <span className="text-foreground">Sectors</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider buying by sector
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            Where insiders are putting their own money, grouped by sector. Each
            hub lists every company in the sector with a detected cluster buy —
            two or more insiders buying on the open market around the same time
            — parsed from SEC Form 4 filings.
          </p>
        </header>

        {sectors.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              Sector data fills in as tickers are enriched. Check back shortly.
            </p>
          </div>
        ) : (
          <ul className="mt-8 border-t border-border">
            {sectors.map((s) => (
              <li key={s.slug}>
                <Link href={sectorPath(s.slug)} className="directory-record">
                  <div>
                    <span className="record-name">{s.sector}</span>
                    <p className="record-company">
                      {formatNumber(s.totalInsiders)} insiders in tracked
                      clusters
                    </p>
                  </div>
                  <div className="record-number">
                    {formatNumber(s.clusterCount)}
                    <small>Detected clusters</small>
                  </div>
                  <div className="record-number">
                    {formatNumber(s.tickerCount)}
                    <small>Companies</small>
                  </div>
                  <div className="record-date text-sm">
                    {formatDate(s.lastDetectedAt)}
                    <small>Last detected</small>
                  </div>
                  <span aria-hidden className="text-accent">
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />

      <JsonLd data={jsonLd} />
    </div>
  );
}
