import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PricingCards, PRO_PRICE_MONTHLY } from "@/components/pricing";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing — Free insider-buy alerts, or real-time Pro",
  description: `Track SEC insider cluster buys free with a weekly, delayed feed, or go Pro for $${PRO_PRICE_MONTHLY}/month to get every cluster in real time with instant email and Discord alerts.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "InsiderClusters Pricing",
    description: `Free weekly feed or real-time Pro at $${PRO_PRICE_MONTHLY}/month.`,
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

// Straightforward, specific answers — no filler. These double as the FAQPage
// structured data below so they can surface directly in search results.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as a cluster buy?",
    a: "A cluster buy is when two or more distinct company insiders — officers, directors, or 10% owners — each report an open-market purchase (SEC transaction code P) of the same stock within a rolling 15-day window. We only surface companies under a $2B market cap, where insider conviction tends to move the needle most.",
  },
  {
    q: "How fast are Pro alerts?",
    a: "Our scraper polls SEC EDGAR continuously. When a new Form 4 completes a cluster, Pro members get it in the dashboard and by email within minutes. Free members see a single cluster per week on a 24-hour delay.",
  },
  {
    q: "Where does the data come from?",
    a: "Every transaction is parsed directly from public SEC Form 4 filings on EDGAR, and each cluster links back to the original filing so you can verify it yourself. We add nothing you couldn't confirm at the source.",
  },
  {
    q: "Is this investment advice?",
    a: "No. InsiderClusters is an informational tool that organizes public filing data. It is not a recommendation to buy or sell any security. Always do your own research.",
  },
  {
    q: `What do I get for $${PRO_PRICE_MONTHLY} a month?`,
    a: "Real-time access to every cluster the moment it's detected, unlimited history, instant email alerts, and Discord alerts as they roll out — with no weekly cap and no delay. You can cancel anytime.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Sign in with a magic link and use the free plan indefinitely. Upgrade to Pro from your dashboard whenever you're ready.",
  },
];

export default function PricingPage() {
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
          Start free and watch the pattern a week behind, or go Pro to see every
          insider cluster buy in real time. No contracts, cancel anytime.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <PricingCards />
        <p className="mt-6 text-center text-xs text-muted">
          Pro checkout is launching shortly. Start on the free plan today — your
          account and alert history carry straight over when you upgrade.
        </p>
      </section>

      {/* Feature comparison */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-12">
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 text-center font-medium">Free</th>
                <th className="px-4 py-3 text-center font-medium text-accent">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <ComparisonRow feature="Clusters shown" free="1 / week" pro="Unlimited" />
              <ComparisonRow feature="Delay" free="24 hours" pro="Real-time" />
              <ComparisonRow feature="Full transaction breakdown" free pro />
              <ComparisonRow feature="Public ticker pages" free pro />
              <ComparisonRow feature="Instant email alerts" free={false} pro />
              <ComparisonRow feature="Discord alerts" free={false} pro="Soon" />
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
  free,
  pro,
}: {
  feature: string;
  free?: boolean | string;
  pro?: boolean | string;
}) {
  return (
    <tr className="bg-surface">
      <td className="px-4 py-3">{feature}</td>
      <td className="px-4 py-3 text-center text-muted">{renderCell(free)}</td>
      <td className="px-4 py-3 text-center font-medium">{renderCell(pro)}</td>
    </tr>
  );
}

function renderCell(v: boolean | string | undefined) {
  if (typeof v === "string") return v;
  return v ? "✓" : "—";
}
