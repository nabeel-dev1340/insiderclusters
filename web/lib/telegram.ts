import "server-only";

// Telegram linking + reply transport (Phase 6, web side).
//
// The scraper owns *alert* delivery (scraper/src/telegram.ts). This module owns
// the account-linking half that lives in the web app:
//   - createLinkToken:  mint a one-time deep-link code stored (hashed) in the DB.
//   - linkChat:         redeem a code, binding a Telegram chat to a user.
//   - sendTelegram:     reply to the user from the webhook (connect confirmation).
//
// SDK-free (a single fetch to api.telegram.org) to match lib/email.ts.

import { randomBytes, createHash } from "node:crypto";
import { pool } from "./db";
import { logger } from "./logger";

const LINK_TOKEN_TTL_MINUTES = Number(
  process.env.TELEGRAM_LINK_TTL_MINUTES ?? 15
);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mint a single-use link code for `userId` and return the raw code (goes in the
 * deep link). Only its hash is stored. Any older unused codes for this user are
 * invalidated so at most one is live at a time.
 */
export async function createLinkToken(userId: number): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await pool.query(
    `UPDATE telegram_link_tokens SET used = TRUE
      WHERE user_id = $1 AND used = FALSE`,
    [userId]
  );
  await pool.query(
    `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [userId, hashToken(token), LINK_TOKEN_TTL_MINUTES]
  );
  return token;
}

/**
 * Redeem a link code sent by the bot's `/start <code>` and bind `chatId` to the
 * owning user (enabling Telegram alerts). Single-use and expiry-checked.
 * Returns true when a chat was linked, false when the code is invalid/expired.
 */
export async function linkChat(token: string, chatId: string): Promise<boolean> {
  const { rows } = await pool.query<{ id: number; user_id: number }>(
    `UPDATE telegram_link_tokens
        SET used = TRUE
      WHERE id = (
        SELECT id FROM telegram_link_tokens
         WHERE token_hash = $1 AND used = FALSE AND expires_at > now()
         LIMIT 1
      )
      RETURNING id, user_id`,
    [hashToken(token)]
  );
  const row = rows[0];
  if (!row) return false;

  await pool.query(
    `UPDATE users
        SET telegram_chat_id = $1, telegram_alerts_enabled = TRUE
      WHERE id = $2`,
    [chatId, row.user_id]
  );
  return true;
}

/** The bot's public deep link that opens a chat and pre-fills `/start <token>`. */
export function botDeepLink(token: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

/**
 * Send one message via the Telegram Bot API (used for webhook replies). Returns
 * true on success. Never throws. No-op returning false when the token is unset.
 */
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      logger.error("telegram", "reply send failed", { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("telegram", "reply send threw", { error: (err as Error).message });
    return false;
  }
}
