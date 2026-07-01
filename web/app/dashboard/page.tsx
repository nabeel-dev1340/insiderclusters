import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import { getClusterFeed } from "@/lib/clusters";
import { ClusterCard } from "@/components/cluster-card";
import { ButtonLink } from "@/components/ui/button";

const PAGE_SIZE = 12;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = (await getCurrentUser())!; // guaranteed by layout
  const plan = effectivePlan(user);
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { clusters, total, hiddenCount } = await getClusterFeed(plan, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cluster feed</h1>
          <p className="mt-1 text-sm text-muted">
            {plan === "paid"
              ? "Real-time. Newest cluster buys first."
              : "Free plan — delayed 24h, one cluster per week."}
          </p>
        </div>
        {plan === "free" && (
          <ButtonLink href="/dashboard/settings" size="sm">
            Upgrade to Pro
          </ButtonLink>
        )}
      </div>

      {plan === "free" && hiddenCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm">
            <span className="font-semibold text-accent">
              {hiddenCount} more cluster{hiddenCount === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-muted">
              are available in real time on Pro, plus the full history.
            </span>
          </p>
          <ButtonLink href="/dashboard/settings" size="sm">
            Unlock real-time
          </ButtonLink>
        </div>
      )}

      {clusters.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No clusters yet</p>
          <p className="mt-1 text-sm text-muted">
            New insider cluster buys will appear here as they&apos;re detected.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {clusters.map((c) => (
            <ClusterCard
              key={c.id}
              cluster={c}
              isNew={Date.now() - new Date(c.detectedAt).getTime() < NEW_WINDOW_MS}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
          <PageLink page={page - 1} disabled={page <= 1} label="← Prev" />
          <span className="text-muted tabular-nums">
            Page {page} of {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages} label="Next →" />
        </nav>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-md px-3 py-1.5 text-muted opacity-50">{label}</span>;
  }
  return (
    <Link
      href={`/dashboard?page=${page}`}
      className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-surface-muted"
    >
      {label}
    </Link>
  );
}
