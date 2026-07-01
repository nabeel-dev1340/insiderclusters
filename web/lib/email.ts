import "server-only";

// Email transport (Phase 5). Sends via Resend when RESEND_API_KEY is set;
// otherwise falls back to a dev transport that logs the link to the server
// console so the auth flow stays fully testable locally without a provider.
//
// SDK-free (a single fetch to Resend) to match the scraper's transport and keep
// the dependency surface small.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM = process.env.ALERT_FROM_EMAIL ?? "InsiderClusters <support@beelodev.com>";

async function send(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        JSON.stringify({ level: "error", msg: "email send failed", status: res.status, body: body.slice(0, 500) })
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({ level: "error", msg: "email send threw", error: (err as Error).message })
    );
    return false;
  }
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const subject = "Your InsiderClusters sign-in link";
  const text = [
    "Sign in to InsiderClusters by opening the link below:",
    "",
    link,
    "",
    "This link expires shortly and can only be used once. If you didn't request it, ignore this email.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <h1 style="font-size:18px;color:#111827;margin:0 0 16px">Sign in to InsiderClusters</h1>
    <p style="font-size:14px;color:#374151;margin:0 0 20px">Click the button below to sign in. This link expires shortly and can only be used once.</p>
    <a href="${link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:8px">Sign in</a>
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0">If the button doesn't work, paste this URL into your browser:<br>${link}</p>
    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0">If you didn't request this, you can safely ignore this email.</p>
  </div>
</body></html>`;

  const sent = await send({ to: email, subject, text, html });
  if (!sent) {
    // Dev transport / provider unavailable: log so local auth still works.
    console.info(
      JSON.stringify({ level: "info", msg: "magic link (dev transport)", email, link })
    );
  }
}
