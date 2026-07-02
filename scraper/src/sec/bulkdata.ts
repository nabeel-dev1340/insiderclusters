// SEC DERA "Insider Transactions Data Sets" — quarterly bulk TSVs.
// https://www.sec.gov/dera/data/form-345
//
// One zip per quarter (SUBMISSION / REPORTINGOWNER / NONDERIV_TRANS ...). This
// module is pure TSV → structured parsing so it can be unit-tested on string
// fixtures; download/unzip lives in backfill.ts. Output mirrors the live
// parser's shapes (ParsedOwner / ParsedTransaction) so the rest of the
// pipeline — signal filter, DB inserts, role-based conviction SQL in the web
// layer — treats backfilled rows identically to live ones.

import { normalizeTicker, type ParsedOwner, type ParsedTransaction } from "../form4.parse.ts";

export interface BulkFiling {
  accessionNumber: string;
  filedAt: Date;
  issuerCik: string;
  issuerName: string;
  ticker: string | null;
  owner: ParsedOwner; // first reporting owner, like pipeline's owners[0]
  transactions: ParsedTransaction[];
}

/** Parse a TSV file into row objects keyed by the header line. */
export function parseTsv(content: string): Array<Record<string, string>> {
  const lines = content.split("\n");
  const header = lines[0]?.replace(/\r$/, "").split("\t") ?? [];
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.replace(/\r$/, "");
    if (line === "") continue;
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) row[header[c]!] = cells[c] ?? "";
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** DERA date "31-MAR-2026" → ISO "2026-03-31". Null when malformed. */
export function parseDeraDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i);
  if (!m) return null;
  const month = MONTHS[m[2]!.toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]}`;
}

/**
 * Rebuild the live parser's role text from the dataset's pre-derived columns
 * (RPTOWNER_RELATIONSHIP is "Director,Officer,TenPercentOwner,Other" tokens).
 * Must stay in sync with deriveRole in form4.parse.ts — the web layer's
 * conviction/role-mix SQL matches on this text.
 */
export function roleFromRelationship(
  relationship: string,
  officerTitle: string,
  otherText: string
): string | null {
  const tokens = new Set(
    relationship.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const roles: string[] = [];
  if (tokens.has("director")) roles.push("Director");
  if (tokens.has("officer")) roles.push(officerTitle.trim() || "Officer");
  if (tokens.has("tenpercentowner")) roles.push("10% Owner");
  if (tokens.has("other")) roles.push(otherText.trim() || "Other");
  return roles.length ? roles.join(", ") : null;
}

function toNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface BulkTsvs {
  submissions: string;
  reportingOwners: string;
  nonDerivTrans: string;
}

/**
 * Join the three TSVs into per-filing structures. Only original Form 4s are
 * kept: 3/5 carry no open-market purchases we track, and 4/A amendments would
 * double-count transactions that already appear under the original accession.
 */
export function buildBulkFilings(tsvs: BulkTsvs): BulkFiling[] {
  // First reporting owner per accession (mirrors pipeline's owners[0]).
  const ownerByAccession = new Map<string, ParsedOwner>();
  for (const r of parseTsv(tsvs.reportingOwners)) {
    const acc = r.ACCESSION_NUMBER!;
    if (ownerByAccession.has(acc)) continue;
    ownerByAccession.set(acc, {
      cik: r.RPTOWNERCIK?.trim() || null,
      name: r.RPTOWNERNAME?.trim() || "Unknown",
      role: roleFromRelationship(
        r.RPTOWNER_RELATIONSHIP ?? "",
        r.RPTOWNER_TITLE ?? "",
        r.RPTOWNER_TXT ?? ""
      ),
    });
  }

  const txsByAccession = new Map<string, ParsedTransaction[]>();
  for (const r of parseTsv(tsvs.nonDerivTrans)) {
    const acc = r.ACCESSION_NUMBER!;
    const date = parseDeraDate(r.TRANS_DATE ?? "");
    if (!date) continue;
    const shares = toNumber(r.TRANS_SHARES ?? "");
    const price = toNumber(r.TRANS_PRICEPERSHARE ?? "");
    const tx: ParsedTransaction = {
      securityTitle: r.SECURITY_TITLE?.trim() || null,
      transactionCode: (r.TRANS_CODE ?? "").trim(),
      transactionDate: date,
      shares,
      pricePerShare: price,
      value: shares != null && price != null ? shares * price : null,
      acquiredDisposed: r.TRANS_ACQUIRED_DISP_CD?.trim() || null,
    };
    const list = txsByAccession.get(acc);
    if (list) list.push(tx);
    else txsByAccession.set(acc, [tx]);
  }

  const filings: BulkFiling[] = [];
  for (const r of parseTsv(tsvs.submissions)) {
    if (r.DOCUMENT_TYPE?.trim() !== "4") continue;
    const acc = r.ACCESSION_NUMBER!;
    const owner = ownerByAccession.get(acc);
    const transactions = txsByAccession.get(acc);
    if (!owner || !transactions) continue; // same skip as pipeline's owner guard
    const filedIso = parseDeraDate(r.FILING_DATE ?? "");
    if (!filedIso) continue;
    filings.push({
      accessionNumber: acc,
      filedAt: new Date(`${filedIso}T00:00:00Z`),
      issuerCik: r.ISSUERCIK?.trim() ?? "",
      issuerName: r.ISSUERNAME?.trim() || "Unknown",
      ticker: normalizeTicker(r.ISSUERTRADINGSYMBOL),
      owner,
      transactions,
    });
  }
  return filings;
}

/** EDGAR full-submission URL for an accession (same shape db.ts stores). */
export function submissionUrl(issuerCik: string, accession: string): string {
  const cik = String(Number(issuerCik) || issuerCik);
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/${accession}.txt`;
}
