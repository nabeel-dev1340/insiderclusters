// Thin Postgres repository for the scraper. All SQL lives here; higher-level
// modules (pipeline, clusters) call these functions.

import { pool } from "@insiderclusters/db";
import type { FeedEntry } from "./sec/feed.ts";
import type { ParsedFiling, ParsedTransaction, ParsedOwner } from "./sec/form4.ts";

/** Which of the given accession numbers already exist in `filings`. */
export async function knownAccessions(accessions: string[]): Promise<Set<string>> {
  if (accessions.length === 0) return new Set();
  const { rows } = await pool.query<{ accession_number: string }>(
    `SELECT accession_number FROM filings WHERE accession_number = ANY($1)`,
    [accessions]
  );
  return new Set(rows.map((r) => r.accession_number));
}

/**
 * Insert a filing row. Returns the new filing id, or null if another worker
 * already inserted this accession (unique-violation race — safe to skip).
 */
export async function insertFiling(
  entry: FeedEntry,
  parsed: ParsedFiling
): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO filings
       (accession_number, issuer_cik, issuer_name, ticker, filed_at, raw_xml_url, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (accession_number) DO NOTHING
     RETURNING id`,
    [
      entry.accessionNumber,
      parsed.issuerCik ?? "",
      parsed.issuerName,
      parsed.ticker,
      entry.filedAt.toISOString(),
      entry.submissionUrl,
    ]
  );
  return rows[0]?.id ?? null;
}

/** Insert one parsed transaction row and return its id. */
export async function insertTransaction(
  filingId: number,
  owner: ParsedOwner,
  tx: ParsedTransaction,
  isSignal: boolean
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO transactions
       (filing_id, insider_cik, insider_name, insider_role, transaction_code,
        transaction_date, shares, price_per_share, value, is_signal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      filingId,
      owner.cik,
      owner.name,
      owner.role,
      tx.transactionCode,
      tx.transactionDate,
      tx.shares,
      tx.pricePerShare,
      tx.value,
      isSignal,
    ]
  );
  return rows[0]!.id;
}
