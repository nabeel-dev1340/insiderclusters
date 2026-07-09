// Feature 5.1 / 5.2 — Alert dispatcher + email templates.
//
// Runs once per scraper cycle (every ~5 min). Two independent paths:
//
//   Real-time (paid):  every undispatched cluster is emailed to each eligible
//                      paid user, then clusters.alert_sent_at is stamped so a
//                      re-run sends zero duplicates.
//   Weekly digest (free): the single highest-value cluster of the last N days is
//                      emailed to each eligible free user at most once per N days,
//                      deduped via users.last_digest_sent_at.
//
// The two paths are decoupled on purpose: alert_sent_at gates the paid path only;
// the digest selects by detected_at so it still surfaces the week's top cluster
// even after it's been dispatched in real time.

import { pool } from "@insiderclusters/db";
import { config } from "./config.ts";
import { log } from "./logger.ts";
import { sendEmail } from "./email.ts";
import { sendTelegram, telegramEscape } from "./telegram.ts";
import { posthog } from "./posthog.ts";

export interface DispatchStats {
  clustersDispatched: number;
  realtimeEmails: number;
  digestEmails: number;
  telegramMessages: number;
  emailFailures: number;
  telegramFailures: number;
}

interface ClusterRow {
  id: number;
  ticker: string;
  issuer_name: string;
  market_cap: string | null;
  insider_count: number;
  total_value: string;
  window_start: string;
  window_end: string;
  transaction_ids: number[];
}

interface Recipient {
  id: number;
  email: string;
  telegramChatId: string | null;
  emailAlertsEnabled: boolean;
  telegramAlertsEnabled: boolean;
}

// A recipient can run email, Telegram, both, or neither. The eligibility queries
// guarantee at least one channel is deliverable; these decide which to attempt.
function wantsEmail(r: Recipient): boolean {
  return r.emailAlertsEnabled;
}
function wantsTelegram(r: Recipient): r is Recipient & { telegramChatId: string } {
  return r.telegramAlertsEnabled && r.telegramChatId != null;
}

// --- formatting -------------------------------------------------------------

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function money(v: string | number | null): string {
  const n = typeof v === "string" ? Number(v) : v;
  return n == null || !Number.isFinite(n) ? "—" : USD.format(n);
}
function marketCap(v: string | null): string {
  const n = v == null ? null : Number(v);
  return n == null || !Number.isFinite(n) ? "Unknown" : USD_COMPACT.format(n);
}
function dateRange(start: string, end: string): string {
  return `${DATE.format(new Date(start))} – ${DATE.format(new Date(end))}`;
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- insiders ---------------------------------------------------------------

interface Insider {
  name: string;
  role: string | null;
}

async function clusterInsiders(transactionIds: number[]): Promise<Insider[]> {
  if (transactionIds.length === 0) return [];
  const { rows } = await pool.query<{ insider_name: string; insider_role: string | null }>(
    `SELECT DISTINCT insider_name, insider_role
       FROM transactions
      WHERE id = ANY($1)
      ORDER BY insider_name`,
    [transactionIds]
  );
  return rows.map((r) => ({ name: r.insider_name, role: r.insider_role }));
}

// --- templates --------------------------------------------------------------

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function insidersLine(insiders: Insider[]): string {
  return insiders
    .map((i) => (i.role ? `${i.name} (${i.role})` : i.name))
    .join(", ");
}

function clusterEmail(
  cluster: ClusterRow,
  insiders: Insider[],
  opts: { digest: boolean }
): RenderedEmail {
  const link = `${config.appUrl}/dashboard/clusters/${cluster.id}`;
  const heading = opts.digest
    ? "This week's top insider cluster buy"
    : "New insider cluster buy";
  const subject = opts.digest
    ? `Weekly digest: ${cluster.ticker} — ${insiders.length} insiders bought ${money(
        cluster.total_value
      )}`
    : `Cluster buy: ${cluster.ticker} — ${insiders.length} insiders, ${money(
        cluster.total_value
      )}`;

  const rows: Array<[string, string]> = [
    ["Ticker", cluster.ticker],
    ["Company", cluster.issuer_name],
    ["Insiders", `${cluster.insider_count} (${insidersLine(insiders)})`],
    ["Total bought", money(cluster.total_value)],
    ["Market cap", marketCap(cluster.market_cap)],
    ["Window", dateRange(cluster.window_start, cluster.window_end)],
  ];

  const text = [
    heading,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `View details: ${link}`,
    "",
    "You're receiving this because email alerts are on. Manage them in your dashboard settings.",
  ].join("\n");

  const htmlRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(
          k
        )}</td><td style="padding:6px 0;color:#111827">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <h1 style="font-size:18px;color:#111827;margin:0 0 4px">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;color:#6b7280;margin:0 0 20px">
      <strong style="color:#111827">${escapeHtml(cluster.ticker)}</strong> — ${escapeHtml(
        cluster.issuer_name
      )}
    </p>
    <table style="font-size:14px;border-collapse:collapse;margin-bottom:24px">${htmlRows}</table>
    <a href="${link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:8px">View cluster details</a>
    <p style="font-size:12px;color:#9ca3af;margin:28px 0 0">
      You're receiving this because email alerts are on. Manage them in your
      <a href="${config.appUrl}/dashboard/settings" style="color:#6b7280">dashboard settings</a>.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}

