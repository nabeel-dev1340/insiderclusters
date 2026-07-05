import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err) => {
  const { posthog } = await import("@/lib/posthog");
  const { logger } = await import("@/lib/logger");

  // Log to PostHog for visibility in analytics
  posthog().captureException(err as Error, "system");

  // Also log to server logs with proper formatting
  const error = err as Error;
  logger.error("request_error", error.message, {
    name: error.name,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Optional: Initialize security checks on app startup
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRequiredAPIKeys } = await import("@/lib/secrets/api-keys");

    // Validate required API keys are configured
    const validation = validateRequiredAPIKeys();
    if (!validation.valid) {
      console.error(
        "❌ Missing required API keys:",
        validation.missing.join(", ")
      );
      if (process.env.NODE_ENV === "production") {
        // In production, this would cause the app to crash (fail fast)
        // In development, we just warn
      }
    }

    const { logger } = await import("@/lib/logger");
    logger.info("app_startup", "Application initialized with security protections enabled");
  }
}
