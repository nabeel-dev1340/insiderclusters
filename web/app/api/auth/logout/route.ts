import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// POST /api/auth/logout — delete the session row, clear the cookie, redirect.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw) await deleteSession(raw);

  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(new URL("/login", base), { status: 303 });
  clearSessionCookie(res);
  return res;
}
