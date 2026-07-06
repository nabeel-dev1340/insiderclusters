import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy.
//
// This site is statically generated (SEO). Client-side analytics run through
// PostHog (posthog-js, see instrumentation-client.ts): it loads its bundle from
// the PostHog assets host and sends events / session-replay data to the
// ingestion host, so both origins must be allow-listed below. Server-side
// custom events still use posthog-node; Resend/Lemon Squeezy are called from the
// server. The only inline scripts are Next.js's own hydration (RSC flight)
// scripts and a JSON-LD data block.
//
// We deliberately use a STATIC CSP (no per-request nonce). A nonce would force
// every page into dynamic rendering, defeating static generation. The tradeoff
// is that script-src must allow 'unsafe-inline' for Next's inline bootstrap
// scripts. We still lock down the high-value directives (frame-ancestors,
// object-src, base-uri, form-action, default-src) and forbid any other external
// script origin. Revisit with nonce+strict-dynamic if/when the app moves to
// dynamic rendering.
//
// PostHog US cloud origins. If you migrate to a reverse proxy (routing through a
// first-party /ingest path) these can be dropped back to 'self'.
const POSTHOG_INGEST = "https://us.i.posthog.com";
const POSTHOG_ASSETS = "https://us-assets.i.posthog.com";

function contentSecurityPolicy(): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'unsafe-inline' ${POSTHOG_ASSETS}`
    : // dev: React Refresh / HMR needs eval
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${POSTHOG_ASSETS}`;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src 'self' ${POSTHOG_INGEST} ${POSTHOG_ASSETS}`,
    // Session replay compresses payloads in a blob-backed web worker.
    "worker-src 'self' blob:",
    "frame-src 'none'",
  ];
  if (isProd) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Deprecated header; OWASP recommends disabling the legacy auditor entirely.
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "geolocation=()",
      "microphone=()",
      "camera=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  },
  // HSTS only in production (never send over plain-http local dev).
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Pin the monorepo root so Turbopack doesn't guess from multiple lockfiles.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Transpile the shared workspace DB package (ships TypeScript source).
  transpilePackages: ["@insiderclusters/db"],
  // Keep `pg` (and its optional native bindings) as a runtime require rather
  // than bundling it into server chunks.
  serverExternalPackages: ["pg"],
  // Security headers applied to every response at the framework level. Works
  // for both statically-generated and dynamic routes, so we don't need to run
  // JS middleware on every request just to set headers.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
