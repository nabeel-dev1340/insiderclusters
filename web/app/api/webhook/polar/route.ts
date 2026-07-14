import { NextResponse, type NextRequest } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { pool } from "@/lib/db";
import { tierForProduct } from "@/lib/billing";
import { posthog } from "@/lib/posthog";
import { logger } from "@/lib/logger";

// Polar webhook (billing, Phase 4). Polar POSTs order/customer events here.
//
// Security: every delivery is signed with the endpoint's secret (Standard
// Webhooks scheme). validateEvent checks the signature against the RAW request
// body — re-serialized JSON would fail — so anything unsigned is rejected
// before we look at it.
//
// customer.state_changed is the source of truth for access: it carries the
// customer's full current state (all active/trialing subscriptions), so one
// idempotent sync handles purchase, trial start, cancellation, expiry, and
// plan switches alike. The customer maps back to a users row via external_id,
// which /checkout sets to the app user id. order.paid is analytics only.
//
// Ack fast with 200 once verified: a non-200 makes Polar retry the delivery.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("polar", "webhook hit but POLAR_WEBHOOK_SECRET is unset");
    return NextResponse.json({ received: false }, { status: 503 });
  }

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(
      await req.text(),
      {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      },
      secret
    );
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      logger.security("Polar webhook bad signature");
      return NextResponse.json({ received: false }, { status: 403 });
    }
    throw err;
  }

  switch (event.type) {
    case "customer.state_changed": {
      const state = event.data;
      const userId = Number(state.externalId);
      if (!state.externalId || !Number.isInteger(userId)) {
        // Customers created outside /checkout (e.g. by hand in the dashboard)
        // have no external_id; nothing to sync against.
        logger.warn("polar", "customer state without usable external_id", {
          customerId: state.id,
        });
        break;
      }

      // Highest tier among active/trialing subscriptions wins (pro > basic).
      const subs = state.activeSubscriptions.map((s) => ({
        sub: s,
        tier: tierForProduct(s.productId),
      }));
      for (const s of subs) {
        if (!s.tier)
          logger.warn("polar", "subscription for unknown product", {
            productId: s.sub.productId,
          });
      }
      const best =
        subs.find((s) => s.tier === "pro") ??
        subs.find((s) => s.tier === "basic");

      const { rowCount } = best
        ? await pool.query(
            `UPDATE users
                SET plan = $2, subscription_status = $3,
                    polar_customer_id = $4, polar_subscription_id = $5
              WHERE id = $1`,
            [userId, best.tier, best.sub.status, state.id, best.sub.id]
          )
        : await pool.query(
            // No live subscription → back to the paywall. Keep the customer id
            // so their billing history stays connected if they resubscribe.
            `UPDATE users
                SET plan = 'free', subscription_status = NULL,
                    polar_customer_id = $2, polar_subscription_id = NULL
              WHERE id = $1`,
            [userId, state.id]
          );
      if (rowCount === 0) {
        logger.warn("polar", "customer state for unknown user", { userId });
        break;
      }

      logger.info("polar", "synced subscription state", {
        userId,
        plan: best?.tier ?? "free",
        status: best?.sub.status ?? null,
      });
      posthog().capture({
        distinctId: state.email ?? String(userId),
        event: "subscription state synced",
        properties: {
          plan: best?.tier ?? "none",
          status: best?.sub.status ?? "none",
        },
      });
      break;
    }

    case "order.paid": {
      // Fulfillment rides on customer.state_changed; this is revenue telemetry.
      logger.info("polar", "order.paid", {
        orderId: event.data.id,
        amount: event.data.totalAmount,
        billingReason: event.data.billingReason,
      });
      posthog().capture({
        distinctId: event.data.customer.email ?? event.data.customerId,
        event: "order paid",
        properties: {
          amount_usd: event.data.totalAmount / 100,
          product_id: event.data.productId,
          billing_reason: event.data.billingReason,
        },
      });
      break;
    }

    default:
      logger.info("polar", "unhandled webhook event", { type: event.type });
  }

  return NextResponse.json({ received: true });
}
