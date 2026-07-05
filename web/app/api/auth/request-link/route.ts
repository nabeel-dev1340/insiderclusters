import { NextResponse, type NextRequest } from "next/server";
import { createMagicToken } from "@/lib/auth/tokens";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { sendMagicLink } from "@/lib/email";
import { posthog } from "@/lib/posthog";
import { isSameOrigin } from "@/lib/http/origin";
import { requestLinkSchema } from "@/lib/validation/auth";
import { validateData } from "@/lib/validation";
import { checkRateLimit, RateLimitPolicy, getClientIP } from "@/lib/middleware/rate-limit";
import { handleError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { auditLog, AUDIT_EVENTS } from "@/lib/audit/log";

// Mask an email for logs: keep first 2 chars + domain.
function maskEmail(email: string): string {
  return email.replace(/(.{2}).*(@.*)/, "$1***$2");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const clientIP = getClientIP(req);

  try {
    // 1. Same-origin (CSRF) guard for this state-changing request.
    if (!isSameOrigin(req)) {
      logger.security("Cross-origin request-link blocked", { requestId, clientIP });
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    // 2. Parse the body exactly once, then validate.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const validation = validateData(requestLinkSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }
    const { email } = validation.data!;

    // 3. Rate limiting.
    //    a) In-memory per-email cap (fast, stops rapid repeats).
    const emailLimit = checkRateLimit({
      policy: RateLimitPolicy.AUTH_EMAIL,
      identifier: `reqlink:${email}`,
    });
    if (!emailLimit.allowed) {
      logger.security("Rate limit (email) hit on request-link", {
        email: maskEmail(email),
        requestId,
      });
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
      );
    }

    //    b) Per-IP cap — but only when we actually resolved an IP. If the proxy
    //       didn't set a forwarded-for header we get "unknown"; rate-limiting a
    //       shared "unknown" bucket would lock out ALL users, so skip it then.
    if (clientIP !== "unknown") {
      const ipLimit = checkRateLimit({
        policy: RateLimitPolicy.AUTH_IP,
        identifier: `reqlink-ip:${clientIP}`,
      });
      if (!ipLimit.allowed) {
        logger.security("Rate limit (IP) hit on request-link", { clientIP, requestId });
        return NextResponse.json(
          { error: "Too many requests from this network. Please try again later." },
          { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
        );
      }
    }

    //    c) Legacy DB-backed per-email limiter (burst + window), unchanged.
    if (await isRateLimited(email)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    // 4. Create the token and send the link.
    const token = await createMagicToken(email);
    const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
    const link = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLink(email, link);

    posthog().capture({ distinctId: email, event: "magic link requested" });
    logger.info("request_link", "Magic link sent", { email: maskEmail(email), requestId });

    // Non-blocking audit trail (never breaks the request).
    void auditLog({
      email,
      action: AUDIT_EVENTS.AUTH_MAGIC_LINK_REQUESTED,
      ipAddress: clientIP !== "unknown" ? clientIP : undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Always respond the same way regardless of whether the email maps to an
    // existing user (no account enumeration). In dev, surface the link.
    const payload: Record<string, unknown> = { ok: true };
    if (process.env.NODE_ENV !== "production") payload.devLink = link;
    return NextResponse.json(payload);
  } catch (err) {
    const { status, userMessage } = handleError(err, "request_link", requestId);
    return NextResponse.json({ error: userMessage }, { status });
  }
}
