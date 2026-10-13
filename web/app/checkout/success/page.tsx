import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAccess } from "@/lib/plan";
import { ButtonLink } from "@/components/ui/button";
import { PaymentRefresh } from "./payment-refresh";
export const metadata: Metadata = { title: "Confirming your subscription", robots: { index: false, follow: false } };
export default async function CheckoutSuccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcheckout%2Fsuccess");
  if (hasAccess(user)) redirect("/dashboard");
  return (
    <main id="main-content" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl">Confirming your subscription</h1>
      <p className="mt-4 text-muted">We are waiting for confirmation from Creem. This page will refresh automatically. Your access starts once the subscription is confirmed.</p>
      <PaymentRefresh />
      <ButtonLink href="/dashboard" className="mt-6">Check dashboard</ButtonLink>
      <ButtonLink href="/billing" variant="secondary" className="mt-4">Manage billing</ButtonLink>
    </main>
  );
}
