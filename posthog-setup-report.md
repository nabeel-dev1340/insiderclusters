# PostHog post-wizard report

The wizard completed a PostHog integration for InsiderClusters. Both the **scraper** (long-running Node.js service) and the **web** (Next.js 16 app) packages were already substantially instrumented; the wizard audited the full codebase, confirmed all existing events are correct, and filled three genuine gaps: conversion-funnel tracking on the pricing page, and operational telemetry for the manual historical-backfill CLI.

**Changes made this run:**
- `web/app/pricing/page.tsx` — made async, added `pricing page viewed` event (identifies logged-in user or `"anonymous"`)
- `scraper/src/backfill.ts` — added `posthog` import, `backfill quarter ingested` event after each bulk quarter, `backfill sweep complete` event after the historical sweep, and `posthog().shutdown()` before `pool.end()` so events flush before the CLI exits
- `.env` — `POSTHOG_API_KEY` and `POSTHOG_HOST` values confirmed/updated

---

## Events instrumented

### New events (added this run)

| Event name | Description | File |
|---|---|---|
| `pricing page viewed` | A visitor (or logged-in user) views the pricing page — top of the upgrade conversion funnel. | `web/app/pricing/page.tsx` |
| `backfill quarter ingested` | One DERA quarterly bulk data set finished ingesting (manual backfill CLI). | `scraper/src/backfill.ts` |
| `backfill sweep complete` | The historical cluster sweep finished creating or skipping episode clusters. | `scraper/src/backfill.ts` |

### Pre-existing events (already in the codebase)

| Event name | File |
|---|---|
| `magic link requested` | `web/app/api/auth/request-link/route.ts` |
| `user signed in` + `identify` | `web/app/auth/verify/route.ts` |
| `user signed out` | `web/app/api/auth/logout/route.ts` |
| `email alerts toggled` | `web/app/dashboard/settings/actions.ts` |
| `cluster viewed` / `cluster locked` | `web/app/dashboard/clusters/[id]/page.tsx` |
| `pipeline cycle completed` | `scraper/src/pipeline.ts` |
| `cluster detected` | `scraper/src/clusters.ts` |
| `realtime alert sent` | `scraper/src/alerts.ts` |
| `digest alert sent` | `scraper/src/alerts.ts` |

## Next steps

We've built a dashboard and five insights to monitor user behavior and system health:

- **Dashboard:** [Analytics basics (wizard)](https://us.posthog.com/project/494603/dashboard/1800515)
- [Signup funnel (wizard)](https://us.posthog.com/project/494603/insights/gR1jkJdi) — pricing page view → magic link request → sign-in conversion
- [New cluster detections (wizard)](https://us.posthog.com/project/494603/insights/jp6Z4vZh) — insider cluster buys detected per day
- [Alert emails sent (wizard)](https://us.posthog.com/project/494603/insights/sNzdKOsC) — real-time and digest alert delivery
- [Upgrade intent — paywalled views (wizard)](https://us.posthog.com/project/494603/insights/f4WIG0mA) — free users hitting the paywall
- [Pipeline health — scraper cycles (wizard)](https://us.posthog.com/project/494603/insights/ouwjcpJB) — scraper uptime over the last 7 days

## Verify before merging

- [ ] Run a full production build (`npm run build --workspace web` and `npm run typecheck --workspace scraper`) and fix any lint or type errors.
- [ ] Run the test suite — call sites that were instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to `.env.example` and any monorepo bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production Next.js stack traces de-minify in PostHog error tracking.
- [ ] Confirm the returning-visitor path also calls `identify` — currently `identify` fires only on fresh magic-link verification; a returning session that skips the verify step lands on an anonymous distinct ID until the next sign-in.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
