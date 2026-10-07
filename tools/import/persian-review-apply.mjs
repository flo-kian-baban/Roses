#!/usr/bin/env node
// Reads the reviewed CSV back. For every row with a corrected value it updates the Persian text,
// clears that field's draft flag, records a revision, and marks the row as reviewed so a re-import
// leaves it alone.
//   node tools/import/persian-review-apply.mjs senso reports/persian-review.csv [--dry] [--accept-drafts] [--reviewer "Name"]
// --accept-drafts: every row whose "corrected Persian" cell is empty is taken as confirmed (the draft becomes the
// reviewed value); used when a fluent reader confirms the drafts as they stand.
import fs from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [venue, file, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry');
const acceptDrafts = rest.includes('--accept-drafts');
const reviewer = rest.includes('--reviewer') ? rest[rest.indexOf('--reviewer') + 1] : 'Persian reviewer';
const text = (await fs.readFile(file, 'utf8')).replace(/^﻿/, '');
const rows = parseCsv(text);
const header = rows.shift().map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name.toLowerCase());
const C = { section: col('section'), item: col('item'), field: col('field'), en: col('English'), draft: col('Persian draft'), corrected: col('corrected Persian') };
if (Object.values(C).some((i) => i < 0)) throw new Error('CSV header must be: section,item,field,English,Persian draft,corrected Persian');
const by = { kind: 'review', id: file, name: reviewer };
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = { rows: rows.length, corrected: 0, confirmed: 0, applied: 0, notFound: 0, unchanged: 0 };
// The value a row settles on: the reviewer's correction, or (with --accept-drafts) the draft itself.
const valueOf = (r) => { const c = (r[C.corrected] || '').trim(); if (c) return { v: c, confirmed: false }; if (acceptDrafts && (r[C.draft] || '').trim()) return { v: r[C.draft].trim(), confirmed: true }; return null; };
await client.query('begin');
try {
  for (const r of rows) {
    const val = valueOf(r);
    if (!val) continue;
    const corrected = val.v;
    val.confirmed ? counts.confirmed++ : counts.corrected++;
    const field = r[C.field].trim(), itemName = r[C.item].trim(), en = r[C.en].trim(), sectionName = r[C.section].trim();
    if (field === 'section note') {
      const s = (await client.query(`select id, note, fa_draft from sections where venue_id = $1 and name->>'en' = $2`, [venue, sectionName])).rows[0];
      if (!s) { counts.notFound++; console.log(`not found: section "${sectionName}"`); continue; }
      if (s.note?.fa === corrected && !s.fa_draft.includes('note')) { counts.unchanged++; continue; }
      const after = { ...(s.note || { en: null }), fa: corrected };
      if (!dry) { await client.query(`update sections set note = $2, fa_draft = array_remove(fa_draft, 'note'), updated_at = now(), updated_by = $3 where id = $1`, [s.id, after, by]); await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1,'sections',$2,'update',$3,$4,$5)`, [venue, s.id, { note: s.note, fa_draft: s.fa_draft }, { note: after, fa_draft: s.fa_draft.filter((f) => f !== 'note') }, by]); }
      counts.applied++; continue;
    }
    if (field === 'section name') {
      const s = (await client.query(`select id, name, fa_draft from sections where venue_id = $1 and name->>'en' = $2`, [venue, en])).rows[0];
      if (!s) { counts.notFound++; console.log(`not found: section "${en}"`); continue; }
      if (s.name.fa === corrected && !s.fa_draft.includes('name')) { counts.unchanged++; continue; }
      const after = { ...s.name, fa: corrected };
      if (!dry) { await client.query(`update sections set name = $2, fa_draft = array_remove(fa_draft, 'name'), updated_at = now(), updated_by = $3 where id = $1`, [s.id, after, by]); await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1,'sections',$2,'update',$3,$4,$5)`, [venue, s.id, { name: s.name, fa_draft: s.fa_draft }, { name: after, fa_draft: s.fa_draft.filter((f) => f !== 'name') }, by]); }
      counts.applied++; continue;
    }
    const i = (await client.query(`select id, name, description, add_ons, variants, components, fa_draft from items where venue_id = $1 and name->>'en' = $2`, [venue, itemName])).rows[0];
    if (!i) { counts.notFound++; console.log(`not found: item "${itemName}" (${sectionName})`); continue; }
    const before = { name: i.name, description: i.description, add_ons: i.add_ons, variants: i.variants, components: i.components, fa_draft: i.fa_draft };
    let name = i.name, description = i.description, add_ons = i.add_ons, variants = i.variants, components = i.components, fa_draft = [...i.fa_draft];
    if (field === 'name') { if (name.fa === corrected && !fa_draft.includes('name')) { counts.unchanged++; continue; } name = { ...name, fa: corrected }; fa_draft = fa_draft.filter((f) => f !== 'name'); }
    else if (field === 'description') { if (description.fa === corrected && !fa_draft.includes('description')) { counts.unchanged++; continue; } description = { ...description, fa: corrected }; fa_draft = fa_draft.filter((f) => f !== 'description'); }
    else if (field === 'add-on group') { add_ons = add_ons.map((a) => a.group?.en === en ? { ...a, group: { ...a.group, fa: corrected } } : a); }
    else if (field === 'add-on') { add_ons = add_ons.map((a) => a.label?.en === en ? { ...a, label: { ...a.label, fa: corrected } } : a); }
    else if (field === 'size') { variants = variants.map((v) => v.label?.en === en ? { ...v, label: { ...v.label, fa: corrected } } : v); }
    else if (field === 'component') { components = components.map((c) => c.label?.en === en ? { ...c, label: { ...c.label, fa: corrected } } : c); }
    else { counts.notFound++; console.log(`unknown field "${field}"`); continue; }
    if (!dry) {
      await client.query(`update items set name = $2, description = $3, add_ons = $4, variants = $5, components = $6, fa_draft = $7, updated_at = now(), updated_by = $8 where id = $1`, [i.id, name, description, JSON.stringify(add_ons), JSON.stringify(variants), JSON.stringify(components), fa_draft, by]);
      await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1,'items',$2,'update',$3,$4,$5)`, [venue, i.id, before, { name, description, add_ons, variants, components, fa_draft }, by]);
    }
    counts.applied++;
  }
  // The add-on draft flag clears once every add-on string of the item has been corrected in this CSV.
  const touched = new Set(rows.filter((r) => valueOf(r) && /^add-on/.test(r[C.field])).map((r) => r[C.item].trim()));
  for (const itemName of touched) {
    const i = (await client.query(`select id, add_ons, fa_draft from items where venue_id = $1 and name->>'en' = $2`, [venue, itemName])).rows[0];
    if (!i || !i.fa_draft.includes('addOns')) continue;
    const strings = new Set(); for (const a of i.add_ons) { if (a.group?.en) strings.add('g:' + a.group.en); strings.add('l:' + a.label.en); }
    const correctedHere = new Set(rows.filter((r) => r[C.item].trim() === itemName && valueOf(r)).map((r) => (r[C.field].trim() === 'add-on group' ? 'g:' : 'l:') + r[C.en].trim()));
    if ([...strings].every((s) => correctedHere.has(s)) && !dry) await client.query(`update items set fa_draft = array_remove(fa_draft, 'addOns') where id = $1`, [i.id]);
  }
  for (const [flag, field, col] of [['variants', 'size', 'variants'], ['components', 'component', 'components']]) {
    const names = new Set(rows.filter((r) => valueOf(r) && r[C.field].trim() === field).map((r) => r[C.item].trim()));
    for (const itemName of names) {
      const i = (await client.query(`select id, ${col} as labels, fa_draft from items where venue_id = $1 and name->>'en' = $2`, [venue, itemName])).rows[0];
      if (!i || !i.fa_draft.includes(flag)) continue;
      const have = new Set(rows.filter((r) => r[C.item].trim() === itemName && r[C.field].trim() === field && valueOf(r)).map((r) => r[C.en].trim()));
      if (i.labels.every((x) => have.has(x.label.en)) && !dry) await client.query(`update items set fa_draft = array_remove(fa_draft, $2) where id = $1`, [i.id, flag]);
    }
  }
  await client.query(dry ? 'rollback' : 'commit');
} catch (e) { await client.query('rollback'); throw e; } finally { await client.end(); }
console.log(JSON.stringify({ ...counts, acceptDrafts, reviewer, dry }));

function parseCsv(s) {
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) out.push(row); }
  return out;
}
