import type { SessionUser } from "./auth/session";

// Access control. NEVER trust the `plan` column alone — a user gets paid
// behavior only when plan names a paid tier AND the subscription is active or
// trialing. Webhook delivery can lag or fail (PRD constraint + Phase 4.3), so
// this cross-check is the single source of truth used everywhere in the app.
//
// There is no free tier: users without an active/trialing subscription hit the
// dashboard paywall. 'trialing' grants full access — Polar collects the card at
// checkout and converts the 7-day trial automatically.

export type PaidTier = "basic" | "pro";
export type EffectivePlan = "none" | PaidTier;

const ACCESS_STATUSES = new Set(["active", "trialing"]);

export function hasAccess(
  user: Pick<SessionUser, "plan" | "subscriptionStatus">
): boolean {
  return (
    (user.plan === "basic" || user.plan === "pro") &&
    ACCESS_STATUSES.has(user.subscriptionStatus ?? "")
  );
}

export function effectivePlan(
  user: Pick<SessionUser, "plan" | "subscriptionStatus">
): EffectivePlan {
  return hasAccess(user) ? (user.plan as PaidTier) : "none";
}
