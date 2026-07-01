import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/auth/tokens";
import { createSession, setSessionCookie } from "@/lib/auth/session";

// GET /auth/verify?token=xxx
// Validates and consumes the magic-link token, creates a session, sets the
// httpOnly cookie, and redirects to the dashboard. Invalid/expired/used tokens
// redirect to /login with a clear error (never a silent failure).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", base));
  }

  const consumed = await consumeToken(token);
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?error=expired", base));
  }

  const { token: sessionToken, expiresAt } = await createSession(consumed.email);
  const res = NextResponse.redirect(new URL("/dashboard", base));
  setSessionCookie(res, sessionToken, expiresAt);
  return res;
}
