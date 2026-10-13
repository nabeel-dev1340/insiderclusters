import { JsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicInsiderDirectoryPage } from "@/lib/public-directory";
import { notFound } from "next/navigation";
import {
  DIRECTORY_PAGE_SIZE,
  directoryQuery,
  directoryUrl,
  type DirectoryParams,
} from "@/lib/directory-query";
import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { SITE_URL, insiderPath, tickerPath } from "@/lib/site";
import { formatMoneyCompact, formatDate, formatNumber } from "@/lib/format";

const TITLE = "Most active insider buyers";
const DESCRIPTION =
  "The insiders buying the most stock on the open market, ranked by total dollars purchased across SEC Form 4 filings. See who's backing their own companies.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}): Promise<Metadata> {
  const query = {
    ...directoryQuery(await searchParams),
    sort: "recent" as const,
    buysPage: 1,
  };
  const canonical = directoryUrl("/insiders", query);
  if (query.page > 1) {
    const result = await getPublicInsiderDirectoryPage(query.page, query.q);
    if (
      query.page >
      Math.max(1, Math.ceil(result.totalCount / DIRECTORY_PAGE_SIZE))
    )
      notFound();
  }
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    robots: query.q ? { index: false, follow: true } : undefined,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}${canonical}`,
      type: "website",
    },
  };
}

// Cache each public result page hourly; account/session data is never cached.
export const revalidate = 3600;

export default async function InsidersPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const query = {
    ...directoryQuery(await searchParams),
    sort: "recent" as const,
    buysPage: 1,
  };
  const result = await getPublicInsiderDirectoryPage(query.page, query.q);
  const listing = {
    items: result.items,
    pages: Math.max(1, Math.ceil(result.totalCount / DIRECTORY_PAGE_SIZE)),
    offset: (query.page - 1) * DIRECTORY_PAGE_SIZE,
  };
  if (query.page > listing.pages) notFound();
  const leaders = listing.items;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Insiders",
          item: `${SITE_URL}/insiders`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: TITLE,
      description: DESCRIPTION,
      numberOfItems: leaders.length,
      itemListElement: leaders.map((l, i) => ({
        "@type": "ListItem",
        position: listing.offset + i + 1,
        name: l.name,
        ...(l.cik ? { url: `${SITE_URL}${insiderPath(l.cik, l.name)}` } : {}),
      })),
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
          <span className="text-foreground">Insiders</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Most active insider buyers
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            The corporate insiders buying the most stock on the open market,
            ranked by total dollars purchased across the Form 4 filings we
            track. A{" "}
            <span className="font-medium text-foreground">Executive buyer</span>{" "}
            tag identifies a senior executive from the reported role text.
          </p>
        </header>
        <DirectoryControls
          path="/insiders"
          query={query}
          sorts={false}
          label="Search by insider name or ticker"
        />
        <p className="my-4 text-sm text-muted">
          {formatNumber(result.totalCount)} matching insiders · ranked by total
          dollars purchased in our tracked filings
        </p>

        {leaders.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              {query.q
                ? "No insiders match this search. Try another name or ticker."
                : "No insider buys recorded yet. This directory fills in as purchases are detected."}
            </p>
            <div className="mt-5">
              <ButtonLink href="/login">Get alerted first</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <div className="responsive-records overflow-x-auto">
              <table role="table" className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      #
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Insider
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Tickers
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
                  {leaders.map((l, i) => (
                    <tr
                      key={l.key}
                      className="bg-surface transition-colors hover:bg-surface-muted/50"
                    >
                      <td
                        data-label="#"
                        className="px-4 py-3 tabular-nums text-muted"
                      >
                        {listing.offset + i + 1}
                      </td>
                      <td data-label="Insider" className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {l.cik ? (
                            <Link
                              prefetch={false}
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
                          <div className="mt-0.5 text-xs text-muted">
                            {l.role}
                          </div>
                        )}
                      </td>
                      <td data-label="Tickers" className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {l.tickers.slice(0, 4).map((t) => (
                            <Link key={t} href={tickerPath(t)}>
                              <Badge
                                tone="neutral"
                                className="font-mono hover:border-accent/40"
                              >
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
                      <td
                        data-label="Buys"
                        className="px-4 py-3 text-right tabular-nums"
                      >
                        {formatNumber(l.buyCount)}
                      </td>
                      <td
                        data-label="Total bought"
                        className="px-4 py-3 text-right font-semibold tabular-nums"
                      >
                        {formatMoneyCompact(l.totalValue)}
                      </td>
                      <td
                        data-label="Last buy"
                        className="px-4 py-3 text-right tabular-nums text-muted"
                      >
                        {formatDate(l.lastBuyDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DirectoryPagination
          label="Insider directory pages"
          page={query.page}
          pages={listing.pages}
          href={(page) => directoryUrl("/insiders", { ...query, page })}
        />
      </main>

      <SiteFooter />

      <JsonLd data={jsonLd} />
    </div>
  );
}
