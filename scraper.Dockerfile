# Dedicated image for the scraper worker (PRD Phase 1 service).
#
# The scraper runs TypeScript directly via Node's type-stripping — no build
# step. It only needs production deps (pg, fast-xml-parser, the shared db
# workspace), so we omit devDeps, which also sidesteps web's Tailwind native
# binaries entirely.
#
# Point the Coolify "scraper" application's Dockerfile Location at this file.

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY . .
# Drop the macOS lockfile so npm resolves prod deps for this platform.
RUN rm -f package-lock.json && npm install --omit=dev --no-audit --no-fund

# Long-running worker: polls EDGAR, detects clusters, writes to Postgres.
CMD ["npm", "run", "start", "--workspace", "@insiderclusters/scraper"]
