import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "@/lib/db";
import { creemPlanForProduct } from "@/lib/creem-catalog";
import { referenceId, retrieveSubscription } from "@/lib/creem";

export function verifyCreemSignature(body: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export const creemEventSchema = z.object({
  id: z.string().min(1), eventType: z.string().min(1),
  object: z.object({
    id: z.string().min(1),
    subscription: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  }).passthrough(),
});

// Retrieve current state under a per-subscription lock: delayed events cannot
// restore canceled access. Receipts and entitlement writes commit together.
export async function processCreemEvent(event: z.infer<typeof creemEventSchema>): Promise<void> {
  const supported = new Set(["checkout.completed", "subscription.active", "subscription.trialing",
    "subscription.paid", "subscription.update", "subscription.scheduled_cancel", "subscription.canceled",
    "subscription.expired", "subscription.paused", "subscription.past_due", "subscription.unpaid"]);
  if (!supported.has(event.eventType)) return;
  const subscriptionId = event.eventType === "checkout.completed"
    ? event.object.subscription && referenceId(event.object.subscription) : event.object.id;
  if (!subscriptionId?.startsWith("sub_")) throw new Error("Missing subscription reference");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [subscriptionId]);
    const receipt = await client.query(
      "INSERT INTO creem_webhook_events (id,event_type) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [event.id,event.eventType],
    );
    if (!receipt.rowCount) { await client.query("COMMIT"); return; }
    const sub = await retrieveSubscription(subscriptionId);
    if (sub.id !== subscriptionId || (process.env.CREEM_TEST_MODE === "true" ? sub.mode === "prod" : sub.mode !== "prod")) {
      throw new Error("Subscription environment mismatch");
    }
    const productId = referenceId(sub.product);
    const catalog = creemPlanForProduct(productId);
    if (!catalog) throw new Error("Unknown subscription product");
    const customerId = referenceId(sub.customer);
    const known = await client.query<{ user_id: number }>(
      "SELECT user_id FROM creem_subscriptions WHERE id=$1", [sub.id],
    );
    const owner = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE creem_customer_id=$1", [customerId],
    );
    const metadataUserId = Number(sub.metadata?.userId ?? event.object.metadata?.userId);
    const userId = known.rows[0]?.user_id ?? owner.rows[0]?.id ?? metadataUserId;
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Missing account reference");
    const user = await client.query<{ creem_customer_id: string | null }>(
      "SELECT creem_customer_id FROM users WHERE id=$1 FOR UPDATE", [userId],
    );
    if (!user.rowCount || (user.rows[0].creem_customer_id && user.rows[0].creem_customer_id !== customerId)) {
      throw new Error("Subscription account mismatch");
    }
    await client.query(
      `INSERT INTO creem_subscriptions (id,user_id,customer_id,product_id,tier,status,period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET product_id=EXCLUDED.product_id,
         tier=EXCLUDED.tier,status=EXCLUDED.status,period_end=EXCLUDED.period_end,synced_at=now()`,
      [sub.id,userId,customerId,productId,catalog.tier,sub.status,sub.current_period_end_date ?? null],
    );
    const best = await client.query<{ id: string; tier: string; status: string; period_end: string | null }>(
      `SELECT id,tier,status,period_end FROM creem_subscriptions
       WHERE user_id=$1 AND (status IN ('active','trialing') OR
         (status='scheduled_cancel' AND period_end > now()))
       ORDER BY (tier='pro') DESC,synced_at DESC LIMIT 1`, [userId],
    );
    const live = best.rows[0];
    if (live) {
      await client.query(
        `UPDATE users SET plan=$2,subscription_status=$3,billing_provider='creem',
         creem_customer_id=$4,creem_subscription_id=$5,creem_access_until=$6 WHERE id=$1`,
        [userId,live.tier,live.status === "scheduled_cancel" ? "active" : live.status,customerId,live.id,
          live.status === "scheduled_cancel" ? live.period_end : null],
      );
    } else {
      await client.query(
        `UPDATE users SET plan='free',subscription_status=$2,creem_subscription_id=$3,
         creem_access_until=NULL,creem_customer_id=$4,billing_provider='creem' WHERE id=$1`,
        [userId,sub.status,["canceled", "expired"].includes(sub.status) ? null : sub.id,customerId],
      );
    }
    if (event.eventType === "checkout.completed") {
      await client.query("UPDATE creem_checkouts SET completed_at=now() WHERE id=$1 AND user_id=$2",
        [event.object.id,userId]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
