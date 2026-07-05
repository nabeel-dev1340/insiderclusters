import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, deleteSession, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { posthog } from "@/lib/posthog";
import { validateCSRFRequest } from "@/lib/middleware/csrf";
import { checkRateLimit, RateLimitPolicy, getClientIP } from "@/lib/middleware/rate-limit";
import { handleError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

// POST /api/auth/logout — delete the session row, clear the cookie, redirect.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const clientIP = getClientIP(req);

  try {
    // 1. Validate CSRF token
    const isCsrfValid = await validateCSRFRequest(req);
    if (!isCsrfValid) {
      logger.security("CSRF validation failed (logout)", { requestId, clientIP });
      return NextResponse.json(
        { error: "Security validation failed." },
        { status: 403 }
      );
    }

    // 2. Get current user
    const user = await getCurrentUser();

    // 3. Check rate limit (per session/user)
    if (user) {
      const userRateLimit = checkRateLimit({
        policy: RateLimitPolicy.API_SESSION,
        identifier: `logout:${user.id}`,
      });
      if (!userRateLimit.allowed) {
        logger.security("Rate limit exceeded (logout)", {
          userId: user.id,
          requestId,
        });
        return NextResponse.json(
          { error: "Too many requests. Please try again." },
          { status: 429, headers: { "Retry-After": String(userRateLimit.retryAfter) } }
        );
      }
    }

    // 4. Delete session
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    if (raw) {
      await deleteSession(raw);
    }

    // 5. Log event
    if (user) {
      posthog().capture({
        distinctId: user.email,
        event: "user signed out",
        properties: { plan: user.plan },
      });
      logger.info("logout", "User logged out", { userId: user.id, requestId });
    }

    // 6. Redirect to login
    const base = process.env.APP_URL ?? req.nextUrl.origin;
    const res = NextResponse.redirect(new URL("/login", base), { status: 303 });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    const { status, userMessage } = handleError(err, "logout", requestId);
    return NextResponse.json({ error: userMessage }, { status });
  }
}
