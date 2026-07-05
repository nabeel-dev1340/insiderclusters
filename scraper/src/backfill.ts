// One-off historical backfill (run manually, not part of the poll loop).
//
//   node --env-file=../.env src/backfill.ts --quarters 2024q2-2026q1
//   node --env-file=../.env src/backfill.ts --crawl 2026-04-01:2026-07-02
//   node --env-file=../.env src/backfill.ts --sweep
//
// Modes compose (bulk → crawl → sweep). All are resumable: filings dedupe on
// accession_number and the sweep skips episodes overlapping existing clusters.
//
// --quarters  Ingest SEC DERA quarterly insider-transaction data sets (fast,
//             covers everything up to the last published quarter). Requires
//             the system `unzip` binary.
// --crawl     Ingest via EDGAR daily form indexes + per-filing fetch (slow,
//             ~1 request per Form 4) — fills the gap after the last data set.
// --sweep     Detect historical cluster episodes over all signal transactions.
//             Clusters are inserted with detected_at = window end and
//             alert_sent_at pre-stamped, so the live alert/digest dispatch
//             never emails historical events.
//
// Storage stays lean on purpose: only filings containing at least one signal
// transaction (open-market buy ≥ threshold with a real ticker) are inserted —
// everything the web layer surfaces (clusters, insider leaderboard) reads
// signal rows only.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { pool } from "@insiderclusters/db";
import { config } from "./config.ts";
import { log } from "./logger.ts";
import { isSignal, isPlausiblePrice, SUSPECT_PRICE_PER_SHARE } from "./signal.ts";
import { getMarketCap, getCurrentPrice, isWithinCap } from "./marketcap.ts";
import { knownAccessions, insertFiling, insertTransaction } from "./db.ts";
import { fetchAndParseFiling } from "./sec/form4.ts";
import type { FeedEntry } from "./sec/feed.ts";
import { fetchDayFilings, dateRange } from "./sec/dailyindex.ts";
import {
  buildBulkFilings,
  submissionUrl,
  type BulkFiling,
} from "./sec/bulkdata.ts";
import { detectEpisodes, type SignalTx } from "./episodes.ts";
import { posthog } from "./posthog.ts";

const execFileP = promisify(execFile);

// --- bulk data sets ----------------------------------------------------------

const BULK_BASE =
  "https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets";

/** "2024q2-2026q1" | "2025q1,2025q2" → ["2024q2", ...] in order. */
export function parseQuarters(spec: string): string[] {
  const one = /^(\d{4})q([1-4])$/;
  if (spec.includes(",")) {
    const parts = spec.toLowerCase().split(",").map((s) => s.trim());
    for (const p of parts) if (!one.test(p)) throw new Error(`Bad quarter: ${p}`);
    return parts;
  }
  const m = spec.toLowerCase().match(/^(\d{4})q([1-4])-(\d{4})q([1-4])$/);
  if (!m) {
    if (one.test(spec.toLowerCase())) return [spec.toLowerCase()];
    throw new Error(`Bad quarters spec: ${spec}`);
  }
  const out: string[] = [];
  let y = Number(m[1]);
  let q = Number(m[2]);
  const endY = Number(m[3]);
  const endQ = Number(m[4]);
  while (y < endY || (y === endY && q <= endQ)) {
    out.push(`${y}q${q}`);
    q++;
    if (q === 5) {
      q = 1;
      y++;
    }
  }
  return out;
}

async function downloadQuarter(quarter: string, dir: string): Promise<string> {
  const zipPath = join(dir, `${quarter}_form345.zip`);
  try {
    await access(zipPath);
    return zipPath; // cached from a previous run
  } catch {
    /* not cached — download */
  }
  const url = `${BULK_BASE}/${quarter}_form345.zip`;
  log.info("downloading data set", { url });
  const res = await fetch(url, {
    headers: { "User-Agent": config.secUserAgent },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));
  return zipPath;
}

