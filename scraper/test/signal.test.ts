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
  assert.equal(isSignal(f.transactions[0]!, MIN), false);
});

test("only the large open-market purchase (P, value >= threshold) is a signal", () => {
  const f = parseForm4Xml(fixture("synthetic_multi.xml"));
  const [bigP, smallP, taxF, exerciseM] = f.transactions;

  assert.equal(isSignal(bigP!, MIN), true); // P, 150000
  assert.equal(isSignal(smallP!, MIN), false); // P but only 2000
  assert.equal(isSignal(taxF!, MIN), false); // F disposition
  assert.equal(isSignal(exerciseM!, MIN), false); // M exercise
});

test("threshold is inclusive and configurable", () => {
  assert.equal(isSignal({ transactionCode: "P", value: 100_000 }, 100_000), true);
  assert.equal(isSignal({ transactionCode: "P", value: 99_999 }, 100_000), false);
  assert.equal(isSignal({ transactionCode: "P", value: null }, 100_000), false);
});
