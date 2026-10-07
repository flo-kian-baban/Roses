#!/usr/bin/env node
// Usage: node tools/import/run.mjs <venue> [--date 2026-10-07] [--load]
//   builds data/import/<date>/<venue>/<venue>.json, needs-persian.json and import-report.md;
//   with --load also writes venues.json and the venue rows into Postgres (DATABASE_URL from .env.local).
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSenso } from './senso.mjs';
import { loadVenueFile, loadVenues } from './load.mjs';
import { writeReport } from './report.mjs';
import { reconcileSenso } from './reconcile-senso.mjs';
import { norm } from './lib.mjs';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [venue, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter((x) => x.length));
const date = args.date || '2026-10-07';
const raw = path.resolve('data/raw');
const out = path.resolve('data/import', date, venue);
await fs.mkdir(out, { recursive: true });
const draftsFile = path.join(out, 'persian-drafts.json');
const drafts = JSON.parse(await fs.readFile(draftsFile, 'utf8').catch(() => '{}'));
const venues = JSON.parse(await fs.readFile(path.resolve('data/import', date, 'venues.json'), 'utf8').catch(() => '[]'));

const builders = { senso: buildSenso };
if (!builders[venue]) { console.error(`unknown venue ${venue}`); process.exit(1); }
const data = await builders[venue]({ raw, date, drafts });
await fs.writeFile(path.join(out, `${venue}.json`), JSON.stringify({ venue: data.venue, generatedAt: data.generatedAt, sections: data.sections, items: data.items }, null, 1));
await fs.writeFile(path.join(out, 'needs-persian.json'), JSON.stringify(data.log.persian.missing, null, 1));
console.log('stats', JSON.stringify(data.stats));
console.log(`persian: from source ${data.log.persian.fromSource.length}, drafted ${data.log.persian.drafted.length}, missing ${data.log.persian.missing.length}`);
let counts = null;
if (args.load) {
  const n = await loadVenues(venues, { databaseUrl: process.env.DATABASE_URL });
  counts = await loadVenueFile(data, { databaseUrl: process.env.DATABASE_URL });
  console.log(`venues upserted: ${n}; sections +${counts.sectionsInserted} ~${counts.sectionsUpdated} =${counts.sectionsKept}; items +${counts.itemsInserted} ~${counts.itemsUpdated} =${counts.itemsKept}`);
}
const reconcile = venue === 'senso' ? await reconcileSenso({ raw, date, importedUnlistedKeys: new Set(data.items.filter((i) => !i.listed).map((i) => norm(i.name.en))) }) : null;
await writeReport({ venue, date, out, data, venues: venues.find((v) => v.id === venue) || null, counts, reconcile });
console.log(`report: ${path.join(out, 'import-report.md')}`);