/** Telegram HTML-parse-mode body for a cluster. Mirrors the email content. */
function clusterTelegram(
  cluster: ClusterRow,
  insiders: Insider[],
  opts: { digest: boolean }
): string {
  const link = `${config.appUrl}/dashboard/clusters/${cluster.id}`;
  const heading = opts.digest
    ? "📊 This week's top insider cluster buy"
    : "🚨 New insider cluster buy";
  const e = telegramEscape;

  return [
    `<b>${e(heading)}</b>`,
    "",
    `<b>${e(cluster.ticker)}</b> — ${e(cluster.issuer_name)}`,
    "",
    `Insiders: ${cluster.insider_count} (${e(insidersLine(insiders))})`,
    `Total bought: ${e(money(cluster.total_value))}`,
    `Market cap: ${e(marketCap(cluster.market_cap))}`,
    `Window: ${e(dateRange(cluster.window_start, cluster.window_end))}`,
    "",
    `<a href="${e(link)}">View cluster details</a>`,
  ].join("\n");
}

// --- recipient queries ------------------------------------------------------

// A user is deliverable when at least one channel is on: email, or Telegram with
// a linked chat. Both queries share this predicate so we never return a user we
// can't actually message (which for the digest would spin without ever stamping
// last_digest_sent_at).
const HAS_A_CHANNEL =
  `(email_alerts_enabled = TRUE
    OR (telegram_alerts_enabled = TRUE AND telegram_chat_id IS NOT NULL))`;

const RECIPIENT_COLS = `id, email,
    telegram_chat_id        AS "telegramChatId",
    email_alerts_enabled    AS "emailAlertsEnabled",
    telegram_alerts_enabled AS "telegramAlertsEnabled"`;

/** Paid + active + at least one channel on. */
async function eligiblePaidUsers(): Promise<Recipient[]> {
  const { rows } = await pool.query<Recipient>(
    `SELECT ${RECIPIENT_COLS} FROM users
      WHERE plan = 'paid'
        AND subscription_status = 'active'
        AND ${HAS_A_CHANNEL}`
  );
  return rows;
}

/** Free (not paid+active) + a channel on + not digested within the window. */
async function eligibleDigestUsers(): Promise<Recipient[]> {
  const { rows } = await pool.query<Recipient>(
    `SELECT ${RECIPIENT_COLS} FROM users
      WHERE ${HAS_A_CHANNEL}
        AND NOT (plan = 'paid' AND subscription_status = 'active')
        AND (last_digest_sent_at IS NULL
             OR last_digest_sent_at < now() - ($1 || ' days')::interval)`,
    [config.digestIntervalDays]
  );
  return rows;
}

// --- dispatch ---------------------------------------------------------------

