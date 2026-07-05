# Security Layer — Status & Corrections

**Last updated:** 2026-07-05

This document records the current, real state of the security layer after the
initial implementation was audited and corrected. Read this before touching the
security code — the first pass shipped several breaking bugs that are now fixed.

---

## What broke in the first pass (and how it's fixed)

The initial security commit (`9ffd79c`) took production down. Root-cause audit
found five real defects:

| # | Severity | Defect | Fix |
|---|----------|--------|-----|
| C1 | Critical | `proxy.ts` broadened its matcher to **all** routes but kept the "redirect to /login if no session cookie" logic unconditional → every public/SEO page and `/login` itself 307-looped to login ("no available server"). | Reverted `proxy.ts` to the original **`/dashboard/:path*`-only** auth gate. |
| C2 | Critical | `request-link` read the request body **twice** (CSRF helper called `req.json()`, then the handler did too) → 400 on every login. | Body is parsed exactly once; token-CSRF removed. |
| C3 | Critical | Token-based **CSRF was required but the frontend never sends a token** → 403 on login and logout. | Replaced with an **Origin/Referer same-origin check** (`lib/http/origin.ts`). Non-breaking; the session cookie is already `SameSite=Lax`. |
| C4 | Critical | Strict `script-src 'self'` CSP would **block Next.js's inline hydration scripts** → client components (login form) wouldn't hydrate. | CSP moved to a **static policy in `next.config.ts`** that allows Next's inline bootstrap while locking down the high-value directives. |
| H1 | High | CORS middleware **reflected any Origin with `Allow-Credentials: true`** and matched origins by loose substring. | CORS **removed entirely** — the site has no cross-origin browser clients (PostHog is server-side). |
| H2 | High | Per-IP rate limiter keyed on `"unknown"` when no forwarded-for header → could **lock out all users** at 10/hr total. | IP limiter is **skipped when the IP is `"unknown"`** (fail-open); per-email + legacy DB limiter remain. |

Plus low-severity correctness fixes: token schema now matches the real
`base64url` token format (was 64-hex), and the PostHog env var name in the key
registry is `POSTHOG_API_KEY` (was a wrong `NEXT_PUBLIC_*` name).

---

## Design decisions (important context)

- **Security headers live in `next.config.ts` `headers()`, not middleware.**
  They apply to every route (static + dynamic) at the framework level. This
  keeps `proxy.ts` minimal and avoids running JS middleware on every request.

- **CSP is static, not nonce-based — on purpose.** This is a
  statically-generated SEO site. A per-request nonce would force every page into
  dynamic rendering and kill static generation. The tradeoff is
  `script-src 'self' 'unsafe-inline'` (needed for Next's inline hydration
  scripts). The high-value directives are still enforced: `default-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, and no external script origin is allowed. Revisit with
  nonce + `strict-dynamic` only if the app moves to dynamic rendering.

- **CSRF = SameSite cookie + Origin check, not tokens.** The session cookie is
  `SameSite=Lax`, so browsers won't send it on cross-site POSTs. The Origin
  check in `lib/http/origin.ts` is cheap defense-in-depth. No token plumbing is
  required in the frontend.

---

## What is active and wired

| Protection | File | Status |
|------------|------|--------|
| Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | `next.config.ts` | ✅ Active on all routes |
| Dashboard auth gate | `web/proxy.ts` | ✅ Active on `/dashboard/*` |
| Same-origin (CSRF) guard | `web/lib/http/origin.ts` | ✅ Wired into `request-link`, `logout` |
| Input validation (Zod) | `web/lib/validation/*` | ✅ Wired into `request-link` |
| Rate limiting (in-memory per-email/IP + legacy DB) | `web/lib/middleware/rate-limit.ts`, `web/lib/auth/rate-limit.ts` | ✅ Wired into `request-link` |
| Structured logging + secret masking | `web/lib/logger.ts` | ✅ Used across auth routes |
| Safe error handling (no stack traces to client) | `web/lib/error-handler.ts` | ✅ Used across auth routes |
| Audit logging | `web/lib/audit/log.ts` + `audit_logs` table | ✅ Non-blocking, wired for `magic_link_requested` + `signed_out` |
| Health check | `web/app/api/health/route.ts` | ✅ Public `GET /api/health` |
| API key startup validation | `web/lib/secrets/api-keys.ts` | ✅ Requires only `RESEND_API_KEY` (Phase 5) |

## Scaffolding present but NOT yet wired (safe no-ops)

These exist for future phases and are **not** on any request path. They are not
breaking and not exploitable, just inert until wired:

- `web/lib/monitoring/request-monitor.ts` — metrics/anomaly alerts (not imported anywhere).
- `web/lib/auth/device-fingerprint.ts` — unusual-access detection (not called).

Requiring keys for **Phase 4 (billing / Lemon Squeezy)** and **Phase 6
(Discord)** was removed from startup validation — those phases aren't built yet,
so their secrets are optional. Add them back to the required list when those
phases land (see `docs/security/SECRETS_ROTATION.md`).

---

## Database

- Migration `0006_audit_logs.sql` creates `audit_logs`. **Fixed:** `user_id` is
  `INTEGER REFERENCES users(id)` (was mistakenly `UUID`; `users.id` is `SERIAL`).
  The original UUID version failed the FK constraint and blocked deploys.

---

## If you add a new state-changing endpoint

1. `if (!isSameOrigin(req)) return 403` (from `lib/http/origin.ts`).
2. Parse body **once**, validate with a Zod schema.
3. Rate-limit (skip IP bucket when IP is `"unknown"`).
4. Wrap in try/catch → `handleError()` for generic client messages.
5. `void auditLog({...})` for anything security-relevant (non-blocking).

See `docs/security/API_SECURITY_GUIDE.md` for the full template (note: it still
shows the old token-CSRF pattern — prefer the `isSameOrigin` check above).
