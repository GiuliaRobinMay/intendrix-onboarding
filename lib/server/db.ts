// Server-side Postgres access. When DATABASE_URL is set (the Supabase
// connection string in production, a local Postgres in development) the
// app serves shared data from the database; without it, the app keeps
// running as the browser-storage prototype.

import { Pool } from "pg";

const url = process.env.DATABASE_URL;

export const dbConfigured = Boolean(url);

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!url) throw new Error("DATABASE_URL is not set");
    const local =
      url.includes("localhost") || url.includes("127.0.0.1") || url.includes("host=/");
    pool = new Pool({
      connectionString: url,
      max: 3,
      // Supabase's pooler speaks TLS with a managed certificate chain
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}
