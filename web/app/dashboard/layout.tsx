import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Authoritative session check for every /dashboard/* route (Feature 2.3).
// Validates the session against the DB (existence + expiry), not just the
// cookie's presence. Redirects to /login when absent or expired.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold tracking-tight">InsiderClusters</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500">{user.email}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {user.plan}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
