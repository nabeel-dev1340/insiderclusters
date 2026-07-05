import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, deleteSession, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { posthog } from "@/lib/posthog";
import { isSameOrigin } from "@/lib/http/origin";
import { getClientIP } from "@/lib/middleware/rate-limit";
import { handleError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { auditLog, AUDIT_EVENTS } from "@/lib/audit/log";

// POST /api/auth/logout — delete the session row, clear the cookie, redirect.
// Triggered by a same-origin <form> POST from the dashboard nav.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  try {
    // Same-origin (CSRF) guard. The session cookie is SameSite=Lax so a
    // cross-site POST wouldn't carry it anyway; this is defense-in-depth.
    if (!isSameOrigin(req)) {
      logger.security("Cross-origin logout blocked", { requestId });
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const user = await getCurrentUser();
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    if (raw) await deleteSession(raw);

    if (user) {
      posthog().capture({
        distinctId: user.email,
        event: "user signed out",
        properties: { plan: user.plan },
      });
      logger.info("logout", "User logged out", { userId: user.id, requestId });
      void auditLog({
        userId: user.id,
        email: user.email,
        action: AUDIT_EVENTS.USER_SIGNED_OUT,
        ipAddress: getClientIP(req) !== "unknown" ? getClientIP(req) : undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      });
    }

    const base = process.env.APP_URL ?? req.nextUrl.origin;
    const res = NextResponse.redirect(new URL("/login", base), { status: 303 });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    const { status, userMessage } = handleError(err, "logout", requestId);
    return NextResponse.json({ error: userMessage }, { status });
  }
}
