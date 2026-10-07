#!/usr/bin/env node
// Exports every Persian draft (fa_draft flags in the database) for a fluent reader.
//   node tools/import/persian-review-export.mjs senso [--out reports/persian-review.csv]
// Columns: section | item | field | English | Persian draft | corrected Persian (left empty for the reviewer).
import fs from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [venue, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const out = args.out || 'reports/persian-review.csv';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const rows = [];
const sections = (await client.query(`select id, name, fa_draft from sections where venue_id = $1 order by position`, [venue])).rows;
for (const s of sections) if (s.fa_draft.includes('name')) rows.push([s.name.en, '', 'section name', s.name.en, s.name.fa ?? '']);
const items = (await client.query(
  `select i.id, i.name, i.description, i.add_ons, i.fa_draft,
          (select s.name->>'en' from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id order by s.position, x.position limit 1) as section
     from items i where i.venue_id = $1 and cardinality(i.fa_draft) > 0
    order by section, i.name->>'en'`, [venue])).rows;
for (const i of items) {
  if (i.fa_draft.includes('name')) rows.push([i.section ?? '', i.name.en, 'name', i.name.en, i.name.fa ?? '']);
  if (i.fa_draft.includes('description')) rows.push([i.section ?? '', i.name.en, 'description', i.description.en ?? '', i.description.fa ?? '']);
  if (i.fa_draft.includes('addOns')) {
    const groups = new Map();
    for (const a of i.add_ons) if (a.group?.en && !groups.has(a.group.en)) groups.set(a.group.en, a.group.fa ?? '');
    for (const [en, fa] of groups) rows.push([i.section ?? '', i.name.en, 'add-on group', en, fa]);
    for (const a of i.add_ons) rows.push([i.section ?? '', i.name.en, 'add-on', a.label.en, a.label.fa ?? '']);
  }
}
await client.end();
const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = '﻿' + ['section,item,field,English,Persian draft,corrected Persian', ...rows.map((r) => [...r, ''].map(esc).join(','))].join('\n') + '\n';
await fs.writeFile(out, csv);
console.log(`${rows.length} rows written to ${out}`);
