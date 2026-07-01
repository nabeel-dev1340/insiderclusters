import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseForm4Xml } from "../src/form4.parse.ts";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

test("parses a real A-grant Form 4 (issuer, owner role, transaction)", () => {
  const f = parseForm4Xml(fixture("uctt_grant_A.xml"));
  assert.equal(f.documentType, "4");
  assert.equal(f.issuerName, "Ultra Clean Holdings, Inc.");
  assert.equal(f.ticker, "UCTT");
  assert.equal(f.issuerCik, "0001275014");
  assert.equal(f.owners.length, 1);
  assert.equal(f.owners[0]!.name, "HARDING BRIAN E");
  assert.equal(f.owners[0]!.role, "Chief Accounting Officer");
  assert.equal(f.transactions.length, 1);
  const tx = f.transactions[0]!;
  assert.equal(tx.transactionCode, "A");
  assert.equal(tx.shares, 9363);
  assert.equal(tx.pricePerShare, 0);
  assert.equal(tx.value, 0);
});

test("parses multi-transaction filing and normalises ticker to uppercase", () => {
  const f = parseForm4Xml(fixture("synthetic_multi.xml"));
  assert.equal(f.ticker, "SYN"); // source had lowercase "syn"
  assert.equal(f.owners[0]!.role, "Chief Executive Officer");
  assert.equal(f.transactions.length, 4);

  const codes = f.transactions.map((t) => t.transactionCode);
  assert.deepEqual(codes, ["P", "P", "F", "M"]);

  const bigP = f.transactions[0]!;
  assert.equal(bigP.value, 150000); // 10000 * 15
});

test("throws on XML with no ownershipDocument", () => {
  assert.throws(() => parseForm4Xml("<foo>bar</foo>"));
});
