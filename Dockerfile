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
# install ALL workspace deps. `--include=dev` guarantees build-only deps
# (tailwind, typescript) are present even if NODE_ENV=production is injected.
COPY . .
RUN npm ci --include=dev
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
