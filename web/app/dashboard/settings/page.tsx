import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { MONTHLY_PRICE } from "@/lib/billing";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmailAlertsToggle } from "@/components/email-alerts-toggle";
import { TelegramConnect } from "@/components/telegram-connect";

const PRO_EXTRAS = [
  "Instant email alerts as clusters form",
  "Instant Telegram alerts as clusters form",
];

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const plan = effectivePlan(user); // "basic" | "pro" — paywall guards "none"
  const trialing = user.subscriptionStatus === "trialing";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Account */}
      <Section title="Account">
        <Row label="Email" description="Used for sign-in and alerts.">
          <span className="text-sm">{user.email}</span>
        </Row>
      </Section>

      {/* Plan / billing */}
      <Section title="Plan">
        <Row
          label="Current plan"
          description={
            plan === "pro"
              ? "Real-time feed plus instant email and Telegram alerts."
              : "Real-time feed and history, with a weekly email digest."
          }
        >
          <span className="flex items-center gap-2">
            {trialing && <Badge tone="muted">Trial</Badge>}
            <Badge tone="accent" className="uppercase">
              {plan === "pro" ? "Pro" : "Basic"}
            </Badge>
          </span>
        </Row>

        {plan === "basic" && (
          <div className="px-5 py-5">
            <p className="text-sm font-medium">
              Upgrade to Pro — ${MONTHLY_PRICE.pro}/month
            </p>
            <ul className="mt-3 space-y-2">
              {PRO_EXTRAS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <ButtonLink href="/checkout?plan=pro">Upgrade to Pro</ButtonLink>
            </div>
          </div>
        )}

        <Row
          label="Billing"
          description="Invoices, card, plan changes, and cancellation are handled by Polar — use the secure link in any Polar receipt email."
        >
          <span />
        </Row>
      </Section>

      {/* Alerts */}
      <Section title="Alerts">
        <Row
          label="Email alerts"
          description={
            plan === "pro"
              ? "Get an email the moment a new cluster is detected."
              : "Get the weekly digest email. Instant per-cluster email is a Pro feature."
          }
        >
          <EmailAlertsToggle initial={user.emailAlertsEnabled} />
        </Row>
        <Row
          label="Telegram"
          description={
            plan !== "pro"
              ? "Instant Telegram alerts are a Pro feature."
              : user.telegramLinked
                ? "Connected. Get cluster alerts in Telegram."
                : "Get cluster alerts as Telegram messages."
          }
        >
          {plan === "pro" ? (
            <TelegramConnect
              linked={user.telegramLinked}
              alertsEnabled={user.telegramAlertsEnabled}
            />
          ) : (
            <ButtonLink href="/checkout?plan=pro" size="sm" variant="secondary">
              Upgrade
            </ButtonLink>
          )}
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <Card>
        <div className="divide-y divide-border">{children}</div>
      </Card>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-sm text-muted">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="text-accent"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