async function readZipMember(zipPath: string, member: string): Promise<string> {
  const { stdout } = await execFileP("unzip", ["-p", zipPath, member], {
    maxBuffer: 256 * 1024 * 1024,
    encoding: "utf8",
  });
  return stdout;
}

interface IngestStats {
  filings: number;
  transactions: number;
  skippedKnown: number;
}

/** Insert one backfilled filing + its signal transactions. */
async function ingestFiling(
  entry: FeedEntry,
  filing: Pick<BulkFiling, "issuerCik" | "issuerName" | "ticker" | "owner">,
  signalTxs: BulkFiling["transactions"],
  stats: IngestStats
): Promise<void> {
  const filingId = await insertFiling(entry, {
    documentType: "4",
    issuerCik: filing.issuerCik,
    issuerName: filing.issuerName,
    ticker: filing.ticker,
    owners: [filing.owner],
    transactions: signalTxs,
  });
  if (filingId == null) {
    stats.skippedKnown++;
    return;
  }
  stats.filings++;
  for (const tx of signalTxs) {
    await insertTransaction(filingId, filing.owner, tx, true);
    stats.transactions++;
  }
}

async function runBulk(quarters: string[]): Promise<void> {
  const cacheDir = join(tmpdir(), "insiderclusters-backfill");
  await mkdir(cacheDir, { recursive: true });

  for (const quarter of quarters) {
    const zipPath = await downloadQuarter(quarter, cacheDir);
    const [submissions, reportingOwners, nonDerivTrans] = await Promise.all([
      readZipMember(zipPath, "SUBMISSION.tsv"),
      readZipMember(zipPath, "REPORTINGOWNER.tsv"),
      readZipMember(zipPath, "NONDERIV_TRANS.tsv"),
    ]);

    const filings = buildBulkFilings({ submissions, reportingOwners, nonDerivTrans });

    // Keep only filings with >= 1 signal transaction.
    const withSignals = filings
      .map((f) => ({
        filing: f,
        signalTxs: f.transactions.filter(
          (tx) => tx.transactionDate && isSignal(tx, config.minSignalValue, f.ticker)
        ),
      }))
      .filter((f) => f.signalTxs.length > 0);

    const known = await knownAccessions(
      withSignals.map((f) => f.filing.accessionNumber)
    );

    const stats: IngestStats = { filings: 0, transactions: 0, skippedKnown: 0 };
    for (const { filing, signalTxs } of withSignals) {
      if (known.has(filing.accessionNumber)) {
        stats.skippedKnown++;
        continue;
      }
      const url = submissionUrl(filing.issuerCik, filing.accessionNumber);
      await ingestFiling(
        {
          accessionNumber: filing.accessionNumber,
          submissionUrl: url,
          indexUrl: url.replace(/\.txt$/, "-index.htm"),
          filedAt: filing.filedAt,
        },
        filing,
        signalTxs,
        stats
      );
    }
    log.info("bulk quarter ingested", {
      quarter,
      totalForm4s: filings.length,
      signalFilings: withSignals.length,
      ...stats,
    });
    posthog().capture({
      distinctId: "system",
      event: "backfill quarter ingested",
      properties: {
        quarter,
        total_form4s: filings.length,
        signal_filings: withSignals.length,
        filings_inserted: stats.filings,
        transactions_inserted: stats.transactions,
        skipped_known: stats.skippedKnown,
      },
    });
  }
}

// --- daily-index crawl ---------------------------------------------------------

