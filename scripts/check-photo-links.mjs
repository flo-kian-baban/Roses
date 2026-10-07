#!/usr/bin/env node
// Requests every photo URL stored in the database (listed and unlisted items) plus the venue logo source,
// with HEAD (GET fallback on non-200), 6 at a time. Writes reports/<dir>/photo-links.{json,md}.
//   node scripts/check-photo-links.mjs senso [--out reports/checkpoint-a2]
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

loadEnv();
const [venue, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const out = path.resolve(args.out || 'reports/checkpoint-a2');
await fs.mkdir(out, { recursive: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const items = (await client.query(`select i.name->>'en' as item, i.listed, i.photo->>'url' as url from items i where i.venue_id = $1 and i.photo is not null order by i.listed desc, 1`, [venue])).rows;
const venueRow = (await client.query('select brand from venues where id = $1', [venue])).rows[0];
await client.end();
const targets = items.map((r) => ({ item: r.item, listed: r.listed, url: r.url }));
const logo = venueRow?.brand?.logo;
if (logo?.sourceUrl) targets.push({ item: '(venue logo source)', listed: true, url: logo.sourceUrl });
else if (logo?.url && /^https?:/.test(logo.url)) targets.push({ item: '(venue logo)', listed: true, url: logo.url });

async function probe(url) {
  const t0 = Date.now();
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (menu link check)' } });
    let method = 'HEAD';
    if (res.status !== 200) { res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (menu link check)', range: 'bytes=0-0' } }); method = 'GET'; }
    return { status: res.status, method, contentType: res.headers.get('content-type'), ms: Date.now() - t0 };
  } catch (e) { return { status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message, ms: Date.now() - t0 }; }
  finally { clearTimeout(timer); }
}
const results = [];
let idx = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (idx < targets.length) { const t = targets[idx++]; results.push({ ...t, ...(await probe(t.url)) }); } }));
const byStatus = {};
for (const r of results) { const k = r.status === 206 ? '206 (range GET)' : String(r.status); byStatus[k] = (byStatus[k] || 0) + 1; }
const bad = results.filter((r) => r.status !== 200 && r.status !== 206);
const md = [`# Photo link check — ${venue} — ${new Date().toISOString()}`, '', `${results.length} URLs requested (${targets.length - (logo ? 1 : 0)} item photos, ${logo ? 1 : 0} logo source).`, '', '| Status | Count |', '| --- | --- |', ...Object.entries(byStatus).sort().map(([k, v]) => `| ${k} | ${v} |`), ''];
md.push(bad.length ? `Not 200 (${bad.length}):` : 'Every URL returned 200.', '');
if (bad.length) { md.push('| Item | Listed | Status | URL |', '| --- | --- | --- | --- |'); for (const r of bad) md.push(`| ${r.item} | ${r.listed ? 'yes' : 'no'} | ${r.status || r.error} | ${r.url} |`); }
await fs.writeFile(path.join(out, 'photo-links.json'), JSON.stringify({ venue, at: new Date().toISOString(), byStatus, results }, null, 2));
await fs.writeFile(path.join(out, 'photo-links.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
