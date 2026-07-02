// EDGAR daily form index — lists every filing for one day.
// https://www.sec.gov/Archives/edgar/daily-index/{year}/QTR{q}/form.{yyyymmdd}.idx
//
// Used by the backfill to enumerate Form 4s for days not yet covered by a
// DERA quarterly data set. Weekends/holidays have no index (404) — that's a
// normal empty day, not an error.

import { fetchText, HttpError } from "./client.ts";
import type { FeedEntry } from "./feed.ts";

export function dailyIndexUrl(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  const quarter = Math.floor((Number(m) - 1) / 3) + 1;
  return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${quarter}/form.${y}${m}${d}.idx`;
}

/**
 * Parse a form.idx body into Form 4 feed entries. Lines are column-aligned:
 *   Form Type   Company Name   CIK   Date Filed   File Name
 * We match on exact form type "4" (amendments 4/A are skipped — consistent
 * with the bulk backfill, which drops them to avoid double-counting).
 */
export function parseFormIndex(body: string, filedAt: Date): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const seen = new Set<string>();
  for (const line of body.split("\n")) {
    if (!/^4\s/.test(line)) continue; // exact "4" + whitespace, not 40-F/424B/4/A
    const m = line.match(/(edgar\/data\/\d+\/(\S+)\.txt)\s*$/);
    if (!m) continue;
    const accessionNumber = m[2]!;
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber)) continue;
    if (seen.has(accessionNumber)) continue;
    seen.add(accessionNumber);
    const submissionUrl = `https://www.sec.gov/Archives/${m[1]}`;
    entries.push({
      accessionNumber,
      submissionUrl,
      indexUrl: submissionUrl.replace(/\.txt$/, "-index.htm"),
      filedAt,
    });
  }
  return entries;
}

/** Form 4 entries filed on `isoDate` (empty on weekends/holidays). */
export async function fetchDayFilings(isoDate: string): Promise<FeedEntry[]> {
  let body: string;
  try {
    body = await fetchText(dailyIndexUrl(isoDate));
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return [];
    throw err;
  }
  return parseFormIndex(body, new Date(`${isoDate}T00:00:00Z`));
}

/** Inclusive ISO date range, oldest first. */
export function dateRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${fromIso}T00:00:00Z`);
    t <= Date.parse(`${toIso}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
