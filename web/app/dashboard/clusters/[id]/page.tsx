import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/plan";
import {
  getClusterForUser,
  avgBuyPrice,
  buyFractionOfCompany,
  returnSinceCluster,
  type ClusterTransaction,
} from "@/lib/clusters";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConvictionBadge } from "@/components/conviction-badge";
import { ReturnBadge } from "@/components/return-badge";
import {
  formatMoney,
  formatMoneyCompact,
  formatMarketCap,
  formatNumber,
  formatDate,
  formatDateRange,
  formatSharePrice,
  formatPercent,
  formatRoleMix,
  isSeniorInsiderRole,
} from "@/lib/format";

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clusterId = Number(id);
  if (!Number.isInteger(clusterId)) notFound();

  const user = (await getCurrentUser())!;
  const plan = effectivePlan(user);
  const result = await getClusterForUser(clusterId, plan);

  if (result.status === "not_found") notFound();

  const { cluster } = result;

  return (
    <div>
      <Link
        href="/dashboard"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← Back to feed
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-bold tracking-tight">
              {cluster.ticker}
            </h1>
            <Badge tone="neutral">{cluster.insiderCount} insiders buying</Badge>
            {cluster.hasSeniorInsider && <ConvictionBadge />}
            {cluster.sector && <Badge tone="muted">{cluster.sector}</Badge>}
            <ReturnBadge fraction={returnSinceCluster(cluster)} />
          </div>
          <p className="mt-1 text-muted">{cluster.issuerName}</p>
          {formatRoleMix(cluster.roleMix) && (
            <p className="mt-0.5 text-sm text-muted">{formatRoleMix(cluster.roleMix)}</p>
          )}
        </div>
      </div>

      {result.status === "locked" ? (
        <LockedNotice ticker={cluster.ticker} />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryStat label="Total bought" value={formatMoneyCompact(cluster.totalValue)} />
            <SummaryStat label="Avg paid" value={formatSharePrice(avgBuyPrice(cluster))} />
            <SummaryStat label="Latest price" value={formatSharePrice(cluster.lastPrice)} />
            <SummaryStat label="Total shares" value={formatNumber(cluster.totalShares)} />
            <SummaryStat
              label="% of company"
              value={formatPercent(buyFractionOfCompany(cluster))}
            />
            <SummaryStat label="Insiders" value={String(cluster.insiderCount)} />
            <SummaryStat label="Market cap" value={formatMarketCap(cluster.marketCap)} />
            <SummaryStat
              label="Window"
              value={formatDateRange(cluster.windowStart, cluster.windowEnd)}
            />
          </div>

          <h2 className="mt-8 text-lg font-semibold">Transactions</h2>
          <p className="mt-1 text-sm text-muted">
            Open-market purchases that make up this cluster.
            {cluster.hasSeniorInsider && (
              <>
                {" "}
                A <span className="inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-accent align-middle" />{" "}
                marks a C-suite / executive officer.
              </>
            )}
          </p>
          <TransactionsTable transactions={result.transactions} />
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 font-semibold tabular-nums">{value}</div>
      </CardBody>
    </Card>
  );
}

function LockedNotice({ ticker }: { ticker: string }) {
  return (
    <Card className="mt-6 border-accent/30 bg-accent/5">
      <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent">
          {/* lock glyph */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold">This is a real-time cluster</h2>
        <p className="max-w-md text-sm text-muted">
          Insider buying in {ticker} was detected within the last 24 hours. Upgrade
          to Pro to view real-time clusters and the full transaction breakdown.
        </p>
        <ButtonLink href="/dashboard/settings" className="mt-1">
          Upgrade to Pro
        </ButtonLink>
      </CardBody>
    </Card>
  );
}

function TransactionsTable({ transactions }: { transactions: ClusterTransaction[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Insider</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Shares</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="px-4 py-3 text-right font-medium">Filing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((t) => {
              const senior = isSeniorInsiderRole(t.insiderRole);
              return (
              <tr key={t.id} className="bg-surface transition-colors hover:bg-surface-muted/50">
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {senior && (
                      <span
                        aria-hidden
                        title="C-suite / executive officer"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                    )}
                    {t.insiderName}
                  </span>
                </td>
                <td className={senior ? "px-4 py-3 font-medium text-foreground" : "px-4 py-3 text-muted"}>
                  {t.insiderRole ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">{formatDate(t.transactionDate)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(t.shares)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.pricePerShare != null ? formatMoney(t.pricePerShare) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(t.value)}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={t.filingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    SEC ↗
                  </a>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
