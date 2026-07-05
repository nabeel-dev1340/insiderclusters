import "server-only";
import { pool } from "@/lib/db";
import { logger } from "../logger";

export interface AuditLogEntry {
  userId?: number; // users.id is SERIAL (integer)
  email: string;
  action: string;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a security-relevant action to the audit log.
 * Used for compliance, forensics, and security monitoring.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const {
      userId,
      email,
      action,
      resourceId,
      resourceType,
      details,
      ipAddress,
      userAgent,
    } = entry;

    await pool.query(
      `INSERT INTO audit_logs (
        user_id, email, action, resource_id, resource_type,
        details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        email,
        action,
        resourceId || null,
        resourceType || null,
        details ? JSON.stringify(details) : null,
        ipAddress || null,
        userAgent || null,
      ]
    );

    logger.debug("audit_log", `Logged action: ${action}`, {
      email: email.replace(/(.{2}).*(@.*)/, "$1***$2"),
      action,
    });
  } catch (err) {
    // Log the error but don't throw — audit failures shouldn't break the application
    logger.error("audit_log_failed", `Failed to log action: ${entry.action}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Common audit events as constants to prevent typos.
 */
export const AUDIT_EVENTS = {
  // Authentication
  AUTH_MAGIC_LINK_REQUESTED: "auth_magic_link_requested",
  AUTH_MAGIC_LINK_VERIFIED: "auth_magic_link_verified",
  USER_SIGNED_IN: "user_signed_in",
  USER_SIGNED_OUT: "user_signed_out",
  AUTH_FAILED: "auth_failed",

  // User settings
  EMAIL_ALERTS_TOGGLED: "email_alerts_toggled",
  EMAIL_DIGEST_UPDATED: "email_digest_updated",
  USER_PLAN_CHANGED: "user_plan_changed",

  // Security events
  RATE_LIMIT_TRIGGERED: "rate_limit_triggered",
  CSRF_VALIDATION_FAILED: "csrf_validation_failed",
  SUSPICIOUS_ACTIVITY_DETECTED: "suspicious_activity_detected",

  // API access
  API_KEY_GENERATED: "api_key_generated",
  API_KEY_REVOKED: "api_key_revoked",
  UNAUTHORIZED_ACCESS_ATTEMPT: "unauthorized_access_attempt",
} as const;
