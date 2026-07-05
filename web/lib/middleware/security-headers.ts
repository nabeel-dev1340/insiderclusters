import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { generateCSP } from "./csp";

export function applySecurityHeaders(response: NextResponse, env: string = "production"): void {
  // HSTS: Force HTTPS for all future connections
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Content Security Policy: Prevent XSS attacks
  const cspHeader = generateCSP({ env: env as "development" | "production" });
  response.headers.set("Content-Security-Policy", cspHeader);

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Disable legacy XSS protection (modern CSP is sufficient)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Control how much referrer info is sent
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict access to browser features
  response.headers.set(
    "Permissions-Policy",
    [
      "geolocation=()",
      "microphone=()",
      "camera=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", ")
  );

  // Remove Server header to avoid exposing server info
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");
}
