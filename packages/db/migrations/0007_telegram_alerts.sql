-- 0007_telegram_alerts.sql
-- Phase 6 (Telegram Alerts). Replaces the never-built Discord plan with Telegram.
--
-- A user links their Telegram by pressing "Start" on our bot via a one-time
-- deep-link code. The bot webhook resolves the code -> user and stores the
-- Telegram chat id. The scraper dispatcher then sends cluster alerts to that
-- chat, on the same paid=real-time / free=weekly-digest tiering as email.

ALTER TABLE users
  -- The private chat id the bot messages. NULL until the user links Telegram.
  ADD COLUMN IF NOT EXISTS telegram_chat_id        TEXT,
  -- Independent of email_alerts_enabled: a user can run either channel, both,
  -- or neither. Defaults FALSE and is flipped TRUE when a chat is linked.
  ADD COLUMN IF NOT EXISTS telegram_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per outstanding "connect Telegram" request. Short-lived, single-use.
-- The raw code lives only in the deep link the user clicks; we store its hash.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens (user_id);
