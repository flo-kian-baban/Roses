// Minimal .env.local loader for scripts (Next.js loads it itself for the app), plus the one database client every
// drill uses: it names itself to Postgres (application_name "roses-check:<drill>") and prints the database it connected
// to as its first line, so the check suite can prove from the logs and from pg_stat_activity which database each
// process used.
import fs from 'node:fs';
import pg from 'pg';
export function loadEnv(file = '.env.local') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
export const dbName = (url = process.env.DATABASE_URL) => { try { return new URL(url || '').pathname.slice(1) || '(none)'; } catch { return '(unparsed)'; } };
export async function connectDb(drill, log = console.log) {
  const app = `roses-check:${drill}`;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: app });
  await client.connect();
  const row = (await client.query('select current_database() as db')).rows[0];
  log(`connected to database "${row.db}" as application "${app}"`);
  return client;
}
