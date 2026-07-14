import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { insiderPath } from "@/lib/site";
import { posthog } from "@/lib/posthog";
import {
  getClusterForUser,
  avgBuyPrice,
  buyFractionOfCompany,
  returnSinceCluster,
  type ClusterTransaction,
} from "@/lib/clusters";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const result = await getClusterForUser(clusterId);

  if (result.status === "not_found") notFound();

  const { cluster } = result;

  posthog().capture({
    distinctId: user.email,
    event: "cluster viewed",
    properties: {
      cluster_id: clusterId,
      ticker: cluster.ticker,
      insider_count: cluster.insiderCount,
    },
  });

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
                    {t.insiderCik ? (
                      <Link
                        href={insiderPath(t.insiderCik, t.insiderName)}
                        className="hover:text-accent hover:underline"
                      >
                        {t.insiderName}
                      </Link>
                    ) : (
                      t.insiderName
                    )}
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
