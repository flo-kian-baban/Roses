#!/usr/bin/env node
// Applies db/migrations/*.sql in filename order, once each, inside a transaction.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

loadEnv();
const dir = path.resolve('db/migrations');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
const applied = new Set((await client.query('select filename from schema_migrations')).rows.map((r) => r.filename));
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
let n = 0;
for (const f of files) {
  if (applied.has(f)) { console.log(`skip   ${f}`); continue; }
  const sql = await fs.readFile(path.join(dir, f), 'utf8');
  await client.query('begin');
  try { await client.query(sql); await client.query('insert into schema_migrations (filename) values ($1)', [f]); await client.query('commit'); console.log(`applied ${f}`); n++; }
  catch (e) { await client.query('rollback'); console.error(`FAILED ${f}: ${e.message}`); process.exitCode = 1; break; }
}
console.log(`${n} migration(s) applied, ${applied.size} already present`);
await client.end();
