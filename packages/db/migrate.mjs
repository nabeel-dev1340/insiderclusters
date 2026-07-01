// Minimal, dependency-light migration runner.
//
// - Applies every *.sql file in ./migrations in ascending filename order.
// - Tracks applied files in a `schema_migrations` table (idempotent: already
//   applied files are skipped).
// - Each migration runs inside its own transaction; a failure rolls back that
//   file and aborts the run without marking it applied.
//
// Usage (from repo root):  npm run migrate
// Requires DATABASE_URL in the environment (loaded from .env via --env-file).

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is not set. Copy .env.example to .env.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query("SELECT version FROM schema_migrations")).rows.map(
        (r) => r.version
      )
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= skip   ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`+ apply  ${file}`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`\nFAILED on ${file}:\n${err.message}`);
        process.exit(1);
      }
    }

    console.log(
      ran === 0
        ? "Database already up to date."
        : `Applied ${ran} migration(s).`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
