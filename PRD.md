# PRD: Insider Cluster-Buy Alert Platform

## 0. Product Summary

A SaaS that monitors SEC EDGAR Form 4 filings in real time, detects **cluster buys** (2+ distinct insiders buying open-market shares of the same small/micro-cap stock within a 15-day window), and delivers alerts via web dashboard, email, and Discord. Free tier is delayed/limited; paid tier is real-time and unlimited.

**Stack decisions (locked):**
- Scraper: Python 3, runs as a systemd service / cron on Hetzner VPS
- Database: PostgreSQL, self-hosted on the same Hetzner VPS
- Web app: Next.js (App Router), deployed via Coolify on Hetzner VPS
- Auth: Magic link (passwordless email), no passwords stored
- Payments: Lemon Squeezy (checkout + webhooks)
- Alerts: Email (transactional provider, e.g. Resend/SES) + Discord bot
- Hosting: Everything on one Hetzner VPS behind Coolify, no third-party PaaS

**Build order:** Phase 1 → 8, in sequence. Each phase should be a separate Claude Code session/task. Do not start a phase until the prior phase's acceptance criteria pass.

---

## 1. Data Model (build this first, everything depends on it)

```sql
-- Raw filings, one row per Form 4 accession number
CREATE TABLE filings (
  id SERIAL PRIMARY KEY,
  accession_number TEXT UNIQUE NOT NULL,
  issuer_cik TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  ticker TEXT,
  filed_at TIMESTAMPTZ NOT NULL,
  raw_xml_url TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual parsed transactions within a filing (a filing can have multiple)
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  filing_id INTEGER REFERENCES filings(id),
  insider_cik TEXT,
  insider_name TEXT NOT NULL,
  insider_role TEXT, -- e.g. "CEO", "Director", "10% Owner"
  transaction_code TEXT NOT NULL, -- P, S, A, M, F, etc.
  transaction_date DATE NOT NULL,
  shares NUMERIC,
  price_per_share NUMERIC,
  value NUMERIC, -- shares * price, computed
  is_signal BOOLEAN DEFAULT FALSE, -- true if code=P and value >= threshold
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Detected clusters (2+ distinct insiders, same ticker, 15-day window)
CREATE TABLE clusters (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  market_cap NUMERIC, -- pulled from a market data source, see Phase 2
  insider_count INTEGER NOT NULL,
  total_value NUMERIC NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  transaction_ids INTEGER[] NOT NULL, -- FK array to transactions
  detected_at TIMESTAMPTZ DEFAULT now(),
  alert_sent_at TIMESTAMPTZ -- null until dispatched
);

-- Users (magic link auth, no passwords)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'paid'
  lemonsqueezy_customer_id TEXT,
  lemonsqueezy_subscription_id TEXT,
  subscription_status TEXT, -- active, cancelled, past_due, etc.
  discord_user_id TEXT, -- null until linked
  email_alerts_enabled BOOLEAN DEFAULT TRUE
);

-- Magic link tokens
CREATE TABLE auth_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions (post magic-link verification)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Acceptance criteria:** all tables created via a migration script (use `node-pg-migrate` or plain SQL migration files, not an ORM auto-sync). Migrations must be idempotent and version-numbered.

---

## 2. Phase 1: Scraper Core

**Goal:** A standalone Python service that polls EDGAR, parses filings, applies the filter, detects clusters, and writes to Postgres. No web app dependency, must run and prove itself via CLI/logs first.

**Feature 1.1 — EDGAR poller**
- Poll `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=include&count=100&action=getcurrent` every 5 minutes
- Required: set `User-Agent` header to `"<CompanyName> <contact@email.com>"` — SEC returns 403 without this
- Deduplicate by accession number before processing (check `filings` table)
- Acceptance: running the poller for 30 minutes during market hours produces new rows in `filings` with no duplicate accession numbers

**Feature 1.2 — Filing parser**
- For each new filing, fetch the full submission `.txt` (contains embedded XML)
- Parse using `xml.etree.ElementTree`: issuer name/ticker, insider name/role, transaction code, shares, price, date
- Compute `value = shares * price_per_share`
- Write one row per `nonDerivativeTransaction` to `transactions`
- Acceptance: parsing 20 real filings produces correct field extraction with zero unhandled exceptions (wrap parse in try/except, log and skip malformed filings, never crash the poller)

**Feature 1.3 — Signal filter**
- Mark `is_signal = TRUE` only when: `transaction_code = 'P'` AND `value >= 100000` (configurable env var `MIN_SIGNAL_VALUE`)
- Acceptance: re-run the test fixtures from the earlier validation (Trupanion M/F filing → filtered out; synthetic P filing → passes) as an automated pytest suite, not manual inspection

**Feature 1.4 — Market cap enrichment**
- For each issuer on a signal transaction, fetch market cap from a free source (e.g. `stockanalysis.com` API or Yahoo Finance unofficial endpoint — pick one, document rate limits)
- Cache market cap per ticker for 24 hours (don't re-fetch every transaction)
- Only proceed to cluster detection if `market_cap <= 2_000_000_000` (configurable `MAX_MARKET_CAP`)
- Acceptance: a signal transaction for a mega-cap ticker (e.g. AAPL) is excluded from cluster detection; a signal for a sub-$2B ticker proceeds

**Feature 1.5 — Cluster detection**
- Every poll cycle, for each ticker with new signal transactions, query: distinct `insider_cik` count on signal transactions within a rolling 15-day window
- If distinct insider count >= 2, upsert a row in `clusters` (update if window overlaps an existing undispatched cluster, don't create duplicates)
- Acceptance: feeding 3 synthetic signal transactions for the same ticker with 3 different insider CIKs within 10 days produces exactly one cluster row with `insider_count = 3`

**Feature 1.6 — Logging & resilience**
- Structured logging (JSON lines) to a file, rotated daily
- If EDGAR is unreachable, retry with exponential backoff, never crash the service
- Acceptance: killing network mid-poll and restoring it results in the poller resuming without manual intervention

---

## 3. Phase 2: Auth (Magic Link)

**Feature 2.1 — Request magic link**
- POST `/api/auth/request-link` with email
- Generate a random token, store in `auth_tokens` with 15-minute expiry
- Send email with link `https://yourdomain.com/auth/verify?token=xxx`
- Rate limit: max 3 requests per email per 15 minutes
- Acceptance: requesting a link twice rapidly triggers rate limit response, not two emails

