import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

const TITLE = "Insider Buying Data & Cluster Detection Methodology";
const DESCRIPTION =
  "How InsiderClusters parses SEC Form 4 filings, groups qualifying purchases, calculates cluster metrics, and handles the limits of insider buying data.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/methodology`,
    type: "website",
  },
};
export default function MethodologyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="editorial-main mx-auto w-full max-w-3xl px-6 py-12"
      >
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/">Home</Link>
          <span className="px-2">/</span>Methodology
        </nav>
        <header className="mt-5">
          <span className="eyebrow mb-4">Sources, process & limitations</span>
          <h1>Behind the buying data.</h1>
          <p className="mt-5 text-muted">
            InsiderClusters organizes public SEC filings into research leads.
            Here is how the data becomes a cluster, what the numbers mean, and
            what they cannot tell you.
          </p>
          <p className="mt-4 text-xs text-muted">
            Methodology documented October 12, 2026 · InsiderClusters, a product
            by Beelodev
          </p>
        </header>
        <article className="methodology-body">
          <h2>Our primary source: SEC Form 4</h2>
          <p>
            We parse reported insider transactions from Form 4 filings published
            on SEC EDGAR. These filings identify reporting owners, transaction
            dates, codes, share quantities, and reported prices. The SEC
            provides a{" "}
            <a
              href="https://www.sec.gov/files/forms-3-4-5.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              guide to Forms 3, 4, and 5
            </a>
            ; original filings remain the authoritative source.
          </p>
          <p>
            Trade dates and filing dates are different. Monitoring begins after
            a filing becomes public and processing completes. An alert does not
            mean a trade just happened, and monitoring is subject to filing
            delays, service availability, and processing limits.
          </p>
          <h2>Which purchases qualify?</h2>
          <p>
            The detector selects transaction code P purchases with an
            identifiable ticker and a recorded dollar value that passes the
            configured minimum and data-quality checks. Grants, option
            exercises, tax-withholding dispositions, and sales use other codes
            and do not qualify.
          </p>
          <p>
            Code P includes open-market or private purchases. It does not
            establish, by itself, that a purchase was discretionary or occurred
            on an exchange. Our current filter does not independently exclude
            all transactions associated with a 10b5-1 plan. Read ownership
            information and footnotes in the original filing for context.
          </p>
          <h2>How a cluster forms</h2>
          <p>
            A live cluster requires qualifying purchases by at least two
            distinct insiders in the same ticker within a rolling window
            anchored to the latest qualifying purchase date. The detector
            identifies insiders by SEC CIK where available, and falls back to
            the reported name. Multiple purchases by the same identified insider
            count as one buyer.
          </p>
          <p>
            The code defaults to a 90-day detection window, a $1 minimum
            purchase value, and no market-cap ceiling. Deployment settings can
            override these defaults. The dates shown on a cluster are its
            earliest and latest included purchase dates, rather than a promise
            that all buyers traded on the same day.
          </p>
          <p>
            Historical backfills group connected purchases into episodes. An
            episode qualifies when distinct insiders buy within the configured
            window, but additional connected purchases can extend the displayed
            episode beyond that window. Historical detections and live alerts
            therefore have different timing.
          </p>
          <h2>How to read the metrics</h2>
          <dl>
            <div>
              <dt>Total purchased</dt>
              <dd>
                The sum of recorded dollar values for transactions included in
                the cluster.
              </dd>
            </div>
            <div>
              <dt>Average price paid</dt>
              <dd>
                Total purchase value divided by total recorded shares, where
                available. This is a volume-weighted average, not the simple
                average of individual prices.
              </dd>
            </div>
            <div>
              <dt>Buy value / market cap</dt>
              <dd>
                Purchase value divided by cached market capitalization. This is
                a size comparison, not the percentage of shares acquired or an
                insider&apos;s ownership stake.
              </dd>
            </div>
            <div>
              <dt>Senior executive buyer</dt>
              <dd>
                A buyer classified from reported role text as an officer or
                senior executive. This label describes the role; it does not
                establish conviction or predict returns.
              </dd>
            </div>
            <div>
              <dt>Change since cluster</dt>
              <dd>
                Where shown, a comparison of the latest available cached share
                price with the average purchase price. It may use delayed prices
                and is not a realized, dividend-adjusted, or total return.
              </dd>
            </div>
          </dl>
          <h2>What to verify before using the data</h2>
          <p>
            Filings can contain errors, amendments, joint reporting owners,
            indirect holdings, and prices expressed as weighted averages or
            ranges. Parsing and role classification can also be imperfect.
            Data-quality checks reject some implausible values but cannot catch
            every error.
          </p>
          <p>
            Check the original filing, its footnotes, transaction and filing
            dates, ownership type, and the business&apos;s financial condition.
            Cluster buying alone does not establish undervaluation, intent,
            independence of decisions, or future performance.
          </p>
          <h2>Corrections and accountability</h2>
          <p>
            InsiderClusters is built by{" "}
            <a
              href="https://beelodev.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Beelodev
            </a>
            . The data is processed automatically, and the educational content
            explains the process without claiming an independent expert review.
            To report a suspected data issue, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with
            the ticker, filing URL, and figure to check.
          </p>
          <p>
            InsiderClusters provides information for research. It does not
            recommend buying or selling a security.
          </p>
          <div className="mt-10 flex flex-wrap gap-5 border-t border-border pt-6">
            <Link className="text-link" href="/stocks">
              Explore insider buying ↗
            </Link>
            <Link className="text-link" href="/learn/how-to-read-a-form-4">
              Read a Form 4 ↗
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/methodology`,
          dateModified: "2026-10-12",
          about: { "@id": `${SITE_URL}/#organization` },
        }}
      />
    </div>
  );
}
