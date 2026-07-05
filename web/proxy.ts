import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { applySecurityHeaders } from "@/lib/middleware/security-headers";
import { applyCORS, handleCORSPreFlight } from "@/lib/middleware/cors";

// Coarse auth gate (Feature 2.3). Redirects unauthenticated requests for
// /dashboard/* to /login before rendering. This only checks cookie *presence*
// — it deliberately does no DB work (proxy may run outside the app runtime).
// The authoritative session validation happens in the dashboard layout.
export function proxy(req: NextRequest): NextResponse {
  const env = process.env.NODE_ENV || "production";

  // Generate request ID for tracing
  const requestId = crypto.randomUUID();

  // 1. Handle CORS preflight
  const preflightResponse = handleCORSPreFlight(req);
  if (preflightResponse) {
    applySecurityHeaders(preflightResponse, env);
    preflightResponse.headers.set("X-Request-ID", requestId);
    return preflightResponse;
  }

  // 2. Check auth for dashboard routes
  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    const res = NextResponse.redirect(url);
    applySecurityHeaders(res, env);
    return res;
  }

  // 3. Continue with request
  let response = NextResponse.next();

  // 4. Apply security headers
  applySecurityHeaders(response, env);

  // 5. Apply CORS headers
  const corsOptions = {
    allowedOrigins: [
      "localhost",
      "127.0.0.1",
      process.env.APP_URL || "",
    ].filter(Boolean),
    allowedMethods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  };
  applyCORS(response, req, corsOptions);

  // 6. Add request ID to response
  response.headers.set("X-Request-ID", requestId);

  return response;
}

export const config = {
  matcher: [
    // Protect dashboard routes
    "/dashboard/:path*",
    // Apply security headers to all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|icon\\.svg).*)",
  ],
};
