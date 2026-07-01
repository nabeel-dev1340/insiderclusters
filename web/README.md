# @insiderclusters/web

Next.js 16 (App Router) web app: dashboard, magic-link auth, billing, and SEO
pages. Reads/writes the shared Postgres via `@insiderclusters/db`.

> **Next.js version note:** this is Next 16, which has breaking changes vs.
> earlier versions. Notably `middleware` is renamed to **`proxy.ts`**. Read the
> bundled docs under `node_modules/next/dist/docs/` before adding framework code.

## Run

Requires Node ≥ 22, a running Postgres with migrations applied, and env in the
repo-root `.env` (symlinked here as `.env.local`).

```bash
npm run dev    --workspace @insiderclusters/web   # http://localhost:3000
npm run build  --workspace @insiderclusters/web   # production build (also typechecks)
```

## Auth (Phase 2 — magic link, no passwords)

Flow:

1. `POST /api/auth/request-link` `{ email }` → creates a hashed, 15-min token in
   `auth_tokens`, emails a link. Rate limited (burst + 3 / 15 min). In dev the
   response includes `devLink` so the flow is testable without an email provider.
2. `GET /auth/verify?token=…` → atomically consumes the token, find-or-creates
   the user, creates a session, sets an **httpOnly** cookie, redirects to
   `/dashboard`. Invalid/expired/reused tokens redirect to `/login?error=…`.
3. `POST /api/auth/logout` → deletes the session row and clears the cookie.

Session gating (`/dashboard/*`) is two-layer:

- [`proxy.ts`](./proxy.ts) — coarse cookie-presence check, redirects to `/login`.
  Does **no** DB work (proxy may run outside the app runtime).
- [`app/dashboard/layout.tsx`](./app/dashboard/layout.tsx) — authoritative check:
  validates the session against the DB (existence + expiry) on every request.

### Security notes

- Tokens (magic-link + session) are random 256-bit values; only their SHA-256
  hash is stored. The raw value lives in the email link / cookie.
- Token consumption is a single atomic `UPDATE … WHERE used=FALSE AND not expired
  RETURNING`, so reuse and concurrent verifies can't both succeed.
- No account enumeration: `request-link` responds identically whether or not the
  email maps to an existing user.

## Key files

| Path | Responsibility |
| --- | --- |
| `lib/auth/constants.ts` | `SESSION_COOKIE` (no imports — safe for `proxy.ts`) |
| `lib/auth/crypto.ts` | token generation + SHA-256 hashing |
| `lib/auth/tokens.ts` | create / atomically consume magic-link tokens |
| `lib/auth/session.ts` | create/read/delete sessions, cookie helpers |
| `lib/auth/rate-limit.ts` | burst + windowed request-link rate limiting |
| `lib/email.ts` | email transport (dev = console log; Resend in Phase 5) |
| `proxy.ts` | coarse `/dashboard/*` auth gate |
