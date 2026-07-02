// Scraper entry point (PRD Phase 1).
//
// Runs runCycle() on a fixed interval forever. A failed cycle is logged and the
// loop continues after a backoff — the service must never crash on transient
// EDGAR/network errors (Feature 1.6). Supports a one-shot mode for testing.

import { pool } from "@insiderclusters/db";
import { config } from "./config.ts";
import { log } from "./logger.ts";
import { runCycle } from "./pipeline.ts";
import { posthog } from "./posthog.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let shuttingDown = false;

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  log.info("scraper starting", {
    once,
    pollIntervalSeconds: config.pollIntervalSeconds,
    minSignalValue: config.minSignalValue,
    maxMarketCap: config.maxMarketCap,
    clusterWindowDays: config.clusterWindowDays,
  });

  let consecutiveFailures = 0;

  do {
    try {
      await runCycle();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      // Exponential backoff on repeated whole-cycle failures, capped.
      const backoff = Math.min(
        config.pollIntervalSeconds * 1000,
        1000 * 2 ** consecutiveFailures
      );
      log.error("cycle failed, backing off", {
        consecutiveFailures,
        backoffMs: backoff,
        error: (err as Error).message,
      });
      if (!once) await sleep(backoff);
    }

    if (once || shuttingDown) break;
    await sleep(config.pollIntervalSeconds * 1000);
  } while (!shuttingDown);

  await posthog().shutdown();
  await pool.end();
  log.info("scraper stopped");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (shuttingDown) process.exit(1);
    log.info("shutdown signal received", { signal: sig });
    shuttingDown = true;
  });
}

main().catch((err) => {
  log.error("fatal", { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
