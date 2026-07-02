import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseForm4Xml } from "../src/form4.parse.ts";
import { isSignal } from "../src/signal.ts";

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

test("threshold is inclusive and configurable", () => {
  assert.equal(isSignal({ transactionCode: "P", value: 100_000 }, 100_000, "ABC"), true);
  assert.equal(isSignal({ transactionCode: "P", value: 99_999 }, 100_000, "ABC"), false);
  assert.equal(isSignal({ transactionCode: "P", value: null }, 100_000, "ABC"), false);
});

test("implausibly large values are filer errors, not signals", () => {
  // Real case (REEMF): total dollars typed into the price field -> $2.4e15 "buy".
  assert.equal(isSignal({ transactionCode: "P", value: 2.4e15 }, MIN, "REEMF"), false);
  assert.equal(isSignal({ transactionCode: "P", value: 9e9 }, MIN, "ABC"), true);
});

test("a qualifying purchase with no ticker is not a signal (non-traded funds/BDCs)", () => {
  // The $100M TPG/Blackstone fund-subscription case: code P, well over
  // threshold, but the issuer has no tradable symbol so it can never cluster.
  const tx = { transactionCode: "P", value: 100_000_000 };
  assert.equal(isSignal(tx, MIN, null), false);
  assert.equal(isSignal(tx, MIN, ""), false);
  assert.equal(isSignal(tx, MIN, "TPGX"), true); // same tx, real ticker -> signal
});
