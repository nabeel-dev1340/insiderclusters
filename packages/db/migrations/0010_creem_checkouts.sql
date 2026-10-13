-- Reuse in-progress sessions so repeated clicks cannot open parallel purchases.
CREATE TABLE creem_checkouts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX creem_checkouts_user_idx ON creem_checkouts (user_id, product_id);
