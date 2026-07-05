import "server-only";
import type { NextRequest } from "next/server";

/**
 * Same-origin (CSRF) guard for state-changing requests.
 *
 * We do NOT use double-submit CSRF tokens: the app's forms/fetches don't carry
 * one, and the session cookie is already `SameSite=Lax`, which the browser will
 * not attach to cross-site POSTs. This Origin/Referer check is cheap
 * defense-in-depth on top of that.
 *
 * Policy: if the request carries an `Origin` (browsers always send it on POST)
 * or a `Referer`, it MUST match our own origin. If neither is present (e.g. a
 * non-browser/programmatic client, or a curl health probe), we allow it — the
 * SameSite cookie and per-endpoint rate limits remain the backstop, and this
 * keeps us from breaking legitimate server-to-server callers.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const allowed = new Set<string>();
  allowed.add(req.nextUrl.origin);
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      // ignore malformed APP_URL
    }
  }

  const origin = req.headers.get("origin");
  if (origin) return allowed.has(origin);

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // No Origin/Referer header at all — allow (see policy note above).
  return true;
}
