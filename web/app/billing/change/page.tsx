import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { pool } from "@/lib/db";
import { creemProduct, creemPlanForProduct } from "@/lib/creem-catalog";
import { creemRequest, referenceId, retrieveSubscription } from "@/lib/creem";
import { MONTHLY_PRICE, annualPrice } from "@/lib/billing";
import { Button, ButtonLink } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Change plan", robots: { index: false, follow: false } };

async function changePlan(form: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const plan = form.get("plan");
  const interval = form.get("interval");
  if ((plan !== "basic" && plan !== "pro") || (interval !== "month" && interval !== "year")) {
    throw new Error("Invalid plan");
  }
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [user.id]);
    const { rows } = await client.query<{ creem_subscription_id: string | null; creem_customer_id: string | null }>(
      "SELECT creem_subscription_id,creem_customer_id FROM users WHERE id=$1", [user.id],
    );
    const account = rows[0];
    if (!account?.creem_subscription_id) throw new Error("No subscription to change");
    const sub = await retrieveSubscription(account.creem_subscription_id);
    if (referenceId(sub.customer) !== account.creem_customer_id || !["active", "trialing"].includes(sub.status)) {
      throw new Error("Subscription cannot be changed");
    }
    const product = creemProduct(plan, interval);
    // A repeated form submission cannot charge for an already completed change.
    if (referenceId(sub.product) !== product) {
      await creemRequest(`subscriptions/${encodeURIComponent(sub.id)}/upgrade`, {
        product_id: product, update_behavior: "proration-charge-immediately",
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("creem", "Plan change failed", { error: (error as Error).message });
    failed = true;
  } finally { client.release(); }
  if (failed) redirect(`/billing/change?plan=${plan}&interval=${interval}&error=1`);
  redirect("/checkout/success?change=1");
}

export default async function ChangePlanPage({ searchParams }: {
  searchParams: Promise<{ plan?: string; interval?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { plan = "pro", interval = "month", error } = await searchParams;
  if ((plan !== "basic" && plan !== "pro") || (interval !== "month" && interval !== "year")) redirect("/pricing");
  const { rows } = await pool.query<{ creem_subscription_id: string | null }>(
    "SELECT creem_subscription_id FROM users WHERE id=$1", [user.id],
  );
  if (!rows[0]?.creem_subscription_id) redirect(`/checkout?plan=${plan}&interval=${interval}`);
  const current = await retrieveSubscription(rows[0].creem_subscription_id);
  if (!["active", "trialing"].includes(current.status)) redirect("/billing");
  const selected = creemPlanForProduct(referenceId(current.product));
  const same = selected?.tier === plan && selected?.interval === interval;
  const price = interval === "year" ? annualPrice(plan).toFixed(2) : MONTHLY_PRICE[plan];
  return (
    <main id="main-content" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl">{same ? "You already have this plan" : `Switch to ${plan === "pro" ? "Pro" : "Basic"}`}</h1>
      <p className="mt-4 text-muted">${price}/{interval === "year" ? "year" : "month"}. Creem prorates the change and charges any amount due immediately. Your existing subscription is updated.</p>
      {error && <p role="alert" className="mt-4">The change could not be completed. Please try again or manage your subscription in the billing portal.</p>}
      {!same && <form action={changePlan} className="mt-6">
        <input type="hidden" name="plan" value={plan} />
        <input type="hidden" name="interval" value={interval} />
        <Button type="submit">Confirm plan change</Button>
      </form>}
      <ButtonLink href="/billing" variant="secondary" className="mt-4">Manage billing</ButtonLink>
      <ButtonLink href="/dashboard/settings" variant="ghost" className="mt-4">Back to settings</ButtonLink>
    </main>
  );
}
