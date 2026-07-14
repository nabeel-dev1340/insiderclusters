import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { PaidTier } from "@/lib/plan";
import { MONTHLY_PRICE, annualPrice, TRIAL_DAYS, ANNUAL_DISCOUNT_PCT } from "@/lib/billing";

// Single source of truth for plan marketing copy, reused on the landing page,
// the /pricing route, and the dashboard paywall. There is no free plan: both
// tiers carry a 7-day free trial (Polar collects the card at checkout, no
// charge until the trial ends), and each has a monthly and an annual product —
// the annual option is offered on Polar's checkout page itself.

export const PRO_PRICE_MONTHLY = MONTHLY_PRICE.pro;

interface Plan {
  id: PaidTier;
  name: string;
  tagline: string;
  featured?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Every cluster, in real time.",
    features: [
      "Real-time cluster feed — no delay, no caps",
      "Full multi-year cluster history",
      "Weekly email digest of the top cluster",
      "Direct links to the underlying SEC filings",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Hear about it the moment it's detected.",
    featured: true,
    features: [
      "Everything in Basic",
      "Instant email alerts as clusters form",
      "Instant Telegram alerts as clusters form",
      "Cancel anytime",
    ],
  },
];

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * `checkout` — link CTAs straight to /checkout (viewer has an account).
 * Default links to /login: signup first, then the paywall hands them here.
 */
export function PricingCards({ checkout = false }: { checkout?: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "flex flex-col rounded-2xl border bg-surface p-6 shadow-sm",
            plan.featured ? "border-accent/50 ring-1 ring-accent/20" : "border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            {plan.featured && <Badge tone="accent">Most popular</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tracking-tight">
              ${MONTHLY_PRICE[plan.id]}
            </span>
            <span className="text-sm text-muted">per month</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            or ${annualPrice(plan.id)}/year — save {ANNUAL_DISCOUNT_PCT}%
          </p>

          <ButtonLink
            href={checkout ? `/checkout?plan=${plan.id}` : "/login"}
            variant={plan.featured ? "primary" : "secondary"}
            className="mt-5 w-full"
          >
            Start {TRIAL_DAYS}-day free trial
          </ButtonLink>

          <ul className="mt-6 space-y-3 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
