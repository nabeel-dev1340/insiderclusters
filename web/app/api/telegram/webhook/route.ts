import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { linkChat, sendTelegram } from "@/lib/telegram";
import { logger } from "@/lib/logger";

// Telegram Bot webhook (Phase 6). Telegram POSTs each update here. We only care
// about text commands in private chats:
//   /start <code>  link this chat to the account that generated <code>
//   /stop          pause Telegram alerts for this chat
//
// Security: Telegram is told a secret token at setWebhook time and echoes it in
// the X-Telegram-Bot-Api-Secret-Token header on every call. We reject anything
// without the matching secret, so nobody can spoof updates against this URL.
//
// We always answer 200 for *accepted* updates (even user errors like a bad
// code): a non-200 makes Telegram retry the same update repeatedly.

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    logger.error("telegram", "webhook hit but TELEGRAM_WEBHOOK_SECRET is unset");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    logger.security("Telegram webhook bad secret token");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true }); // malformed body — ack and drop
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (chatId == null || !text) return NextResponse.json({ ok: true });

  const chat = String(chatId);

  try {
    if (text.startsWith("/start")) {
      const code = text.slice("/start".length).trim();
      if (!code) {
        await sendTelegram(
          chat,
          "👋 Welcome to <b>InsiderClusters</b>. To receive alerts here, open your " +
            "dashboard → Settings → Telegram and tap <b>Connect Telegram</b>."
        );
      } else if (await linkChat(code, chat)) {
        await sendTelegram(
          chat,
          "✅ <b>Connected!</b> You'll now get insider cluster-buy alerts here. " +
            "Send /stop any time to pause them."
        );
      } else {
        await sendTelegram(
          chat,
          "⚠️ That link has expired or was already used. Generate a fresh one from " +
            "your dashboard → Settings → Telegram."
        );
      }
    } else if (text.startsWith("/stop")) {
      const { rowCount } = await pool.query(
        `UPDATE users SET telegram_alerts_enabled = FALSE WHERE telegram_chat_id = $1`,
        [chat]
      );
      await sendTelegram(
        chat,
        rowCount
          ? "🔕 Telegram alerts paused. Re-enable them from your dashboard settings."
          : "This chat isn't linked to an InsiderClusters account."
      );
    } else {
      await sendTelegram(
        chat,
        "I only understand /start &lt;code&gt; and /stop. Manage alerts from your " +
          "dashboard → Settings → Telegram."
      );
    }
  } catch (err) {
    // Log but still ack: we don't want Telegram hammering retries on a DB blip.
    logger.error("telegram", "webhook handler error", { error: (err as Error).message });
  }

  return NextResponse.json({ ok: true });
}
