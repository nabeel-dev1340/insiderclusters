import type { Metadata } from "next";
import Link from "next/link";
import { getRecentClusters, type ClusterSummary } from "@/lib/clusters";
import { LoginForm } from "@/app/login/login-form";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HeroVisual } from "@/components/landing/hero-visual";
import { PricingCards } from "@/components/pricing";
import { Reveal } from "@/components/reveal";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
} from "@/lib/format";

// Public landing page (Feature 3.1). Server-rendered for fast load +
// crawlability; revalidated periodically so social proof stays fresh without a
// DB hit on every request. All motion is CSS-only for a light PageSpeed budget.
export const revalidate = 600;

// Self-referencing canonical for the homepage. The root layout deliberately
// leaves canonical unset (see app/layout.tsx), so each page owns its own.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  // Degrade gracefully: if the DB is unreachable (e.g. at build time), still
  // render the page without the social-proof section rather than failing.
  let clusters: ClusterSummary[] = [];
  try {
    clusters = await getRecentClusters(3);
  } catch {
    clusters = [];
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main>
        <Hero featured={clusters[0]} />
        <DetectionStrip />
        <Thesis />
        <HowItWorks />
        <Features />
        {clusters.length > 0 && <LiveClusters clusters={clusters} />}
        <PricingPreview />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({ featured }: { featured?: ClusterSummary }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]"
      />
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-8 lg:py-28">
        <Reveal className="min-w-0 max-w-xl">
          <Badge tone="accent">Real-time SEC Form 4 monitoring</Badge>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Catch insider conviction the moment it{" "}
            <span className="text-accent">clusters.</span>
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-lg text-muted">
            InsiderClusters parses every SEC Form 4 filing and alerts you when
            two or more insiders buy the same small-cap stock within days — the
            rarest, highest-signal pattern in insider trading.
          </p>

          <div className="mt-8 max-w-md">
            <LoginForm autoFocus={false} layout="row" cta="Get started free" />
            <p className="mt-3 text-sm text-muted">
              Free forever plan · No credit card · Data straight from SEC EDGAR.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120} className="min-w-0 lg:pl-6">
          <HeroVisual cluster={featured} />
        </Reveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Detection rule strip (specific = credible)                                 */
/* -------------------------------------------------------------------------- */

const DETECTION = [
  { value: "2+", label: "distinct insiders" },
  { value: "≤ 15 days", label: "rolling window" },
  { value: "< $2B", label: "market cap" },
  { value: "Real-time", label: "EDGAR polling" },
];