**Feature 2.2 — Verify magic link**
- GET `/auth/verify?token=xxx`
- Validate token not expired, not used; mark used; create/find user by email; create session; set httpOnly cookie
- Acceptance: expired or reused tokens return a clear error page, not a silent failure

**Feature 2.3 — Session middleware**
- All `/dashboard/*` routes check for valid session cookie, redirect to `/login` if absent/expired
- Acceptance: accessing `/dashboard` while logged out redirects correctly; session persists across a browser refresh

---

## 4. Phase 3: Web Dashboard

**Feature 3.1 — Public landing page**
- Explains the product, shows 2-3 example past clusters (real, anonymized if needed) as social proof
- CTA: email input → triggers magic link flow directly (no separate signup form)
- Acceptance: landing page loads under 1s, mobile-responsive, single clear CTA above the fold

**Feature 3.2 — Cluster feed (dashboard home)**
- Logged-in users see a paginated feed of `clusters`, newest first
- Each card shows: ticker, issuer name, insider count, total value, date range, market cap
- Free-tier users see feed delayed by 24 hours and capped at 1 cluster/week visible; paid users see everything real-time
- Acceptance: toggling a test user between `plan='free'` and `plan='paid'` in the DB visibly changes what the feed shows on next load

**Feature 3.3 — Cluster detail view**
- Click a cluster → shows individual transactions that make up the cluster (insider names, roles, dates, amounts) and a link to the underlying SEC filing
- Acceptance: every cluster detail page correctly links back to the real EDGAR filing URL

**Feature 3.4 — Account settings**
- Toggle email alerts on/off
- View current plan and a "Manage subscription" button (links to Lemon Squeezy customer portal)
- Discord account linking (see Phase 6)
- Acceptance: toggling email alerts off actually suppresses the next email dispatch for that user

---

## 5. Phase 4: Billing (Lemon Squeezy)

**Feature 4.1 — Checkout**
- "Upgrade" button opens Lemon Squeezy hosted checkout (use their overlay/checkout link, not custom Stripe-style forms)
- Pass `user.email` and `user.id` as checkout custom data so the webhook can match it back
- Acceptance: completing a real test-mode checkout redirects back to the dashboard with a success state

