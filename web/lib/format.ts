// Presentation helpers for money, market cap, counts, and date ranges.

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
