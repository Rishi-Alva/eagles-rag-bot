import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(databaseUrl());
}

/** Lazy singleton pool. Returns null when DATABASE_URL is unset. */
export function getPool(): pg.Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[db] pool error:", err.message);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
