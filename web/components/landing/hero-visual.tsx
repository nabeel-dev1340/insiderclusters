import type { ClusterSummary } from "@/lib/clusters";
import { Badge } from "@/components/ui/badge";
import { ConvictionBadge } from "@/components/conviction-badge";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatRoleMix,
} from "@/lib/format";

// Product-preview panel for the hero: a "live signal terminal". Purely
// presentational and server-rendered (CSS-only motion, no client JS) so it
// costs nothing on the critical path. Uses a real recent cluster when
// available, otherwise a representative sample. We never invent insider
// *names* — the avatar row is anonymous, tinted by the real role mix.

const SAMPLE: Pick<
  ClusterSummary,
  | "ticker"
  | "issuerName"
  | "insiderCount"
  | "totalValue"
  | "marketCap"
  | "windowStart"
  | "windowEnd"
  | "hasSeniorInsider"
  | "sector"
  | "roleMix"
> = {
  ticker: "BBAI",
  issuerName: "BigBear.ai Holdings",
  insiderCount: 3,
  totalValue: 1_240_000,
  marketCap: 480_000_000,
  windowStart: "2026-06-18",
  windowEnd: "2026-06-27",
  hasSeniorInsider: true,
  sector: "Technology",
  roleMix: { officer: 2, director: 1, owner: 0, other: 0 },
};

export function HeroVisual({ cluster }: { cluster?: ClusterSummary | null }) {
  const c = cluster ?? SAMPLE;
  const bars = [38, 52, 44, 61, 55, 78, 66, 94];
  const roleLabel = formatRoleMix(c.roleMix);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)] blur-2xl motion-safe:animate-float"
      />

      {/* back cards for depth */}
      <div
        aria-hidden
        className="absolute -right-3 -top-5 h-full w-full rounded-3xl border border-border bg-surface-muted/50 sm:-right-6"
      />
      <div
        aria-hidden
        className="absolute -right-1.5 -top-2.5 h-full w-full rounded-3xl border border-border bg-surface-muted/70 sm:-right-3"
      />

      <div className="relative rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/5">
        {/* live header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Cluster detected
          </span>
          <span className="text-xs text-muted">just now</span>
        </div>

        {/* ticker + issuer */}
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-3xl font-bold tracking-tight">
              {c.ticker}
            </div>
            <div className="mt-0.5 truncate text-sm text-muted">
              {c.issuerName}
              {c.sector && <span className="text-muted/70"> · {c.sector}</span>}
            </div>
          </div>
          <Badge tone="accent" className="shrink-0">
            {c.insiderCount} buying
          </Badge>
        </div>

        {/* anonymous insider avatars + role mix */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(c.insiderCount, 4) }).map((_, i) => (
              <span
                key={i}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-accent/15 text-accent"
                aria-hidden
              >
                <PersonGlyph />
              </span>
            ))}
            {c.insiderCount > 4 && (
              <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-surface-muted text-[10px] font-semibold text-muted">
                +{c.insiderCount - 4}
              </span>
            )}
          </div>
          {roleLabel && (
            <span className="truncate text-xs text-muted">{roleLabel}</span>
          )}
          {c.hasSeniorInsider && <ConvictionBadge size="xs" className="ml-auto" />}
        </div>

        {/* mini activity chart with a radar scan line */}
        <div className="relative mt-5 h-20 overflow-hidden rounded-xl bg-surface-muted/50 p-2.5">
          <div className="flex h-full items-end gap-1.5" aria-hidden>
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-accent/20"
                style={{ height: `${h}%` }}
              >
                <div
                  className="h-full w-full rounded-sm bg-accent"
                  style={{ opacity: i >= bars.length - 2 ? 1 : 0.4 }}
                />
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--accent)_28%,transparent),transparent)] motion-safe:animate-scan motion-reduce:hidden"
          />
        </div>

        {/* metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
          <Metric label="Bought" value={formatMoneyCompact(c.totalValue)} />
          <Metric label="Mkt cap" value={formatMarketCap(c.marketCap)} />
          <Metric
            label="Window"
            value={formatDateRange(c.windowStart, c.windowEnd)}
            small
          />
        </div>
      </div>

      {/* floating secondary alert for depth + "there's a feed" cue */}
      <div className="absolute -bottom-6 -left-4 hidden w-52 rotate-[-3deg] rounded-2xl border border-border bg-surface p-3 shadow-xl shadow-black/10 motion-safe:animate-float sm:block">
        <div className="flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <span className="font-mono font-semibold">HCTI</span>
          <span className="text-muted">2 insiders</span>
          <span className="ml-auto font-semibold tabular-nums text-accent">
            $610K
          </span>
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

function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6v.5H5v-.5z" />
    </svg>
  );
}
