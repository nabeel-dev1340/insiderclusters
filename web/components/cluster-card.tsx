import Link from "next/link";
import type { ClusterSummary } from "@/lib/clusters";
import {
  formatMoneyCompact,
  formatMarketCap,
  formatDateRange,
  formatRelative,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";

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
  return (
    <Link
      href={`/dashboard/clusters/${cluster.id}`}
      className="group block rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold tracking-tight">
              {cluster.ticker}
            </span>
            {isNew && <Badge tone="accent">New</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">{cluster.issuerName}</p>
        </div>
        <Badge tone="accent" className="shrink-0">
          {cluster.insiderCount} insiders
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Total bought" value={formatMoneyCompact(cluster.totalValue)} />
        <Stat label="Market cap" value={formatMarketCap(cluster.marketCap)} />
        <Stat label="Detected" value={formatRelative(cluster.detectedAt)} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <span>{formatDateRange(cluster.windowStart, cluster.windowEnd)}</span>
        <span className="font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          View details →
        </span>
      </div>
    </Link>
  );
}
