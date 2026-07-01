import "server-only";

// Email transport. Phase 5 wires a real provider (Resend/SES). Until then, the
// dev transport logs the link to the server console so the auth flow is fully
// testable locally without an email provider.

export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    // Phase 5: send via Resend here.
    // (Intentionally not implemented yet — falls through to the log transport.)
  }

  console.info(
    JSON.stringify({ level: "info", msg: "magic link (dev transport)", email, link })
  );
}
