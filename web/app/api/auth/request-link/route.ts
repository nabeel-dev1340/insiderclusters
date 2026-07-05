import { NextResponse, type NextRequest } from "next/server";
import { createMagicToken } from "@/lib/auth/tokens";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { sendMagicLink } from "@/lib/email";
import { posthog } from "@/lib/posthog";
import { validateCSRFRequest, generateCSRFToken } from "@/lib/middleware/csrf";
import { requestLinkSchema } from "@/lib/validation/auth";
import { validateData } from "@/lib/validation";
import { checkRateLimit, RateLimitPolicy, getClientIP } from "@/lib/middleware/rate-limit";
import { handleError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Return CSRF token for the form
  try {
    const csrfToken = await generateCSRFToken();
    return NextResponse.json({ csrfToken });
  } catch (err) {
    const { status, userMessage } = handleError(err, "auth_get_csrf_token");
    return NextResponse.json({ error: userMessage }, { status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const clientIP = getClientIP(req);

  try {
    // 1. Validate CSRF token
    const isCsrfValid = await validateCSRFRequest(req);
    if (!isCsrfValid) {
      logger.security("CSRF validation failed", { requestId, clientIP });
      return NextResponse.json(
        { error: "Security validation failed. Please try again." },
        { status: 403 }
      );
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = validateData(requestLinkSchema, body);
    if (!validation.success) {
      logger.warn("request_link", "Validation failed", {
        error: validation.error,
        requestId,
      });
      return NextResponse.json(
        { error: validation.error || "Invalid input." },
        { status: 400 }
      );
    }

    const { email } = validation.data!;

    // 3. Check rate limits (email-based)
    const emailRateLimit = checkRateLimit({
      policy: RateLimitPolicy.AUTH_EMAIL,
      identifier: email,
    });
    if (!emailRateLimit.allowed) {
      logger.security("Rate limit exceeded (email)", { email: email.replace(/(.{2}).*(@.*)/, "$1***$2"), requestId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(emailRateLimit.retryAfter) } }
      );
    }

    // 4. Check rate limits (IP-based)
    const ipRateLimit = checkRateLimit({
      policy: RateLimitPolicy.AUTH_IP,
      identifier: clientIP,
    });
    if (!ipRateLimit.allowed) {
      logger.security("Rate limit exceeded (IP)", { clientIP, requestId });
      return NextResponse.json(
        { error: "Too many requests from this location. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipRateLimit.retryAfter) } }
      );
    }

    // 5. Check legacy rate limiter (database-based per email)
    if (await isRateLimited(email)) {
      logger.security("Legacy rate limit triggered", { email: email.replace(/(.{2}).*(@.*)/, "$1***$2"), requestId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    // 6. Create magic token and send email
    const token = await createMagicToken(email);
    const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
    const link = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

    await sendMagicLink(email, link);

    posthog().capture({ distinctId: email, event: "magic link requested" });
    logger.info("request_link", "Magic link sent", { email: email.replace(/(.{2}).*(@.*)/, "$1***$2"), requestId });

    // 7. Return success response (no user enumeration)
    const payload: Record<string, unknown> = { ok: true };
    if (process.env.NODE_ENV !== "production") {
      payload.devLink = link;
    }
    return NextResponse.json(payload);
  } catch (err) {
    const { status, userMessage } = handleError(err, "request_link", requestId);
    return NextResponse.json({ error: userMessage }, { status });
  }
}
