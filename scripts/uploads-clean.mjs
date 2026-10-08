#!/usr/bin/env node
// Removes uploaded files that no row references (items.photo.key, venues.brand.logo.key) and prints each one
// (PM decision, 2026-10-08: a replaced or removed photo's file stays on disk until this runs). Files younger than
// --min-age minutes (default 60) are kept: an upload whose item is still being added has no row yet.
//   npm run uploads:clean                 remove and print
//   npm run uploads:clean -- --dry-run    print what would be removed, remove nothing
//   npm run uploads:clean -- --min-age 0  (the check suite, on its own scratch copy and run folder)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

loadEnv();
const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');
const minAgeMin = argv.includes('--min-age') ? Number(argv[argv.indexOf('--min-age') + 1]) : 60;
const dir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const KEY_RE = /^[a-z0-9-]+\/(photo|logo)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|svg)$/;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-uploads-clean' });
await client.connect();
const dbName = (await client.query('select current_database() as db')).rows[0].db;
console.log(`database "${dbName}", folder ${dir}${dry ? ' (dry run: nothing is removed)' : ''}, keeping files younger than ${minAgeMin} min`);
const referenced = new Set([
  ...(await client.query(`select photo->>'key' as k from items where photo->>'key' is not null`)).rows.map((r) => r.k),
  ...(await client.query(`select brand->'logo'->>'key' as k from venues where brand->'logo'->>'key' is not null`)).rows.map((r) => r.k),
]);
await client.end();

const files = [];
const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(p); } };
walk(dir);
const now = Date.now();
const out = { keptReferenced: [], keptYoung: [], leftAlone: [], removed: [], bytes: 0 };
for (const f of files.sort()) {
  const key = path.relative(dir, f).split(path.sep).join('/');
  const st = fs.statSync(f);
  if (!KEY_RE.test(key)) { out.leftAlone.push(key); console.log(`left alone (not an upload key): ${key}`); continue; }
  if (referenced.has(key)) { out.keptReferenced.push(key); continue; }
  if (now - st.mtimeMs < minAgeMin * 60000) { out.keptYoung.push(key); console.log(`kept (younger than ${minAgeMin} min, may still be saved): ${key}`); continue; }
  out.removed.push(key); out.bytes += st.size;
  console.log(`${dry ? 'would remove' : 'removed'}: ${key} (${st.size} bytes)`);
  if (!dry) fs.rmSync(f);
}
// empty venue folders go too
if (!dry && fs.existsSync(dir)) for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && fs.readdirSync(path.join(dir, e.name)).length === 0) fs.rmdirSync(path.join(dir, e.name));
console.log(`SUMMARY referenced-kept ${out.keptReferenced.length}, young-kept ${out.keptYoung.length}, left-alone ${out.leftAlone.length}, ${dry ? 'would-remove' : 'removed'} ${out.removed.length} (${out.bytes} bytes); ${referenced.size} key${referenced.size === 1 ? '' : 's'} referenced by rows`);
