import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEpisodes, type SignalTx } from "../src/episodes.ts";
import {
  parseTsv,
  parseDeraDate,
  roleFromRelationship,
  buildBulkFilings,
  submissionUrl,
} from "../src/sec/bulkdata.ts";
import { parseFormIndex, dailyIndexUrl, dateRange } from "../src/sec/dailyindex.ts";
import { parseQuarters } from "../src/backfill.ts";

const WINDOW = 15;

const tx = (id: number, insiderKey: string, date: string, value = 200_000): SignalTx => ({
  id,
  insiderKey,
  date,
  value,
});

// --- episodes ----------------------------------------------------------------

test("two insiders within the window form one episode", () => {
  const eps = detectEpisodes(
    [tx(1, "A", "2025-03-01"), tx(2, "B", "2025-03-10")],
    WINDOW
  );
  assert.equal(eps.length, 1);
  assert.deepEqual(eps[0]!.transactionIds, [1, 2]);
  assert.equal(eps[0]!.insiderCount, 2);
  assert.equal(eps[0]!.totalValue, 400_000);
  assert.equal(eps[0]!.windowStart, "2025-03-01");
  assert.equal(eps[0]!.windowEnd, "2025-03-10");
});

test("a single insider never qualifies, even with many buys", () => {
  const eps = detectEpisodes(
    [tx(1, "A", "2025-03-01"), tx(2, "A", "2025-03-05"), tx(3, "A", "2025-03-09")],
    WINDOW
  );
  assert.equal(eps.length, 0);
});

test("distinct insiders further apart than the window do not qualify", () => {
  const eps = detectEpisodes(
    [tx(1, "A", "2025-03-01"), tx(2, "B", "2025-03-20")],
    WINDOW
  );
  assert.equal(eps.length, 0);
});

test("separate episodes months apart are detected independently", () => {
  const eps = detectEpisodes(
    [
      tx(1, "A", "2025-01-05"),
      tx(2, "B", "2025-01-10"),
      tx(3, "C", "2025-06-01"),
      tx(4, "D", "2025-06-03"),
    ],
    WINDOW
  );
  assert.equal(eps.length, 2);
  assert.equal(eps[0]!.windowEnd, "2025-01-10");
  assert.equal(eps[1]!.windowStart, "2025-06-01");
});

test("chained same-insider buys don't qualify unless a distinct pair is within the window", () => {
  // A buys day 0 and day 14, B buys day 28: chain holds (gaps < 15) and the
  // A@14 / B@28 pair is 14 days apart -> qualifies as one episode.
  const eps = detectEpisodes(
    [tx(1, "A", "2025-03-01"), tx(2, "A", "2025-03-15"), tx(3, "B", "2025-03-29")],
    WINDOW
  );
  assert.equal(eps.length, 1);
  assert.equal(eps[0]!.insiderCount, 2);

  // Exactly 15 days apart is OUTSIDE the live (anchor-15, anchor] window, so
  // A@01 / B@16 must not qualify (matches the SQL's exclusive start bound).
  const none = detectEpisodes(
    [tx(1, "A", "2025-03-01"), tx(2, "B", "2025-03-16")],
    WINDOW
  );
  assert.equal(none.length, 0);
});

// --- bulkdata ------------------------------------------------------------------

test("parseDeraDate converts DD-MON-YYYY", () => {
  assert.equal(parseDeraDate("31-MAR-2026"), "2026-03-31");
  assert.equal(parseDeraDate("01-jan-2025"), "2025-01-01");
  assert.equal(parseDeraDate(""), null);
  assert.equal(parseDeraDate("2026-03-31"), null);
});

test("roleFromRelationship mirrors the live parser's role text", () => {
  assert.equal(
    roleFromRelationship("Director,Officer", "Chief Financial Officer", ""),
    "Director, Chief Financial Officer"
  );
  assert.equal(roleFromRelationship("Officer", "", ""), "Officer");
  assert.equal(roleFromRelationship("TenPercentOwner", "", ""), "10% Owner");
  assert.equal(roleFromRelationship("Other", "", "Trustee"), "Trustee");
  assert.equal(roleFromRelationship("", "", ""), null);
});

const SUBMISSIONS = [
  "ACCESSION_NUMBER\tFILING_DATE\tDOCUMENT_TYPE\tISSUERCIK\tISSUERNAME\tISSUERTRADINGSYMBOL",
  "0001-26-000001\t05-FEB-2026\t4\t0001825079\tSmallCap Inc.\tSMCP",
  "0001-26-000002\t06-FEB-2026\t4/A\t0001825079\tSmallCap Inc.\tSMCP", // amendment -> dropped
  "0001-26-000003\t07-FEB-2026\t4\t0000999999\tNo Symbol LP\tNONE", // placeholder ticker
].join("\n");

