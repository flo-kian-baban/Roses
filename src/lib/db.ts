import { Pool } from 'pg';

// One pool per process. Standard Postgres only; the connection string is the only environment-specific value.
// Every process names itself to Postgres (application_name) and logs the database it connected to, so the check
// suite can prove from both sides that no server or drill it started touched the working database.
const globalForPg = globalThis as unknown as { pgPool?: Pool };
export const APP_NAME = process.env.ROSES_APP_NAME || 'roses-app';
export const DB_NAME = (() => { try { return new URL(process.env.DATABASE_URL || '').pathname.slice(1) || '(none)'; } catch { return '(unparsed)'; } })();
export const pool = globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, application_name: APP_NAME });
if (!globalForPg.pgPool) pool.once('connect', () => console.log(`[db] connected to database "${DB_NAME}" as application "${APP_NAME}"`));
if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
