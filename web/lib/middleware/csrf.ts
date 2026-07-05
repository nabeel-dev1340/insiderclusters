import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { logger } from "../logger";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token: create a random secret and store it in a cookie,
 * then return the token (hash of secret) for the client to send back.
 * The server validates by comparing the token with the stored secret.
 */
export async function generateCSRFToken(): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const token = createHash("sha256").update(secret).digest("hex");

  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return token;
}

/**
 * Validate a CSRF token from the request.
 * Checks: 1) token is provided, 2) matches the stored secret.
 */
export async function validateCSRFToken(token?: string): Promise<boolean> {
  if (!token) {
    logger.security("csrf_validation_failed", { reason: "token_missing" });
    return false;
  }

  const cookieStore = await cookies();
  const secret = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!secret) {
    logger.security("csrf_validation_failed", { reason: "secret_missing" });
    return false;
  }

  const expectedToken = createHash("sha256").update(secret).digest("hex");
  const isValid = token === expectedToken;

  if (!isValid) {
    logger.security("csrf_validation_failed", { reason: "token_mismatch" });
  }

  return isValid;
}

/**
 * Extract CSRF token from request headers or body.
 * Supports both fetch API (X-CSRF-Token header) and form submissions (x-csrf-token field).
 */
export async function extractCSRFToken(req: Request): Promise<string | undefined> {
  // Check header first (for fetch/AJAX requests)
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // Check form body (for form submissions)
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    try {
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const body = await req.json() as { [key: string]: unknown };
        return body["x-csrf-token"] as string | undefined;
      } else if (contentType?.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        return params.get("x-csrf-token") || undefined;
      }
    } catch {
      // If parsing fails, token extraction fails
      return undefined;
    }
  }

  return undefined;
}

/**
 * Middleware function to validate CSRF token on state-changing requests.
 * Returns false if validation fails, true if valid or not required.
 */
export async function validateCSRFRequest(req: Request): Promise<boolean> {
  // Only validate state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    return true;
  }

  const token = await extractCSRFToken(req);
  return validateCSRFToken(token);
}
