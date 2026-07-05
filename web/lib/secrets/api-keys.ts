import "server-only";
import { logger } from "../logger";

interface APIKeyConfig {
  serviceName: string;
  envVarName: string;
  description: string;
}

/**
 * Registry of all third-party API keys used in the application.
 * Each entry defines where to load the key from environment variables.
 */
const API_KEY_REGISTRY: Record<string, APIKeyConfig> = {
  RESEND: {
    serviceName: "Resend",
    envVarName: "RESEND_API_KEY",
    description: "Email delivery service API key",
  },
  LEMONSQUEEZY: {
    serviceName: "Lemon Squeezy",
    envVarName: "LEMONSQUEEZY_API_KEY",
    description: "Payment processing API key",
  },
  LEMONSQUEEZY_WEBHOOK_SECRET: {
    serviceName: "Lemon Squeezy Webhook",
    envVarName: "LEMONSQUEEZY_WEBHOOK_SECRET",
    description: "Webhook signature verification secret",
  },
  POSTHOG: {
    serviceName: "PostHog",
    envVarName: "NEXT_PUBLIC_POSTHOG_KEY",
    description: "Analytics API key",
  },
  DISCORD_BOT_TOKEN: {
    serviceName: "Discord",
    envVarName: "DISCORD_BOT_TOKEN",
    description: "Discord bot authentication token",
  },
};

/**
 * Load an API key from environment, validating it's set.
 * Logs warnings if not configured, but doesn't throw (fail-open).
 */
export function getAPIKey(keyName: keyof typeof API_KEY_REGISTRY): string | undefined {
  const config = API_KEY_REGISTRY[keyName];

  if (!config) {
    logger.warn("api_keys", "API key not registered", { keyName });
    return undefined;
  }

  const keyValue = process.env[config.envVarName];

  if (!keyValue) {
    logger.warn("api_keys", "API key missing from environment", {
      service: config.serviceName,
      envVar: config.envVarName,
    });
    return undefined;
  }

  // Validate key format (basic checks)
  if (keyValue.length < 10) {
    logger.warn("api_keys", "API key has invalid format", {
      service: config.serviceName,
      reason: "too_short",
    });
    return undefined;
  }

  return keyValue;
}

/**
 * Validate that all required API keys are configured.
 * Call this during app startup to catch configuration issues early.
 */
export function validateRequiredAPIKeys(): { valid: boolean; missing: string[] } {
  const required = ["RESEND", "LEMONSQUEEZY_WEBHOOK_SECRET"];
  const missing: string[] = [];

  for (const keyName of required) {
    const key = getAPIKey(keyName as keyof typeof API_KEY_REGISTRY);
    if (!key) {
      missing.push(keyName);
    }
  }

  if (missing.length > 0) {
    logger.error("required_api_keys_missing", `Missing: ${missing.join(", ")}`);
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Utility to mask API keys in logs and error messages.
 * Keeps first 4 and last 4 characters, masks the rest.
 */
export function maskAPIKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Return list of all configured API services (for monitoring/admin).
 */
export function getConfiguredServices(): { service: string; configured: boolean }[] {
  return Object.entries(API_KEY_REGISTRY).map(([name, config]) => ({
    service: config.serviceName,
    configured: Boolean(process.env[config.envVarName]),
  }));
}
