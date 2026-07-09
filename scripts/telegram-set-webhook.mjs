// One-time Telegram webhook registration (Phase 6).
//
// Tells Telegram to POST bot updates to our web app's webhook route, with a
// secret token it echoes back on every call (verified in the route handler).
// Idempotent — safe to re-run after changing APP_URL or the secret.
//
// Usage (from repo root):
//   npm run telegram:webhook            # register APP_URL/api/telegram/webhook
//   npm run telegram:webhook -- info    # show the current webhook status
//   npm run telegram:webhook -- delete  # remove the webhook
//
// Requires TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and APP_URL in the env
// (loaded from .env via the npm script's --env-file-if-exists).

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
const mode = process.argv[2] ?? "set";

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!token) die("TELEGRAM_BOT_TOKEN is not set.");

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) die(`${method} failed: ${JSON.stringify(json)}`);
  return json.result;
}

if (mode === "info") {
  console.log(JSON.stringify(await api("getWebhookInfo"), null, 2));
} else if (mode === "delete") {
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log("Webhook deleted.");
} else if (mode === "set") {
  if (!secret) die("TELEGRAM_WEBHOOK_SECRET is not set.");
  if (!appUrl) die("APP_URL is not set.");
  const url = `${appUrl}/api/telegram/webhook`;
  await api("setWebhook", {
    url,
    secret_token: secret,
    // We only ever act on messages; skip the rest of the update firehose.
    allowed_updates: ["message"],
  });
  console.log(`Webhook set -> ${url}`);
} else {
  die(`Unknown mode "${mode}". Use: set | info | delete`);
}
