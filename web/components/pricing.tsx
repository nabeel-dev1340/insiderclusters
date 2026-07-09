import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// Single source of truth for plan marketing copy, reused on the landing page
// and the dedicated /pricing route. Billing (Lemon Squeezy) is not wired yet —
// both CTAs start the free magic-link signup; upgrading happens in-app once
// checkout ships, so we never advertise a flow that doesn't exist.

export const PRO_PRICE_MONTHLY = 19;

interface Plan {
  id: "free" | "pro";
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  cta: string;
  href: string;
  featured?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "See the signal, one week behind.",
    cta: "Get started free",
    href: "/login",
    features: [
      "One cluster per week, on a 24-hour delay",
      "Full transaction breakdown for each cluster",
      "Public ticker history pages",
      "Direct links to the underlying SEC filings",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: `$${PRO_PRICE_MONTHLY}`,
    cadence: "per month",
    tagline: "Every cluster, the moment it's detected.",
    cta: "Start free, upgrade in-app",
    href: "/login",
    featured: true,
    features: [
      "Real-time clusters — no 24-hour delay",
      "Unlimited feed and full cluster history",
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

export function PricingCards() {
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
            <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
            <span className="text-sm text-muted">{plan.cadence}</span>
          </div>

          <ButtonLink
            href={plan.href}
            variant={plan.featured ? "primary" : "secondary"}
            className="mt-5 w-full"
          >
            {plan.cta}
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
