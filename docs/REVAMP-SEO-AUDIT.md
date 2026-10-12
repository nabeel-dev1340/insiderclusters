# UI revamp and SEO audit

Date: October 12, 2026. Scope: repository implementation, rendered local pages, and production build. Existing public URLs are preserved.

## Design delivered

The user selected a refined financial editorial direction: warm light surfaces, forest green, readable data. The design context is saved in `.impeccable.md`.

- Rebuilt homepage around insider buying research, recent clusters, source verification, research entry points, and clear plan choices.
- Added optimized DM Sans and Newsreader fonts, a common editorial hierarchy, revised navigation, buttons, cards, and page spacing.
- Rebuilt stock browsing with ticker/company search, recency/activity/alphabetical sorting, and useful empty results.
- Revised sector browsing as an activity directory, learning pages as an editorial library, article navigation with section links, pricing, and sign-in.
- Applied the system to public stock/insider/sector/archive detail pages, legal pages, dashboard feed, cluster details, and settings.
- Adapted wide data tables into labelled mobile records while retaining every column. Added scoped column headers and explicit table roles.
- Added keyboard skip navigation, visible focus, larger interactive targets, accessible alert-switch names, login status/error announcements, and reduced-motion behavior.
- Removed invisible-until-JavaScript reveal behavior. Public explanations remain usable without JavaScript; homepage motion is a single CSS entrance.

## Evidence and fixes

| Priority | Confirmed finding | Evidence | Implemented fix |
| --- | --- | --- | --- |
| High | Organization schema asserted SEC identity | Root `sameAs` pointed to SEC EDGAR | Removed false equivalence; added a stable organization ID and logo, connected article publisher metadata |
| High | Structured data inserted raw external/entity strings | Existing page scripts used `JSON.stringify` without escaping HTML delimiters | Shared server-rendered `JsonLd` component escapes `<`, applied to public templates |
| High | Product explanations overstated exclusions | `scraper/src/signal.ts` filters code P, ticker and value; it does not independently exclude all 10b5-1 purchases | Corrected the cluster guide and machine-readable index; published methodology describing code P, configurable defaults, historical episodes and limits |
| High | Role and market-cap metrics implied stronger conclusions | “High conviction” and “% of company” labels described role classification and value/capitalization ratios | Changed badge to “Executive buyer”; clarified market-cap ratio and cached-price change labels |
| Medium | Mobile research required wide table scrolling | Fixed minimum widths across stock, insider, archive and cluster tables | Every value is retained in mobile labelled records; desktop tables stay tabular |
| Medium | Generic inherited social text | Root Twitter title/description could persist on child pages; legal pages inherited homepage Open Graph details | Let Twitter resolve route-specific Open Graph text; added legal page Open Graph metadata |
| Medium | Homepage heading lacked the explicit subject | Previous hero led with “Catch insider conviction…” | New H1 leads with “Insider buying”; dedicated title, description and social metadata |
| Medium | Source/process explanation had no central public destination | Technical implementation existed but no methodology page | Added `/methodology`, linked from home, footer, articles, pricing, sitemap and llms.txt |
| Medium | Archive sitemap timestamps were synthesized | Past month boundary/current time used as `lastModified` | Omitted unsupported archive modification timestamps; retained actual timestamps for other page types |
| Medium | Split sitemaps lacked an index | Six existing `/sitemap/{type}.xml` files | Added `/sitemap-index.xml`, referenced by robots.txt; all existing sitemap paths retained |
| Low | Learning pages were hard to scan and navigate | Repeated card list and no section navigation | Numbered editorial library, article provenance and anchor navigation |

The index uses `/sitemap-index.xml` because a `/sitemap.xml` custom route conflicts with Next 16's existing metadata sitemap convention. No public content URL was moved.

## Internal links and intent

Expected path: home → stock/insider/sector/archive/learn hubs → individual research pages. Education also links to data; entity pages link to related entities and their hubs. Home now offers direct contextual links to every research hub and the methodology. Footer links supplement those paths.

Preserved the existing ticker URLs rather than creating competing “insider buying” pages for the same companies. Did not generate speculative keyword pages, remove indexed pages, or change eligibility gates without search evidence.

## SEO guidance used

Downloaded the plain Markdown [SEOO.tools skill pack](https://www.seoo.tools/download), version 1.1.1, and read these specialist skills:

- `technical-seo-audit`
- `indexing-crawl-health-audit`
- `page-quality-audit`
- `internal-linking-audit`

Also used the repository SEO audit skill and the installed frontend design/responsive design skills. Checked local Next 16 documentation for CSS, fonts, metadata, robots, sitemaps and safe JSON-LD rendering before implementation.

Primary references checked:

- [Google organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Google structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [SEC guide to Forms 3, 4 and 5](https://www.sec.gov/files/forms-3-4-5.pdf)
- [NBER: Decoding Inside Information](https://www.nber.org/papers/w16454) — the article now describes its actual topic, routine versus opportunistic trades, rather than presenting it as validation of this cluster detector.

FAQ markup reflects visible answers; it is not presented as a promise of a search rich result. No ratings, named reviewers, performance claims or search volumes were invented.

## Remaining work requiring live evidence

No Search Console or Bing indexing report was used. Indexed counts, ranking changes, query demand, search CTR, backlinks and field Core Web Vitals are **not checked**. Local rendering and a passing build cannot establish those outcomes.

After deployment:

1. Submit `/sitemap-index.xml` in Search Console and Bing, preserving the existing per-template submissions.
2. Inspect representative home, ticker, insider, sector, article and archive URLs; confirm canonical selection, crawlability and actual rendered data. Use Google's structured data tools on live URLs.
3. Record the deployment date and compare organic clicks, sign-ups and indexed URLs by template at 2, 4 and 8 weeks. Check reporting anomalies and seasonality before attributing a change to this revamp.
4. Use actual query demand to prioritize title experiments and future learning content. Avoid additional ticker URLs that duplicate existing intent.
5. Check field LCP/INP/CLS and live PageSpeed on desktop and mobile. Real-device Safari/Android testing and authenticated alert/billing flows remain release checks.
6. Verify deployed scraper settings against the documented code defaults. Audit older educational claims and filing exceptions against current primary sources before calling every article fact-checked.

Implementation validation was performed locally. Search-engine adoption and traffic improvements depend on production deployment, recrawling and measurement.

## Validation completed

- Production build and TypeScript checks pass.
- ESLint reports no errors. Four pre-existing unused-variable warnings remain in unrelated health/monitoring/API-key code.
- Local production HTTP checks passed on 31 representative pages, including every learning article and samples of each entity template: 200 responses, unique titles, descriptions, self-canonical paths, viewport metadata, one main target/H1, parseable JSON-LD, social titles, article provenance/section navigation.
- All six sitemap sections and the sitemap index parse successfully. The local dataset emitted 10 core, 253 stock, 346 insider, 10 sector, 12 learn, and 19 archive URLs; these are local counts, not production indexing counts.
- Unknown ticker/article routes return real 404s; an unauthenticated dashboard request redirects to sign-in. Open Graph image and Apple icon return PNGs.
- Visually checked the desktop homepage and 390px/320px mobile layouts. Verified mobile menu navigation and a ticker search returning one matching company. Verified a stock detail table renders as labelled mobile records with its filing links intact.
- Corrected older “free alerts/full history” CTAs to describe paid plans/trials accurately.