function DetectionStrip() {
  return (
    <section className="border-b border-border bg-surface-muted/40">
      <Container className="py-8">
        <Reveal>
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted">
            What we count as a cluster
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
            {DETECTION.map((d) => (
              <div key={d.label} className="text-center">
                <dt className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {d.value}
                </dt>
                <dd className="mt-1 text-sm text-muted">{d.label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Thesis                                                                      */
/* -------------------------------------------------------------------------- */

function Thesis() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Most insider trades are noise. Clusters aren&apos;t.
            </h2>
          </Reveal>
          <Reveal delay={100} className="space-y-4 text-pretty text-muted">
            <p>
              A single executive buying their own stock can mean almost
              anything — compensation, optics, a routine plan. The signal is
              easy to over-read in isolation.
            </p>
            <p>
              But when several{" "}
              <span className="font-medium text-foreground">independent</span>{" "}
              insiders — different officers, directors, and major holders — buy
              the same company within a two-week window, that&apos;s coordinated
              conviction that&apos;s hard to fake. We surface only those events,
              and only in the sub-$2B names where they move the most.
            </p>
            <p>
              Every figure traces back to an official SEC filing, one click away.
              No black boxes, no invented scores — just the raw pattern, on time.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    title: "We watch EDGAR",
    body: "Our scraper polls SEC filings continuously and parses every insider open-market purchase the moment it's published.",
  },
  {
    title: "We detect clusters",
    body: "When 2+ distinct insiders buy the same sub-$2B stock inside a rolling 15-day window, that's flagged as a cluster.",
  },
  {
    title: "You get alerted",
    body: "Clusters land in your dashboard and inbox — real-time for Pro, on a weekly digest for free — before the crowd notices.",
  },
];

function HowItWorks() {
  return (
    <section className="border-y border-border bg-surface-muted/40 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From filing to alert in minutes"
          subtitle="A single, automated pipeline — no spreadsheets, no manual EDGAR spelunking."
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 110}>
              <li className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 font-semibold text-accent">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: RadarIcon,
    title: "Real-time EDGAR monitoring",
    body: "We poll SEC EDGAR continuously and parse each Form 4 the second it lands — no delay, no polling schedules to manage.",
  },
  {
    icon: LayersIcon,
    title: "Cluster detection engine",
    body: "Rolling 15-day window, distinct-insider dedupe, and a sub-$2B market-cap gate applied automatically to every filing.",
  },
  {
    icon: LinkIcon,
    title: "Source-linked transparency",
    body: "Every transaction links straight back to the original SEC filing, so you can verify each buy at the source.",
  },
  {
    icon: BellIcon,
    title: "Alerts where you work",
    body: "Get clusters in your dashboard and inbox today, with Discord alerts rolling out for Pro members shortly.",
  },
];

function Features() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Built for signal"
          title="Everything you need to act on insider buying"
          subtitle="Purpose-built for one job — surfacing clustered insider conviction — and nothing you don't need."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 2) * 90}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm transition-colors hover:border-accent/40">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <f.icon />
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Live clusters (real social proof)                                          */
/* -------------------------------------------------------------------------- */

function LiveClusters({ clusters }: { clusters: ClusterSummary[] }) {
  return (
    <section className="border-y border-border bg-surface-muted/40 py-20 sm:py-24">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Recently detected clusters
            </h2>
            <p className="mt-2 text-muted">
              Live examples of multi-insider buying we surfaced from public
              filings.
            </p>
          </div>
          <Link
            href="/stocks"
            className="text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            Browse all stocks →
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {clusters.map((c, i) => (
            <Reveal key={c.id} delay={i * 100}>
              <Link
                href={tickerPath(c.ticker)}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">{c.ticker}</span>
                  <Badge tone="accent">{c.insiderCount} insiders</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted">{c.issuerName}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold tabular-nums">
                    {formatMoneyCompact(c.totalValue)}
                  </span>
                  <span className="text-muted">
                    {formatMarketCap(c.marketCap)} cap
                  </span>
                </div>
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  {formatDateRange(c.windowStart, c.windowEnd)}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pricing preview                                                             */
/* -------------------------------------------------------------------------- */

function PricingPreview() {
  return (
    <section className="py-20 sm:py-24">
      <Container size="lg">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when the edge pays for itself."
          subtitle="One high-signal feed — a week behind on free, real-time on Pro."
        />
        <div className="mx-auto mt-12 max-w-3xl">
          <Reveal>
            <PricingCards />
          </Reveal>
          <p className="mt-6 text-center text-sm text-muted">
            Want the details?{" "}
            <Link href="/pricing" className="font-medium text-accent hover:underline">
              See full pricing and FAQ →
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                    */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="border-t border-border">
      <Container className="py-20 sm:py-24">
        <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-sm sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]"
          />
          <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Start tracking insider conviction today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-muted">
            Create a free account in seconds. Upgrade to real-time whenever
            you&apos;re ready.
          </p>
          <div className="mx-auto mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" size="lg">
              Get started free
            </ButtonLink>
            <ButtonLink href="/pricing" size="lg" variant="secondary">
              View pricing
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                  */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-pretty text-muted">{subtitle}</p>}
    </Reveal>
  );
}

/* Inline icons — stroke-based, inherit currentColor, zero dependencies. */
function RadarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12l6-3" />
      <path d="M20.5 12a8.5 8.5 0 1 1-4.2-7.3" />
      <path d="M17 7.5a6 6 0 1 0 1.7 3" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
