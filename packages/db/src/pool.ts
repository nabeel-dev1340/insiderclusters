import { Pool } from "pg";

/**
 * Shared Postgres connection pool for the web app and scraper.
 *
 * The pool is created lazily on first use so that merely importing this module
 * has no side effects and does not require DATABASE_URL. This matters during
 * `next build`, which imports route modules to analyze them without a database
 * available — an eager connection/throw at import time would break the build.
 *
 * Both services should import `pool` (or `query`) from here rather than
 * constructing their own pool, so connection limits are respected.
 */

let realPool: Pool | null = null;

function getPool(): Pool {
  if (!realPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env (see repo root)."
      );
    }
    realPool = new Pool({ connectionString });
  }
  return realPool;
}

// A lazy proxy so existing `pool.query(...)` / `pool.end()` call sites keep
// working, but the underlying Pool (and the DATABASE_URL check) is only created
// on first property access.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const p = getPool();
    const value = Reflect.get(p as object, prop, receiver);
    return typeof value === "function" ? value.bind(p) : value;
  },
});

/** Thin helper for one-off parameterized queries. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, params as never[]);
  return result.rows as T[];
}
