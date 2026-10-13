import Link from "next/link";
import type { TickerDirectoryEntry } from "@/lib/clusters";
import { tickerPath } from "@/lib/site";
import { formatDate, formatNumber } from "@/lib/format";
import { ConvictionBadge } from "@/components/conviction-badge";

export function StockDirectory({
  tickers,
}: {
  tickers: TickerDirectoryEntry[];
}) {
  return (
    <section aria-label="Stock directory">
      <ul>
        {tickers.map((t) => (
          <li key={t.ticker}>
            <Link
              prefetch={false}
              href={tickerPath(t.ticker)}
              className="directory-record"
            >
              <div>
                <span className="record-name">{t.ticker}</span>
                <p className="record-company">{t.issuerName}</p>
                {t.hasSeniorInsider && (
                  <ConvictionBadge size="xs" className="mt-2" />
                )}
              </div>
              <div className="record-number">
                {formatNumber(t.totalClusters)}
                <small>Detected clusters</small>
              </div>
              <div className="record-number">
                {formatNumber(t.insiderCount)}
                <small>Distinct insiders</small>
              </div>
              <div className="record-date text-sm">
                {formatDate(t.lastDetectedAt)}
                <small>Last detected</small>
              </div>
              <span aria-hidden className="text-accent">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
