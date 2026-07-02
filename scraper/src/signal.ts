// Feature 1.3 — Signal filter.
//
// A transaction is a "signal" only when it is an open-market purchase (code P)
// with a dollar value at or above the configured threshold, on an issuer with a
// real ticker. Grants (A), option exercises (M), tax-withholding dispositions
// (F), sales (S), etc. are never signals.
//
// The ticker requirement excludes non-traded funds/BDCs (e.g. a fund GP
// subscribing capital, reported as a large code-P "purchase" with no symbol).
// Such a filing can never contribute to a cluster — detection groups by ticker
// — so counting it as a signal only inflates stats and risks junk if the filer
// puts a placeholder symbol in. `ticker` is the already-normalized value from
// form4.parse (placeholders like "NONE" are null by the time it reaches here).

import type { ParsedTransaction } from "./form4.parse.ts";

// Plausibility ceiling: no genuine open-market insider purchase reaches $10B.
// Values above it are filer errors (e.g. the total dollar amount typed into the
// price-per-share field, seen in real EDGAR data at $2.4e15) and would dwarf
// every honest cluster stat they touch.
export const MAX_PLAUSIBLE_SIGNAL_VALUE = 10_000_000_000;

export function isSignal(
  tx: Pick<ParsedTransaction, "transactionCode" | "value">,
  minSignalValue: number,
  ticker: string | null,
  maxSignalValue: number = MAX_PLAUSIBLE_SIGNAL_VALUE
): boolean {
  return (
    ticker != null &&
    ticker !== "" &&
    tx.transactionCode === "P" &&
    tx.value != null &&
    tx.value >= minSignalValue &&
    tx.value <= maxSignalValue
  );
}
