import type { SessionUser } from "./auth/session";

// Access control. NEVER trust the `plan` column alone — a user gets paid
// behavior only when plan is 'paid' AND the subscription is active. Webhook
// delivery can lag or fail (PRD constraint + Phase 4.3), so this cross-check is
// the single source of truth used everywhere in the app.
export function isPaid(user: Pick<SessionUser, "plan" | "subscriptionStatus">): boolean {
  return user.plan === "paid" && user.subscriptionStatus === "active";
}

export type EffectivePlan = "free" | "paid";

export function effectivePlan(
  user: Pick<SessionUser, "plan" | "subscriptionStatus">
): EffectivePlan {
  return isPaid(user) ? "paid" : "free";
}

// Free-tier limits (PRD 3.2): feed is delayed 24h and capped at 1 cluster/week.
export const FREE_DELAY_HOURS = 24;
export const FREE_CLUSTERS_PER_WEEK = 1;
