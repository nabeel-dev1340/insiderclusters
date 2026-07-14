import type { Metadata } from "next";
import Link from "next/link";
import {
  getRecentClusters,
  getClusterStats,
  type ClusterSummary,
  type ClusterStats,
} from "@/lib/clusters";
import { LoginForm } from "@/app/login/login-form";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HeroVisual } from "@/components/landing/hero-visual";
import { TickerTape } from "@/components/landing/ticker-tape";
import { PricingCards } from "@/components/pricing";
import { Reveal } from "@/components/reveal";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ConvictionBadge } from "@/components/conviction-badge";
import { tickerPath } from "@/lib/site";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatRoleMix,
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
  // render the page without the social-proof sections rather than failing. We
  // pull a dozen so the ticker tape and the live grid can share one query.
  let clusters: ClusterSummary[] = [];
  let stats: ClusterStats | null = null;
  try {
    [clusters, stats] = await Promise.all([
      getRecentClusters(12),
      getClusterStats(),
    ]);
  } catch {
    clusters = [];
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <TickerTape clusters={clusters} />
      <main>
        <Hero featured={clusters[0]} />
        <DetectionStrip />
        <NoiseVsSignal />
        <HowItWorks />
        <Features />
        <Anatomy />
        {clusters.length > 0 && (
          <LiveClusters clusters={clusters.slice(0, 6)} stats={stats} />
        )}
        <Comparison />
        <PricingPreview />
        <Faq />
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
        className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_-5%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent)]"
      />
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-8 lg:py-28">
        <Reveal className="min-w-0 max-w-xl">
          <Link
            href="/stocks"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 py-1 pl-1 pr-3 text-xs font-medium text-muted shadow-sm backdrop-blur transition-colors hover:border-accent/40 hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 motion-safe:animate-pulse-ring" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live
            </span>
            Real-time SEC Form 4 monitoring
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>

          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
            Catch insider conviction the moment it{" "}
            <span className="text-gradient">clusters.</span>
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-lg text-muted">
            InsiderClusters parses every SEC Form 4 filing and alerts you when
            two or more insiders buy the same stock around the same time — the
            rarest, highest-signal pattern in insider trading.
          </p>

          <div className="mt-8 max-w-md">
            <LoginForm autoFocus={false} layout="row" cta="Start free trial" />
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <TrustItem>7-day free trial</TrustItem>
              <TrustItem>Cancel anytime</TrustItem>
              <TrustItem>Straight from SEC EDGAR</TrustItem>
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

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckIcon className="h-4 w-4 text-accent" />
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Detection rule strip (specific = credible)                                 */
/* -------------------------------------------------------------------------- */

const DETECTION = [
  { value: "2+", label: "distinct insiders" },
  { value: "Open-market", label: "code-P buys" },
  { value: "Any size", label: "market cap" },
  { value: "Real-time", label: "EDGAR polling" },
];

