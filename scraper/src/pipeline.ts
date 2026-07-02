// Orchestrates one poll cycle: feed -> parse -> persist -> signal -> clusters.
// Every per-filing step is wrapped so a single malformed filing is logged and
// skipped, never crashing the cycle (Feature 1.2 / 1.6 acceptance).

import { config } from "./config.ts";
import { log } from "./logger.ts";
import { fetchCurrentFilings, type FeedEntry } from "./sec/feed.ts";
import { fetchAndParseFiling } from "./sec/form4.ts";
import { knownAccessions, insertFiling, insertTransaction } from "./db.ts";
import { isSignal } from "./signal.ts";
import { getMarketCap, isWithinCap } from "./marketcap.ts";
import { detectCluster } from "./clusters.ts";
import { dispatchAlerts } from "./alerts.ts";

export interface CycleStats {
  fetched: number;
  newFilings: number;
  transactions: number;
  signals: number;
  clustersCreated: number;
  clustersUpdated: number;
  alertsSent: number;
  digestsSent: number;
  errors: number;
}

async function processFiling(
  entry: FeedEntry,
  signalTickers: Set<string>,
  stats: CycleStats
): Promise<void> {
  const parsed = await fetchAndParseFiling(entry.submissionUrl);

  // Only Form 4 ownership docs with a primary reporting owner are usable.
  const owner = parsed.owners[0];
  if (!owner) {
    log.warn("filing has no reporting owner, skipping", {
      accession: entry.accessionNumber,
    });
    return;
  }

  const filingId = await insertFiling(entry, parsed);
  if (filingId == null) return; // raced/duplicate

  stats.newFilings++;

  for (const tx of parsed.transactions) {
    if (!tx.transactionDate) continue; // malformed row
    const signal = isSignal(tx, config.minSignalValue, parsed.ticker);
    await insertTransaction(filingId, owner, tx, signal);
    stats.transactions++;
    if (signal) {
      stats.signals++;
      if (parsed.ticker) signalTickers.add(parsed.ticker);
    }
  }
}

export async function runCycle(): Promise<CycleStats> {
  const stats: CycleStats = {
    fetched: 0,
    newFilings: 0,
    transactions: 0,
    signals: 0,
    clustersCreated: 0,
    clustersUpdated: 0,
    alertsSent: 0,
    digestsSent: 0,
    errors: 0,
  };

  const entries = await fetchCurrentFilings();
  stats.fetched = entries.length;

  const known = await knownAccessions(entries.map((e) => e.accessionNumber));
  const fresh = entries.filter((e) => !known.has(e.accessionNumber));

  const signalTickers = new Set<string>();

  for (const entry of fresh) {
    try {
      await processFiling(entry, signalTickers, stats);
    } catch (err) {
      stats.errors++;
      log.error("failed to process filing", {
        accession: entry.accessionNumber,
        url: entry.submissionUrl,
        error: (err as Error).message,
      });
    }
  }

  // Cluster detection only for tickers that got new signals this cycle.
  for (const ticker of signalTickers) {
    try {
      const marketCap = await getMarketCap(ticker);
      if (!isWithinCap(marketCap)) {
        log.info("ticker above market-cap ceiling, skipping cluster check", {
          ticker,
          marketCap,
        });
        continue;
      }
      const result = await detectCluster(ticker, marketCap);
      if (result?.created) stats.clustersCreated++;
      else if (result) stats.clustersUpdated++;
    } catch (err) {
      stats.errors++;
      log.error("cluster detection failed", { ticker, error: (err as Error).message });
    }
  }

  // Email dispatch (Phase 5). Gated on RESEND_API_KEY so deploying before email
  // is configured never consumes the pending-cluster backlog (dispatch stamps
  // alert_sent_at, which is irreversible). Isolated in try/catch so a mail
  // failure never affects scraping — the next cycle retries anything undispatched.
  if (config.resendApiKey) {
    try {
      const dispatch = await dispatchAlerts();
      stats.alertsSent = dispatch.realtimeEmails;
      stats.digestsSent = dispatch.digestEmails;
      if (dispatch.emailFailures) stats.errors += dispatch.emailFailures;
    } catch (err) {
      stats.errors++;
      log.error("alert dispatch failed", { error: (err as Error).message });
    }
  }

  log.info("cycle complete", { ...stats });
  return stats;
}
