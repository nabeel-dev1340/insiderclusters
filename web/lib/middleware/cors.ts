import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "../logger";

export interface CORSOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CORSOptions = {
  allowedOrigins: ["localhost", "127.0.0.1"], // Add APP_URL in production
  allowedMethods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "X-Request-ID"],
  allowCredentials: true,
  maxAge: 3600,
};

/**
 * Handle CORS preflight OPTIONS requests and apply CORS headers to responses.
 */
export function applyCORS(
  response: NextResponse,
  request: NextRequest,
  options: CORSOptions = DEFAULT_OPTIONS
): NextResponse {
  const origin = request.headers.get("origin");

  // Check if origin is allowed
  const allowedOrigins = options.allowedOrigins || DEFAULT_OPTIONS.allowedOrigins || [];
  const appUrl = process.env.APP_URL || "";

  const isOriginAllowed =
    !origin || // Same-origin requests don't have origin header
    allowedOrigins.includes(origin) ||
    allowedOrigins.some(
      (allowed) =>
        appUrl.includes(allowed) ||
        origin?.includes(allowed) ||
        origin === appUrl
    );

  if (!isOriginAllowed && origin) {
    logger.warn("cors", "CORS request rejected", { origin });
    // Return response without CORS headers (request will be blocked by browser)
    return response;
  }

  // Apply CORS headers
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    (options.allowedMethods || DEFAULT_OPTIONS.allowedMethods || []).join(", ")
  );

  response.headers.set(
    "Access-Control-Allow-Headers",
    (options.allowedHeaders || DEFAULT_OPTIONS.allowedHeaders || []).join(", ")
  );

  if (options.exposedHeaders) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      options.exposedHeaders.join(", ")
    );
  }

  if (options.allowCredentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  if (options.maxAge) {
    response.headers.set("Access-Control-Max-Age", String(options.maxAge));
  }

  return response;
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 */
export function handleCORSPreFlight(
  request: NextRequest,
  options: CORSOptions = DEFAULT_OPTIONS
): NextResponse | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const response = new NextResponse(null, { status: 204 });
  return applyCORS(response, request, options);
}
