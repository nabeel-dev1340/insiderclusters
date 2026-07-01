import type { ClusterSummary } from "@/lib/clusters";
import { Badge } from "@/components/ui/badge";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
} from "@/lib/format";

// Product-preview panel for the hero. Purely presentational and server-rendered
// (CSS-only motion, no client JS) so it costs nothing on the critical path.
// Uses a real recent cluster when available, otherwise a representative sample.

const SAMPLE: Pick<
  ClusterSummary,
  "ticker" | "issuerName" | "insiderCount" | "totalValue" | "marketCap" | "windowStart" | "windowEnd"
> = {
  ticker: "BBAI",
  issuerName: "BigBear.ai Holdings",
  insiderCount: 3,
  totalValue: 1_240_000,
  marketCap: 480_000_000,
  windowStart: "2026-06-18",
  windowEnd: "2026-06-27",
};

export function HeroVisual({ cluster }: { cluster?: ClusterSummary | null }) {
  const c = cluster ?? SAMPLE;
  const bars = [42, 68, 55, 83, 61, 92];

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)] blur-2xl motion-safe:animate-float"
      />

      {/* back card for depth */}
      <div
        aria-hidden
        className="absolute -right-3 -top-4 h-full w-full rounded-2xl border border-border bg-surface-muted/60 sm:-right-5"
      />

      <div className="relative rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Cluster detected
          </span>
          <span className="text-xs text-muted">just now</span>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-2xl font-bold tracking-tight">
              {c.ticker}
            </div>
            <div className="mt-0.5 truncate text-sm text-muted">
              {c.issuerName}
            </div>
          </div>
          <Badge tone="accent" className="shrink-0">
            {c.insiderCount} insiders buying
          </Badge>
        </div>

        {/* mini activity chart */}
        <div className="mt-5 flex h-16 items-end gap-1.5" aria-hidden>
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-accent/25"
              style={{ height: `${h}%` }}
            >
              <div
                className="h-full w-full rounded-sm bg-accent/70"
                style={{ opacity: i >= bars.length - 2 ? 1 : 0.35 }}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
          <Metric label="Bought" value={formatMoneyCompact(c.totalValue)} />
          <Metric label="Mkt cap" value={formatMarketCap(c.marketCap)} />
          <Metric
            label="Window"
            value={formatDateRange(c.windowStart, c.windowEnd)}
            small
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div
        className={
          small
            ? "mt-0.5 text-xs font-medium tabular-nums"
            : "mt-0.5 font-semibold tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}
