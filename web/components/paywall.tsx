import { PricingCards } from "@/components/pricing";
import { TRIAL_DAYS, ANNUAL_DISCOUNT_PCT } from "@/lib/billing";

// Hard paywall (no free tier). The dashboard layout renders this instead of
// the page for any signed-in user without an active or trialing subscription —
// both brand-new accounts and lapsed subscribers land here.
export function Paywall({ lapsed }: { lapsed: boolean }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {lapsed ? "Your subscription has ended" : "Pick your plan to unlock the feed"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          {lapsed
            ? "Restart below to get back to the real-time cluster feed — your account, history, and alert settings are all still here."
            : `Every insider cluster buy, in real time. Both plans start with a ${TRIAL_DAYS}-day free trial — no charge until it ends, cancel anytime.`}
        </p>
      </div>

      <div className="mt-10">
        <PricingCards checkout />
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Annual billing ({ANNUAL_DISCOUNT_PCT}% off) is offered at checkout. Card
        handled by Polar, our payment provider.
      </p>
    </div>
  );
}
