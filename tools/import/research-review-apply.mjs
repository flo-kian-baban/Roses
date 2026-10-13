#!/usr/bin/env node
// Reads a reviewed menu research sheet back (reports/research-review-<venue>.csv; Kian via the PM, 2026-10-12). Per row, against the database
// as it is now (tools/import/research-review-lib.mjs builds the same rows the export wrote):
//   - new EN / new FA changed (only on rows where the research wrote that field): the description is set to the reviewer's text and its
//     draft flag goes (it is the reviewer's text now);
//   - allergens / dietary changed: the item's notes get the reviewer's words and that field's draft flag goes (a person's correction);
//   - confirmed = yes: the allergen and dietary drafts are confirmed as they stand (their flags go; customers see "Contains: …");
//   - correction: listed for a person to read, never applied; a read-only column that differs from the database: listed, ignored;
//   - apply fix = yes (Kian, 2026-10-13): the row's proposed fix is applied: the English and Persian as written in the "proposed fix" cell
//     (the reviewer may edit them), the notes as the record proposes; the fixed text is the reviewer's, so its draft flags go. A row not
//     ticked changes nothing, whatever its proposed fix says.
// One revision row per item changed, as { kind: 'review', id: <the CSV>, name: <reviewer> }, with before and after snapshots. A sheet
// exported and read back unchanged changes nothing (the round trip); so does a sheet read back twice.
//   node tools/import/research-review-apply.mjs senso reports/research-review-senso.csv [--dry] [--reviewer "Kian"]
import fs from 'node:fs';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';
import { COLUMNS, YES, applyFix, currentRows, listOf, parseCsv } from './research-review-lib.mjs';

