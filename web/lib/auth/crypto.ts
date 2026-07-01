import "server-only";
import { randomBytes, createHash } from "node:crypto";

// Magic-link and session tokens are random 256-bit strings. We store only their
// SHA-256 hash in the database — the raw token lives in the email link / cookie.
// A DB leak therefore does not expose usable tokens.

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
