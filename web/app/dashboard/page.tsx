import { getCurrentUser } from "@/lib/auth/session";

// Dashboard home. The real cluster feed lands in Phase 3; for now this confirms
// the authenticated session end-to-end.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        You are signed in as <strong>{user?.email}</strong>.
      </p>
      <p className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        The cluster feed will appear here in Phase 3.
      </p>
    </div>
  );
}
