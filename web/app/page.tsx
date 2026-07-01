import Link from "next/link";
import { getRecentClusters } from "@/lib/clusters";
import { LoginForm } from "@/app/login/login-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
} from "@/lib/format";

// Public landing page (Feature 3.1). Server-rendered for fast load +
// crawlability; revalidated periodically so social proof stays fresh without
// a DB hit on every request.
export const revalidate = 600;

export default async function Home() {
  // Degrade gracefully: if the DB is unreachable (e.g. at build time), still
  // render the page without the social-proof section rather than failing.
  let clusters: Awaited<ReturnType<typeof getRecentClusters>> = [];
  try {
    clusters = await getRecentClusters(3);
  } catch {
    clusters = [];
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent)]"
        />
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <Badge tone="accent" className="mx-auto">
            Real-time SEC Form 4 monitoring
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Know when insiders buy,{" "}
            <span className="text-accent">together.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            We watch every SEC Form 4 filing and alert you the moment two or more
            insiders buy the same small-cap stock within days of each other — the
            highest-signal pattern in insider trading.
          </p>

          <div className="mx-auto mt-8 max-w-sm text-left">
            <LoginForm autoFocus={false} />
            <p className="mt-3 text-center text-xs text-muted">
              No password. We&apos;ll email you a magic sign-in link.
            </p>
          </div>
        </div>
      </section>

      {/* Social proof: recent clusters */}
      {clusters.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Recently detected clusters
              </h2>
              <p className="mt-1 text-sm text-muted">
                Live examples of multi-insider buying we surfaced.
              </p>
            </div>
            <Link href="/login" className="text-sm text-accent hover:underline">
              See all →
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {clusters.map((c) => (
              <Link
                key={c.id}
                href="/login"
                className="group rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
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
                  <span className="text-muted">{formatMarketCap(c.marketCap)} cap</span>
                </div>
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  {formatDateRange(c.windowStart, c.windowEnd)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-center text-xl font-semibold tracking-tight">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Step
              n={1}
              title="We watch EDGAR"
              body="Our scraper polls SEC filings continuously and parses every insider open-market purchase."
            />
            <Step
              n={2}
              title="We detect clusters"
              body="When 2+ distinct insiders buy the same sub-$2B stock within a 15-day window, that's a cluster."
            />
            <Step
              n={3}
              title="You get alerted"
              body="Real-time alerts land in your dashboard, inbox, and Discord — before the crowd notices."
            />
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Start tracking insider conviction
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Free to start. Upgrade for real-time alerts whenever you&apos;re ready.
        </p>
        <ButtonLink href="/login" size="lg" className="mt-6">
          Get started free
        </ButtonLink>
      </section>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
            IC
          </span>
          InsiderClusters
        </Link>
        <ButtonLink href="/login" variant="secondary" size="sm">
          Sign in
        </ButtonLink>
      </div>
    </header>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 font-semibold text-accent">
        {n}
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} InsiderClusters</span>
        <span className="text-xs">
          Not investment advice. Data sourced from public SEC filings.
        </span>
      </div>
    </footer>
  );
}
