import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAbbreviatedNumber,
  isWithinCap,
  parseOverview,
  extractLatestPrice,
  extractSector,
} from "../src/marketcap.ts";

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

test("market-cap gate disabled by default: every size proceeds", () => {
  // MAX_MARKET_CAP defaults to Infinity in config — the size ceiling is off, so
  // clusters form regardless of company size. (Set a finite env value to gate.)
  assert.equal(isWithinCap(3.5e12), true); // e.g. AAPL — now included
  assert.equal(isWithinCap(6.39e9), true); // former >2B names — now included
  assert.equal(isWithinCap(1.5e9), true); // small-cap — proceeds
  assert.equal(isWithinCap(null), true); // unknown — do not silently drop
});

test("extractLatestPrice takes the last intraday close", () => {
  assert.equal(
    extractLatestPrice({ chart: { data: [{ c: 19.53 }, { c: 19.54 }, { c: 19.52 }] } }),
    19.52
  );
  assert.equal(extractLatestPrice({ chart: { data: [] } }), null);
  assert.equal(extractLatestPrice({}), null);
});

test("extractSector reads the Sector row from infoTable", () => {
  const info = [
    { t: "Industry", v: "Biotechnology" },
    { t: "Sector", v: "Healthcare" },
    { t: "Employees", v: "12" },
  ];
  assert.equal(extractSector({ infoTable: info }), "Healthcare");
  assert.equal(extractSector({ infoTable: [{ t: "Sector", v: "n/a" }] }), null);
  assert.equal(extractSector({}), null);
});

test("parseOverview pulls market cap, price, and sector together", () => {
  const body = JSON.stringify({
    status: 200,
    data: {
      marketCap: "517.78M",
      chart: { data: [{ c: 19.5 }, { c: 19.61 }] },
      infoTable: [{ t: "Sector", v: "Healthcare" }],
    },
  });
  assert.deepEqual(parseOverview(body), {
    marketCap: 517.78e6,
    price: 19.61,
    sector: "Healthcare",
  });
});
