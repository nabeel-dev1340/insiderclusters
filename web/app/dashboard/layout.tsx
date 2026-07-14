import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { DashboardNav } from "@/components/dashboard-nav";
import { Paywall } from "@/components/paywall";

// Defense in depth: the whole /dashboard/* area is gated (redirects to /login)
// and Disallow-ed in robots.txt, but robots.txt only blocks crawling — a URL
// linked externally could still be indexed URL-only. An explicit noindex on the
// segment ensures none of these authenticated pages ever enter the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Authoritative session check for every /dashboard/* route (Feature 2.3).
// Validates the session against the DB (not just cookie presence) and computes
// the effective plan (plan + subscription cross-check) for the whole area.
// No free tier: without an active/trialing subscription, every dashboard route
// renders the paywall instead of its page.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = effectivePlan(user);

  return (
    <div className="flex min-h-full flex-col">
      <DashboardNav email={user.email} plan={plan} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {plan === "none" ? (
          <Paywall lapsed={user.plan === "basic" || user.plan === "pro"} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
