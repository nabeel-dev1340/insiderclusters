// Feature 1.1 — EDGAR "getcurrent" poller.
//
// Polls the Atom variant of the getcurrent feed (structured XML, far easier
// than scraping the HTML page). Each accession appears twice in the feed — once
// under the Reporting person and once under the Issuer — so we dedupe by
// accession number here before any downstream work.

import { XMLParser } from "fast-xml-parser";
import { config } from "../config.ts";
import { fetchText } from "./client.ts";

const FEED_URL =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=include&count=100&output=atom";

export interface FeedEntry {
  accessionNumber: string; // e.g. 0001193125-26-291233
  indexUrl: string; // ...-index.htm
  submissionUrl: string; // full submission .txt (contains embedded XML)
  filedAt: Date;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/** Derive the full-submission .txt URL from an EDGAR index URL. */
function submissionUrlFromIndex(indexUrl: string): string {
  // .../0000950103-26-009883-index.htm -> .../0000950103-26-009883.txt
  return indexUrl.replace(/-index\.html?$/i, ".txt");
}

function accessionFromId(id: string): string | null {
  const m = id.match(/accession-number=([\d-]+)/);
  return m ? m[1]! : null;
}

/** Fetch and parse the current Form 4 feed into unique, dated entries. */
export async function fetchCurrentFilings(): Promise<FeedEntry[]> {
  const xml = await fetchText(FEED_URL);
  const doc = parser.parse(xml) as {
    feed?: { entry?: unknown };
  };

  const rawEntries = doc.feed?.entry;
  if (!rawEntries) return [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

  const byAccession = new Map<string, FeedEntry>();

  for (const e of entries as Array<Record<string, unknown>>) {
    const id = typeof e.id === "string" ? e.id : "";
    const accessionNumber = accessionFromId(id);
    if (!accessionNumber) continue;
    if (byAccession.has(accessionNumber)) continue; // dedupe issuer/reporting pair

    const link = e.link as { "@_href"?: string } | Array<{ "@_href"?: string }>;
    const href = Array.isArray(link) ? link[0]?.["@_href"] : link?.["@_href"];
    if (!href) continue;
    const indexUrl = href.startsWith("http") ? href : `https://www.sec.gov${href}`;

    const updated = typeof e.updated === "string" ? e.updated : undefined;
    const filedAt = updated ? new Date(updated) : new Date();

    byAccession.set(accessionNumber, {
      accessionNumber,
      indexUrl,
      submissionUrl: submissionUrlFromIndex(indexUrl),
      filedAt,
    });
  }

  return [...byAccession.values()].slice(0, config.maxFilingsPerCycle);
}
