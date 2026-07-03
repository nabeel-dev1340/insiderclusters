import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEARN_ARTICLES, getArticle } from "@/lib/learn";
import { getRecentClusters, type ClusterSummary } from "@/lib/clusters";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { SITE_URL, learnPath, tickerPath } from "@/lib/site";
import { formatDateRange, formatMoneyCompact } from "@/lib/format";

type Params = { slug: string };

// Article text is static, but the "latest clusters" proof block should stay
// fresh — same hourly cadence as the data pages.
export const revalidate = 3600;

export function generateStaticParams(): Params[] {
  return LEARN_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return { title: "Article not found", robots: { index: false, follow: false } };
  }
  const canonical = learnPath(article.slug);
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${SITE_URL}${canonical}`,
      type: "article",
    },
  };
}

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  // Live proof block: the newest detected clusters. Degrade to nothing if the
  // DB is unreachable (e.g. at build time) — the article still renders.
  let recent: ClusterSummary[] = [];
  try {
    recent = await getRecentClusters(3);
  } catch {
    recent = [];
  }

  const related = article.related
    .map((s) => getArticle(s))
    .filter((a): a is NonNullable<typeof a> => a != null);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE_URL}/learn` },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: `${SITE_URL}${learnPath(article.slug)}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      dateModified: article.updated,
      url: `${SITE_URL}${learnPath(article.slug)}`,
      author: { "@type": "Organization", name: "InsiderClusters" },
      publisher: { "@type": "Organization", name: "InsiderClusters" },
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
          <Link href="/learn" className="hover:text-foreground">
            Learn
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{article.title}</span>
        </nav>

        <article className="mt-4">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {article.title}
          </h1>
          <div className="mt-3 text-sm text-muted">
            Updated {article.updated} · InsiderClusters
          </div>
          <div className="mt-2 text-[15px]">{article.body}</div>
        </article>

        {recent.length > 0 && (
          <aside className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Latest detected cluster buys
            </h2>
            <ul className="mt-4 space-y-3">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={tickerPath(c.ticker)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm shadow-sm transition-all hover:border-accent/40"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono font-bold">{c.ticker}</span>
                      <span className="text-muted">
                        {formatDateRange(c.windowStart, c.windowEnd)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{c.insiderCount} insiders</Badge>
                      <span className="font-semibold tabular-nums">
                        {formatMoneyCompact(c.totalValue)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              Live from SEC Form 4 filings —{" "}
              <Link href="/stocks" className="text-accent hover:underline">
                browse every stock with a cluster
              </Link>{" "}
              or{" "}
              <Link href="/login" className="text-accent hover:underline">
                get alerted when the next one forms
              </Link>
              .
            </p>
          </aside>
        )}

        {related.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-semibold">Keep reading</h2>
            <ul className="mt-4 space-y-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={learnPath(r.slug)}
                    className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
                  >
                    <div className="font-medium">{r.title}</div>
                    <p className="mt-1 text-sm text-muted">{r.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