async function dispatchRealtime(stats: DispatchStats): Promise<void> {
  const { rows: clusters } = await pool.query<ClusterRow>(
    `SELECT id, ticker, issuer_name, market_cap, insider_count,
            total_value, window_start::text, window_end::text, transaction_ids
       FROM clusters
      WHERE alert_sent_at IS NULL
      ORDER BY detected_at ASC`
  );
  if (clusters.length === 0) return;

  const recipients = await eligiblePaidUsers();

  for (const cluster of clusters) {
    const insiders = await clusterInsiders(cluster.transaction_ids);
    const email = clusterEmail(cluster, insiders, { digest: false });
    const telegram = clusterTelegram(cluster, insiders, { digest: false });
    const props = { cluster_id: cluster.id, ticker: cluster.ticker };

    for (const r of recipients) {
      if (wantsEmail(r)) {
        if (await sendEmail({ to: r.email, ...email })) {
          stats.realtimeEmails++;
          posthog().capture({ distinctId: r.email, event: "realtime alert sent", properties: props });
        } else {
          stats.emailFailures++;
        }
      }
      if (wantsTelegram(r)) {
        if (await sendTelegram({ chatId: r.telegramChatId, text: telegram })) {
          stats.telegramMessages++;
          posthog().capture({ distinctId: r.email, event: "realtime telegram alert sent", properties: props });
        } else {
          stats.telegramFailures++;
        }
      }
    }

    // Stamp regardless of recipient count so the undispatched set always drains
    // and re-runs never re-send. (Zero recipients => nothing to send, still done.)
    // One stamp covers all channels: a re-run re-sends nothing on email OR Telegram.
    await pool.query(`UPDATE clusters SET alert_sent_at = now() WHERE id = $1`, [
      cluster.id,
    ]);
    stats.clustersDispatched++;
  }
}

async function dispatchDigest(stats: DispatchStats): Promise<void> {
  const { rows } = await pool.query<ClusterRow>(
    `SELECT id, ticker, issuer_name, market_cap, insider_count,
            total_value, window_start::text, window_end::text, transaction_ids
       FROM clusters
      WHERE detected_at >= now() - ($1 || ' days')::interval
      ORDER BY total_value DESC
      LIMIT 1`,
    [config.digestIntervalDays]
  );
  const top = rows[0];
  if (!top) return; // no clusters this week — nothing to digest

  const recipients = await eligibleDigestUsers();
  if (recipients.length === 0) return;

  const insiders = await clusterInsiders(top.transaction_ids);
  const email = clusterEmail(top, insiders, { digest: true });
  const telegram = clusterTelegram(top, insiders, { digest: true });
  const props = { cluster_id: top.id, ticker: top.ticker };

  for (const r of recipients) {
    // Attempt every enabled channel; a channel failure is counted but doesn't
    // block the others. We only stamp last_digest_sent_at when at least one
    // channel delivered, so a total failure retries the whole recipient next
    // cycle (a partial success won't re-fire the succeeded channel — acceptable).
    let delivered = false;

    if (wantsEmail(r)) {
      if (await sendEmail({ to: r.email, ...email })) {
        stats.digestEmails++;
        delivered = true;
        posthog().capture({ distinctId: r.email, event: "digest alert sent", properties: props });
      } else {
        stats.emailFailures++;
      }
    }
    if (wantsTelegram(r)) {
      if (await sendTelegram({ chatId: r.telegramChatId, text: telegram })) {
        stats.telegramMessages++;
        delivered = true;
        posthog().capture({ distinctId: r.email, event: "digest telegram alert sent", properties: props });
      } else {
        stats.telegramFailures++;
      }
    }

    if (delivered) {
      await pool.query(`UPDATE users SET last_digest_sent_at = now() WHERE id = $1`, [r.id]);
    }
  }
}

/** Run both dispatch paths. Never throws — failures are logged and counted. */
export async function dispatchAlerts(): Promise<DispatchStats> {
  const stats: DispatchStats = {
    clustersDispatched: 0,
    realtimeEmails: 0,
    digestEmails: 0,
    telegramMessages: 0,
    emailFailures: 0,
    telegramFailures: 0,
  };

  await dispatchRealtime(stats);
  await dispatchDigest(stats);

  if (
    stats.clustersDispatched ||
    stats.digestEmails ||
    stats.telegramMessages ||
    stats.emailFailures ||
    stats.telegramFailures
  ) {
    log.info("alerts dispatched", { ...stats });
  }
  return stats;
}
