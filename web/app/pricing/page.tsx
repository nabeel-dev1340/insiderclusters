import { JsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PricingCards } from "@/components/pricing";
import { MONTHLY_PRICE, TRIAL_DAYS, ANNUAL_DISCOUNT_PCT } from "@/lib/billing";
import { SITE_URL } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { posthog } from "@/lib/posthog";

export const metadata: Metadata = {
  title: "Insider Buying Alerts Pricing",
  description: `Track SEC insider cluster buys in real time from $${MONTHLY_PRICE.basic}/month, or go Pro for $${MONTHLY_PRICE.pro}/month with instant email and Telegram alerts. Every plan starts with a ${TRIAL_DAYS}-day free trial.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "InsiderClusters Pricing",
    description: `Real-time cluster feed from $${MONTHLY_PRICE.basic}/month, instant alerts on Pro at $${MONTHLY_PRICE.pro}/month. ${TRIAL_DAYS}-day free trial.`,
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

// Straightforward, specific answers — no filler. These double as the FAQPage
// structured data below so the machine-readable and visible answers agree.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as a cluster buy?",
    a: "A cluster groups qualifying code-P purchases by at least two distinct insiders in the same ticker within the detection window. Read our methodology for the filters, default window, and limitations.",
  },
  {
    q: "How does the free trial work?",
    a: `Both plans start with a ${TRIAL_DAYS}-day free trial. You enter a card at checkout but aren't charged until the trial ends, and you can cancel any time before then at no cost. You can manage your subscription through Creem, our payment provider.`,
  },
  {
    q: `What's the difference between Basic and Pro?`,
    a: `Both plans get the full real-time cluster feed and complete history. Basic ($${MONTHLY_PRICE.basic}/month) includes a weekly email digest of the top cluster; Pro ($${MONTHLY_PRICE.pro}/month) adds instant email and Telegram alerts the moment each cluster is detected.`,
  },
  {
    q: "How does annual billing work?",
    a: `Each plan has an annual option at ${ANNUAL_DISCOUNT_PCT}% off the monthly price — choose monthly or annual billing on the plan cards.`,
  },
  {
    q: "How fast are Pro alerts?",
    a: "Pro alerts are dispatched after a qualifying cluster is detected from public filings. Filing delays, polling, processing, and delivery affect timing. They are not notifications at the moment a trade takes place.",
  },
  {
    q: "Where does the data come from?",
    a: "Every transaction is parsed directly from public SEC Form 4 filings on EDGAR, and each cluster links back to the original filing so you can verify it yourself. We add nothing you couldn't confirm at the source.",
  },
  {
    q: "Is this investment advice?",
    a: "No. InsiderClusters is an informational tool that organizes public filing data. It is not a recommendation to buy or sell any security. Always do your own research.",
  },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const distinctId = user?.email ?? "anonymous";
  posthog().capture({
    distinctId,
    event: "pricing page viewed",
    properties: { plan: user ? effectivePlan(user) : "none" },
  });

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main id="main-content" tabIndex={-1} className="pricing-page">
        <Container>
          <section
            className="home-section pricing-layout"
            aria-labelledby="pricing-title"
          >
            <div>
              <span className="eyebrow">A plan for your research</span>
              <h1 id="pricing-title" className="mt-5 text-5xl sm:text-6xl">
                The evidence.
                <br />
                <em>On your terms.</em>
              </h1>
              <p className="mt-5">
                Both plans include the full cluster feed and purchase history.
                Choose Pro to receive email and Telegram notifications after
                detection.
              </p>
              <p className="mt-5 text-xs">
                {TRIAL_DAYS}-day free trial · Card required at checkout
                <br />
                Cancel before the trial ends to avoid a charge.
              </p>
              <Link href="/stocks" className="text-link mt-5">
                Explore public data first ↗
              </Link>
            </div>
            <div>
              <PricingCards checkout={!!user} />
              <p className="mt-5 text-xs text-muted">
                Annual billing saves {ANNUAL_DISCOUNT_PCT}% and can be selected on the plan cards. Your card is charged after the trial unless you
                cancel.
              </p>
            </div>
          </section>
          <section
            className="border-t border-border pb-16 pt-12"
            aria-labelledby="comparison-heading"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">Side by side</span>
                <h2 id="comparison-heading">
                  Same research. Different delivery.
                </h2>
              </div>
              <Link href="/methodology" className="text-link">
                How we detect clusters ↗
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Basic and Pro subscription features
                </caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="px-3 py-4 font-medium">
                      Included
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-4 text-center font-medium"
                    >
                      Basic
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-4 text-center font-medium text-accent"
                    >
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ComparisonRow feature="Cluster feed" basic pro />
                  <ComparisonRow feature="Full cluster history" basic pro />
                  <ComparisonRow feature="Transaction breakdown" basic pro />
                  <ComparisonRow feature="Weekly email digest" basic pro />
                  <ComparisonRow
                    feature="Instant email alerts"
                    basic={false}
                    pro
                  />
                  <ComparisonRow feature="Telegram alerts" basic={false} pro />
                </tbody>
              </table>
            </div>
          </section>
          <section className="home-section border-t border-border">
            <div className="faq-layout">
              <div>
                <span className="eyebrow">The details</span>
                <h2>
                  Before you
                  <br />
                  <em>choose a plan.</em>
                </h2>
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
        </Container>
      </main>

      <SiteFooter />

      <JsonLd data={faqJsonLd} />
    </div>
  );
}

function ComparisonRow({
  feature,
  basic,
  pro,
}: {
  feature: string;
  basic?: boolean | string;
  pro?: boolean | string;
}) {
  return (
    <tr className="hover:bg-surface-muted/50">
      <td className="px-4 py-3">{feature}</td>
      <td className="px-4 py-3 text-center text-muted">{renderCell(basic)}</td>
      <td className="px-4 py-3 text-center font-medium">{renderCell(pro)}</td>
    </tr>
  );
}

function renderCell(v: boolean | string | undefined) {
  if (typeof v === "string") return v;
  return (
    <>
      <span aria-hidden>{v ? "✓" : "—"}</span>
      <span className="sr-only">{v ? "Included" : "Not included"}</span>
    </>
  );
}
