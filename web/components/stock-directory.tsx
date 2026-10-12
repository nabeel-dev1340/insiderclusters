"use client";

import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickers
      .filter((t) => `${t.ticker} ${t.issuerName}`.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "name"
          ? a.ticker.localeCompare(b.ticker)
          : sort === "clusters"
            ? b.totalClusters - a.totalClusters
            : new Date(b.lastDetectedAt).getTime() -
              new Date(a.lastDetectedAt).getTime(),
      );
  }, [tickers, query, sort]);
  return (
    <section aria-label="Stock directory">
      <div className="directory-tools">
        <label className="sr-only" htmlFor="stock-search">
          Search stocks by ticker or company
        </label>
        <input
          id="stock-search"
          type="search"
          autoComplete="off"
          placeholder="Search a ticker or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="sr-only" htmlFor="stock-sort">
          Sort stocks
        </label>
        <select
          id="stock-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Latest activity</option>
          <option value="clusters">Most clusters</option>
          <option value="name">Ticker A–Z</option>
        </select>
        <span className="directory-result-count" role="status">
          {formatNumber(matches.length)}{" "}
          {matches.length === 1 ? "company" : "companies"}
        </span>
      </div>
      <ul>
        {matches.map((t) => (
          <li key={t.ticker}>
            <Link href={tickerPath(t.ticker)} className="directory-record">
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
      {!matches.length && (
        <div className="py-12">
          <h2 className="text-2xl">No companies match “{query}”.</h2>
          <p className="mt-3 text-sm text-muted">
            Try a different company name or ticker.
          </p>
          <button className="text-link mt-4" onClick={() => setQuery("")}>
            Clear search →
          </button>
        </div>
      )}
    </section>
  );
}