**Feature 4.2 — Webhook handler**
- POST `/api/webhooks/lemonsqueezy`
- Verify signature using the webhook secret (never process unverified payloads)
- Handle events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
- Update `users.plan`, `subscription_status`, `lemonsqueezy_subscription_id` accordingly
- Acceptance: firing a test webhook payload (Lemon Squeezy provides test events) correctly flips a user from `free` to `paid` and back on cancellation

**Feature 4.3 — Access control enforcement**
- A cron job (or on-request check) downgrades users to `free` behavior immediately if `subscription_status != 'active'`, regardless of what the `plan` column says (webhook delivery can lag or fail — don't trust a single source of truth blindly)
- Acceptance: manually setting a user's `subscription_status = 'past_due'` in the DB immediately restricts their dashboard access on next page load

---

## 6. Phase 5: Email Alerts

**Feature 5.1 — Alert dispatcher**
- A scheduled job (every 5 min) checks `clusters` where `alert_sent_at IS NULL`
- For paid users with `email_alerts_enabled = TRUE`: send immediately
- For free users: batch into a weekly digest (only the single highest-value cluster of the week)
- Mark `alert_sent_at` after successful dispatch to avoid double-sends
- Acceptance: a new cluster triggers exactly one email per eligible paid user, zero duplicates on job re-run

**Feature 5.2 — Email templates**
- Plain, readable transactional email (not heavy HTML/marketing design): ticker, insiders involved, total value, link to dashboard detail page
- Acceptance: renders correctly in Gmail and Apple Mail, no broken layout

---

## 7. Phase 6: Discord Bot

**Feature 6.1 — Bot setup + role-gated server**
- One Discord server, a `#real-time-alerts` channel restricted to a `Paid` role
- Bot posts every new cluster to that channel as soon as detected (paid tier only)
- Acceptance: a cluster detected by the scraper appears in Discord within 1 minute

**Feature 6.2 — Account linking**
- User clicks "Link Discord" in dashboard settings → OAuth2 flow → store `discord_user_id`
- On successful Lemon Squeezy payment, bot automatically assigns the `Paid` role to that Discord user; on cancellation, role is removed
- Acceptance: upgrading a linked account results in the Discord role appearing within 5 minutes without manual action; downgrading removes it

---

## 8. Phase 7: SEO / Content Layer

**Feature 7.1 — Programmatic ticker pages**
- Auto-generate a public (non-gated) page per ticker that has ever appeared in a cluster: `/stock/AAPL/insider-cluster-buys`
- Shows historical clusters for that ticker, gated to "last 3" for non-logged-in visitors
- This is your SEO surface area — every ticker page targets long-tail search traffic
- Acceptance: pages are server-rendered (not client-only) so they're crawlable, have unique title/meta per ticker

**Feature 7.2 — Sitemap + robots.txt**
- Auto-updating sitemap.xml including all ticker pages
- Acceptance: sitemap validates and includes newly created ticker pages within 24 hours of first cluster

---

## 9. Phase 8: Ops / Deployment

**Feature 8.1 — Coolify deployment**
- Next.js app + Python scraper as two separate services in Coolify, both pointing at the same Postgres instance
- Environment variables for all secrets (Lemon Squeezy keys, Discord bot token, email provider keys, `MIN_SIGNAL_VALUE`, `MAX_MARKET_CAP`)
- Acceptance: a fresh deploy from a clean Coolify project succeeds end-to-end using only documented env vars, no manual server SSH steps required

**Feature 8.2 — Backups**
- Daily automated Postgres dump to a separate location (not just the same VPS disk)
- Acceptance: a restore-from-backup drill actually works, tested once before launch

---

## 10. Explicitly Out of Scope (v1)

- Telegram bot (v2, after Discord is validated)
- Insider historical performance scoring ("this insider's past buys returned X%")
- Mobile app
- Any brokerage/trading integration
- Congress/STOCK Act trades (separate data source, separate feature)

---

## 11. Non-Negotiable Constraints for Claude Code

- Never call the SEC without a proper `User-Agent` header (compliance requirement, not optional)
- Never trust `plan` column alone for access control — always cross-check `subscription_status`
- Never process an unverified Lemon Squeezy webhook payload
- All money-relevant logic (billing, plan status) needs a corresponding automated test before being marked done
- Every phase must be independently testable via CLI or a documented manual test before moving to the next phase