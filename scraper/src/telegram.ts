// Feature 6.1 — Telegram transport (Bot API sendMessage).
//
// Deliberately SDK-free: a single fetch to api.telegram.org, matching email.ts
// and the scraper's dependency-light style. The dispatcher (alerts.ts) owns the
// "who / when / dedupe" logic; this module only puts one message on the wire and
// reports success/failure. When no bot token is configured this is a no-op that
// returns false (caller treats that as "not dispatched").

import { config } from "./config.ts";
import { log } from "./logger.ts";

export interface TelegramMessage {
  chatId: string;
  /** HTML-formatted body. Only Telegram's HTML subset is supported — callers
   *  must escape user-supplied text with `telegramEscape` first. */
  text: string;
}

/**
 * Send one message via the Telegram Bot API. Returns true on success, false on
 * failure — never throws, so a provider hiccup can't crash the scraper cycle.
 */
export async function sendTelegram(msg: TelegramMessage): Promise<boolean> {
  if (!config.telegramBotToken) {
    log.warn("telegram skipped (TELEGRAM_BOT_TOKEN unset)", { chatId: msg.chatId });
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chatId,
          text: msg.text,
          parse_mode: "HTML",
          // Alerts are self-contained; the inline link is enough without a fat
          // link-preview card blowing up the message.
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("telegram send failed", {
        chatId: msg.chatId,
        status: res.status,
        body: body.slice(0, 500),
      });
      return false;
    }
    return true;
  } catch (err) {
    log.error("telegram send threw", { chatId: msg.chatId, error: (err as Error).message });
    return false;
  }
}

/** Escape text for Telegram's HTML parse mode (only &, <, > are special). */
export function telegramEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
