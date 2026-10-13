import type { PaidTier } from "@/lib/plan";

// Shared USD prices for marketing and payment provisioning.

export const TRIAL_DAYS = 7;
export const ANNUAL_DISCOUNT_PCT = 20;

/** USD per month for each tier. Annual is exactly 20% off (12 × 0.8). */
export const MONTHLY_PRICE: Record<PaidTier, number> = {
  basic: 9,
  pro: 19,
};

export function annualPrice(tier: PaidTier): number {
  return Math.round(MONTHLY_PRICE[tier] * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100) * 100) / 100;
}