function DetectionStrip() {
  return (
    <section className="border-b border-border bg-surface-muted/40">
      <Container className="py-10">
        <Reveal>
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted">
            What we count as a cluster
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            {DETECTION.map((d) => (
              <div
                key={d.label}
                className="bg-surface px-4 py-6 text-center"
              >
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
/* Noise vs. signal (the thesis, made visual)                                 */
/* -------------------------------------------------------------------------- */

function NoiseVsSignal() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">
              The thesis
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Most insider trades are noise. Clusters aren&apos;t.
            </h2>
            <div className="mt-5 space-y-4 text-pretty text-muted">
              <p>
                A single executive buying their own stock can mean almost
                anything — compensation, optics, a routine plan. The signal is
                easy to over-read in isolation.
              </p>
              <p>
                But when several{" "}
                <span className="font-medium text-foreground">independent</span>{" "}
                insiders buy the same company within a short window, that&apos;s
                coordinated conviction that&apos;s hard to fake. We surface those
                events — every figure one click from an official SEC filing.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120} className="grid gap-4 sm:grid-cols-2">
            {/* Noise: a lone buy, deliberately understated */}
            <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Noise
                </span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-surface text-muted">
                  <PersonGlyph />
                </span>
              </div>
              <p className="mt-8 font-mono text-lg font-semibold text-muted">
                1 insider
              </p>
              <p className="mt-1 text-sm text-muted/80">
                One director buys. Could be anything. We skip it.
              </p>
            </div>

            {/* Signal: a cluster, elevated */}
            <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-surface p-5 shadow-lg ring-1 ring-accent/10">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/15 blur-2xl"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Signal
                </span>
                <div className="flex -space-x-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-accent/15 text-accent"
                      aria-hidden
                    >
                      <PersonGlyph />
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-8 font-mono text-lg font-semibold">3 insiders</p>
              <p className="mt-1 text-sm text-muted">
                Officers + a director, same stock, 9 days. That&apos;s a cluster.
              </p>
            </div>
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
    icon: RadarIcon,
  },
  {
    title: "We detect clusters",
    body: "When 2+ distinct insiders buy the same stock inside a rolling window, that's flagged as a cluster.",
    icon: LayersIcon,
  },
  {
    title: "You get alerted",
    body: "Clusters land in your dashboard in real time — plus instant email and Telegram alerts on Pro — before the crowd notices.",
    icon: BellIcon,
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
        <ol className="relative mt-12 grid gap-6 sm:grid-cols-3">
          {/* connecting line on desktop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[16.6%] top-11 hidden h-px bg-linear-to-r from-transparent via-border to-transparent sm:block"
          />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 110}>
              <li className="relative h-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="relative z-10 grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent ring-4 ring-surface-muted/40">
                    <s.icon />
                  </span>
                  <span className="font-mono text-sm font-semibold text-muted">
                    0{i + 1}
                  </span>
                </div>
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
/* Features (bento grid)                                                       */
/* -------------------------------------------------------------------------- */

function Features() {
  return (
    <section className="py-20 sm:py-24">
      <Container size="lg">
        <SectionHeading
          eyebrow="Built for signal"
          title="Everything you need to act on insider buying"
          subtitle="Purpose-built for one job — surfacing clustered insider conviction — and nothing you don't need."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Wide feature cell with an inline live visual */}
          <Reveal className="sm:col-span-2 lg:col-span-4">
            <BentoCell className="flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="max-w-sm">
                <FeatureIcon icon={RadarIcon} />
                <h3 className="mt-4 text-lg font-semibold">
                  Real-time EDGAR monitoring
                </h3>
                <p className="mt-2 text-sm text-muted">
                  We poll SEC EDGAR continuously and parse each Form 4 the second
                  it lands — no delay, no polling schedules to manage.
                </p>
              </div>
              <MiniPulseVisual />
            </BentoCell>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-2">
            <BentoCell className="h-full">
              <FeatureIcon icon={LayersIcon} />
              <h3 className="mt-4 font-semibold">Cluster detection engine</h3>
              <p className="mt-2 text-sm text-muted">
                Rolling detection window, distinct-insider dedupe, and
                open-market-only filtering applied automatically to every filing.
              </p>
            </BentoCell>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-2">
            <BentoCell className="h-full">
              <FeatureIcon icon={LinkIcon} />
              <h3 className="mt-4 font-semibold">Source-linked transparency</h3>
              <p className="mt-2 text-sm text-muted">
                Every transaction links straight back to the original SEC filing,
                so you can verify each buy at the source.
              </p>
            </BentoCell>
          </Reveal>

          <Reveal delay={160} className="lg:col-span-2">
            <BentoCell className="h-full">
              <FeatureIcon icon={SparkIcon} />
              <h3 className="mt-4 font-semibold">Role-weighted conviction</h3>
              <p className="mt-2 text-sm text-muted">
                A CEO or CFO buying alongside others outranks a cluster of only
                directors — we flag the high-conviction ones for you.
              </p>
            </BentoCell>
          </Reveal>

          <Reveal delay={160} className="lg:col-span-2">
            <BentoCell className="h-full">
              <FeatureIcon icon={BellIcon} />
              <h3 className="mt-4 font-semibold">Alerts where you work</h3>
              <p className="mt-2 text-sm text-muted">
                Get clusters in your dashboard, inbox, and Telegram — instant
                alerts for Pro members, the moment they form.
              </p>
            </BentoCell>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function BentoCell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm transition-colors hover:border-accent/40">
      <div className={className}>{children}</div>
    </div>
  );
}

function FeatureIcon({ icon: Icon }: { icon: () => React.ReactElement }) {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
      <Icon />
    </span>
  );
}

function MiniPulseVisual() {
  const bars = [40, 58, 46, 70, 60, 88];
  return (
    <div className="relative w-full shrink-0 rounded-xl border border-border bg-surface-muted/50 p-4 sm:w-52">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 motion-safe:animate-pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        Monitoring EDGAR
      </div>
      <div className="mt-4 flex h-14 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-accent"
            style={{ height: `${h}%`, opacity: i >= bars.length - 2 ? 1 : 0.35 }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Anatomy of a signal (educational + trust)                                  */
/* -------------------------------------------------------------------------- */

const ANATOMY = [
  {
    n: 1,
    label: "The company",
    body: "Ticker and issuer, linked to its full cluster history and every underlying filing.",
  },
  {
    n: 2,
    label: "Distinct insiders",
    body: "How many different people bought. Two is the floor — that's what makes it a cluster.",
  },
  {
    n: 3,
    label: "High-conviction flag",
    body: "Lights up when a C-suite officer is among the buyers — historically the strongest signal.",
  },
  {
    n: 4,
    label: "Total bought",
    body: "Combined open-market dollars, summed straight from each insider's Form 4.",
  },
  {
    n: 5,
    label: "Rolling window",
    body: "Every buy lands inside a rolling window, so you see conviction that clusters in time.",
  },
];

function Pin({ n }: { n: number }) {
  return (
    <span className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
      {n}
    </span>
  );
}

function Anatomy() {
  return (
    <section className="border-t border-border bg-surface-muted/40 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Anatomy of a signal"
          title="Every cluster, decoded at a glance"
          subtitle="No black boxes and no invented scores — just the raw pattern, labeled."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* Annotated card */}
          <Reveal>
            <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-black/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Pin n={1} />
                  <div>
                    <div className="font-mono text-2xl font-bold tracking-tight">
                      NRXP
                    </div>
                    <div className="text-sm text-muted">NRx Pharmaceuticals</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Pin n={2} />
                  <Badge tone="accent">3 insiders</Badge>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Pin n={3} />
                <ConvictionBadge size="xs" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                    <Pin n={4} /> Bought
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    $1.4M
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                    <Pin n={5} /> Window · cap
                  </div>
                  <div className="mt-1 text-sm font-medium tabular-nums">
                    9 days · $310M
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Legend */}
          <Reveal delay={120}>
            <ul className="space-y-5">
              {ANATOMY.map((a) => (
                <li key={a.n} className="flex gap-3.5">
                  <Pin n={a.n} />
                  <div>
                    <h3 className="font-semibold leading-tight">{a.label}</h3>
                    <p className="mt-1 text-sm text-muted">{a.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Live clusters (real social proof)                                          */
/* -------------------------------------------------------------------------- */

// Only brag about the track record once it's a track record — below this the
// plain copy reads better than a small number.
const MIN_STATS_CLUSTERS = 25;

function trackRecordLine(stats: ClusterStats): string {
  const since = stats.since
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(stats.since))
    : null;
  const clusters = stats.clusterCount.toLocaleString("en-US");
  const companies = stats.tickerCount.toLocaleString("en-US");
  const dollars = formatMoneyCompact(stats.totalValue);
  return `${clusters} clusters across ${companies} companies${
    since ? ` since ${since}` : ""
  } — ${dollars} of insider buying, every dollar traced to an SEC filing.`;
}

function LiveClusters({
  clusters,
  stats,
}: {
  clusters: ClusterSummary[];
  stats: ClusterStats | null;
}) {
  const showStats = stats != null && stats.clusterCount >= MIN_STATS_CLUSTERS;
  return (
    <section className="border-y border-border py-20 sm:py-24">
      <Container size="lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">
              Live from EDGAR
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Recently detected clusters
            </h2>
            <p className="mt-2 text-muted">
              {showStats
                ? trackRecordLine(stats)
                : "Live examples of multi-insider buying we surfaced from public filings."}
            </p>
          </div>
          <Link
            href="/stocks"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            Browse all stocks
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c, i) => (
            <Reveal key={c.id} delay={(i % 3) * 90}>
              <Link
                href={tickerPath(c.ticker)}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold">{c.ticker}</span>
                  <Badge tone="neutral">{c.insiderCount} insiders</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-sm text-muted">{c.issuerName}</p>
                  {c.hasSeniorInsider && (
                    <ConvictionBadge size="xs" className="shrink-0" />
                  )}
                </div>
                {formatRoleMix(c.roleMix) && (
                  <p className="mt-2 text-xs text-muted/80">
                    {formatRoleMix(c.roleMix)}
                  </p>
                )}
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
/* Comparison                                                                  */
/* -------------------------------------------------------------------------- */

const COMPARE_ROWS: {
  label: string;
  us: boolean | string;
  manual: boolean | string;
  screener: boolean | string;
}[] = [
  { label: "Multi-insider cluster detection", us: true, manual: "Manual", screener: false },
  { label: "All market caps, no blind spots", us: true, manual: false, screener: "Partial" },
  { label: "Real-time as filings land", us: true, manual: false, screener: "Varies" },
  { label: "Every figure linked to its SEC filing", us: true, manual: true, screener: false },
  { label: "Role-weighted conviction flag", us: true, manual: false, screener: false },
  { label: "Setup time", us: "Seconds", manual: "Hours / week", screener: "Minutes" },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (typeof value === "string") {
    return (
      <span
        className={
          highlight
            ? "text-sm font-semibold text-accent"
            : "text-sm text-muted"
        }
      >
        {value}
      </span>
    );
  }
  return value ? (
    <CheckIcon className={highlight ? "mx-auto h-5 w-5 text-accent" : "mx-auto h-5 w-5 text-foreground"} />
  ) : (
    <XIcon className="mx-auto h-5 w-5 text-muted/50" />
  );
}

function Comparison() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why not do it yourself"
          title="You could watch EDGAR by hand. This is faster."
          subtitle="The cluster rule is simple to state and tedious to run — so we run it, continuously, for you."
        />

        <Reveal className="mt-12 overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50">
                  <th className="px-5 py-4 text-sm font-medium text-muted" />
                  <th className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                      <SparkIcon />
                      InsiderClusters
                    </span>
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-medium text-muted">
                    Manual EDGAR
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-medium text-muted">
                    Generic screener
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i % 2 ? "bg-surface-muted/20" : "bg-surface"}
                  >
                    <th
                      scope="row"
                      className="px-5 py-4 text-left text-sm font-medium text-foreground"
                    >
                      {row.label}
                    </th>
                    <td className="bg-accent/[0.04] px-5 py-4 text-center">
                      <Cell value={row.us} highlight />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Cell value={row.manual} />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Cell value={row.screener} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pricing preview                                                             */
/* -------------------------------------------------------------------------- */

function PricingPreview() {
  return (
    <section className="border-t border-border bg-surface-muted/40 py-20 sm:py-24">
      <Container size="lg">
        <SectionHeading
          eyebrow="Pricing"
          title="Try it free for 7 days. Keep it when the edge pays for itself."
          subtitle="One high-signal feed, real-time on every plan — instant alerts on Pro."
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
/* FAQ (native details — zero JS)                                             */
/* -------------------------------------------------------------------------- */

const FAQS = [
  {
    q: "What exactly counts as a “cluster”?",
    a: "Two or more distinct insiders making open-market purchases of the same stock inside a rolling window. We dedupe by person, so one insider filing twice never counts as two.",
  },
  {
    q: "Where does the data come from?",
    a: "Directly from SEC EDGAR Form 4 filings, which insiders are legally required to file. We parse every filing ourselves and link each figure back to the original document — nothing is invented or estimated.",
  },
  {
    q: "How fast are the alerts?",
    a: "Every plan gets the cluster feed in real time, the moment we detect them. Pro adds instant email and Telegram alerts, so clusters reach you without opening the dashboard; Basic includes a weekly digest of the top cluster.",
  },
  {
    q: "Do you cover large-caps too, or only small companies?",
    a: "Every company size. We track clusters from micro-caps to mega-caps — wherever two or more insiders buy on the open market together, it shows up in the feed. No market-cap blind spots.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "Signup itself is a single magic link, no card. Both plans then start with a 7-day free trial — you add a card at checkout but aren't charged until the trial ends, and you can cancel anytime before that at no cost.",
  },
  {
    q: "Is this investment advice?",
    a: "No. InsiderClusters is an informational tool built on public SEC filings. It surfaces a pattern; what you do with it is your call.",
  },
];

function Faq() {
  // FAQPage schema mirrors the visible questions verbatim so AI engines and
  // rich results can lift exact answers from the page.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="py-20 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Container>
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          subtitle="Everything else you might want to know before you sign up."
        />
        <Reveal className="mx-auto mt-12 max-w-2xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-medium transition-colors hover:bg-surface-muted/40 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronIcon className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="px-6 pb-5 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </Reveal>
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
        <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-16 text-center shadow-sm sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-70"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent)]"
          />
          <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Start tracking insider conviction today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-muted">
            Create your account in seconds, then try any plan free for 7 days.
          </p>
          <div className="mx-auto mt-8 max-w-md text-left">
            <LoginForm autoFocus={false} layout="row" cta="Start free trial" />
            <p className="mt-3 text-center text-sm text-muted">
              7-day free trial · Cancel anytime · Data straight from SEC EDGAR.
            </p>
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
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-accent">
        <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
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

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6v.5H5v-.5z" />
    </svg>
  );
}
