import "server-only";
import { createHash } from "crypto";

type Environment = "development" | "production";

interface CSPConfig {
  nonce?: string;
  env: Environment;
}

export function generateCSP(config: CSPConfig): string {
  const { nonce, env } = config;
  const isDev = env === "development";
  const isProduction = env === "production";

  // Build CSP directives
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": [],
  };

  // PostHog needs special handling
  directives["script-src"]!.push("https://cdn.posthog.com");
  directives["connect-src"]!.push("https://us.posthog.com");
  directives["img-src"]!.push("https://us.posthog.com");

  // Google Fonts
  directives["style-src"]!.push("https://fonts.googleapis.com");
  directives["font-src"]!.push("https://fonts.gstatic.com");

  // Resend (email)
  directives["connect-src"]!.push("https://api.resend.com");

  // Lemon Squeezy (payment)
  directives["frame-src"]!.push("https://checkout.lemonsqueezy.com");
  directives["connect-src"]!.push("https://api.lemonsqueezy.com");

  // Allow nonce for inline scripts (PostHog, analytics)
  if (nonce) {
    directives["script-src"]!.push(`'nonce-${nonce}'`);
  }

  // In development, allow unsafe-inline for easier debugging
  if (isDev) {
    directives["style-src"]!.push("'unsafe-inline'");
  }

  // Build CSP header string
  const cspParts = Object.entries(directives)
    .filter(([, values]) => values.length > 0)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  return cspParts;
}

/**
 * Generate a nonce for inline scripts and return both the nonce and CSP header.
 * Use this when you need to include inline scripts with CSP enabled.
 */
export function generateNonceAndCSP(env: Environment): {
  nonce: string;
  cspHeader: string;
} {
  const nonce = createHash("sha256").update(Math.random().toString()).digest("base64");
  const cspHeader = generateCSP({ nonce, env });
  return { nonce, cspHeader };
}
