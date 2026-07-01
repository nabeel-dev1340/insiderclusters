// Seed realistic demo clusters for local development / UI work.
//
// Idempotent: removes any prior demo rows (accession prefix "DEMO-") before
// inserting. Demo filings use well-formed but illustrative EDGAR URLs — real
// clusters produced by the scraper carry real filing URLs.
//
// Usage:  npm run seed

import pg from "pg";

const DEMO_PREFIX = "DEMO-";

/** ticker, issuer, marketCap, hours-ago detected, and the participating insiders */
const CLUSTERS = [
  {
    ticker: "SOUN",
    issuer: "SoundHound AI, Inc.",
    marketCap: 1_580_000_000,
    detectedHoursAgo: 10, // < 24h -> real-time (free tier locked)
    insiders: [
      { name: "Keyvan Mohajer", role: "CEO, Director", cik: "0001680048", shares: 40000, price: 8.9 },
      { name: "Nitesh Sharan", role: "CFO", cik: "0001680049", shares: 22000, price: 8.72 },
      { name: "James Hom", role: "Chief Product Officer", cik: "0001680050", shares: 15000, price: 8.81 },
      { name: "Diana Sroka", role: "Director", cik: "0001680051", shares: 12000, price: 8.95 },
    ],
  },
  {
    ticker: "RGTI",
    issuer: "Rigetti Computing, Inc.",
    marketCap: 1_240_000_000,
    detectedHoursAgo: 74, // ~3 days -> delayed, free tier sees it
    insiders: [
      { name: "Subodh Kulkarni", role: "CEO, Director", cik: "0001838831", shares: 55000, price: 12.4 },
      { name: "Jeffrey Bertelsen", role: "CFO, COO", cik: "0001838832", shares: 20000, price: 12.15 },
      { name: "Cathy McCarthy", role: "Director", cik: "0001838833", shares: 10000, price: 12.5 },
    ],
  },
  {
    ticker: "LUNR",
    issuer: "Intuitive Machines, Inc.",
    marketCap: 940_000_000,
    detectedHoursAgo: 200, // ~8 days -> a different ISO week
    insiders: [
      { name: "Stephen Altemus", role: "CEO, President", cik: "0001844452", shares: 30000, price: 9.6 },
      { name: "Peter McGrath", role: "10% Owner", cik: "0001844453", shares: 28000, price: 9.45 },
    ],
  },
  {
    ticker: "BBAI",
    issuer: "BigBear.ai Holdings, Inc.",
    marketCap: 720_000_000,
    detectedHoursAgo: 130, // ~5 days
    insiders: [
      { name: "Mandy Long", role: "CEO", cik: "0001836981", shares: 45000, price: 3.55 },
      { name: "Julie Peffer", role: "CFO", cik: "0001836982", shares: 40000, price: 3.48 },
    ],
  },
  {
    ticker: "CIFR",
    issuer: "Cipher Mining Inc.",
    marketCap: 1_090_000_000,
    detectedHoursAgo: 480, // ~20 days -> older week
    insiders: [
      { name: "Tyler Page", role: "CEO, Director", cik: "0001819989", shares: 60000, price: 4.35 },
      { name: "Edward Farrell", role: "CFO", cik: "0001819990", shares: 24000, price: 4.28 },
    ],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Clean prior demo data.
    await client.query(
      `DELETE FROM transactions WHERE filing_id IN
         (SELECT id FROM filings WHERE accession_number LIKE $1)`,
      [`${DEMO_PREFIX}%`]
    );
    await client.query(`DELETE FROM clusters WHERE ticker = ANY($1)`, [
      CLUSTERS.map((c) => c.ticker),
    ]);
    await client.query(`DELETE FROM filings WHERE accession_number LIKE $1`, [
      `${DEMO_PREFIX}%`,
    ]);

    let filingSeq = 0;

    for (const c of CLUSTERS) {
      const txIds = [];
      const dates = [];

      for (let i = 0; i < c.insiders.length; i++) {
        const ins = c.insiders[i];
        filingSeq++;
        const accession = `${DEMO_PREFIX}${String(filingSeq).padStart(10, "0")}`;
        // Transactions land in the few days before detection.
        const dayOffset = Math.floor(c.detectedHoursAgo / 24) + (i + 1);
        const cikPath = ins.cik.replace(/^0+/, "");
        const rawUrl = `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accession.replace(
          /-/g,
          ""
        )}/${accession}.txt`;

        const { rows: fRows } = await client.query(
          `INSERT INTO filings
             (accession_number, issuer_cik, issuer_name, ticker, filed_at, raw_xml_url, processed_at)
           VALUES ($1, $2, $3, $4, now() - ($5 || ' hours')::interval, $6, now())
           RETURNING id`,
          [accession, ins.cik, c.issuer, c.ticker, c.detectedHoursAgo + i, rawUrl]
        );
        const filingId = fRows[0].id;

        const value = ins.shares * ins.price;
        const { rows: tRows } = await client.query(
          `INSERT INTO transactions
             (filing_id, insider_cik, insider_name, insider_role, transaction_code,
              transaction_date, shares, price_per_share, value, is_signal)
           VALUES ($1, $2, $3, $4, 'P', (CURRENT_DATE - $5::int), $6, $7, $8, TRUE)
           RETURNING id`,
          [filingId, ins.cik, ins.name, ins.role, dayOffset, ins.shares, ins.price, value]
        );
        txIds.push(tRows[0].id);
        dates.push(dayOffset);
      }

      const totalValue = c.insiders.reduce((s, i) => s + i.shares * i.price, 0);
      const maxOffset = Math.max(...dates);
      const minOffset = Math.min(...dates);

      await client.query(
        `INSERT INTO clusters
           (ticker, issuer_name, market_cap, insider_count, total_value,
            window_start, window_end, transaction_ids, detected_at, alert_sent_at)
         VALUES ($1, $2, $3, $4, $5,
            (CURRENT_DATE - $6::int), (CURRENT_DATE - $7::int), $8,
            now() - ($9 || ' hours')::interval, now() - ($9 || ' hours')::interval)`,
        [
          c.ticker,
          c.issuer,
          c.marketCap,
          c.insiders.length,
          totalValue,
          maxOffset,
          minOffset,
          txIds,
          c.detectedHoursAgo,
        ]
      );

      console.log(
        `seeded ${c.ticker}: ${c.insiders.length} insiders, $${totalValue.toLocaleString()}, ${c.detectedHoursAgo}h ago`
      );
    }

    await client.query("COMMIT");
    console.log(`\nDone. Seeded ${CLUSTERS.length} demo clusters.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
