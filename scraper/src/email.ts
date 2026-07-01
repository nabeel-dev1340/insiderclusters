// Feature 5.1 — Email transport (Resend REST API).
//
// Deliberately SDK-free: a single fetch call to Resend, matching the scraper's
// dependency-light style (it already talks to EDGAR over plain fetch). The
// dispatcher (alerts.ts) owns the "who / when / dedupe" logic; this module only
// puts one message on the wire and reports success/failure.

import { config } from "./config.ts";
import { log } from "./logger.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send one email via Resend. Returns true on success, false on failure — never
 * throws, so a provider hiccup can't crash the scraper cycle. When no API key
 * is configured this is a no-op that returns false (caller treats that as "not
 * dispatched").
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (!config.resendApiKey) {
    log.warn("email skipped (RESEND_API_KEY unset)", { to: msg.to, subject: msg.subject });
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.alertFromEmail,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("email send failed", {
        to: msg.to,
        status: res.status,
        body: body.slice(0, 500),
      });
      return false;
    }
    return true;
  } catch (err) {
    log.error("email send threw", { to: msg.to, error: (err as Error).message });
    return false;
  }
}
