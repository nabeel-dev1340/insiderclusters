# Programmatic SEO Plan — insiderclusters.com

_Drafted 2026-07-03. Grounded in the live dataset (~702 clusters / ~506 tickers / ~$6.05B of insider buying, Apr 2024 → today, growing every poll cycle)._

## 1. Where we stand

The Phase-7 foundation is already good and should not be rebuilt:

- **506 ticker pages** at `/stock/{T}/insider-cluster-buys` — SSR, unique title/meta, canonical, Breadcrumb + Dataset JSON-LD, public 3-cluster gate.
- **Two hubs**: `/stocks` (ticker directory, ItemList schema) and `/insiders` (top-100 leaderboard — currently a dead end: names are not links).
- **Sitemap** with hourly revalidation, robots.txt, graceful DB-down fallback.

The data moat is real: cluster detection + conviction (C-suite buyer) + per-cluster economics (`avgBuyPrice`, `buyFractionOfCompany`) is **product-derived data nobody else publishes in this shape**. OpenInsider/secform4/MarketBeat republish raw Form 4 tables; none lead with clusters. That's the angle every page type below leans on.

**Constraint to respect:** the domain is new with ~no authority. Head terms ("AAPL insider trading") are unwinnable for now. Everything below targets long-tail queries where the page is often the *only* focused result: small-cap tickers, individual insider names, sector + intent combos.

## 2. Playbook fit (ranked)

| Priority | Playbook | Pattern | Est. pages | Status |
|---|---|---|---|---|
| P1 | Profiles | "[insider name] insider trading / form 4" | ~1,000–2,500 | Missing — biggest gap |
| P2 | Broaden existing | "[TICKER] insider buying" | 506 → ~1,500+ | Partial (cluster-only today) |
| P3 | Directory×2 | "insider buying in [sector]" | ~10–12 | Missing |
| P4 | Glossary | "form 4 code P meaning" etc. | ~15–25 | Missing |
| P5 | Archives | "biggest insider buys [month year]" | ~27 (+1/mo) | Missing |

Skipped deliberately: Locations, Integrations, Templates (no fit); Comparisons is one hand-written "OpenInsider alternative" page someday, not programmatic.

---

## 3. P1 — Insider profile pages (the big one)

**Query patterns:** `[name] insider trading`, `[name] form 4`, `[name] stock purchases`, `[name] [ticker]`. Individually tiny volume, but there are thousands of names and search intent is dead-on: someone Googling an insider's name after seeing a filing is exactly our user. Competitors rank for these with bare tables; a focused page wins long-tail.

**URL:** `/insider/{cik}-{name-slug}` → e.g. `/insider/1234567-jane-a-doe`
- CIK anchors identity (names collide; people change roles/companies). Redirect any slug mismatch to the canonical slug, 301.
- Subfolder, consistent with existing `/stock/…` structure.

**Eligibility / thin-content gate:** generate only for insider CIKs that have ≥1 cluster participation **or** ≥2 signal buys. One-off small buyers get no page (their buy still appears on the ticker page). Revisit the gate once indexation data comes in.

**Page template:**
- `<h1>` — "{Name} — Insider Buying History" ; title tag `{Name} Insider Trading & Form 4 Buys — {top ticker(s)}`
- Fact box: total invested, # of buys, companies, roles held, first/last buy date.
- **Unique-value block (per-page, computed):** buys vs. current price — "Jane Doe's 3 open-market buys in $XYZ average $4.12/share; the stock trades at $6.30 (+53%)." Uses `market_cap_cache.price`. This is the sentence that makes the page *not* thin.
- Buy history table: date, ticker (→ ticker page), role, shares, price, value, in-cluster badge (→ cluster context), EDGAR filing link.
- Cluster participation list with ConvictionBadge reuse.
- Schema: `Person` (name, jobTitle, worksFor) + `Dataset`, Breadcrumb.
- CTA: "Get alerted when {Name} buys again" → magic-link input (persona-matched conversion, better than generic signup).

**Linking (kills the orphan problem on day one):**
- `/insiders` leaderboard names become links (hub → spoke).
- Every insider name on ticker pages / cluster details links to the profile (spoke ↔ spoke; also distributes to ticker pages in reverse).
- Profile links back to each ticker page.
- Separate `sitemap` section or second sitemap file for insider pages.

