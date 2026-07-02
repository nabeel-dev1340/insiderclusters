import Link from "next/link";
import {
  avgBuyPrice,
  buyFractionOfCompany,
  returnSinceCluster,
  type ClusterSummary,
} from "@/lib/clusters";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatRelative,
  formatSharePrice,
  formatPercent,
  formatRoleMix,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ConvictionBadge } from "@/components/conviction-badge";
import { ReturnBadge } from "@/components/return-badge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function ClusterCard({
  cluster,
  isNew,
}: {
  cluster: ClusterSummary;
  isNew?: boolean;
}) {
  const avg = avgBuyPrice(cluster);
  const frac = buyFractionOfCompany(cluster);
  const ret = returnSinceCluster(cluster);
  const roleMix = formatRoleMix(cluster.roleMix);
  return (
    <Link
      href={`/dashboard/clusters/${cluster.id}`}
      className="group block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold tracking-tight">
              {cluster.ticker}
            </span>
            {isNew && <Badge tone="accent">New</Badge>}
            {cluster.hasSeniorInsider && <ConvictionBadge size="xs" />}
            <ReturnBadge fraction={ret} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            {cluster.issuerName}
            {cluster.sector && (
              <span className="text-muted/70"> · {cluster.sector}</span>
            )}
          </p>
        </div>
        <Badge tone="neutral" className="shrink-0">
          {cluster.insiderCount} insiders
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Total bought" value={formatMoneyCompact(cluster.totalValue)} />
        <Stat label="Avg paid" value={formatSharePrice(avg)} />
        <Stat label="Market cap" value={formatMarketCap(cluster.marketCap)} />
      </div>

      {(roleMix || frac != null) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          {roleMix && <span className="font-medium text-foreground">{roleMix}</span>}
          {roleMix && frac != null && <span aria-hidden>·</span>}
          {frac != null && <span>{formatPercent(frac)} of company</span>}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <span>
          {formatDateRange(cluster.windowStart, cluster.windowEnd)}
          <span className="px-1.5" aria-hidden>·</span>
          {formatRelative(cluster.detectedAt)}
        </span>
        <span className="font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          View details →
        </span>
      </div>
    </Link>
  );
}
