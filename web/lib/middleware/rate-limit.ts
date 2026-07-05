import "server-only";
import { logger } from "../logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

type BucketKey = string;

/**
 * In-memory rate limiter using token bucket algorithm.
 * For distributed deployments, this should be replaced with Redis.
 */
class InMemoryRateLimiter {
  private buckets: Map<BucketKey, RateLimitEntry> = new Map();

  check(key: BucketKey, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.buckets.get(key);

    // Initialize or reset if window expired
    if (!entry || now >= entry.resetTime) {
      this.buckets.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true; // First request in window
    }

    // Increment and check limit
    entry.count += 1;
    if (entry.count > limit) {
      logger.security("rate_limit_exceeded", {
        key: this.maskKey(key),
        limit,
        windowMs,
        count: entry.count,
      });
      return false; // Rate limit exceeded
    }

    return true; // Within limit
  }

  // Mask sensitive parts of the key (email, IP, etc.)
  private maskKey(key: string): string {
    if (key.includes("@")) {
      // Email
      return key.replace(/(.{2}).*(@.*)/, "$1***$2");
    }
    return key;
  }

  // Cleanup old entries every 5 minutes
  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.buckets.entries()) {
      if (now >= entry.resetTime) {
        this.buckets.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug("rate_limiter", `Cleaned up ${removed} expired entries`);
    }
  }
}

// Global rate limiter instance
const limiter = new InMemoryRateLimiter();

// Cleanup every 5 minutes
setInterval(() => limiter.cleanup(), 5 * 60 * 1000);

export enum RateLimitPolicy {
  // Auth endpoints: 3 requests per email per 15 minutes
  AUTH_EMAIL = "auth_email",
  // Auth endpoints: 10 requests per IP per hour
  AUTH_IP = "auth_ip",
  // API endpoints: 30 requests per session per minute
  API_SESSION = "api_session",
  // API endpoints: 60 requests per IP per minute
  API_IP = "api_ip",
  // Public pages: 100 requests per IP per hour
  PUBLIC_IP = "public_ip",
  // Dashboard data fetch: 60 requests per session per hour
  DASHBOARD_SESSION = "dashboard_session",
}

const POLICY_CONFIG: Record<
  RateLimitPolicy,
  { limit: number; windowMs: number }
> = {
  [RateLimitPolicy.AUTH_EMAIL]: { limit: 3, windowMs: 15 * 60 * 1000 },
  [RateLimitPolicy.AUTH_IP]: { limit: 10, windowMs: 60 * 60 * 1000 },
  [RateLimitPolicy.API_SESSION]: { limit: 30, windowMs: 60 * 1000 },
  [RateLimitPolicy.API_IP]: { limit: 60, windowMs: 60 * 1000 },
  [RateLimitPolicy.PUBLIC_IP]: { limit: 100, windowMs: 60 * 60 * 1000 },
  [RateLimitPolicy.DASHBOARD_SESSION]: { limit: 60, windowMs: 60 * 60 * 1000 },
};

export interface RateLimitOptions {
  policy: RateLimitPolicy;
  identifier: string; // Email, IP, session ID, etc.
}

/**
 * Check if a request should be rate limited.
 * Returns { allowed: boolean, retryAfter?: number }
 */
export function checkRateLimit(
  options: RateLimitOptions
): { allowed: boolean; retryAfter?: number } {
  const { policy, identifier } = options;
  const config = POLICY_CONFIG[policy];

  if (!config) {
    logger.warn("rate_limiter", `Unknown policy: ${policy}`);
    return { allowed: true }; // Fail open if policy not found
  }

  const allowed = limiter.check(identifier, config.limit, config.windowMs);

  return {
    allowed,
    retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000),
  };
}

/**
 * Extract client IP from request headers (supports proxies and Cloudflare).
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
