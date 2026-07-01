# Deploying to Coolify (Hetzner VPS)

Production deploy of InsiderClusters on the existing Coolify instance. Two
applications (`web`, `scraper`) built from one `Dockerfile`, plus a Coolify-
managed Postgres. Domain: **insiderclusters.com**.

> The same image runs both services. `web` uses the default CMD (runs migrations,
> then `next start`). `scraper` overrides the start command.

## 1. DNS (Hostinger)

Point the domain at the VPS. In Hostinger → Domains → DNS / Nameservers → DNS
records:

| Type | Name | Value            | TTL  |
| ---- | ---- | ---------------- | ---- |
| A    | `@`  | `89.167.116.36`  | auto |
| A    | `www`| `89.167.116.36`  | auto |

(If you use IPv6 too, add `AAAA @ 2a01:4f9:c012:e42d::1` — optional.)

DNS can take a few minutes to a couple hours to propagate. Coolify's built-in
proxy (Traefik) routes by hostname, so pointing at the same IP as your existing
site is correct.

## 2. Postgres (Coolify)

Coolify dashboard → your project → **+ New** → **Database** → **PostgreSQL 16**.

- Create it, then open it and **Start** it.
- Copy the **internal** connection URL (looks like
  `postgres://postgres:<pass>@<service>:5432/postgres`). Use the *internal* URL —
  both apps run inside Coolify and talk to the DB over the internal network.

## 3. Web application

Coolify → **+ New** → **Application** → **Public/Private Git repository** →
select `nabeel-dev1340/insiderclusters` (branch `main`).

- **Build Pack:** Dockerfile
- **Dockerfile location:** `/Dockerfile`
- **Base directory:** `/`
- **Port (exposed):** `3000`
- **Domain:** `https://insiderclusters.com` (add `https://www.insiderclusters.com`
  too if you want www). Coolify provisions TLS via Let's Encrypt automatically.
- **Environment variables:**

  ```
  DATABASE_URL=<internal URL from step 2>
  SEC_USER_AGENT=InsiderClusters support@beelodev.com
  APP_URL=https://insiderclusters.com
  NODE_ENV=production
  ```

Deploy. The container runs `npm run migrate` (creates all tables) then starts
Next.js. Watch the deploy logs for `Applied N migration(s)` then `Ready`.

## 4. Scraper application

Coolify → **+ New** → **Application** → same repo/branch.

- **Build Pack:** Dockerfile, **Dockerfile location:** `/Dockerfile`
- **No domain** (background worker, not web-facing).
- **Start command (override):**

  ```
  npm run start --workspace @insiderclusters/scraper
  ```

- **Environment variables:**

  ```
  DATABASE_URL=<same internal URL>
  SEC_USER_AGENT=InsiderClusters support@beelodev.com
  MIN_SIGNAL_VALUE=100000
  MAX_MARKET_CAP=2000000000
  ```

Deploy. Logs should show `scraper starting` and, every ~5 min, `cycle complete`.

## 5. Verify

- Visit https://insiderclusters.com → landing page loads over HTTPS.
- Sign-in link **won't email yet** (email provider is a later phase). Until then
  the dashboard isn't reachable in production by design.
- Scraper logs show cycles running and (eventually) real filings/clusters.

## Notes

- **Migrations** run automatically on every web deploy (idempotent — already-
  applied files are skipped).
- **Redeploys:** push to `main`, then hit Redeploy in Coolify (or enable
  auto-deploy on push).
- **Secrets** for later phases (Lemon Squeezy, Resend, Discord) get added as env
  vars on the relevant app when we build those phases.
- The demo seed (`npm run seed`) is **local-only** — production starts empty and
  fills in from real SEC data as the scraper runs.
