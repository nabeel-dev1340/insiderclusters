import Link from "next/link";
import type { ClusterSummary } from "@/lib/clusters";
import { tickerPath } from "@/lib/site";
import { formatMoneyCompact } from "@/lib/format";

// A live "market tape" of recently detected clusters that scrolls under the
// header. It's the single most credible thing on the page — real tickers we
// actually surfaced, impossible to fake — and it costs nothing: pure CSS
// marquee, server-rendered, no client JS. The track is rendered twice so the
// -50% translate loops seamlessly; the duplicate is aria-hidden.
export function TickerTape({ clusters }: { clusters: ClusterSummary[] }) {
  if (clusters.length < 4) return null;

  return (
    <div className="relative border-b border-border bg-surface/60 backdrop-blur-sm">
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max motion-safe:animate-marquee-slow motion-reduce:animate-none">
          <TapeRow clusters={clusters} />
          <TapeRow clusters={clusters} ariaHidden />
        </div>
      </div>
    </div>
  );
}

function TapeRow({
  clusters,
  ariaHidden,
}: {
  clusters: ClusterSummary[];
  ariaHidden?: boolean;
}) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex shrink-0 items-center"
    >
      {clusters.map((c) => (
        <li key={`${ariaHidden ? "d" : "o"}-${c.id}`} className="shrink-0">
          <Link
            href={tickerPath(c.ticker)}
            tabIndex={ariaHidden ? -1 : undefined}
            className="group flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-surface-muted/60"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            <span className="font-mono font-semibold tracking-tight">
              {c.ticker}
            </span>
            <span className="text-muted">{c.insiderCount} insiders</span>
            <span className="font-medium tabular-nums text-accent">
              {formatMoneyCompact(c.totalValue)}
            </span>
            <span className="text-border" aria-hidden>
              |
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
