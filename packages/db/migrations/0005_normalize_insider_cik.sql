-- 0005_normalize_insider_cik.sql
-- Insider CIKs arrived in two shapes: Form 4 XML zero-pads to 10 digits
-- ("0001234567") while the DERA bulk backfill stores them unpadded
-- ("1234567"). The same person therefore existed under two keys, splitting
-- their history across the /insiders leaderboard, cluster distinct-insider
-- counts, and the per-insider profile pages. Canonical form is the unpadded
-- numeric string (matches EDGAR person URLs). The scraper now normalizes on
-- parse; this backfills rows written before that fix.

UPDATE transactions
   SET insider_cik = NULLIF(ltrim(insider_cik, '0'), '')
 WHERE insider_cik IS NOT NULL
   AND insider_cik <> NULLIF(ltrim(insider_cik, '0'), '');
