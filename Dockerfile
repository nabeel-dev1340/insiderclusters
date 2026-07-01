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
