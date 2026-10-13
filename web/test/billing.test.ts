import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { safeAuthNext } from "../lib/auth/next";
import { creemProduct } from "../lib/creem-catalog";
import { creemRedirectUrl, type CreemSubscription } from "../lib/creem";
import { processCreemEvent, verifyCreemSignature } from "../lib/creem-webhook";
import { POST } from "../app/api/webhook/creem/route";
import { NextRequest } from "next/server";
import { pool } from "../lib/db";

const schema = `billing_test_${randomUUID().replaceAll("-", "")}`;
const database = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1", "::1"].includes(database.hostname)) {
  throw new Error("Billing tests require local PostgreSQL");
}
const admin = new pg.Client({ connectionString: database.href });
const realFetch = globalThis.fetch;
const subscriptions = new Map<string, CreemSubscription>();
let userId: number;
let apiCalls = 0;
function sub(id: string, tier = "basic", status = "active"): CreemSubscription {
  return { id, mode: "prod", product: creemProduct(tier as "basic" | "pro", "month"),
    customer: "cust_test", status, metadata: { userId: String(userId) },
    current_period_end_date: new Date(Date.now() + 86400000).toISOString() };
}
function event(id: string, subscription: string, type = "subscription.active") {
  return { id, eventType: type, object: { id: subscription } };
}
async function account() {
  return (await pool.query("SELECT * FROM users WHERE id=$1", [userId])).rows[0];
}
before(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  database.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = database.href;
  process.env.CREEM_API_KEY = "test-local-placeholder";
  process.env.CREEM_TEST_MODE = "false";
  process.env.CREEM_WEBHOOK_SECRET = "test-signing-secret";
  const migrations = new URL("../../packages/db/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith(".sql")).sort()) {
    await pool.query(await readFile(new URL(file, migrations), "utf8"));
  }
  userId = (await pool.query("INSERT INTO users(email) VALUES ('billing-test@example.com') RETURNING id")).rows[0].id;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.creem.io");
    assert.equal(url.pathname, "/v1/subscriptions");
    apiCalls++;
    const snapshot = subscriptions.get(url.searchParams.get("subscription_id")!);
    if (!snapshot) return new Response("{}", { status: 503 });
    return Response.json(snapshot);
  };
});
after(async () => {
  globalThis.fetch = realFetch;
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
test("safe checkout redirects survive sign-in and reject external destinations", () => {
  assert.equal(safeAuthNext("/checkout?plan=pro&interval=year"), "/checkout?plan=pro&interval=year");
  for (const unsafe of ["//evil.com", "https://evil.com", "/\\evil.com", "/auth/verify", "/checkout/../../login"]) {
    assert.equal(safeAuthNext(unsafe), "/dashboard");
  }
  assert.throws(() => creemRedirectUrl("https://creem.io.evil.com/checkout"));
  assert.throws(() => creemRedirectUrl("http://creem.io/checkout"));
});
test("webhook signatures reject missing, malformed and tampered payloads", async () => {
  const body = JSON.stringify({ id: "evt_ignored", eventType: "unhandled", object: { id: "obj_test" } });
  const signature = createHmac("sha256", process.env.CREEM_WEBHOOK_SECRET!).update(body).digest("hex");
  assert.equal(verifyCreemSignature(body, signature, process.env.CREEM_WEBHOOK_SECRET!), true);
  for (const bad of ["", "invalid", "a".repeat(64), signature.slice(1)]) {
    assert.equal(verifyCreemSignature(body, bad, process.env.CREEM_WEBHOOK_SECRET!), false);
  }
  assert.equal(verifyCreemSignature(body + " ", signature, process.env.CREEM_WEBHOOK_SECRET!), false);
  assert.equal((await POST(new NextRequest("https://insiderclusters.com/api/webhook/creem", {
    method: "POST", body, headers: { "creem-signature": "bad" },
  }))).status, 403);
  assert.equal((await POST(new NextRequest("https://insiderclusters.com/api/webhook/creem", {
    method: "POST", body, headers: { "creem-signature": signature },
  }))).status, 200);
});
test("trial completion grants access once; paid renewal keeps it", async () => {
  subscriptions.set("sub_basic", sub("sub_basic", "basic", "trialing"));
  const checkout = { id: "evt_checkout", eventType: "checkout.completed",
    object: { id: "ch_test", subscription: { id: "sub_basic" }, metadata: { userId } } };
  await processCreemEvent(checkout);
  assert.equal((await account()).plan, "basic");
  assert.equal((await account()).subscription_status, "trialing");
  const count = apiCalls;
  await processCreemEvent(checkout);
  assert.equal(apiCalls, count);
  subscriptions.set("sub_basic", sub("sub_basic"));
  await processCreemEvent(event("evt_paid", "sub_basic", "subscription.paid"));
  assert.equal((await account()).subscription_status, "active");
});
test("the strongest live subscription wins and canceling it restores Basic", async () => {
  subscriptions.set("sub_pro", sub("sub_pro", "pro"));
  await processCreemEvent(event("evt_pro", "sub_pro"));
  assert.equal((await account()).plan, "pro");
  subscriptions.set("sub_pro", sub("sub_pro", "pro", "canceled"));
  await processCreemEvent(event("evt_cancel_pro", "sub_pro", "subscription.canceled"));
  assert.equal((await account()).plan, "basic");
});
test("scheduled cancellation grants access only until the paid period ends", async () => {
  subscriptions.set("sub_basic", sub("sub_basic", "basic", "scheduled_cancel"));
  await processCreemEvent(event("evt_schedule", "sub_basic", "subscription.scheduled_cancel"));
  const user = await account();
  assert.equal(user.subscription_status, "active");
  assert.ok(user.creem_access_until);
  const expired = sub("sub_basic", "basic", "scheduled_cancel");
  expired.current_period_end_date = new Date(Date.now() - 86400000).toISOString();
  subscriptions.set("sub_basic", expired);
  await processCreemEvent(event("evt_end", "sub_basic", "subscription.expired"));
  assert.equal((await account()).plan, "free");
});
test("late activation cannot restore canceled access", async () => {
  subscriptions.set("sub_basic", sub("sub_basic", "basic", "canceled"));
  await processCreemEvent(event("evt_late_active", "sub_basic"));
  assert.equal((await account()).plan, "free");
});
test("paused, unpaid, and past-due subscriptions lose access", async () => {
  for (const status of ["paused", "unpaid", "past_due"]) {
    subscriptions.set("sub_basic", sub("sub_basic"));
    await processCreemEvent(event(`evt_restore_${status}`, "sub_basic"));
    subscriptions.set("sub_basic", sub("sub_basic", "basic", status));
    await processCreemEvent(event(`evt_${status}`, "sub_basic", `subscription.${status}`));
    assert.equal((await account()).plan, "free");
  }
});
test("provider failures roll back receipts and remain retryable", async () => {
  const pending = event("evt_retry", "sub_retry");
  await assert.rejects(processCreemEvent(pending), /503/);
  assert.equal((await pool.query("SELECT id FROM creem_webhook_events WHERE id='evt_retry'")).rowCount, 0);
  subscriptions.set("sub_retry", sub("sub_retry"));
  await processCreemEvent(pending);
  assert.equal((await account()).plan, "basic");
});
test("unknown products, mismatched customers and sandbox events fail closed", async () => {
  for (const [name, override] of [
    ["product", { product: "prod_unknown" }], ["customer", { customer: "cust_wrong" }], ["mode", { mode: "test" }],
  ] as const) {
    subscriptions.set(`sub_bad_${name}`, { ...sub(`sub_bad_${name}`), ...override } as CreemSubscription);
    await assert.rejects(processCreemEvent(event(`evt_bad_${name}`, `sub_bad_${name}`)));
    assert.equal((await account()).plan, "basic");
    assert.equal((await pool.query("SELECT id FROM creem_webhook_events WHERE id=$1", [`evt_bad_${name}`])).rowCount, 0);
  }
});
