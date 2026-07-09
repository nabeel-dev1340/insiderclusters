import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailAlertsToggle } from "@/components/email-alerts-toggle";
import { TelegramConnect } from "@/components/telegram-connect";
import { BillingButton } from "@/components/billing-button";

const PRO_FEATURES = [
  "Real-time cluster alerts (no 24h delay)",
  "Full cluster history, no weekly cap",
  "Email + Telegram alerts",
];

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const plan = effectivePlan(user);

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
            plan === "paid"
              ? "You have real-time access to every cluster."
              : "Free — delayed 24h, one cluster per week."
          }
        >
          <Badge tone={plan === "paid" ? "accent" : "muted"} className="uppercase">
            {plan === "paid" ? "Pro" : "Free"}
          </Badge>
        </Row>

        {plan === "paid" ? (
          <div className="px-5 py-4">
            <BillingButton label="Manage subscription" />
          </div>
        ) : (
          <div className="px-5 py-5">
            <p className="text-sm font-medium">Upgrade to Pro</p>
            <ul className="mt-3 space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <BillingButton label="Upgrade to Pro" />
            </div>
          </div>
        )}
      </Section>

      {/* Alerts */}
      <Section title="Alerts">
        <Row
          label="Email alerts"
          description="Get an email when a new cluster is detected."
        >
          <EmailAlertsToggle initial={user.emailAlertsEnabled} />
        </Row>
        <Row
          label="Telegram"
          description={
            user.telegramLinked
              ? "Connected. Get cluster alerts in Telegram."
              : "Get cluster alerts as Telegram messages."
          }
        >
          <TelegramConnect
            linked={user.telegramLinked}
            alertsEnabled={user.telegramAlertsEnabled}
          />
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
