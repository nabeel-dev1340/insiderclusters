// Feature 1.2 — Form 4 filing parser (pure).
//
// This module is intentionally free of network/DB/config imports so it can be
// unit-tested against fixture files without any environment. The network
// wrapper lives in sec/form4.ts.

import { XMLParser } from "fast-xml-parser";

export interface ParsedOwner {
  cik: string | null;
  name: string;
  role: string | null;
}

export interface ParsedTransaction {
  securityTitle: string | null;
  transactionCode: string; // P, S, A, M, F, ...
  transactionDate: string; // YYYY-MM-DD
  shares: number | null;
  pricePerShare: number | null;
  value: number | null; // shares * pricePerShare
  acquiredDisposed: string | null; // A or D
}

export interface ParsedFiling {
  documentType: string | null;
  issuerCik: string | null;
  issuerName: string;
  ticker: string | null;
  owners: ParsedOwner[];
  transactions: ParsedTransaction[];
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // keep values as strings; we coerce explicitly
  trimValues: true,
});

/** Extract the <ownershipDocument> block from the full SGML submission .txt. */
export function extractOwnershipXml(submissionTxt: string): string | null {
  const start = submissionTxt.indexOf("<ownershipDocument>");
  const end = submissionTxt.indexOf("</ownershipDocument>");
  if (start === -1 || end === -1) return null;
  return submissionTxt.slice(start, end + "</ownershipDocument>".length);
}

/** A field in the XML is often wrapped in a <value> element. Unwrap it. */
function val(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node === "" ? null : node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "value" in (node as Record<string, unknown>)) {
    return val((node as Record<string, unknown>).value);
  }
  return null;
}

function toNumber(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Issuers without a listed symbol frequently type a placeholder into the Form 4
// <issuerTradingSymbol> field ("NONE", "N/A", "-", etc.) rather than leaving it
// blank. Left as-is these masquerade as real tickers and produce junk clusters
// on non-tradable entities (e.g. private fund LPs). Normalize any such
// placeholder — or anything that isn't a plausible ticker symbol — to null so
// the pipeline's `if (parsed.ticker)` guard drops it before cluster detection.
const TICKER_PLACEHOLDERS = new Set([
  "NONE", "N/A", "NA", "N.A.", "NULL", "NIL", "NONE.", "NOSYMBOL",
  "-", "--", "---", "—", ".", "..", "*",
]);

export function normalizeTicker(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase();
  if (t === "" || TICKER_PLACEHOLDERS.has(t)) return null;
  // A real symbol is uppercase alphanumerics, optionally with a "." or "-"
  // suffix (e.g. BRK.B, ABC-U), 1–10 chars, and must contain a letter.
  if (!/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(t) || !/[A-Z]/.test(t)) return null;
  return t;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function deriveRole(rel: Record<string, unknown> | undefined): string | null {
  if (!rel) return null;
  const roles: string[] = [];
  const truthy = (v: unknown) => val(v) === "1" || val(v) === "true";
  if (truthy(rel.isDirector)) roles.push("Director");
  if (truthy(rel.isOfficer)) roles.push(val(rel.officerTitle) ?? "Officer");
  if (truthy(rel.isTenPercentOwner)) roles.push("10% Owner");
  if (truthy(rel.isOther)) roles.push(val(rel.otherText) ?? "Other");
  return roles.length ? roles.join(", ") : null;
}

/** Parse a raw Form 4 XML (or full submission .txt) into a structured filing. */
export function parseForm4Xml(xmlOrSubmission: string): ParsedFiling {
  const xml = xmlOrSubmission.includes("<ownershipDocument>")
    ? extractOwnershipXml(xmlOrSubmission)!
    : xmlOrSubmission;

  const doc = parser.parse(xml) as { ownershipDocument?: Record<string, unknown> };
  const od = doc.ownershipDocument;
  if (!od) throw new Error("No <ownershipDocument> element found");

  const issuer = (od.issuer ?? {}) as Record<string, unknown>;
  const owners: ParsedOwner[] = asArray(
    od.reportingOwner as Record<string, unknown> | Record<string, unknown>[]
  ).map((o) => {
    const idNode = (o.reportingOwnerId ?? {}) as Record<string, unknown>;
    const relNode = o.reportingOwnerRelationship as Record<string, unknown> | undefined;
    return {
      cik: val(idNode.rptOwnerCik),
      name: val(idNode.rptOwnerName) ?? "Unknown",
      role: deriveRole(relNode),
    };
  });

  const table = (od.nonDerivativeTable ?? {}) as Record<string, unknown>;
  const transactions: ParsedTransaction[] = asArray(
    table.nonDerivativeTransaction as Record<string, unknown> | Record<string, unknown>[]
  ).map((t) => {
    const coding = (t.transactionCoding ?? {}) as Record<string, unknown>;
    const amounts = (t.transactionAmounts ?? {}) as Record<string, unknown>;
    const shares = toNumber(val(amounts.transactionShares));
    const price = toNumber(val(amounts.transactionPricePerShare));
    const value = shares != null && price != null ? shares * price : null;
    return {
      securityTitle: val(t.securityTitle),
      transactionCode: (val(coding.transactionCode) ?? "").trim(),
      transactionDate: val(t.transactionDate) ?? "",
      shares,
      pricePerShare: price,
      value,
      acquiredDisposed: val(amounts.transactionAcquiredDisposedCode),
    };
  });

  return {
    documentType: val(od.documentType),
    issuerCik: val(issuer.issuerCik),
    issuerName: val(issuer.issuerName) ?? "Unknown",
    ticker: normalizeTicker(val(issuer.issuerTradingSymbol)),
    owners,
    transactions,
  };
}
