import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSectorPage, SECTOR_INTROS, GENERIC_SECTOR_INTRO } from "@/lib/sectors";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, sectorPath, tickerPath } from "@/lib/site";
import {
  formatDate,
  formatMarketCap,
  formatNumber,
} from "@/lib/format";

type Params = { slug: string };

export const revalidate = 3600;

const load = cache((slug: string) => getSectorPage(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) {
    return { title: "Sector not found", robots: { index: false, follow: false } };
  }

  const title = `Insider Buying in ${data.sector} Stocks — Cluster Buys`;
  const description =
    `${data.clusterCount} insider cluster ${data.clusterCount === 1 ? "buy" : "buys"} across ` +
    `${data.tickerCount} ${data.sector.toLowerCase()} ${data.tickerCount === 1 ? "stock" : "stocks"}, ` +
    `detected from SEC Form 4 filings. See which ${data.sector.toLowerCase()} companies insiders are buying and when.`;
  const canonical = sectorPath(data.slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: "website",
    },
  };
}

export default async function SectorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const intro = SECTOR_INTROS[data.slug] ?? GENERIC_SECTOR_INTRO(data.sector);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Sectors", item: `${SITE_URL}/sectors` },
        {
          "@type": "ListItem",
          position: 3,
          name: `${data.sector} insider buying`,
          item: `${SITE_URL}${sectorPath(data.slug)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Insider buying in ${data.sector} stocks`,
      url: `${SITE_URL}${sectorPath(data.slug)}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: data.tickers.length,
        itemListElement: data.tickers.slice(0, 100).map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${t.ticker} insider buying`,
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
          <Link href="/sectors" className="hover:text-foreground">
            Sectors
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{data.sector}</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider buying in {data.sector} stocks
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">{intro}</p>
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium text-foreground">
              {formatNumber(data.clusterCount)}
            </span>{" "}
            cluster {data.clusterCount === 1 ? "buy" : "buys"} across{" "}
            <span className="font-medium text-foreground">
              {formatNumber(data.tickerCount)}
            </span>{" "}
            {data.tickerCount === 1 ? "company" : "companies"} · latest{" "}
            {formatDate(data.lastDetectedAt)}
          </p>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.tickers.map((t) => (
            <li key={t.ticker}>
              <Link
                href={tickerPath(t.ticker)}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-lg font-bold">{t.ticker}</span>
                  <Badge tone="accent" className="shrink-0">
                    {t.totalClusters} {t.totalClusters === 1 ? "cluster" : "clusters"}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-sm text-muted">{t.issuerName}</p>
                  {t.hasSeniorInsider && <ConvictionBadge size="xs" className="shrink-0" />}
                </div>
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

        <section className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-sm font-medium">
            Get alerted when insiders cluster into a {data.sector.toLowerCase()} stock
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            We watch every Form 4 as it hits SEC EDGAR. Real-time alerts the
            moment two or more insiders buy the same stock.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <ButtonLink href="/login">Get alerts free</ButtonLink>
            <ButtonLink href="/stocks" variant="secondary">
              Browse all stocks
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
