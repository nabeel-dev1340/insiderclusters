// Run against a running production build, or pass the deployed origin.
// node scripts/check-public-seo.mjs http://localhost:3006
import assert from "node:assert/strict";
import { get } from "node:http";

const base = (process.argv[2] ?? "http://localhost:3006").replace(/\/$/, "");
const decode = (text) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
async function page(path) {
  const response = await fetch(`${base}${path}`);
  const html = await response.text();
  const canonical = decode(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "");
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => JSON.parse(match[1]));
  return { response, html, canonical, robots, schemas };
}
const stockItems = (result) => result.schemas.find((s) => s["@type"] === "CollectionPage")?.mainEntity?.itemListElement ?? [];

const [first, second, insiders] = await Promise.all([
  page("/stocks"), page("/stocks?page=2"), page("/insiders?page=2"),
]);
assert.equal(first.response.status, 200);
assert.equal(second.response.status, 200);
assert.equal(insiders.response.status, 200);
assert.equal(new URL(second.canonical).searchParams.get("page"), "2");
const a = stockItems(first), b = stockItems(second);
assert.equal(a.length, 50, "Use a dataset with more than 50 cluster stocks for this regression check");
assert(b.length > 0 && b.length <= 50, "The final page can contain fewer than 50 records");
assert(!a.some((x) => b.some((y) => x.url === y.url)), "Stock pages must contain different records");
assert.equal((first.html.match(/data-label="Ticker"/g) ?? []).length, 50, "Secondary purchases must also be paginated");
assert(first.html.length < 500_000, "The full directory must not be serialized into the response");
assert(first.html.includes('action="/stocks"') && first.html.includes('name="q"'), "Search must work without JavaScript");

// Find a ticker outside page one and verify that search reaches it.
const ticker = new URL(b.at(-1).url).pathname.split("/")[2];
const search = await page(`/stocks?q=${encodeURIComponent(ticker)}`);
assert.equal(search.response.status, 200);
assert(stockItems(search).some((x) => new URL(x.url).pathname.split("/")[2] === ticker));
assert(search.robots.includes("noindex") && search.robots.includes("follow"));
const sort = await page("/stocks?sort=name");
assert(sort.robots.includes("noindex"));

const secondary = await page("/stocks?buysPage=2");
assert.equal(secondary.response.status, 200);
assert.equal(new URL(secondary.canonical).searchParams.get("buysPage"), "2");
const invalid = await page("/stocks?page=999999");
assert.equal(invalid.response.status, 404, "Out-of-range pages must return an actual 404");
assert(invalid.robots.includes("noindex"));

const sector = await page("/sectors/healthcare");
assert.equal(sector.response.status, 200);
assert(stockItems(sector).length <= 50);

const insiderList = insiders.schemas.find((s) => s["@type"] === "ItemList");
assert.equal(insiderList.itemListElement.length, 50);
assert.equal(insiderList.itemListElement[0].position, 51);
const insiderUrl = insiderList.itemListElement.find((x) => x.url)?.url;
assert(insiderUrl);
const insiderPath = new URL(insiderUrl).pathname;
const paddedPath = insiderPath.replace(/\/insider\/(\d+)-/, (_, cik) => `/insider/${cik.padStart(10, "0")}-`);
const padded = await fetch(`${base}${paddedPath}`, { redirect: "manual" });
assert.equal(padded.status, 308, "Existing profiles must preserve padded-CIK legacy URLs");
assert.equal(new URL(padded.headers.get("location"), base).pathname, insiderPath);

// Local Next server checks the host-based redirect without resolving www.
if (new URL(base).hostname === "localhost" || new URL(base).hostname === "127.0.0.1") {
  // Node's fetch implementation does not forward an overridden Host header.
  const redirect = await new Promise((resolve, reject) => {
    const request = get(`${base}/stocks?page=2&q=NVCT`, { headers: { Host: "www.insiderclusters.com" } }, (response) => {
      response.resume();
      resolve({ status: response.statusCode, location: response.headers.location });
    });
    request.on("error", reject);
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.location, "https://insiderclusters.com/stocks?page=2&q=NVCT");
}

for (const slug of ["form-4-transaction-codes", "how-to-read-a-form-4", "what-is-a-10b5-1-plan", "form-4-filing-deadline"]) {
  const article = await page(`/learn/${slug}`);
  assert.equal(article.response.status, 200);
  assert(article.html.includes("2026-10-13"));
  assert(article.html.includes("https://www.sec.gov/") || article.html.includes("https://www.investor.gov/"));
}

console.log(JSON.stringify({ passed: true, stockPageBytes: Buffer.byteLength(first.html), stockRowsPerPage: a.length, insiderPage: 2, searchTickerBeyondFirstPage: ticker }, null, 2));
