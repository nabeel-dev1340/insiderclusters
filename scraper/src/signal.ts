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

// Value plausibility ceiling: no genuine open-market insider purchase reaches
// $10B. Values above it are filer errors (e.g. the total dollar amount typed
// into the price-per-share field — observed for real at $2.4e15 on REEMF).
export const MAX_PLAUSIBLE_SIGNAL_VALUE = 10_000_000_000;

export function isSignal(
  tx: Pick<ParsedTransaction, "transactionCode" | "value" | "pricePerShare">,
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

// The same total-in-the-price-field filer error usually lands well under $10B
// (real cases: CNTM/PTN/POCI at $1.4k–$150k "per share" on sub-$1 stocks), so
// a second, price-based guard is needed. A flat ceiling doesn't work — BH,
// FCNCA, TDG, AZO, MKL, TPL, MELI genuinely trade above $1,000 and BH is a
// legitimate sub-$2B cluster name. Instead: prices above the threshold are
// suspect and must be vouched for by the ticker's current price (from the
// market-cap cache); junk is 100–100,000× off, genuine is within ~1×. Unknown
// current price (delisted ticker, uncovered fund) fails suspect prices — every
// junk case observed so far is exactly such a ticker.
export const SUSPECT_PRICE_PER_SHARE = 1_000;
const PRICE_VOUCH_FACTOR = 20; // allow the stock having fallen 20× since

export function isPlausiblePrice(
  pricePerShare: number | null,
  currentPrice: number | null
): boolean {
  if (pricePerShare == null || pricePerShare <= SUSPECT_PRICE_PER_SHARE) return true;
  return currentPrice != null && pricePerShare <= currentPrice * PRICE_VOUCH_FACTOR;
}
