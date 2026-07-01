// Feature 1.3 — Signal filter.
//
// A transaction is a "signal" only when it is an open-market purchase (code P)
// with a dollar value at or above the configured threshold. Grants (A),
// option exercises (M), tax-withholding dispositions (F), sales (S), etc. are
// never signals.

import type { ParsedTransaction } from "./form4.parse.ts";

export function isSignal(
  tx: Pick<ParsedTransaction, "transactionCode" | "value">,
  minSignalValue: number
): boolean {
  return (
    tx.transactionCode === "P" &&
    tx.value != null &&
    tx.value >= minSignalValue
  );
}
