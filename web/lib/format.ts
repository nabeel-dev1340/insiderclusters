// Presentation helpers for money, market cap, counts, and date ranges.
import type { RoleMix } from "./clusters";

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Per-share prices are small; keep cents so "$8.85" doesn't collapse to "$9".
const USD_PRICE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("en-US");

export function formatMoneyCompact(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return USD_COMPACT.format(n);
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return USD_FULL.format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return NUM.format(n);
}

export function formatMarketCap(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "Unknown";
  return USD_COMPACT.format(n);
}

/** Per-share price with cents, e.g. "$8.85". */
export function formatSharePrice(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return USD_PRICE.format(n);
}

/**
 * A ratio (e.g. 0.0022) rendered as a percent ("0.22%"). Uses more decimals for
 * small values so a micro-cap buy that's a fraction of a percent stays legible.
 */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  const pct = fraction * 100;
  if (pct > 0 && pct < 0.01) return "<0.01%";
  const digits = Math.abs(pct) < 1 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
}

/** Like formatPercent but always signed ("+12.4%" / "−8.1%") — for returns. */
export function formatSignedPercent(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const digits = Math.abs(pct) < 1 && pct !== 0 ? 2 : 1;
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

/**
 * "2 officers · 1 director" role-mix label from a cluster's bucketed counts.
 * Buckets are mutually exclusive (each insider is counted once by seniority),
 * so the parts sum to the cluster's distinct-insider count.
 */
export function formatRoleMix(mix: RoleMix | null | undefined): string {
  if (!mix) return "";
  const parts: string[] = [];
  const add = (n: number, singular: string, plural = `${singular}s`) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? singular : plural}`);
  };
  add(mix.officer, "officer");
  add(mix.director, "director");
  add(mix.owner, "10% owner");
  add(mix.other, "insider");
  return parts.join(" · ");
}

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return DATE.format(toDate(d));
}

/** "Jun 20 – Jul 1, 2026" style window label. */
export function formatDateRange(
  start: Date | string,
  end: Date | string
): string {
  const s = toDate(start);
  const e = toDate(end);
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${DATE_SHORT.format(s)} – ${DATE.format(e)}`;
  }
  return `${DATE.format(s)} – ${DATE.format(e)}`;
}

// C-suite / named-officer titles vs. plain directors and passive 10% owners.
// Kept in sync with the SQL predicate in lib/clusters.ts so the per-transaction
// emphasis on the detail page matches the cluster-level "High conviction" flag.
const SENIOR_ROLE_RE =
  /\b(chief|officer|president|principal|vice[ -]?president|ceo|cfo|coo|cao|cio|cto|cmo|cro|caio|vp|svp|evp)\b/i;

/** True when a Form 4 role string denotes a C-suite / executive officer. */
export function isSeniorInsiderRole(role: string | null | undefined): boolean {
  return role != null && SENIOR_ROLE_RE.test(role);
}

/** "3h ago", "2d ago", "just now". */
export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "";
  const then = toDate(d).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
