import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PricingCards } from "@/components/pricing";
import { MONTHLY_PRICE, TRIAL_DAYS, ANNUAL_DISCOUNT_PCT } from "@/lib/billing";
import { SITE_URL } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { posthog } from "@/lib/posthog";

export const metadata: Metadata = {
  title: "Pricing — Real-time insider cluster-buy alerts",
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
// structured data below so they can surface directly in search results.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as a cluster buy?",
    a: "A cluster buy is when two or more distinct company insiders — officers, directors, or 10% owners — each report an open-market purchase (SEC transaction code P) of the same stock within a rolling window. We track them at every company size, from micro-caps to mega-caps.",
  },
  {
    q: "How does the free trial work?",
    a: `Both plans start with a ${TRIAL_DAYS}-day free trial. You enter a card at checkout but aren't charged until the trial ends, and you can cancel any time before then at no cost. Polar, our payment provider, emails you a reminder before the trial converts.`,
  },
  {
    q: `What's the difference between Basic and Pro?`,
    a: `Both plans get the full real-time cluster feed and complete history. Basic ($${MONTHLY_PRICE.basic}/month) includes a weekly email digest of the top cluster; Pro ($${MONTHLY_PRICE.pro}/month) adds instant email and Telegram alerts the moment each cluster is detected.`,
  },
  {
    q: "How does annual billing work?",
    a: `Each plan has an annual option at ${ANNUAL_DISCOUNT_PCT}% off the monthly price — you'll see both billing choices side by side at checkout.`,
  },
  {
    q: "How fast are Pro alerts?",
    a: "Our scraper polls SEC EDGAR continuously. When a new Form 4 completes a cluster, Pro members get it in the dashboard, by email, and on Telegram within minutes.",
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

      <section className="mx-auto w-full max-w-5xl px-6 pt-16 text-center sm:pt-20">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple pricing for a single, high-signal edge
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          See every insider cluster buy in real time. Both plans start with a{" "}
          {TRIAL_DAYS}-day free trial — no charge until it ends, cancel anytime.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <PricingCards checkout={!!user} />
        <p className="mt-6 text-center text-xs text-muted">
          Annual billing ({ANNUAL_DISCOUNT_PCT}% off) is offered at checkout.
          Your card isn&apos;t charged until the trial ends.
        </p>
      </section>

      {/* Feature comparison */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-12">
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 text-center font-medium">Basic</th>
                <th className="px-4 py-3 text-center font-medium text-accent">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <ComparisonRow feature="Real-time cluster feed" basic pro />
              <ComparisonRow feature="Full cluster history" basic pro />
              <ComparisonRow feature="Full transaction breakdown" basic pro />
              <ComparisonRow feature="Weekly email digest" basic pro />
              <ComparisonRow feature="Instant email alerts" basic={false} pro />
              <ComparisonRow feature="Instant Telegram alerts" basic={false} pro />
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Questions, answered
        </h2>
        <dl className="mt-8 divide-y divide-border">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-2 text-sm text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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
    <tr className="bg-surface">
      <td className="px-4 py-3">{feature}</td>
      <td className="px-4 py-3 text-center text-muted">{renderCell(basic)}</td>
      <td className="px-4 py-3 text-center font-medium">{renderCell(pro)}</td>
    </tr>
  );
}

function renderCell(v: boolean | string | undefined) {
  if (typeof v === "string") return v;
  return v ? "✓" : "—";
}
