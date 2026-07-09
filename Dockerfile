# Single image for the whole monorepo. The same image runs either service:
#   - web:     default CMD (Next.js production server; runs migrations first)
#   - scraper: override the start command in Coolify to run the scraper
#
# Build is DB-independent (the landing page degrades gracefully if the DB is
# unreachable during prerender), so it builds cleanly in CI/Coolify.

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the whole repo (node_modules/.next excluded via .dockerignore), then
# install ALL workspace deps. The committed lockfile was generated on macOS;
# npm (both `ci` and `install`) replays it and never fetches the Linux native
# binaries that Tailwind v4's lightningcss/oxide need (known npm optional-deps
# bug). Removing the lockfile forces a fresh, platform-aware resolution so the
# correct linux-x64-gnu binaries get installed.
# `--include=dev` guarantees build-only deps even if NODE_ENV=production is set.
COPY . .
RUN rm -f package-lock.json && npm install --include=dev --no-audit --no-fund
# PostHog's browser SDK (pageviews, autocapture, session replay) reads
# NEXT_PUBLIC_* vars, which Next.js INLINES into the client bundle at build
# time — not at runtime. They must therefore be present during `npm run build`,
# not just in the running container. Coolify injects runtime env into the
# container but NOT into `docker build` unless a var is marked as a Build
# Variable; declaring them as ARGs here lets that value flow into the build.
# Missing here => `process.env.NEXT_PUBLIC_POSTHOG_KEY` compiles to undefined and
# posthog-js never initialises in the browser.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
# Fail loudly if the browser key is missing at build time. Without this the key
# inlines as `undefined`, posthog-js is tree-shaken out, and a keyless bundle
# ships silently (no pageviews/replay) — the exact failure we hit when the
# Coolify var was misnamed. Escape hatch: set ALLOW_MISSING_POSTHOG=1 for
# intentional keyless builds (local/CI/preview without the secret).
ARG ALLOW_MISSING_POSTHOG
RUN if [ -z "$NEXT_PUBLIC_POSTHOG_KEY" ] && [ -z "$ALLOW_MISSING_POSTHOG" ]; then \
      echo "ERROR: NEXT_PUBLIC_POSTHOG_KEY is empty at build time. The browser" \
           "PostHog SDK will be tree-shaken out and no client events will fire." \
           "Set it as a Coolify BUILD variable (exact name, no API_), or pass" \
           "--build-arg ALLOW_MISSING_POSTHOG=1 for an intentional keyless build." >&2; \
      exit 1; \
    fi
RUN npm run build --workspace @insiderclusters/web

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Carry the built app + all workspace node_modules (root and per-package).
COPY --from=build /app ./
EXPOSE 3000
# Default: run pending migrations, then start the web server.
CMD ["sh", "-c", "npm run migrate && npm run start --workspace @insiderclusters/web -- -H 0.0.0.0 -p 3000"]
