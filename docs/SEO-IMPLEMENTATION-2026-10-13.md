# SEO implementation — October 13, 2026

## Delivered

- `/stocks` now renders 50 cluster stocks and 50 other-purchase stocks per section. Search and sorting operate on the full server-side dataset. The former client component no longer ships the full directory to the browser.
- Sector pages render 50 companies per page, with full-dataset search and sorting. `/insiders` now provides a searchable, paginated directory beyond the previous top-100 limit; the database returns only 50 rows for the selected result page.
- Numbered pages have self-canonical URLs and ordinary crawlable links. Search and alternative-sort views use `noindex, follow`. Stock pagination links reset the other section to page one, avoiding a Cartesian product of indexed URL combinations. Out-of-range pages return 404.
- Shared public directory data is cached for one hour. React request memoization prevents repeated metadata/page reads within a request. Cached scope does not include sessions, authentication, or account data. The existing Next.js cache architecture remains in use; Cache Components is not enabled.
- Added a permanent www-to-non-www redirect that preserves paths and query parameters. Existing stock, insider, article, and archive paths are preserved.
- Shortened stock, insider, sector, archive, and article search titles and generated descriptions. The full company and article headings remain visible.
- Reworked the transaction-code, Form 4 walkthrough, 10b5-1, and filing-deadline guides. Added all 20 SEC transaction codes, a verified exercise-and-sale example, clearer date distinctions, primary-source citations, and links into research pages. Corrected assertions that code P always means personal discretionary exchange buying or that the detector excludes every plan purchase.
- Fixed the homepage workflow label contrast issue identified in Lighthouse by using the existing accent color.
- Included the earlier support-email changes: `support@insiderclusters.com` in the footer, methodology, terms, and privacy pages.

No production deployment, GSC validation request, or outreach was performed. Changes are in the working tree.

## Indexing report findings

The supplied coverage export describes **all known pages**, not just submitted sitemap URLs. Its latest index-count snapshot is October 9, 2026: **4,206 indexed** and **3,906 not indexed**. The issue counts reconcile exactly to 3,906.

| Reason | URLs | Treatment |
| --- | ---: | --- |
| Not found (404) | 1,082 | Validation failed. Requires affected URL examples and underlying data investigation. |
| Excluded by noindex | 1,168 | Preserve intentional eligibility/auth/filter exclusions. Investigate only unexpected examples. |
| Alternate with proper canonical | 162 | Can be expected consolidation; not automatically an error. |
| Page with redirect | 124 | Can be expected legacy URL consolidation. |
| Crawled, currently not indexed | 305 | Improve usefulness/discovery; inspect examples before changing eligibility. |
| Discovered, currently not indexed | 1,065 | Smaller directory responses and crawlable pagination improve discovery and rendering. |

Indexed counts remained at 4,271 across September 22–October 4, including the onset of the late-September impression decline. On October 5, the count fell to 4,206, approximately 1.5%. This evidence does not support a sudden 93% loss of indexed pages as the explanation for the 93% impression decline. It also does not establish an alternative cause.

The export contains aggregate reasons and daily totals, not the affected URLs, Google-selected canonicals, crawl failures, or a page/query/date breakdown. Do not treat all 3,906 exclusions as errors to remove. The current 12,264 sitemap candidates and the older 8,112 known-page snapshot are different populations and dates.

Five historical missing profiles sampled during the audit are still absent from the current sitemap and returned 404 even with unpadded CIKs. The local database is a smaller dataset and does not contain those reporting owners. No production records were restored, fabricated, or redirected to unrelated pages. A regression check confirms that a valid current profile's padded-CIK legacy URL already redirects correctly.

## Verification

- Production Next.js build and TypeScript checks passed.
- Full web lint passed with zero errors and four pre-existing warnings in unrelated health, monitoring, and API-key files.
- Production-server HTTP regression checks passed: separate stock pages contain distinct records; both stock sections are bounded to 50; search reaches a ticker outside page one; search/sort views are noindexed; numbered pages are self-canonical; out-of-range pagination is 404; insider page two starts at rank 51; sector records are bounded to 50; valid padded-CIK links redirect to the same insider; www redirects preserve path and query; all four updated guides render with SEC sources and update dates.
- The final local `/stocks` response was **225,963 bytes**, using the local dataset, and contains a plain GET search form usable without JavaScript. This is not a like-for-like production measurement against the audit's 4.7 MB response, because the local and production datasets differ. Pagination bounds the response independently of the total directory length.
- Visual browser QA and field Core Web Vitals were not available. Existing responsive directory/table styling is reused. No new mobile Lighthouse score or ranking improvement is claimed.

Run the HTTP checks against a production build with a dataset containing more than 50 cluster stocks and enough insiders for a second result page:

```sh
npm run build --workspace web
npm run start --workspace web -- --port 3006
node scripts/check-public-seo.mjs http://localhost:3006
```

The script is read-only. It can also take the deployed origin. The host-header redirect check runs only against a local HTTP server.

## Remaining actions

1. Export the individual affected URLs from GSC's **Not found (404)** issue. Inspect their transaction coverage and deployment history before restoring data or mapping exact replacements. Also inspect unexpected noindex/canonical examples.
2. After deployment, run the response checks on production, inspect representative URLs in GSC, and verify www handling through the hosting proxy. Use the live sitemap index in GSC and retain valid historical URLs.
3. Check Crawl stats and URL Inspection around September 28. Separate the loss of particular queries from indexing changes. The current aggregates cannot establish causation.
4. Measure production directory size and mobile performance, including field LCP/INP/CLS when available. Reassess homepage JavaScript and fonts using fresh traces before changing analytics behavior.
5. Use the existing monthly archive as the evidence base for useful recurring research. Publish reviewed interpretation and pursue relevant editorial citations.
6. Compare intended-query impressions, clicks, and sign-ups over 28-day windows following deployment. Keep deployment dates and avoid conclusions from a handful of clicks.

## Sources

GSC source directory: `/Users/nabeel/Downloads/insiderclusters.com-Coverage-2026-10-13/` (`Metadata.csv`, `Critical issues.csv`, `Non-critical issues.csv`, `Chart.csv`). Derived summary: `seo-audit-2026-10-13/gsc-indexing-summary.json`. Original CSVs were read without modification.

Content sources:

- [SEC Form 4 and instructions](https://www.sec.gov/files/form4.pdf)
- [SEC investor bulletin on Forms 3, 4, and 5](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-69)
- [SEC 10b5-1 compliance guide](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/insider-trading-arrangements-and-related-disclosures)
- [SEC adopting release](https://www.sec.gov/files/rules/final/2022/33-11138.pdf)
- [Patusky UTHR filing used in the walkthrough](https://www.sec.gov/Archives/edgar/data/1082554/000123142725000004/xslF345X05/primarydocument.xml)

No additional DataForSEO requests or charges were incurred for this implementation. The earlier audit used $0.239848.
