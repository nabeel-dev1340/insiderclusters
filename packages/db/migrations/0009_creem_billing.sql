-- Creem account references and transactional webhook receipts.
ALTER TABLE users ADD COLUMN billing_provider TEXT;
ALTER TABLE users ADD COLUMN creem_customer_id TEXT;
ALTER TABLE users ADD COLUMN creem_subscription_id TEXT;
ALTER TABLE users ADD COLUMN creem_access_until TIMESTAMPTZ;
CREATE UNIQUE INDEX users_creem_customer_id_idx ON users (creem_customer_id)
  WHERE creem_customer_id IS NOT NULL;
CREATE TABLE creem_subscriptions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro')),
  status TEXT NOT NULL,
  period_end TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX creem_subscriptions_user_idx ON creem_subscriptions (user_id);
CREATE TABLE creem_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
