-- 0001_initial_schema.sql
-- Initial schema for the Insider Cluster-Buy Alert Platform (PRD §1).
-- Idempotent: safe to re-run (CREATE ... IF NOT EXISTS everywhere). The
-- migration runner also guards against re-application via schema_migrations.

-- ---------------------------------------------------------------------------
-- Raw filings: one row per Form 4 accession number.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS filings (
  id               SERIAL PRIMARY KEY,
  accession_number TEXT UNIQUE NOT NULL,
  issuer_cik       TEXT NOT NULL,
  issuer_name      TEXT NOT NULL,
  ticker           TEXT,
  filed_at         TIMESTAMPTZ NOT NULL,
  raw_xml_url      TEXT NOT NULL,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Poller dedupes by accession_number (already unique). These support the
-- "unprocessed filings" scan and ticker lookups.
CREATE INDEX IF NOT EXISTS idx_filings_processed_at ON filings (processed_at);
CREATE INDEX IF NOT EXISTS idx_filings_ticker       ON filings (ticker);
CREATE INDEX IF NOT EXISTS idx_filings_filed_at     ON filings (filed_at DESC);

-- ---------------------------------------------------------------------------
-- Parsed transactions: a filing can contain multiple nonDerivativeTransactions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id               SERIAL PRIMARY KEY,
  filing_id        INTEGER NOT NULL REFERENCES filings (id) ON DELETE CASCADE,
  insider_cik      TEXT,
  insider_name     TEXT NOT NULL,
  insider_role     TEXT,               -- e.g. "CEO", "Director", "10% Owner"
  transaction_code TEXT NOT NULL,      -- P, S, A, M, F, etc.
  transaction_date DATE NOT NULL,
  shares           NUMERIC,
  price_per_share  NUMERIC,
  value            NUMERIC,            -- shares * price_per_share (computed on insert)
  is_signal        BOOLEAN NOT NULL DEFAULT FALSE, -- true when code=P and value >= threshold
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_filing_id ON transactions (filing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_insider   ON transactions (insider_cik);
-- Cluster detection scans signal transactions within a rolling date window.
CREATE INDEX IF NOT EXISTS idx_transactions_signal_window
  ON transactions (transaction_date) WHERE is_signal = TRUE;

-- ---------------------------------------------------------------------------
-- Detected clusters: 2+ distinct insiders, same ticker, within a rolling window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clusters (
  id              SERIAL PRIMARY KEY,
  ticker          TEXT NOT NULL,
  issuer_name     TEXT NOT NULL,
  market_cap      NUMERIC,            -- from market data source (Phase 1.4)
  insider_count   INTEGER NOT NULL,
  total_value     NUMERIC NOT NULL,
  window_start    DATE NOT NULL,
  window_end      DATE NOT NULL,
  transaction_ids INTEGER[] NOT NULL, -- references transactions(id); arrays can't carry a real FK
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_sent_at   TIMESTAMPTZ         -- null until dispatched
);

CREATE INDEX IF NOT EXISTS idx_clusters_ticker      ON clusters (ticker);
CREATE INDEX IF NOT EXISTS idx_clusters_detected_at ON clusters (detected_at DESC);
-- Alert dispatcher polls for clusters that still need sending.
CREATE INDEX IF NOT EXISTS idx_clusters_undispatched
  ON clusters (detected_at) WHERE alert_sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- Users: magic-link auth, no passwords.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                        SERIAL PRIMARY KEY,
  email                     TEXT UNIQUE NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan                      TEXT NOT NULL DEFAULT 'free', -- 'free' | 'paid'
  lemonsqueezy_customer_id     TEXT,
  lemonsqueezy_subscription_id TEXT,
  subscription_status       TEXT,       -- active, cancelled, past_due, etc.
  discord_user_id           TEXT,       -- null until linked
  email_alerts_enabled      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Magic link tokens.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens (email);

-- ---------------------------------------------------------------------------
-- Sessions: created after magic-link verification.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
