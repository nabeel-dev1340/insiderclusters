import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { pool } from "../db";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE } from "./constants";

const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS ?? 30);

export interface SessionUser {
  id: number;
  email: string;
  plan: string;
  subscriptionStatus: string | null;
  emailAlertsEnabled: boolean;
}

/**
 * Find-or-create the user for `email`, then create a session row. Returns the
 * raw session token + expiry; the caller sets the cookie on its response
 * (cookies can only be written from a Route Handler / Server Function).
 */
export async function createSession(
  email: string
): Promise<{ token: string; expiresAt: Date }> {
  const { rows: userRows } = await pool.query<{ id: number }>(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email]
  );
  const userId = userRows[0]!.id;

  const token = generateToken();
  const { rows } = await pool.query<{ expires_at: Date }>(
    `INSERT INTO sessions (user_id, session_token, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)
     RETURNING expires_at`,
    [userId, hashToken(token), SESSION_TTL_DAYS]
  );
  return { token, expiresAt: rows[0]!.expires_at };
}

/** Attach the session cookie to an outgoing response. */
export function setSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date
): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Clear the session cookie on an outgoing response. */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the current user from the session cookie, validating the session row
 * against the DB (existence + expiry). This is the authoritative check — the
 * proxy only does a coarse cookie-presence gate.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const { rows } = await pool.query<{
    id: number;
    email: string;
    plan: string;
    subscription_status: string | null;
    email_alerts_enabled: boolean;
  }>(
    `SELECT u.id, u.email, u.plan, u.subscription_status, u.email_alerts_enabled
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > now()`,
    [hashToken(raw)]
  );

  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    plan: u.plan,
    subscriptionStatus: u.subscription_status,
    emailAlertsEnabled: u.email_alerts_enabled,
  };
}

/** Delete the session identified by a raw cookie token (for logout). */
export async function deleteSession(rawToken: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [
    hashToken(rawToken),
  ]);
}
