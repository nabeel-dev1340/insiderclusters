import type { PaidTier } from "@/lib/plan";

// Billing catalog — the Polar wiring for the two paid tiers. Marketing copy
// lives in components/pricing.tsx; this file owns product ids and price math.
//
// The ids are production Polar products (org `insiderclusters`), created via
// the API with a 7-day trial and metadata {tier, interval}. They are not
// secrets. Checkout links are built from them; the webhook resolves them back
// to a tier via tierForProduct, so access grants never hardcode ids elsewhere.

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

/** Polar product ids per tier and billing interval. */
export const POLAR_PRODUCTS: Record<PaidTier, { month: string; year: string }> = {
  basic: {
    month: "52b3645d-32c8-4f69-9900-9c1701646a85",
    year: "6aee14c3-f2f3-421b-bc19-aea615218d6a",
  },
  pro: {
    month: "2628c4fd-38c8-4948-8095-50d25d18db9d",
    year: "a5036a7a-e7fb-4b76-be3c-338f79245a3a",
  },
};

/** Reverse lookup for webhook payloads. Unknown ids return null (log those). */
export function tierForProduct(productId: string): PaidTier | null {
  for (const tier of ["basic", "pro"] as const) {
    const ids = POLAR_PRODUCTS[tier];
    if (productId === ids.month || productId === ids.year) return tier;
  }
  return null;
}
