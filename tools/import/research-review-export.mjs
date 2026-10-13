#!/usr/bin/env node
// Exports the menu research review sheet of a venue (Kian via the PM, 2026-10-12): one row per shown item, from the database as it is now.
// Columns and what may be edited: tools/import/research-review-lib.mjs. Read it back with tools/import/research-review-apply.mjs.
//   node tools/import/research-review-export.mjs senso [--out reports/research-review-senso.csv]
import fs from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';
import { currentRows, toCsv } from './research-review-lib.mjs';

loadEnv();
const [venue, ...rest] = process.argv.slice(2);
if (!venue) { console.error('usage: node tools/import/research-review-export.mjs <venue> [--out <file.csv>]'); process.exit(2); }
const out = rest.includes('--out') ? rest[rest.indexOf('--out') + 1] : `reports/research-review-${venue}.csv`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-research-review-export' });
await client.connect();
const rows = await currentRows(client, venue);
await client.end();
await fs.writeFile(out, toCsv(rows));
const n = (f) => rows.filter(f).length;
console.log(`${rows.length} rows written to ${out} (shown items of ${venue}): new EN ${n((r) => r.cells['new EN'])}, new FA ${n((r) => r.cells['new FA'])}, with a research basis ${n((r) => r.basis)}, allergens to confirm ${n((r) => r.basis && !r.cells.confirmed)}`);
