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

async function seedClusterAndPaidUser() {
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
     VALUES ($1, 'paid', 'active', TRUE)`,
    [EMAIL]
  );
}

before(async () => {
  await cleanup();
  await seedClusterAndPaidUser();
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
