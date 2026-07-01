import "server-only";
import { pool } from "../db";
import { generateToken, hashToken } from "./crypto";

const TOKEN_TTL_MINUTES = Number(process.env.AUTH_TOKEN_TTL_MINUTES ?? 15);

/**
 * Create a magic-link token for an email. Stores only the token hash with an
 * expiry; returns the raw token to embed in the emailed link.
 */
export async function createMagicToken(email: string): Promise<string> {
  const token = generateToken();
  await pool.query(
    `INSERT INTO auth_tokens (email, token, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [email, hashToken(token), TOKEN_TTL_MINUTES]
  );
  return token;
}

/**
 * Atomically validate and consume a token. The single UPDATE marks the token
 * used only if it is currently unused and unexpired, so a reused or expired
 * token returns null and concurrent verifies can't both succeed.
 */
export async function consumeToken(token: string): Promise<{ email: string } | null> {
  const { rows } = await pool.query<{ email: string }>(
    `UPDATE auth_tokens
        SET used = TRUE
      WHERE token = $1 AND used = FALSE AND expires_at > now()
      RETURNING email`,
    [hashToken(token)]
  );
  return rows[0] ? { email: rows[0].email } : null;
}
