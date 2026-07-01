import { Pool } from "pg";

/**
 * Shared Postgres connection pool for the web app and scraper.
 *
 * Reads DATABASE_URL from the environment. Both services should import
 * `pool` (or `query`) from here rather than constructing their own pool,
 * so connection limits are respected across the monorepo.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env (see repo root)."
  );
}

export const pool = new Pool({ connectionString });

/** Thin helper for one-off parameterized queries. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params as never[]);
  return result.rows as T[];
}