## 4. P2 — Broaden ticker pages to "insider buying" intent

`[TICKER] insider buying` and `[TICKER] insider purchases` massively outsearch `[TICKER] cluster buys` (nobody searches "cluster buys" with a ticker — it's our vocabulary, not the searcher's).

**Do not add a second per-ticker URL** — that's self-cannibalization. Instead, widen the existing page:

- Title → `{T} Insider Buying — Cluster Buys & Form 4 History | {Issuer}` (keeps existing ranking signals, adds the high-volume phrase).
- Add an "All notable open-market buys" section under the clusters: every signal transaction for the ticker, not just clustered ones. The data is already in `transactions`/`filings`; needs one new query in `web/lib/clusters.ts`.
- **Expand eligibility** from "has a cluster" to "has ≥1 signal buy" — grows the page set from 506 to everything with a $100k+ insider purchase in 2 years (likely 1,500–3,000 tickers; pull exact count from prod before building). Pages with clusters stay rich; signal-only pages still show real, dated, named buys — genuinely useful, not thin.
- Keep the URL slug `insider-cluster-buys` for existing pages (they're indexed; don't churn URLs). For the *new* signal-only cohort you could use the same path for consistency — one URL scheme, one template, conditional sections.

## 5. P3 — Sector hubs

`/sectors/{slug}` (e.g. `/sectors/biotech`): "insider buying in biotech stocks", "healthcare stocks insiders are buying". `market_cap_cache.sector` already exists (migration 0004). ~10–12 pages.

Template: sector intro (hand-written paragraph each — it's only ~12), live table of that sector's cluster tickers ranked by recency/value, top insiders in sector, cross-links. These become the mid-tier of the link architecture: home → sectors → tickers.

## 6. P4 — Glossary (`/learn/{slug}`)

Hand-written, ~15–25 pages, one-time effort. Targets: "form 4 transaction codes", "code P vs code S", "what is a cluster buy", "10b5-1 plan", "how to read a form 4", "insider buying vs share buyback", "10% owner definition", "do insiders have to report trades". Each embeds a live data widget (e.g. "latest code-P cluster") and links into ticker/insider pages — this is what builds topical authority so the programmatic pages rank, and it's the content AI search engines cite.

## 7. P5 — Monthly archives

`/insider-buying/2026-06` — "biggest insider buys of June 2026". ~27 backfilled pages + one per month, fully automatic. Unique data per page, evergreen long-tail, and gives crawlers a dated trail through the whole dataset. Low effort once the ticker/insider templates exist; do last.

---

## 8. Technical checklist (applies to all new types)

- [ ] SSR + `revalidate = 3600` (existing pattern) — no client-only rendering.
- [ ] Unique title/meta/canonical per page; `robots: noindex` for below-gate entities rather than 404, if they're linked anywhere.
- [ ] Split sitemaps by type (`sitemap.ts` supports `generateSitemaps` in Next 16 — check `node_modules/next/dist/docs/` first per AGENTS.md) so GSC shows per-type indexation rates.
- [ ] Breadcrumb + type-appropriate schema (Person / Dataset / CollectionPage) — reuse existing JSON-LD patterns.
- [ ] Every new page reachable ≤3 clicks from home; no orphans.
- [ ] GSC: monitor indexation per sitemap, watch for "Crawled — currently not indexed" pile-ups on the signal-only ticker cohort → tighten the gate if >50% never index.
- [ ] PostHog: tag pageviews with page type (`insider_profile`, `ticker`, `sector`, …) to attribute signups.

## 9. Build order

1. **Insider profiles + linkify `/insiders` + cross-links from ticker pages** (P1) — biggest new surface, uses existing data.
2. **Ticker page broadening + eligibility expansion** (P2) — mostly one query + template sections.
3. **Sector hubs** (P3) — small, strengthens internal linking for 1–2.
4. **Glossary** (P4) — steady drip, 2–3 pages at a time.
5. **Monthly archives** (P5).

Before building P1/P2, run the sizing queries against prod (distinct insider CIKs meeting the gate; distinct signal-only tickers) to confirm page counts.
