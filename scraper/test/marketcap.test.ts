import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAbbreviatedNumber, isWithinCap } from "../src/marketcap.ts";

test("parses abbreviated market-cap strings", () => {
  assert.equal(parseAbbreviatedNumber("6.39B"), 6.39e9);
  assert.equal(parseAbbreviatedNumber("44.83M"), 44.83e6);
  assert.equal(parseAbbreviatedNumber("1.2T"), 1.2e12);
  assert.equal(parseAbbreviatedNumber("950K"), 950_000);
  assert.equal(parseAbbreviatedNumber("$1,234.5M"), 1_234_500_000);
  assert.equal(parseAbbreviatedNumber("500"), 500);
  assert.equal(parseAbbreviatedNumber(2_000_000_000), 2_000_000_000);
});

test("returns null for missing / non-numeric values", () => {
  assert.equal(parseAbbreviatedNumber("n/a"), null);
  assert.equal(parseAbbreviatedNumber("N/A"), null);
  assert.equal(parseAbbreviatedNumber(""), null);
  assert.equal(parseAbbreviatedNumber(null), null);
  assert.equal(parseAbbreviatedNumber(undefined), null);
});

test("market-cap gate: mega-cap excluded, sub-ceiling and unknown allowed", () => {
  // MAX_MARKET_CAP defaults to 2e9 in config.
  assert.equal(isWithinCap(3.5e12), false); // e.g. AAPL — excluded
  assert.equal(isWithinCap(6.39e9), false); // above 2B ceiling
  assert.equal(isWithinCap(1.5e9), true); // sub-2B — proceeds
  assert.equal(isWithinCap(null), true); // unknown — do not silently drop
});
