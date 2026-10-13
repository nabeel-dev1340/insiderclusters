#!/usr/bin/env node
/**
 * Tell the IndexNow search engines (Bing and the others that share it) which
 * pages changed, so they recrawl without waiting for the sitemaps:
 *
 *   node scripts/indexnow.mjs                  # sitemap URLs with lastmod since yesterday (UTC)
 *   node scripts/indexnow.mjs --since 2026-10-09
 *   node scripts/indexnow.mjs --all            # every URL in every sitemap
 *   node scripts/indexnow.mjs --dry-run        # list the URLs, send nothing
 *
 * The key is public by design: search engines check that the site serves it
 * at /<key>.txt (web/public/ in this repo) before they accept a submission.
 * Submit only pages that changed; resubmitting everything on every run can
 * be throttled as spam. Pages without a <lastmod> (the core pages, the month
 * archives) are sent only with --all.
 *
 * The sitemaps are read from robots.txt, so a new section is picked up
 * without touching this file.
 */

const KEY = "b48b74afdc5441e99eb19d09a8363ee2";
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const site = (
  flag("--site") ??
  process.env.APP_URL ??
  "https://insiderclusters.com"
).replace(/\/+$/, "");
const since = args.includes("--all")
  ? ""
  : (flag("--since") ??
    new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10));

const served = await fetch(`${site}/${KEY}.txt`);
if (!served.ok || (await served.text()).trim() !== KEY)
  throw new Error(`${site}/${KEY}.txt does not serve the key. Deploy first.`);

const robots = await (await fetch(`${site}/robots.txt`)).text();
const sitemaps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)]
  .map((m) => m[1])
  // The index only lists the others.
  .filter((u) => !u.endsWith("/sitemap-index.xml"));
if (!sitemaps.length) throw new Error(`No Sitemap: lines in ${site}/robots.txt`);

const urls = [];
for (const sitemap of sitemaps) {
  const xml = await (await fetch(sitemap)).text();
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = entry.match(/<loc>(.*?)<\/loc>/)?.[1];
    const lastmod = entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? "";
    if (loc && (!since || lastmod.slice(0, 10) >= since)) urls.push(loc);
  }
}
console.log(
  `${urls.length} URLs ${since ? `changed since ${since}` : `in ${sitemaps.length} sitemaps`}`,
);
if (!urls.length || args.includes("--dry-run")) {
  for (const url of urls.slice(0, 50)) console.log(url);
  if (urls.length > 50) console.log(`... and ${urls.length - 50} more`);
  process.exit(0);
}

// One request takes up to 10,000 URLs; the insiders sitemap alone is close.
let failed = false;
for (let i = 0; i < urls.length; i += 10000) {
  const batch = urls.slice(i, i + 10000);
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(site).host,
      key: KEY,
      keyLocation: `${site}/${KEY}.txt`,
      urlList: batch,
    }),
  });
  // 200: received. 202: received, key check pending. 4xx: rejected.
  console.log(
    `IndexNow answered ${response.status} ${response.statusText} for ${batch.length} URLs`,
  );
  if (response.status >= 400) failed = true;
}
if (failed) process.exit(1);
