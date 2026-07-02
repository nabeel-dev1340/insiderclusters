// Historical cluster detection (backfill).
//
// The live detector (clusters.ts) anchors a rolling window on the newest
// signal and merges into the still-undispatched cluster, which works because
// filings arrive one cycle at a time. Replaying months of history that way
// would emit a trail of overlapping near-duplicate clusters as each episode
// grows. For backfill we instead group a ticker's signal transactions into
// discrete episodes and emit one cluster per qualifying episode.
//
// Episode rule: consecutive signal transactions chain while the date gap is
// within the cluster window. An episode qualifies when it contains two
// transactions from distinct insiders within the window of each other — the
// same "2+ insiders inside a rolling window" condition the live detector
// applies, evaluated over the whole episode.

export interface SignalTx {
  id: number;
  insiderKey: string; // CIK when known, else name (matches live dedupe)
  date: string; // YYYY-MM-DD
  value: number;
}

export interface Episode {
  transactionIds: number[];
  insiderCount: number;
  totalValue: number;
  windowStart: string;
  windowEnd: string;
}

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(b) - Date.parse(a)) / DAY_MS;
}

// Live detection windows are (anchor - windowDays, anchor] — the start bound is
// exclusive, so "within the window" means strictly less than windowDays apart.
/** Two txs from different insiders within `windowDays` of each other? */
function qualifies(txs: SignalTx[], windowDays: number): boolean {
  for (let i = 0; i < txs.length; i++) {
    for (let j = i + 1; j < txs.length; j++) {
      if (txs[i]!.insiderKey === txs[j]!.insiderKey) continue;
      if (daysBetween(txs[i]!.date, txs[j]!.date) < windowDays) return true;
    }
  }
  return false;
}

/**
 * Group one ticker's signal transactions into qualifying cluster episodes.
 * Input order doesn't matter; output episodes are chronological and disjoint.
 */
export function detectEpisodes(txs: SignalTx[], windowDays: number): Episode[] {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const episodes: Episode[] = [];

  let current: SignalTx[] = [];
  const flush = () => {
    if (current.length && qualifies(current, windowDays)) {
      const insiders = new Set(current.map((t) => t.insiderKey));
      episodes.push({
        transactionIds: current.map((t) => t.id).sort((a, b) => a - b),
        insiderCount: insiders.size,
        totalValue: current.reduce((s, t) => s + t.value, 0),
        windowStart: current[0]!.date,
        windowEnd: current[current.length - 1]!.date,
      });
    }
    current = [];
  };

  for (const tx of sorted) {
    const prev = current[current.length - 1];
    if (prev && daysBetween(prev.date, tx.date) >= windowDays) flush();
    current.push(tx);
  }
  flush();

  return episodes;
}
