import "server-only";
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { logger } from "../logger";

/**
 * Device fingerprint: a hash of user agent + client IP.
 * Used to detect unusual access patterns (e.g., VPN, location change).
 */
export function generateDeviceFingerprint(userAgent: string, clientIP: string): string {
  const combined = `${userAgent}:${clientIP}`;
  return createHash("sha256").update(combined).digest("hex");
}

/**
 * Extract user agent and IP from request.
 */
export function extractRequestInfo(request: NextRequest): {
  userAgent: string;
  clientIP: string;
} {
  const userAgent = request.headers.get("user-agent") || "unknown";

  const clientIP =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";

  return { userAgent, clientIP };
}

/**
 * Detect if a login is from an unusual device/location.
 * Returns true if the fingerprint matches recent history, false if unusual.
 */
export function isKnownDevice(
  currentFingerprint: string,
  previousFingerprint?: string | null
): boolean {
  if (!previousFingerprint) {
    // First login from this user - is always "known" (can't compare)
    return true;
  }

  return currentFingerprint === previousFingerprint;
}

/**
 * Log unusual access for monitoring (fingerprint changed).
 */
export function logUnusualAccess(
  userId: string,
  email: string,
  userAgent: string,
  clientIP: string,
  previousFingerprint?: string
): void {
  const currentFingerprint = generateDeviceFingerprint(userAgent, clientIP);
  const isKnown = isKnownDevice(currentFingerprint, previousFingerprint);

  if (!isKnown) {
    logger.security("unusual_device_access", {
      userId,
      email: email.replace(/(.{2}).*(@.*)/, "$1***$2"),
      userAgent,
      clientIP,
      fingerprintMatch: false,
    });
  }
}
