// Entry point for the scraper service (PRD Phase 1).
//
// This is a scaffold placeholder. Phase 1 features will be built here in order:
//   1.1 EDGAR poller        — poll getcurrent feed every POLL_INTERVAL_SECONDS
//   1.2 Filing parser       — fetch submission .txt, parse embedded Form 4 XML
//   1.3 Signal filter       — mark is_signal when code=P and value >= MIN_SIGNAL_VALUE
//   1.4 Market cap enrich    — fetch + 24h cache; gate on MAX_MARKET_CAP
//   1.5 Cluster detection   — >=2 distinct insiders, same ticker, rolling window
//   1.6 Logging & resilience — JSON logs, exponential backoff, never crash
//
// The scraper is intentionally standalone: it talks to Postgres via
// @insiderclusters/db and has no dependency on the web app.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const config = {
    userAgent: requireEnv("SEC_USER_AGENT"),
    minSignalValue: Number(process.env.MIN_SIGNAL_VALUE ?? 100_000),
    maxMarketCap: Number(process.env.MAX_MARKET_CAP ?? 2_000_000_000),
    clusterWindowDays: Number(process.env.CLUSTER_WINDOW_DAYS ?? 15),
    pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS ?? 300),
  };

  console.log("[scraper] scaffold ready. Phase 1 not yet implemented.");
  console.log("[scraper] config:", config);
}

main().catch((err) => {
  console.error("[scraper] fatal:", err);
  process.exit(1);
});
