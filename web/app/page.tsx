import type { Metadata } from "next";
import Link from "next/link";
import { getRecentClusters, type ClusterSummary } from "@/lib/clusters";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { PricingCards } from "@/components/pricing";
import { SITE_URL, tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatDateRange,
  formatRoleMix,
} from "@/lib/format";
import { JsonLd } from "@/components/json-ld";
import { TRIAL_DAYS } from "@/lib/billing";

export const revalidate = 600;
const TITLE = "Insider Buying & Cluster Alerts | InsiderClusters";
const DESCRIPTION =
  "Track insider buying from SEC Form 4 filings. Find cluster purchases, research stocks and insiders, and get email or Telegram alerts when new clusters form.";
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQ = [
  {
    q: "What is an insider cluster buy?",
    a: "An insider cluster buy happens when two or more distinct company insiders report qualifying purchases of the same stock within a rolling detection window. InsiderClusters groups these purchases so you can research the buyers, dates, and amounts together.",
  },
  {
    q: "Where does the insider buying data come from?",
    a: "Our data comes from public SEC Form 4 filings on EDGAR. Each transaction links to its original filing so you can check the price, shares, ownership details, and footnotes yourself.",
  },
  {
    q: "Does insider buying mean a stock will go up?",
    a: "No. Insider buying is a research input, not a prediction of returns. Clusters can help you identify companies to investigate, but prices can fall and filings may have important context in their footnotes.",
  },
  {
    q: "When will I receive an alert?",
    a: "Pro includes email and Telegram alerts when our monitoring detects a new qualifying cluster. Alerts follow public filing and processing, not the moment a trade takes place. Basic includes the cluster feed and a weekly email digest.",
  },
  {
    q: "How does the free trial work?",
    a: `Both plans begin with a ${TRIAL_DAYS}-day free trial. A card is required at checkout. You are charged after the trial unless you cancel before it ends. Annual billing is also available at checkout.`,
  },
];

