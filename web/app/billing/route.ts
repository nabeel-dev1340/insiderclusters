import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { pool } from "@/lib/db";
import { creemRequest, creemRedirectUrl } from "@/lib/creem";
import { logger } from "@/lib/logger";
export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = process.env.APP_URL ?? req.nextUrl.origin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  const { rows } = await pool.query<{ creem_customer_id: string | null }>(
    "SELECT creem_customer_id FROM users WHERE id=$1", [user.id],
  );
  if (!rows[0]?.creem_customer_id) return NextResponse.redirect(new URL("/dashboard/settings", origin));
  try {
    const portal = await creemRequest<{ customer_portal_link: string }>("customers/billing", {
      customer_id: rows[0].creem_customer_id,
    });
    const res = NextResponse.redirect(creemRedirectUrl(portal.customer_portal_link), 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    logger.error("creem", "Portal creation failed", { error: (error as Error).message });
    return NextResponse.json({ error: "Could not open billing. Please try again." }, { status: 503 });
  }
}
