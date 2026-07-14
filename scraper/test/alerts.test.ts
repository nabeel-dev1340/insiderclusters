import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@insiderclusters/db";
import { dispatchAlerts } from "../src/alerts.ts";

// Integration test — requires local Postgres with migrations applied. Verifies
// the Feature 5.1 acceptance: a new cluster is dispatched once, and a re-run
// produces zero duplicates (clusters.alert_sent_at drains the undispatched set).
//
// Recipient uses an @example.com address so nothing reaches a real inbox even
// if RESEND_API_KEY happens to be set in the local environment.

const TICKER = "ZZALERTTEST";
const EMAIL = "zz-alerts-test@example.com";

async function cleanup() {
  await pool.query(`DELETE FROM clusters WHERE ticker = $1`, [TICKER]);
  await pool.query(
    `DELETE FROM transactions WHERE filing_id IN
       (SELECT id FROM filings WHERE ticker = $1)`,
    [TICKER]
  );
  await pool.query(`DELETE FROM filings WHERE ticker = $1`, [TICKER]);
  await pool.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
}

async function seedClusterAndProUser() {
  const { rows: f } = await pool.query<{ id: number }>(
    `INSERT INTO filings
       (accession_number, issuer_cik, issuer_name, ticker, filed_at, raw_xml_url, processed_at)
     VALUES ($1, '0000123', 'ZZ Test Corp', $2, now(), 'http://example/test.txt', now())
     RETURNING id`,
    [`ACC-${TICKER}-1`, TICKER]
  );
  const filingId = f[0]!.id;

  const txIds: number[] = [];
  for (const [cik, name] of [
    ["CIK-A", "Alice Insider"],
    ["CIK-B", "Bob Insider"],
  ] as const) {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO transactions
         (filing_id, insider_cik, insider_name, insider_role, transaction_code,
          transaction_date, shares, price_per_share, value, is_signal)
       VALUES ($1, $2, $3, 'Director', 'P', CURRENT_DATE, 1000, 150, 150000, TRUE)
       RETURNING id`,
      [filingId, cik, name]
    );
    txIds.push(rows[0]!.id);
  }

  await pool.query(
    `INSERT INTO clusters
       (ticker, issuer_name, market_cap, insider_count, total_value,
        window_start, window_end, transaction_ids)
     VALUES ($1, 'ZZ Test Corp', 1.5e9, 2, 300000,
             CURRENT_DATE, CURRENT_DATE, $2)`,
    [TICKER, txIds]
  );

  await pool.query(
    `INSERT INTO users (email, plan, subscription_status, email_alerts_enabled)
     VALUES ($1, 'pro', 'active', TRUE)`,
    [EMAIL]
  );
}

before(async () => {
  await cleanup();
  await seedClusterAndProUser();
});
after(async () => {
  await cleanup();
  await pool.end();
});

// Assertions are scoped to this test's own cluster: dispatchAlerts() operates
// on ALL undispatched clusters globally, and other test files share this DB.

async function sentAt(): Promise<string | null> {
  const { rows } = await pool.query<{ alert_sent_at: string | null }>(
    `SELECT alert_sent_at::text FROM clusters WHERE ticker = $1`,
    [TICKER]
  );
  assert.equal(rows.length, 1, "exactly one cluster row for the test ticker");
  return rows[0]!.alert_sent_at;
}

test("undispatched cluster is stamped dispatched on first run", async () => {
  assert.equal(await sentAt(), null, "starts undispatched");
  await dispatchAlerts();
  assert.notEqual(await sentAt(), null, "cluster stamped alert_sent_at");
});

test("re-run does not re-dispatch the same cluster (no duplicates)", async () => {
  const before = await sentAt();
  assert.notEqual(before, null, "precondition: already dispatched");
  await dispatchAlerts();
  assert.equal(await sentAt(), before, "alert_sent_at unchanged — not re-dispatched");
});

// Telegram (Phase 6): a Pro user with ONLY Telegram enabled (email off) is
// still eligible, and the cluster drains exactly once. TELEGRAM_BOT_TOKEN is
// unset in test, so sendTelegram is a no-op — we assert dispatch semantics
// (eligibility + single stamp), not real delivery.
const TG_TICKER = "ZZTGTEST";
const TG_EMAIL = "zz-tg-test@example.com";

test("telegram-only pro user is eligible and cluster drains once", async () => {
  await pool.query(`DELETE FROM clusters WHERE ticker = $1`, [TG_TICKER]);
  await pool.query(
    `DELETE FROM transactions WHERE filing_id IN
       (SELECT id FROM filings WHERE ticker = $1)`,
    [TG_TICKER]
  );
  await pool.query(`DELETE FROM filings WHERE ticker = $1`, [TG_TICKER]);
  await pool.query(`DELETE FROM users WHERE email = $1`, [TG_EMAIL]);

  const { rows: f } = await pool.query<{ id: number }>(
    `INSERT INTO filings
       (accession_number, issuer_cik, issuer_name, ticker, filed_at, raw_xml_url, processed_at)
     VALUES ($1, '0000999', 'ZZ TG Corp', $2, now(), 'http://example/tg.txt', now())
     RETURNING id`,
    [`ACC-${TG_TICKER}-1`, TG_TICKER]
  );
  const filingId = f[0]!.id;
  const txIds: number[] = [];
  for (const [cik, name] of [["CIK-C", "Carol"], ["CIK-D", "Dave"]] as const) {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO transactions
         (filing_id, insider_cik, insider_name, insider_role, transaction_code,
          transaction_date, shares, price_per_share, value, is_signal)
       VALUES ($1, $2, $3, 'Director', 'P', CURRENT_DATE, 1000, 150, 150000, TRUE)
       RETURNING id`,
      [filingId, cik, name]
    );
    txIds.push(rows[0]!.id);
  }
  await pool.query(
    `INSERT INTO clusters
       (ticker, issuer_name, market_cap, insider_count, total_value,
        window_start, window_end, transaction_ids)
     VALUES ($1, 'ZZ TG Corp', 1.5e9, 2, 300000, CURRENT_DATE, CURRENT_DATE, $2)`,
    [TG_TICKER, txIds]
  );
  // Email OFF, Telegram ON with a linked chat.
  await pool.query(
    `INSERT INTO users
       (email, plan, subscription_status, email_alerts_enabled,
        telegram_chat_id, telegram_alerts_enabled)
     VALUES ($1, 'pro', 'active', FALSE, '123456', TRUE)`,
    [TG_EMAIL]
  );

  const { rows: pre } = await pool.query<{ alert_sent_at: string | null }>(
    `SELECT alert_sent_at::text FROM clusters WHERE ticker = $1`,
    [TG_TICKER]
  );
  assert.equal(pre[0]!.alert_sent_at, null, "starts undispatched");

  await dispatchAlerts();

  const { rows: post } = await pool.query<{ alert_sent_at: string | null }>(
    `SELECT alert_sent_at::text FROM clusters WHERE ticker = $1`,
    [TG_TICKER]
  );
  assert.notEqual(post[0]!.alert_sent_at, null, "cluster stamped for telegram-only user");

  // Cleanup this test's own rows.
  await pool.query(`DELETE FROM clusters WHERE ticker = $1`, [TG_TICKER]);
  await pool.query(`DELETE FROM transactions WHERE filing_id = $1`, [filingId]);
  await pool.query(`DELETE FROM filings WHERE ticker = $1`, [TG_TICKER]);
  await pool.query(`DELETE FROM users WHERE email = $1`, [TG_EMAIL]);
});
