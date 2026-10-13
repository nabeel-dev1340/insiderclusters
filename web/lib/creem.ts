import "server-only";
import { z } from "zod";

// Lazy configuration: builds do not require payment credentials. Provider
// response bodies contain customer data and must not be logged.
export async function creemRequest<T>(path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) throw new Error("Creem API key is not configured");
  const origin = process.env.CREEM_TEST_MODE === "true"
    ? "https://test-api.creem.io" : "https://api.creem.io";
  const response = await fetch(`${origin}/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Creem request failed (${response.status})`);
  return response.json() as Promise<T>;
}
const reference = z.union([z.string().min(1), z.object({ id: z.string().min(1) })]);
export const subscriptionSchema = z.object({
  id: z.string().startsWith("sub_"), mode: z.enum(["prod", "test", "sandbox"]),
  product: reference, customer: reference, status: z.string().min(1),
  current_period_end_date: z.string().datetime({ offset: true }).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type CreemSubscription = z.infer<typeof subscriptionSchema>;
export function referenceId(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}
export async function retrieveSubscription(id: string): Promise<CreemSubscription> {
  return subscriptionSchema.parse(await creemRequest(
    `subscriptions?subscription_id=${encodeURIComponent(id)}`,
  ));
}
export function creemRedirectUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" ||
      !(url.hostname === "creem.io" || url.hostname.endsWith(".creem.io"))) {
    throw new Error("Unexpected Creem redirect URL");
  }
  return url;
}
