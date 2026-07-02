# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics across both the **web** (Next.js) and **scraper** (Node.js) workspaces of the InsiderClusters monorepo.

**New files created:**
- `web/lib/posthog.ts` — singleton PostHog client for the web app (flushAt=1, flushInterval=0 for serverless-safe operation)
- `scraper/src/posthog.ts` — singleton PostHog client for the long-running scraper daemon
- `web/instrumentation.ts` — Next.js `onRequestError` hook that captures all server-side request errors via `captureException`

**`posthog-node` installed** in both `web` and `scraper` workspaces (hoisted to root `node_modules` via npm workspaces). **Environment variables** `POSTHOG_API_KEY` and `POSTHOG_HOST` written to `.env` (scraper) and `web/.env.local` (web).

**User identification:** `posthog().identify()` is called in `web/app/auth/verify/route.ts` when a magic link is verified, setting the user's email as their PostHog distinct ID. All subsequent web events use `user.email` as the distinct ID so sessions across the app stay correlated. Scraper system events use the constant distinct ID `"system"`.

**Error tracking:** `enableExceptionAutocapture: true` is set on both clients. In the web app, `web/instrumentation.ts` forwards all Next.js server request errors via `captureException`. In the scraper, individual `try/catch` blocks around filing processing and cluster detection call `captureException` so failures appear in PostHog Error Tracking.

---

| Event name | Description | File |
|---|---|---|
| `magic link requested` | User submitted the login form and a magic-link email was dispatched. | `web/app/api/auth/request-link/route.ts` |
| `user signed in` | User clicked a magic link and a new session was created. | `web/app/auth/verify/route.ts` |
| `user signed out` | User explicitly signed out and their session was deleted. | `web/app/api/auth/logout/route.ts` |
| `cluster viewed` | User opened a cluster detail page — top of the upgrade conversion funnel. | `web/app/dashboard/clusters/[id]/page.tsx` |
| `cluster locked` | Free-tier user hit a real-time cluster that is behind the paywall. | `web/app/dashboard/clusters/[id]/page.tsx` |
| `email alerts toggled` | User turned email alerts on or off from the settings page. | `web/app/dashboard/settings/actions.ts` |
| `cluster detected` | Scraper detected a new insider cluster buy for a ticker. | `scraper/src/clusters.ts` |
| `realtime alert sent` | A real-time cluster alert email was successfully delivered to a paid user. | `scraper/src/alerts.ts` |
| `digest alert sent` | A weekly digest email was successfully delivered to a free user. | `scraper/src/alerts.ts` |
| `pipeline cycle completed` | Scraper finished one full poll cycle with aggregate stats on filings, signals, and clusters. | `scraper/src/pipeline.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior:

- **Dashboard:** [Analytics basics (wizard)](https://us.posthog.com/project/494603/dashboard/1789384)
- [Sign-in conversion funnel](https://us.posthog.com/project/494603/insights/D3VNqfII) — magic link request → verified sign-in conversion rate
- [Cluster views vs. paywalled (locked) clusters](https://us.posthog.com/project/494603/insights/FqtSVvEh) — paywall hit rate signals upgrade opportunity
- [Daily sign-ins (unique users)](https://us.posthog.com/project/494603/insights/38MXOl0t) — daily active user trend
- [Email alerts enabled](https://us.posthog.com/project/494603/insights/YreDGU6H) — email alert opt-in/opt-out by week
- [Clusters detected (scraper)](https://us.posthog.com/project/494603/insights/P0paoioA) — scraper data pipeline health

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs. (Currently `identify` is called only on magic-link verification. Consider calling it in the dashboard layout server component to re-identify users on each session start.)
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog Error Tracking.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
