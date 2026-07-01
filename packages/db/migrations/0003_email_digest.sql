-- 0003_email_digest.sql
-- Phase 5 (Email Alerts). Tracks when a free user last received the weekly
-- digest so the 5-minute dispatcher sends it at most once per 7 days per user.
-- (Paid real-time sends are deduped by clusters.alert_sent_at, not this column.)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;
