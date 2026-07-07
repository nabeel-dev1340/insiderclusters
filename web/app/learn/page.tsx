import type { Metadata } from "next";
import Link from "next/link";
import { LEARN_ARTICLES } from "@/lib/learn";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { SITE_URL, learnPath } from "@/lib/site";

const TITLE = "Learn: insider trading filings, explained";
const DESCRIPTION =
  "Plain-English guides to SEC insider filings: Form 4 codes, cluster buys, 10b5-1 plans, filing deadlines, and how to separate signal from compensation noise.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/learn`,
    type: "website",
  },
};

export default function LearnIndexPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE_URL}/learn` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/learn`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: LEARN_ARTICLES.length,
        itemListElement: LEARN_ARTICLES.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: a.title,
          url: `${SITE_URL}${learnPath(a.slug)}`,
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
          <span className="text-foreground">Learn</span>
        </nav>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Insider filings, explained
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted">
            Short, practical guides to reading SEC insider filings — what the
            forms and codes mean, which transactions carry signal, and why
            clustered insider buying is the pattern worth watching.
          </p>
        </header>

        <ul className="mt-8 space-y-4">
          {LEARN_ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={learnPath(a.slug)}
                className="block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
              >
                <h2 className="font-semibold">{a.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {a.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
