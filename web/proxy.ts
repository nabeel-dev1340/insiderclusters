import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Coarse auth gate (Feature 2.3). Redirects unauthenticated requests for
// /dashboard/* to /login before rendering. This only checks cookie *presence*
// — it deliberately does no DB work (proxy may run outside the app runtime).
// The authoritative session validation happens in the dashboard layout.
//
// NOTE: security headers are NOT set here. They are applied globally via
// next.config.ts `headers()`, which covers every route (static + dynamic)
// without running JS middleware on each request. The matcher below is scoped
// to /dashboard so this gate can never redirect public/SEO pages or the login
// page itself (which would cause a redirect loop).
export function proxy(req: NextRequest): NextResponse {
  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