async function runCrawl(fromIso: string, toIso: string): Promise<void> {
  const days = dateRange(fromIso, toIso);
  // Missing daily indexes are normal for weekends/holidays (max ~4 in a row
  // around a holiday weekend); many more in a row means SEC is refusing us and
  // silently skipping would fake an empty market.
  let consecutiveMisses = 0;
  for (const day of days) {
    const stats: IngestStats = { filings: 0, transactions: 0, skippedKnown: 0 };
    let errors = 0;

    const entries = await fetchDayFilings(day);
    if (entries == null) {
      consecutiveMisses++;
      if (consecutiveMisses > 5) {
        throw new Error(`no daily index for ${consecutiveMisses} days straight (through ${day}) — blocked by SEC?`);
      }
      log.info("no daily index (weekend/holiday)", { day });
      continue;
    }
    consecutiveMisses = 0;
    const known = await knownAccessions(entries.map((e) => e.accessionNumber));
    const fresh = entries.filter((e) => !known.has(e.accessionNumber));

    for (const entry of fresh) {
      try {
        const parsed = await fetchAndParseFiling(entry.submissionUrl);
        const owner = parsed.owners[0];
        if (!owner) continue;
        const signalTxs = parsed.transactions.filter(
          (tx) => tx.transactionDate && isSignal(tx, config.minSignalValue, parsed.ticker)
        );
        if (signalTxs.length === 0) continue;
        await ingestFiling(
          entry,
          {
            issuerCik: parsed.issuerCik ?? "",
            issuerName: parsed.issuerName,
            ticker: parsed.ticker,
            owner,
          },
          signalTxs,
          stats
        );
      } catch (err) {
        errors++;
        log.error("crawl: filing failed", {
          accession: entry.accessionNumber,
          error: (err as Error).message,
        });
      }
    }
    log.info("crawl day done", {
      day,
      listed: entries.length,
      fetched: fresh.length,
      ...stats,
      errors,
    });
  }
}

// --- historical cluster sweep --------------------------------------------------

/**
 * Data-quality pre-pass: demote signal transactions whose price per share is a
 * filer error (see isPlausiblePrice), then delete any cluster referencing a
 * demoted transaction — the main sweep below re-detects whatever legitimately
 * remains for those tickers.
 */
async function demoteImplausibleSignals(): Promise<void> {
  const { rows } = await pool.query<{ id: number; ticker: string; price: string }>(
    `SELECT t.id, f.ticker, t.price_per_share AS price
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
      WHERE t.is_signal AND f.ticker IS NOT NULL AND t.price_per_share > $1
      ORDER BY f.ticker`,
    [SUSPECT_PRICE_PER_SHARE]
  );
  if (rows.length === 0) return;

  const demote: number[] = [];
  const priceByTicker = new Map<string, number | null>();
  for (const r of rows) {
    if (!priceByTicker.has(r.ticker)) {
      priceByTicker.set(r.ticker, await getCurrentPrice(r.ticker));
    }
    if (!isPlausiblePrice(Number(r.price), priceByTicker.get(r.ticker)!)) {
      demote.push(r.id);
    }
  }
  if (demote.length === 0) return;

  await pool.query(`UPDATE transactions SET is_signal = FALSE WHERE id = ANY($1)`, [
    demote,
  ]);
  // Clusters must reference signal transactions only — repair the invariant.
  const deleted = await pool.query<{ ticker: string }>(
    `DELETE FROM clusters c
      WHERE EXISTS (
        SELECT 1 FROM transactions t
         WHERE t.id = ANY(c.transaction_ids) AND NOT t.is_signal
      )
      RETURNING ticker`
  );
  log.info("implausible signals demoted", {
    suspect: rows.length,
    demoted: demote.length,
    clustersDeleted: deleted.rows.map((r) => r.ticker),
  });
}

