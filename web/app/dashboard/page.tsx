import Link from "next/link";
import { getClusterFeed, type FeedSort } from "@/lib/clusters";
import { ClusterCard } from "@/components/cluster-card";

const PAGE_SIZE = 12;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "biggest", label: "Biggest" },
];

// Size tiers, InsiderAction-style — every cluster has ≥2 insiders by definition.
const TIERS: { value: number; label: string }[] = [
  { value: 2, label: "All" },
  { value: 3, label: "3+" },
  { value: 5, label: "5+" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; tier?: string }>;
}) {
  const { page: pageParam, sort: sortParam, tier: tierParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sort: FeedSort = sortParam === "biggest" ? "biggest" : "newest";
  const minInsiders = TIERS.some((t) => t.value === Number(tierParam))
    ? Number(tierParam)
    : 2;

  const { clusters, total } = await getClusterFeed(page, PAGE_SIZE, {
    sort,
    minInsiders,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build a feed URL preserving the current sort/tier (page changes reset to 1).
  const feedUrl = (next: { page?: number; sort?: FeedSort; tier?: number }) => {
    const p = new URLSearchParams();
    const s = next.sort ?? sort;
    const t = next.tier ?? minInsiders;
    const pg = next.page ?? 1;
    if (s !== "newest") p.set("sort", s);
    if (t !== 2) p.set("tier", String(t));
    if (pg !== 1) p.set("page", String(pg));
    const qs = p.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cluster feed</h1>
          <p className="mt-1 text-sm text-muted">
            Real-time. Newest cluster buys first.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Sort">
          {SORTS.map((s) => (
            <SegLink
              key={s.value}
              href={feedUrl({ sort: s.value })}
              active={sort === s.value}
              label={s.label}
            />
          ))}
        </Segmented>
        <Segmented label="Insiders">
          {TIERS.map((t) => (
            <SegLink
              key={t.value}
              href={feedUrl({ tier: t.value })}
              active={minInsiders === t.value}
              label={t.label}
            />
          ))}
        </Segmented>
      </div>

      {clusters.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">
            {minInsiders > 2 ? "No clusters this large yet" : "No clusters yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {minInsiders > 2 ? (
              <>
                Try the{" "}
                <Link href={feedUrl({ tier: 2 })} className="text-accent hover:underline">
                  All
                </Link>{" "}
                filter — nothing hit {minInsiders}+ insiders.
              </>
            ) : (
              <>New insider cluster buys will appear here as they&apos;re detected.</>
            )}
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
          <PageLink href={feedUrl({ page: page - 1 })} disabled={page <= 1} label="← Prev" />
          <span className="text-muted tabular-nums">
            Page {page} of {totalPages}
          </span>
          <PageLink href={feedUrl({ page: page + 1 })} disabled={page >= totalPages} label="Next →" />
        </nav>
      )}
    </div>
  );
}

function Segmented({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {children}
      </div>
    </div>
  );
}

function SegLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
          : "rounded-md px-3 py-1 text-sm text-muted transition-colors hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-md px-3 py-1.5 text-muted opacity-50">{label}</span>;
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-surface-muted"
    >
      {label}
    </Link>
  );
}
