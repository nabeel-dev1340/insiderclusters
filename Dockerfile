# Single image for the whole monorepo. The same image runs either service:
#   - web:     default CMD (Next.js production server; runs migrations first)
#   - scraper: override the start command in Coolify to run the scraper
#
# Build is DB-independent (the landing page degrades gracefully if the DB is
# unreachable during prerender), so it builds cleanly in CI/Coolify.

FROM node:22-slim AS deps
WORKDIR /app
# Install workspace deps using only manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY scraper/package.json scraper/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @insiderclusters/web

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Copy the built app + all workspace deps.
COPY --from=build /app ./
EXPOSE 3000
# Default: run pending migrations, then start the web server.
CMD ["sh", "-c", "npm run migrate && npm run start --workspace @insiderclusters/web -- -H 0.0.0.0 -p 3000"]