loadEnv();
const [venue, file, ...rest] = process.argv.slice(2);
if (!venue || !file) { console.error('usage: node tools/import/research-review-apply.mjs <venue> <sheet.csv> [--dry] [--reviewer "Name"]'); process.exit(2); }
const dry = rest.includes('--dry');
const reviewer = rest.includes('--reviewer') ? rest[rest.indexOf('--reviewer') + 1] : 'Reviewer';
const by = { kind: 'review', id: file, name: reviewer };
const sheet = parseCsv(fs.readFileSync(file, 'utf8'));
const READ_ONLY = ['section', 'price (read-only)', 'existing description', 'key ingredients', 'source'];
const COLS = 'name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, seasons, drafts';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-research-review-apply' });
await client.connect();
const snapshot = async (id) => {
  const row = (await client.query(`select ${COLS} from items where id = $1`, [id])).rows[0];
  const placements = (await client.query('select section_id, position from item_sections where item_id = $1 order by position', [id])).rows;
  return { ...row, price: row.price === null ? null : Number(row.price), placements };
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const counts = { rows: sheet.length, changed: 0, unchanged: 0, confirmed: 0, descriptions: 0, notes: 0, fixesApplied: 0, corrections: 0, readOnlyIgnored: 0, notFound: 0 };
const lines = [];
await client.query('begin');
try {
  const now = await currentRows(client, venue);
  const byName = new Map();
  for (const r of now) byName.set(r.cells.item, [...(byName.get(r.cells.item) ?? []), r]);
  for (const s of sheet) {
    const hits = byName.get(s.item) ?? [];
    if (hits.length !== 1) { counts.notFound++; lines.push(`${hits.length ? 'AMBIGUOUS' : 'NOT FOUND'}: "${s.item}" (${s.section}): ${hits.length} shown ${venue} items by that name; row skipped`); continue; }
    const cur = hits[0], c = cur.cells, it = cur.item;
    for (const col of READ_ONLY) if ((s[col] ?? '').trim() !== (c[col] ?? '').trim()) { counts.readOnlyIgnored++; lines.push(`${s.item}: the read-only column "${col}" differs from the database; ignored`); }
    if ((s.correction ?? '').trim()) { counts.corrections++; lines.push(`CORRECTION for a person, ${s.item}: ${s.correction.trim()}`); }
    const description = { ...it.description }, notes = { ...it.notes }; let drafts = [...it.drafts], faDraft = [...it.fa_draft];
    const enNew = (s['new EN'] ?? '').trim(), faNew = (s['new FA'] ?? '').trim();
    if (enNew !== (c['new EN'] ?? '').trim()) {
      if (!cur.wrote.has('en')) lines.push(`${s.item}: "new EN" filled on a row whose English is the venue's own text; not applied (write it under correction)`);
      else if (!enNew) lines.push(`${s.item}: "new EN" emptied; not applied (a description is not removed from the sheet)`);
      else { description.en = enNew; drafts = drafts.filter((f) => f !== 'description'); }
    }
    if (faNew !== (c['new FA'] ?? '').trim()) {
      if (!cur.wrote.has('fa')) lines.push(`${s.item}: "new FA" filled on a row whose Persian is the venue's own text; not applied (write it under correction)`);
      else if (!faNew) lines.push(`${s.item}: "new FA" emptied; not applied (a description is not removed from the sheet)`);
      else { description.fa = faNew; faDraft = faDraft.filter((f) => f !== 'description'); }
    }
    const allergens = listOf(s.allergens), dietary = listOf(s.dietary);
    if (!same(allergens, listOf(c.allergens))) { notes.allergens = allergens; drafts = drafts.filter((f) => f !== 'allergens'); }
    if (!same(dietary, listOf(c.dietary))) { notes.dietary = dietary; drafts = drafts.filter((f) => f !== 'dietary'); }
    if (YES.test((s.confirmed ?? '').trim())) drafts = drafts.filter((f) => f !== 'allergens' && f !== 'dietary');
    else if (c.confirmed && !(s.confirmed ?? '').trim()) lines.push(`${s.item}: "confirmed" emptied on a confirmed row; not applied (use Undo in the admin to take a confirmation back)`);
    let after = { description, notes, drafts: drafts.sort(), fa_draft: faDraft.sort() };
    const tick = (s['apply fix'] ?? '').trim();
    if (YES.test(tick)) {
      if (!cur.fix) lines.push(`${s.item}: "apply fix" ticked on a row with no proposed fix; nothing to apply`);
      else { after = applyFix({ ...it, ...after }, cur.fix, s['proposed fix']); counts.fixesApplied++; lines.push(`${s.item}: the proposed fix ${dry ? 'would be ' : ''}applied`); }
    } else if ((s['proposed fix'] ?? '').trim() !== (c['proposed fix'] ?? '').trim()) lines.push(`${s.item}: the "proposed fix" text was edited but "apply fix" is not ticked; nothing applied`);
    if (same(after, { description: it.description, notes: it.notes, drafts: [...it.drafts].sort(), fa_draft: [...it.fa_draft].sort() })) { counts.unchanged++; continue; }
    counts.changed++;
    if (!same(description, it.description)) counts.descriptions++;
    if (!same(notes, it.notes)) counts.notes++;
    if (it.drafts.some((f) => f === 'allergens' || f === 'dietary') && !after.drafts.some((f) => f === 'allergens' || f === 'dietary')) counts.confirmed++;
    if (!dry) {
      const before = await snapshot(cur.id);
      await client.query('update items set description = $2, notes = $3, drafts = $4, fa_draft = $5, updated_at = now(), updated_by = $6 where id = $1', [cur.id, after.description, after.notes, after.drafts, after.fa_draft, by]);
      await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1, 'items', $2, 'update', $3, $4, $5)`, [venue, cur.id, before, await snapshot(cur.id), by]);
    }
    lines.push(`${dry ? 'would apply' : 'applied'}: ${s.item}`);
  }
  const missing = now.filter((r) => !sheet.some((s) => s.item === r.cells.item));
  if (missing.length) lines.push(`shown items not in the sheet (left as they are): ${missing.map((r) => r.cells.item).join(', ')}`);
  await client.query(dry ? 'rollback' : 'commit');
} catch (e) { await client.query('rollback'); console.error(e.message); process.exitCode = 1; } finally { await client.end(); }
for (const l of lines) console.log(l);
console.log(JSON.stringify({ venue, sheet: file, columns: COLUMNS.length, reviewer, ...counts, dry }));
