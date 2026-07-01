// Centralised, validated configuration read from the environment.
// Loaded once at startup; all modules import `config` from here.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Env var ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function opt(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === "" ? null : value;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

export const config = {
  // SEC requires a real contact in the User-Agent or it returns 403.
  secUserAgent: required("SEC_USER_AGENT"),

  // Signal filter (Feature 1.3).
  minSignalValue: num("MIN_SIGNAL_VALUE", 100_000),

  // Market-cap gate (Feature 1.4).
  maxMarketCap: num("MAX_MARKET_CAP", 2_000_000_000),
  marketCapCacheHours: num("MARKET_CAP_CACHE_HOURS", 24),

  // Cluster detection window (Feature 1.5).
  clusterWindowDays: num("CLUSTER_WINDOW_DAYS", 15),

  // Poll loop (Feature 1.1 / 1.6).
  pollIntervalSeconds: num("POLL_INTERVAL_SECONDS", 300),

  // Politeness: SEC asks for <= 10 req/s. We stay well under.
  secRequestDelayMs: num("SEC_REQUEST_DELAY_MS", 200),
  maxFilingsPerCycle: num("MAX_FILINGS_PER_CYCLE", 100),

  // Email alerts (Phase 5). When RESEND_API_KEY is unset the cycle skips email
  // dispatch entirely (see pipeline.ts), so local/`--once` runs never touch a
  // real inbox and never consume the undispatched-cluster backlog.
  resendApiKey: opt("RESEND_API_KEY"),
  alertFromEmail: str("ALERT_FROM_EMAIL", "InsiderClusters <support@beelodev.com>"),
  appUrl: str("APP_URL", "https://insiderclusters.com").replace(/\/+$/, ""),
  // Free tier gets the top cluster of the week, at most once per this many days.
  digestIntervalDays: num("DIGEST_INTERVAL_DAYS", 7),
} as const;

export type Config = typeof config;