const OWNERS = [
  "ACCESSION_NUMBER\tRPTOWNERCIK\tRPTOWNERNAME\tRPTOWNER_RELATIONSHIP\tRPTOWNER_TITLE\tRPTOWNER_TXT",
  "0001-26-000001\t0002000001\tDoe Jane\tOfficer\tCEO\t",
  "0001-26-000001\t0002000002\tSecond Owner\tDirector\t\t", // second owner ignored
  "0001-26-000003\t0002000003\tFund GP\tTenPercentOwner\t\t",
].join("\n");

const TRANS = [
  "ACCESSION_NUMBER\tSECURITY_TITLE\tTRANS_DATE\tTRANS_CODE\tTRANS_SHARES\tTRANS_PRICEPERSHARE\tTRANS_ACQUIRED_DISP_CD",
  "0001-26-000001\tCommon Stock\t04-FEB-2026\tP\t50000.0\t4.00\tA",
  "0001-26-000001\tCommon Stock\t04-FEB-2026\tS\t1000.0\t4.10\tD",
  "0001-26-000003\tLP Units\t05-FEB-2026\tP\t1000000.0\t100.0\tA",
].join("\n");

test("buildBulkFilings joins TSVs, drops 4/A, normalizes placeholder tickers", () => {
  const filings = buildBulkFilings({
    submissions: SUBMISSIONS,
    reportingOwners: OWNERS,
    nonDerivTrans: TRANS,
  });
  assert.equal(filings.length, 2);

  const smcp = filings.find((f) => f.accessionNumber === "0001-26-000001")!;
  assert.equal(smcp.ticker, "SMCP");
  assert.equal(smcp.owner.name, "Doe Jane");
  assert.equal(smcp.owner.role, "CEO");
  assert.equal(smcp.transactions.length, 2);
  assert.equal(smcp.transactions[0]!.value, 200_000);
  assert.equal(smcp.filedAt.toISOString(), "2026-02-05T00:00:00.000Z");

  const fund = filings.find((f) => f.accessionNumber === "0001-26-000003")!;
  assert.equal(fund.ticker, null); // "NONE" normalized away -> can never signal
});

test("parseTsv tolerates CRLF and short rows", () => {
  const rows = parseTsv("A\tB\tC\r\n1\t2\r\n");
  assert.deepEqual(rows, [{ A: "1", B: "2", C: "" }]);
});

test("submissionUrl strips leading zeros from the CIK", () => {
  assert.equal(
    submissionUrl("0001825079", "0001-26-000001"),
    "https://www.sec.gov/Archives/edgar/data/1825079/000126000001/0001-26-000001.txt"
  );
});

// --- daily index -----------------------------------------------------------------

test("dailyIndexUrl computes the quarter directory", () => {
  assert.equal(
    dailyIndexUrl("2026-04-01"),
    "https://www.sec.gov/Archives/edgar/daily-index/2026/QTR2/form.20260401.idx"
  );
});

test("parseFormIndex keeps exact form type 4 only and dedupes", () => {
  const filedAt = new Date("2026-04-01T00:00:00Z");
  const body = [
    "Form Type   Company Name   CIK   Date Filed   File Name",
    "---------------------------------------------------------",
    "4           SmallCap Inc   1825079  20260401  edgar/data/1825079/0001234567-26-000001.txt",
    "4           SmallCap Inc   2000001  20260401  edgar/data/2000001/0001234567-26-000001.txt", // dup accession
    "4/A         SmallCap Inc   1825079  20260401  edgar/data/1825079/0001234567-26-000002.txt",
    "424B3       Big Corp       999      20260401  edgar/data/999/0007654321-26-000001.txt",
    "40-F        Foreign Co     998      20260401  edgar/data/998/0007654321-26-000002.txt",
  ].join("\n");
  const entries = parseFormIndex(body, filedAt);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.accessionNumber, "0001234567-26-000001");
  assert.equal(
    entries[0]!.submissionUrl,
    "https://www.sec.gov/Archives/edgar/data/1825079/0001234567-26-000001.txt"
  );
});

test("dateRange is inclusive", () => {
  assert.deepEqual(dateRange("2026-04-29", "2026-05-01"), [
    "2026-04-29",
    "2026-04-30",
    "2026-05-01",
  ]);
});

// --- CLI helpers -------------------------------------------------------------------

test("parseQuarters expands ranges across year boundaries", () => {
  assert.deepEqual(parseQuarters("2024q3-2025q1"), ["2024q3", "2024q4", "2025q1"]);
  assert.deepEqual(parseQuarters("2026q1"), ["2026q1"]);
  assert.deepEqual(parseQuarters("2025q1,2025q3"), ["2025q1", "2025q3"]);
  assert.throws(() => parseQuarters("2025"));
});