export default async function Home() {
  let clusters: ClusterSummary[] = [];
  try {
    clusters = await getRecentClusters(6);
  } catch {
    /* Public explanation remains available during data outages. */
  }
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Container>
          <section className="research-hero" aria-labelledby="hero-heading">
            <div className="hero-layout">
              <div>
                <span className="eyebrow">
                  Independent research. Public evidence.
                </span>
                <h1 id="hero-heading" className="hero-title">
                  Insider buying.
                  <br />A window into
                  <br className="hidden xl:block" /> <em>conviction.</em>
                </h1>
                <p className="hero-description">
                  A clearer view of insider buying. Find the stocks multiple
                  insiders are buying together, with every purchase traced back
                  to SEC Form 4 filings.
                </p>
                <div className="hero-actions">
                  <ButtonLink href="/stocks" size="lg">
                    Explore insider buys <span aria-hidden>↗</span>
                  </ButtonLink>
                  <Link href="/login" className="text-link">
                    Start your free trial <span aria-hidden>→</span>
                  </Link>
                </div>
                <p className="hero-note">
                  {TRIAL_DAYS}-day trial · Plans from $9/month · Cancel anytime
                </p>
              </div>
              <SignalSheet cluster={clusters[0]} />
            </div>
          </section>
          <div
            className="criteria-strip"
            aria-label="Cluster detection criteria"
          >
            <span className="eyebrow">The pattern we follow</span>
            <p>
              <strong>Two or more insiders</strong>Distinct buyers. Same
              company.
            </p>
            <p>
              <strong>Qualifying purchases</strong>Filtered from Form 4 filings.
            </p>
            <p>
              <strong>Evidence you can check</strong>Direct links to SEC EDGAR.
            </p>
          </div>
          <section className="home-section" aria-labelledby="latest-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">The research desk</span>
                <h2 id="latest-heading">Where insiders are buying.</h2>
              </div>
              <Link href="/stocks" className="text-link">
                View the stock directory <span aria-hidden>↗</span>
              </Link>
            </div>
            {clusters.length ? (
              <div className="signal-list">
                {clusters.map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={tickerPath(cluster.ticker)}
                    className="signal-row"
                  >
                    <div>
                      <strong>{cluster.ticker}</strong>
                      <small>{cluster.issuerName}</small>
                    </div>
                    <div className="value">
                      {cluster.insiderCount}
                      <small>Insiders buying</small>
                    </div>
                    <div className="value">
                      {formatMoneyCompact(cluster.totalValue)}
                      <small>Total purchased</small>
                    </div>
                    <div className="signal-date">
                      <span className="text-xs">
                        {formatDateRange(
                          cluster.windowStart,
                          cluster.windowEnd,
                        )}
                      </span>
                      <small>Purchase window</small>
                    </div>
                    <span aria-hidden className="arrow">
                      ↗
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-research">
                <div>
                  <span className="eyebrow mb-3">
                    Start with the fundamentals
                  </span>
                  <h3>Understand the pattern before you follow it.</h3>
                  <p>
                    Recent cluster data is currently unavailable here. Our
                    guides explain how to read insider purchases and verify the
                    underlying filings.
                  </p>
                </div>
                <div>
                  <Link
                    className="text-link"
                    href="/learn/what-is-a-cluster-buy"
                  >
                    What is an insider cluster buy? ↗
                  </Link>
                  <br />
                  <Link
                    className="text-link"
                    href="/learn/how-to-read-a-form-4"
                  >
                    How to read a Form 4 filing ↗
                  </Link>
                </div>
              </div>
            )}
          </section>
        </Container>
        <section
          className="thesis-section home-section"
          aria-labelledby="thesis-heading"
        >
          <Container className="thesis-layout">
            <div>
              <span className="eyebrow">A better starting point</span>
              <h2 id="thesis-heading">
                One purchase is a data point.
                <br />
                <em>Several tell a story.</em>
              </h2>
              <p className="mt-6">
                Insider buying can reveal where company leaders are committing
                their own capital. A cluster brings those decisions together,
                giving you a focused starting point for deeper research.
              </p>
              <Link className="text-link mt-6" href="/methodology">
                Understand our methodology ↗
              </Link>
            </div>
            <div>
              {[
                [
                  "01",
                  "Separate purchases from routine activity",
                  "Stock grants, option exercises, and sales tell different stories. Our research surfaces focus on qualifying purchases rather than every ownership change.",
                ],
                [
                  "02",
                  "Put every buyer in context",
                  "See the buyer count, executive roles, dollars invested, and purchase window. Review the underlying filings before drawing a conclusion.",
                ],
                [
                  "03",
                  "Research the business behind the signal",
                  "A cluster is a lead worth investigating. Pair it with valuation, financial statements, and your own assessment of the company's risks.",
                ],
              ].map(([n, title, text]) => (
                <div key={n} className="thesis-point">
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>
        <Container>
          <section className="home-section" aria-labelledby="workflow-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">From filing to focus</span>
                <h2 id="workflow-heading">
                  Less searching. More understanding.
                </h2>
              </div>
              <p>
                A research workflow built around the information that matters:
                who bought, how much, and where to verify it.
              </p>
            </div>
            <div className="workflow">
              {[
                [
                  "01 / MONITOR",
                  "We follow the filings.",
                  "Our monitor checks SEC EDGAR for Form 4 filings and parses reported transactions, buyer identities, and roles.",
                ],
                [
                  "02 / CONNECT",
                  "We connect the purchases.",
                  "Qualifying purchases by distinct insiders are grouped into clusters, with the value and purchase window brought into view.",
                ],
                [
                  "03 / RESEARCH",
                  "You decide what matters.",
                  "Explore the feed, open original filings, and get new cluster notifications by email or Telegram with Pro.",
                ],
              ].map(([n, title, text]) => (
                <div key={n} className="workflow-item">
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="pb-16" aria-labelledby="explore-heading">
            <span id="explore-heading" className="eyebrow mb-5">
              Choose your research angle
            </span>
            <div className="explore-links">
              {[
                [
                  "/stocks",
                  "By company",
                  "Explore insider buying and cluster history for individual stocks.",
                  "Browse stocks",
                ],
                [
                  "/insiders",
                  "By insider",
                  "Follow the purchase history of officers, directors, and owners.",
                  "Meet the buyers",
                ],
                [
                  "/sectors",
                  "By sector",
                  "Look for clustered purchases across industries.",
                  "Explore sectors",
                ],
                [
                  "/insider-buying",
                  "Through time",
                  "Review insider buying in the monthly archives.",
                  "Open the archive",
                ],
              ].map(([href, title, text, action]) => (
                <Link key={href} href={href}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span>{action} ↗</span>
                </Link>
              ))}
            </div>
          </section>
          <section
            className="home-section border-t border-border"
            aria-labelledby="pricing-heading"
          >
            <div className="pricing-layout">
              <div>
                <span className="eyebrow">Your research, your pace</span>
                <h2 id="pricing-heading">
                  Stay close to
                  <br />
                  <em>the evidence.</em>
                </h2>
                <p>
                  Explore the full cluster feed with Basic. Add instant email
                  and Telegram notifications with Pro.
                </p>
                <Link href="/pricing" className="text-link mt-5">
                  Compare plans ↗
                </Link>
                <p className="mt-4 text-xs">
                  {TRIAL_DAYS}-day trial. Card required at checkout.
                </p>
              </div>
              <PricingCards />
            </div>
          </section>
          <section
            className="home-section border-t border-border"
            aria-labelledby="faq-heading"
          >
            <div className="faq-layout">
              <div>
                <span className="eyebrow">Before you begin</span>
                <h2 id="faq-heading">
                  Good questions.
                  <br />
                  <em>Clear answers.</em>
                </h2>
                <Link className="text-link mt-5" href="/learn">
                  Visit the learning library ↗
                </Link>
              </div>
              <div>
                {FAQ.map((f) => (
                  <details key={f.q} className="faq-item">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
          <section className="final-cta">
            <div>
              <h2>Find your next research lead.</h2>
              <p>
                Start with public filings. Follow the purchases. Form your own
                view.
              </p>
            </div>
            <ButtonLink href="/stocks" size="lg">
              Explore insider buying ↗
            </ButtonLink>
          </section>
        </Container>
      </main>
      <SiteFooter />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: "InsiderClusters",
            url: SITE_URL,
            description: DESCRIPTION,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />
    </div>
  );
}

function SignalSheet({ cluster }: { cluster?: ClusterSummary }) {
  const buyerCount = Math.min(cluster?.insiderCount ?? 3, 4);
  const buyers = Array.from({ length: buyerCount }, (_, index) => ({
    x: 90 + index * (210 / (buyerCount - 1)),
    label:
      index === 3 && (cluster?.insiderCount ?? 0) > 4
        ? "MORE BUYERS"
        : `BUYER 0${index + 1}`,
  }));
  return (
    <div
      className="research-sheet"
      aria-label={
        cluster
          ? `Latest cluster: ${cluster.ticker}`
          : "Illustrative cluster detection example"
      }
    >
      <div className="sheet-top">
        <span>
          <span className="signal-dot" />
          Cluster observation
        </span>
        <span>{cluster ? "Latest detected" : "Illustrative example"}</span>
      </div>
      <div className="sheet-company">
        <div>
          <p className="sheet-ticker">{cluster?.ticker ?? "COMPANY"}</p>
          <p className="sheet-name">
            {cluster?.issuerName ?? "How a buying cluster comes together"}
          </p>
        </div>
        <span className="sheet-tag">
          {cluster ? "SEC Form 4" : "Not live data"}
        </span>
      </div>
      <dl className="sheet-metrics">
        <div>
          <dt>Insiders buying</dt>
          <dd>
            {cluster?.insiderCount ?? "3"}
            <span className="ml-2 text-xs font-normal text-muted">
              distinct buyers
            </span>
          </dd>
        </div>
        <div>
          <dt>{cluster ? "Total purchased" : "Transaction type"}</dt>
          <dd>{cluster ? formatMoneyCompact(cluster.totalValue) : "Code P"}</dd>
        </div>
      </dl>
      <div className="cluster-map">
        <svg
          viewBox="0 0 400 112"
          role="img"
          aria-label="Schematic showing distinct insider purchases grouped into a cluster"
        >
          <path d="M26 58H374" stroke="#d9ddd1" strokeWidth="1" />
          <path d="M90 58H300" stroke="#234f3d" strokeWidth="2" />
          <path d="M90 30V22H300V30" stroke="#a2762b" fill="none" />
          <text
            x="195"
            y="14"
            textAnchor="middle"
            fill="#a2762b"
            fontSize="10"
            fontFamily="sans-serif"
            letterSpacing="1"
          >
            SHARED PURCHASE WINDOW
          </text>
          {buyers.map(({ x, label }) => (
            <g key={label}>
              <circle
                cx={x}
                cy="58"
                r="9"
                fill="#eef1e5"
                stroke="#234f3d"
                strokeWidth="2"
              />
              <circle cx={x} cy="58" r="3" fill="#234f3d" />
              <text
                x={x}
                y="96"
                textAnchor="middle"
                fill="#606c61"
                fontSize="9"
                fontFamily="sans-serif"
                letterSpacing="1"
              >
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="sheet-bottom">
        <span>
          {cluster
            ? formatRoleMix(cluster.roleMix) || "Distinct company insiders"
            : "Multiple buyers. One company."}
        </span>
        <Link
          href={cluster ? tickerPath(cluster.ticker) : "/methodology"}
          className="text-accent underline underline-offset-4"
        >
          {cluster ? "View research" : "How it works"} ↗
        </Link>
      </div>
      {cluster && (
        <p className="mt-3 text-[10px] text-muted">
          Diagram illustrates the pattern; individual purchase dates are in the
          filings.
        </p>
      )}
    </div>
  );
}
