import "server-only";
import { pool } from "../db";

// Rate limits keyed on email, enforced against the auth_tokens table (each
// request-link creates a row). Two layers:
//   - burst:  no more than one request per BURST_SECONDS (stops double-submits
//             / "requesting twice rapidly" producing two emails)
//   - window: at most MAX_PER_WINDOW requests per WINDOW_MINUTES (PRD: 3 / 15m)
const BURST_SECONDS = Number(process.env.AUTH_RATE_BURST_SECONDS ?? 20);
const WINDOW_MINUTES = Number(process.env.AUTH_RATE_WINDOW_MINUTES ?? 15);
const MAX_PER_WINDOW = Number(process.env.AUTH_RATE_MAX_PER_WINDOW ?? 3);

export async function isRateLimited(email: string): Promise<boolean> {
  const { rows } = await pool.query<{ recent: number; window_count: number }>(
    `SELECT
       count(*) FILTER (WHERE created_at > now() - ($2 || ' seconds')::interval)::int AS recent,
       count(*) FILTER (WHERE created_at > now() - ($3 || ' minutes')::interval)::int AS window_count
     FROM auth_tokens
     WHERE email = $1`,
    [email, BURST_SECONDS, WINDOW_MINUTES]
  );
  const r = rows[0]!;
  return r.recent >= 1 || r.window_count >= MAX_PER_WINDOW;
}
