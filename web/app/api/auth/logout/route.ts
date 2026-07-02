import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, deleteSession, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { posthog } from "@/lib/posthog";

// POST /api/auth/logout — delete the session row, clear the cookie, redirect.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw) await deleteSession(raw);

  if (user) {
    posthog().capture({
      distinctId: user.email,
      event: "user signed out",
      properties: { plan: user.plan },
    });
  }

  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(new URL("/login", base), { status: 303 });
  clearSessionCookie(res);
  return res;
}
