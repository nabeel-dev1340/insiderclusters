"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { pool } from "@/lib/db";
import { posthog } from "@/lib/posthog";
import { createLinkToken, botDeepLink } from "@/lib/telegram";

// Persist the email-alerts preference. The Phase 5 dispatcher reads
// `email_alerts_enabled`, so turning this off suppresses the next email.
export async function setEmailAlerts(enabled: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await pool.query(`UPDATE users SET email_alerts_enabled = $1 WHERE id = $2`, [
    enabled,
    user.id,
  ]);

  posthog().capture({
    distinctId: user.email,
    event: "email alerts toggled",
    properties: { enabled },
  });

  revalidatePath("/dashboard/settings");
}

// --- Telegram (Phase 6) -----------------------------------------------------

// Mint a one-time connect link. The user opens it in Telegram; pressing Start
// fires `/start <code>` to our webhook, which binds their chat to this account.
export async function connectTelegram(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const token = await createLinkToken(user.id);
  posthog().capture({ distinctId: user.email, event: "telegram connect started" });
  return botDeepLink(token);
}

// Toggle Telegram delivery. Only meaningful once a chat is linked; the dispatcher
// requires both telegram_alerts_enabled AND a chat id.
export async function setTelegramAlerts(enabled: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await pool.query(`UPDATE users SET telegram_alerts_enabled = $1 WHERE id = $2`, [
    enabled,
    user.id,
  ]);

  posthog().capture({
    distinctId: user.email,
    event: "telegram alerts toggled",
    properties: { enabled },
  });

  revalidatePath("/dashboard/settings");
}

// Unlink Telegram entirely: clears the chat binding and disables the channel.
export async function disconnectTelegram(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE users
        SET telegram_chat_id = NULL, telegram_alerts_enabled = FALSE
      WHERE id = $1`,
    [user.id]
  );

  posthog().capture({ distinctId: user.email, event: "telegram disconnected" });
  revalidatePath("/dashboard/settings");
}