async function runSweep(): Promise<void> {
  await demoteImplausibleSignals();
  const { rows } = await pool.query<{
    id: number;
    ticker: string;
    issuer_name: string;
    insider_key: string;
    date: string;
    value: string | null;
  }>(
    `SELECT t.id, f.ticker, f.issuer_name,
            COALESCE(t.insider_cik, t.insider_name) AS insider_key,
            t.transaction_date::text AS date, t.value
       FROM transactions t
       JOIN filings f ON f.id = t.filing_id
      WHERE t.is_signal AND f.ticker IS NOT NULL
      ORDER BY f.ticker, t.transaction_date`
  );

  const byTicker = new Map<string, { issuerName: string; txs: SignalTx[] }>();
  for (const r of rows) {
    let group = byTicker.get(r.ticker);
    if (!group) {
      group = { issuerName: r.issuer_name, txs: [] };
      byTicker.set(r.ticker, group);
    }
    group.issuerName = r.issuer_name; // last filing's name wins (most recent)
    group.txs.push({
      id: r.id,
      insiderKey: r.insider_key,
      date: r.date,
      value: r.value == null ? 0 : Number(r.value),
    });
  }

  let created = 0;
  let skippedExisting = 0;
  let skippedCap = 0;

  for (const [ticker, group] of byTicker) {
    const episodes = detectEpisodes(group.txs, config.clusterWindowDays);
    if (episodes.length === 0) continue;

    // Market-cap gate uses the *current* cap (historical caps aren't available
    // from our source). Delisted/unknown tickers pass as null, same as live.
    let marketCap: number | null = null;
    let capChecked = false;

    for (const ep of episodes) {
      const overlap = await pool.query(
        `SELECT 1 FROM clusters
          WHERE ticker = $1 AND window_start <= $2::date AND window_end >= $3::date
          LIMIT 1`,
        [ticker, ep.windowEnd, ep.windowStart]
      );
      if (overlap.rows[0]) {
        skippedExisting++;
        continue;
      }

      if (!capChecked) {
        marketCap = await getMarketCap(ticker);
        capChecked = true;
      }
      if (!isWithinCap(marketCap)) {
        skippedCap++;
        continue;
      }

      // detected_at = window end (historically truthful ordering in feeds);
      // alert_sent_at stamped so realtime dispatch never picks these up.
      await pool.query(
        `INSERT INTO clusters
           (ticker, issuer_name, market_cap, insider_count, total_value,
            window_start, window_end, transaction_ids, detected_at, alert_sent_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $7::date::timestamptz, now())`,
        [
          ticker,
          group.issuerName,
          marketCap,
          ep.insiderCount,
          ep.totalValue,
          ep.windowStart,
          ep.windowEnd,
          ep.transactionIds,
        ]
      );
      created++;
      log.info("historical cluster", {
        ticker,
        window: `${ep.windowStart}..${ep.windowEnd}`,
        insiders: ep.insiderCount,
        totalValue: Math.round(ep.totalValue),
      });
    }
  }

  log.info("sweep complete", {
    tickers: byTicker.size,
    created,
    skippedExisting,
    skippedCap,
  });
  posthog().capture({
    distinctId: "system",
    event: "backfill sweep complete",
    properties: {
      tickers: byTicker.size,
      clusters_created: created,
      skipped_existing: skippedExisting,
      skipped_cap: skippedCap,
    },
  });
}

// --- CLI -------------------------------------------------------------------------

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? (process.argv[i + 1] ?? null) : null;
}

async function main(): Promise<void> {
  const quarters = argValue("--quarters");
  const crawl = argValue("--crawl");
  const sweep = process.argv.includes("--sweep");

  if (!quarters && !crawl && !sweep) {
    console.error(
      "Usage: backfill.ts [--quarters 2024q2-2026q1] [--crawl 2026-04-01:2026-07-02] [--sweep]"
    );
    process.exit(1);
  }

  if (quarters) await runBulk(parseQuarters(quarters));
  if (crawl) {
    const m = crawl.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
    if (!m) throw new Error(`Bad --crawl range: ${crawl}`);
    await runCrawl(m[1]!, m[2]!);
  }
  if (sweep) await runSweep();

  await posthog().shutdown();
  await pool.end();
}

// Only run when executed directly (tests import parseQuarters from here).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    log.error("backfill failed", { error: (err as Error).message });
    process.exit(1);
  });
}
