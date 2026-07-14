-- 0008_polar_billing.sql
-- Phase 4 (Billing). Polar replaces the never-built Lemon Squeezy plan, and the
-- free tier is retired in favour of two paid tiers, each with a 7-day trial:
--   plan: 'free' (no active subscription — hard paywall) | 'basic' | 'pro'
-- Access additionally requires subscription_status IN ('active','trialing');
-- the Polar customer.state_changed webhook keeps these columns in sync.

ALTER TABLE users RENAME COLUMN lemonsqueezy_customer_id     TO polar_customer_id;
ALTER TABLE users RENAME COLUMN lemonsqueezy_subscription_id TO polar_subscription_id;

-- Grandfather anyone on the old single 'paid' tier into Pro (same $19 price
-- point, superset of the old feature set).
UPDATE users SET plan = 'pro' WHERE plan = 'paid';
