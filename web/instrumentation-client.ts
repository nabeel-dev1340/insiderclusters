// Client-side PostHog initialization.
//
// Runs in the browser before React hydration — this is Next.js's
// `instrumentation-client` convention (supported since Next 15.3; see
// node_modules/next/dist/docs/.../instrumentation-client.md). It is what powers
// pageviews, autocapture, and session replay, all of which are browser-only and
// cannot be produced by the server-side posthog-node client in `lib/posthog.ts`.
//
// Reads the public (browser-exposed) env vars. The project token here is the
// same phc_… project key used server-side; only the NEXT_PUBLIC_ copies are
// readable in the browser.
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Guard so a missing key (e.g. in preview/CI) is a no-op rather than a throw
// that would break hydration for every visitor.
if (key) {
  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Makes toolbar / "view in PostHog" links resolve to the app, not the
    // ingestion host.
    ui_host: "https://us.posthog.com",
    // Opt into PostHog's modern defaults. Notably this sets
    // `capture_pageview: 'history_change'` so client-side (App Router) route
    // changes are captured as $pageview, plus $pageleave, autocapture, and
    // session replay. See https://posthog.com/docs/libraries/next-js.
    defaults: "2026-05-30",
  });
}
