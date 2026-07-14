import { NextResponse, type NextRequest } from "next/server";
import { polar } from "@/lib/polar";
import { POLAR_PRODUCTS } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

// Polar checkout (billing, Phase 4). GET /checkout?plan=basic|pro creates a
// hosted checkout session and 302s the visitor to Polar's checkout page, with
// the tier's monthly and annual products side by side (Polar renders the
// interval choice). Raw ?products=<id> (repeatable) is kept for ad-hoc links.
//
// Login required: the session user's id rides along as externalCustomerId —
// that's how the webhook (/api/webhook/polar) maps the Polar customer back to
// a users row to grant access. Polar collects the card and starts the 7-day
// trial; no charge until it ends.
//
// No successUrl: Polar shows its own hosted confirmation after payment, and
// fulfillment happens via the webhook, never here.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const plan = req.nextUrl.searchParams.get("plan");
  const products =
    plan === "basic" || plan === "pro"
      ? [POLAR_PRODUCTS[plan].month, POLAR_PRODUCTS[plan].year]
      : req.nextUrl.searchParams.getAll("products");
  if (products.length === 0) {
    return NextResponse.json(
      { error: "Missing ?plan=basic|pro (or ?products=<product-id>)" },
      { status: 400 }
    );
  }

  try {
    const checkout = await polar.checkouts.create({
      products,
      externalCustomerId: String(user.id),
      customerEmail: user.email,
    });
    return NextResponse.redirect(checkout.url, 302);
  } catch (err) {
    logger.error("polar", "checkout create failed", {
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}
