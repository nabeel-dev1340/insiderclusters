import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { creemRequest, creemRedirectUrl } from "@/lib/creem";
import { creemProduct } from "@/lib/creem-catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = process.env.APP_URL ?? req.nextUrl.origin;
  const user = await getCurrentUser();
  if (!user) {
    const url = new URL("/login", origin);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const plan = req.nextUrl.searchParams.get("plan");
  const interval = req.nextUrl.searchParams.get("interval") ?? "month";
  if ((plan !== "basic" && plan !== "pro") || (interval !== "month" && interval !== "year")) {
    return NextResponse.json({ error: "Choose a valid plan and billing interval" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize clicks per account; reuse an in-progress hosted checkout.
    await client.query("SELECT pg_advisory_xact_lock($1)", [user.id]);
    const { rows } = await client.query<{
      creem_customer_id: string | null; creem_subscription_id: string | null;
    }>("SELECT creem_customer_id,creem_subscription_id FROM users WHERE id=$1", [user.id]);
    const account = rows[0];
    if (account.creem_subscription_id) {
      await client.query("COMMIT");
      return NextResponse.redirect(new URL(`/billing/change?plan=${plan}&interval=${interval}`, origin));
    }
    const product = creemProduct(plan, interval);
    const existing = await client.query<{ url: string }>(
      `SELECT url FROM creem_checkouts WHERE user_id=$1 AND product_id=$2
       AND completed_at IS NULL AND created_at > now() - interval '30 minutes'
       ORDER BY created_at DESC LIMIT 1`, [user.id,product],
    );
    let url = existing.rows[0]?.url;
    if (!url) {
      const checkout = await creemRequest<{ id: string; checkout_url: string }>("checkouts", {
        product_id: product, request_id: randomUUID(),
        customer: account.creem_customer_id ? { id: account.creem_customer_id } : { email: user.email },
        metadata: { userId: String(user.id) },
        success_url: new URL("/checkout/success", origin).href,
      });
      url = creemRedirectUrl(checkout.checkout_url).href;
      await client.query("INSERT INTO creem_checkouts(id,user_id,product_id,url) VALUES ($1,$2,$3,$4)",
        [checkout.id,user.id,product,url]);
    }
    await client.query("COMMIT");
    const response = NextResponse.redirect(creemRedirectUrl(url), 302);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("creem", "Checkout creation failed", { error: (error as Error).message });
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 503 });
  } finally { client.release(); }
}
