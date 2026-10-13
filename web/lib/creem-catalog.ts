import "server-only";
import type { PaidTier } from "@/lib/plan";
export type BillingInterval = "month" | "year";
const LIVE_PRODUCTS: Record<PaidTier, Record<BillingInterval, string>> = {
  basic: { month: "prod_18QFmUQGKFcMIUkfwplMJ", year: "prod_1R09G8tdRMy4jQY6pLh9ud" },
  pro: { month: "prod_1J9oAsNL2ysvT3R9FvwCOi", year: "prod_3V38EHb7ASlB8XW9UDRbvo" },
};
export function creemProduct(tier: PaidTier, interval: BillingInterval): string {
  if (process.env.CREEM_TEST_MODE !== "true") return LIVE_PRODUCTS[tier][interval];
  const id = process.env[`CREEM_TEST_${tier.toUpperCase()}_${interval.toUpperCase()}_PRODUCT_ID`];
  if (!id) throw new Error("Creem test product is not configured");
  return id;
}
export function creemPlanForProduct(id: string): { tier: PaidTier; interval: BillingInterval } | null {
  for (const tier of ["basic", "pro"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (id === creemProduct(tier, interval)) return { tier, interval };
    }
  }
  return null;
}
