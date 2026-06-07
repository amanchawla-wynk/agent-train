import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for Postgres');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function checkDbConnection(): Promise<boolean> {
  const result = await checkDbConnectionDetail();
  return result.ok;
}

export async function checkDbConnectionDetail(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
