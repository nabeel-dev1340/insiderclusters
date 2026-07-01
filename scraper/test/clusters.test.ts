import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@insiderclusters/db";
import { detectCluster } from "../src/clusters.ts";

// Integration test — requires the local Postgres (docker compose / brew) with
// migrations applied. Uses an isolated synthetic ticker and cleans up after.

const TICKER = "ZZCLUSTERTEST";

async function cleanup() {
  await pool.query(`DELETE FROM clusters WHERE ticker = $1`, [TICKER]);
  await pool.query(
    `DELETE FROM transactions WHERE filing_id IN
       (SELECT id FROM filings WHERE ticker = $1)`,
    [TICKER]
  );
  await pool.query(`DELETE FROM filings WHERE ticker = $1`, [TICKER]);
}

async function seedSignal(insiderCik: string, daysAgo: number, value: number) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO filings
       (accession_number, issuer_cik, issuer_name, ticker, filed_at, raw_xml_url, processed_at)
     VALUES ($1, '0000123', 'ZZ Test Corp', $2, now(), 'http://example/test.txt', now())
     RETURNING id`,
    [`ACC-${TICKER}-${insiderCik}-${daysAgo}`, TICKER]
  );
  const filingId = rows[0]!.id;
  await pool.query(
    `INSERT INTO transactions
       (filing_id, insider_cik, insider_name, transaction_code, transaction_date,
        shares, price_per_share, value, is_signal)
     VALUES ($1, $2, $3, 'P', (CURRENT_DATE - $4::int), 1000, $5, $6, TRUE)`,
    [filingId, insiderCik, `Insider ${insiderCik}`, daysAgo, value / 1000, value]
  );
}

before(cleanup);
after(async () => {
  await cleanup();
  await pool.end();
});

test("3 distinct insiders within 10 days -> exactly one cluster, insider_count=3", async () => {
  await seedSignal("CIK-A", 10, 120_000);
  await seedSignal("CIK-B", 5, 150_000);
  await seedSignal("CIK-C", 0, 200_000);

  const result = await detectCluster(TICKER, 1.5e9);
  assert.ok(result, "expected a cluster to be detected");
  assert.equal(result!.created, true);
  assert.equal(result!.insiderCount, 3);

  const { rows } = await pool.query(
    `SELECT insider_count, total_value, array_length(transaction_ids, 1) AS n
     FROM clusters WHERE ticker = $1`,
    [TICKER]
  );
  assert.equal(rows.length, 1, "exactly one cluster row");
  assert.equal(Number(rows[0]!.insider_count), 3);
  assert.equal(Number(rows[0]!.total_value), 470_000);
  assert.equal(Number(rows[0]!.n), 3);
});

test("re-running detection updates in place, no duplicate cluster", async () => {
  const result = await detectCluster(TICKER, 1.5e9);
  assert.ok(result);
  assert.equal(result!.created, false); // updated existing, not created

  const { rows } = await pool.query(
    `SELECT count(*)::int AS c FROM clusters WHERE ticker = $1`,
    [TICKER]
  );
  assert.equal(rows[0]!.c, 1, "still exactly one cluster row");
});

test("a single insider does not form a cluster", async () => {
  await cleanup();
  await seedSignal("CIK-SOLO", 2, 500_000);

  const result = await detectCluster(TICKER, 1.5e9);
  assert.equal(result, null);

  const { rows } = await pool.query(
    `SELECT count(*)::int AS c FROM clusters WHERE ticker = $1`,
    [TICKER]
  );
  assert.equal(rows[0]!.c, 0);
});
