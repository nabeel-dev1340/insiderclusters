import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseForm4Xml } from "../src/form4.parse.ts";
import { isSignal, isPlausiblePrice } from "../src/signal.ts";

const MIN = 100_000;
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

test("A-grant (code A) is never a signal", () => {
  const f = parseForm4Xml(fixture("uctt_grant_A.xml"));
  assert.equal(isSignal(f.transactions[0]!, MIN, f.ticker), false);
});

test("only the large open-market purchase (P, value >= threshold) is a signal", () => {
  const f = parseForm4Xml(fixture("synthetic_multi.xml"));
  const [bigP, smallP, taxF, exerciseM] = f.transactions;

  assert.equal(isSignal(bigP!, MIN, f.ticker), true); // P, 150000
  assert.equal(isSignal(smallP!, MIN, f.ticker), false); // P but only 2000
  assert.equal(isSignal(taxF!, MIN, f.ticker), false); // F disposition
  assert.equal(isSignal(exerciseM!, MIN, f.ticker), false); // M exercise
});

const buy = (value: number | null, pricePerShare: number | null = 10) => ({
  transactionCode: "P",
  value,
  pricePerShare,
});

test("threshold is inclusive and configurable", () => {
  assert.equal(isSignal(buy(100_000), 100_000, "ABC"), true);
  assert.equal(isSignal(buy(99_999), 100_000, "ABC"), false);
  assert.equal(isSignal(buy(null), 100_000, "ABC"), false);
});

test("implausibly large values are filer errors, not signals", () => {
  // Real case (REEMF): total dollars typed into the price field -> $2.4e15 "buy".
  assert.equal(isSignal(buy(2.4e15, 24_035_774), MIN, "REEMF"), false);
  assert.equal(isSignal(buy(9e9, 900), MIN, "ABC"), true);
});

test("isPlausiblePrice: suspect prices need the current price to vouch", () => {
  // Real junk (CNTM/PTN/POCI): $1.4k-$150k "per share" on delisted/sub-$1
  // names where no current price exists to vouch.
  assert.equal(isPlausiblePrice(65_122, null), false);
  assert.equal(isPlausiblePrice(150_000, null), false);
  assert.equal(isPlausiblePrice(1_391, null), false);
  // Real genuine high-priced stocks: current price vouches (BH ~ $1.3k).
  assert.equal(isPlausiblePrice(1_350, 1_300), true);
  // ...but not for a 100x discrepancy (junk on a still-listed ticker).
  assert.equal(isPlausiblePrice(38_533, 3), false);
  // Prices at or below the suspect threshold are always fine, vouched or not.
  assert.equal(isPlausiblePrice(43, null), true);
  assert.equal(isPlausiblePrice(1_000, null), true);
  assert.equal(isPlausiblePrice(null, null), true);
});

test("a qualifying purchase with no ticker is not a signal (non-traded funds/BDCs)", () => {
  // The $100M TPG/Blackstone fund-subscription case: code P, well over
  // threshold, but the issuer has no tradable symbol so it can never cluster.
  const tx = buy(100_000_000);
  assert.equal(isSignal(tx, MIN, null), false);
  assert.equal(isSignal(tx, MIN, ""), false);
  assert.equal(isSignal(tx, MIN, "TPGX"), true); // same tx, real ticker -> signal
});
