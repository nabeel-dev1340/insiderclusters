import "server-only";

// Server-only re-export of the shared Postgres pool. Importing this from a
// Client Component will fail the build (via `server-only`), preventing the DB
// layer from ever leaking into the browser bundle.
export { pool, query } from "@insiderclusters/db";
