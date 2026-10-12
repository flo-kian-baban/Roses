#!/usr/bin/env node
// Applies a seasonal menu record (data/import/<date>/<venue>/<season>-menu.json: Kian's printed seasonal card) to the venue's Seasonal
// section. Each item is an existing item of the venue, matched by its import key (nothing is created): it gets the card's name, price and
// description, the record's seasons, shown, the Persian name as source text (no draft flag) and the Persian description as a draft
// (flagged); it is placed in the Seasonal section at its card position and, unless the record keeps its other sections, taken out of them.
// One revision row per item, as the record's author (by { kind: 'record', id: <file>, name }), the before and after snapshots in the
// admin's shape. Idempotent: an item is applied once per record; on a re-run an item that already carries this record's revision is left
// as it is now (an edit in the admin after the record wins), and the run says whether it still matches the record.
//   node tools/import/seasonal-menu-apply.mjs data/import/2026-10-12/senso/fall-menu.json [--dry]
import fs from 'node:fs';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [file, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry');
if (!file) { console.error('usage: node tools/import/seasonal-menu-apply.mjs <record.json> [--dry]'); process.exit(2); }
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
const by = { kind: 'record', id: file, name: rec.recordedBy };
const COLS = 'id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, seasons';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-seasonal-menu-apply' });
await client.connect();
const snapshot = async (id) => {
  const { id: _id, ...row } = (await client.query(`select ${COLS} from items where id = $1`, [id])).rows[0]; void _id;
  const placements = (await client.query('select section_id, position from item_sections where item_id = $1 order by section_id', [id])).rows;
  return { ...row, price: row.price === null ? null : Number(row.price), placements };
};
const counts = { applied: 0, unchanged: 0, keptAfterEdit: 0 };
const lines = [];
await client.query('begin');
try {
  const section = (await client.query('select id from sections where venue_id = $1 and seasonal', [rec.venue])).rows[0];
  if (!section) throw new Error(`${rec.venue} has no Seasonal section (migration 006)`);
  for (const it of rec.items) {
    const row = (await client.query('select id from items where venue_id = $1 and import_key = $2', [rec.venue, it.importKey])).rows[0];
    if (!row) throw new Error(`card item ${it.card} "${it.name.en}": no ${rec.venue} item with import key ${it.importKey} (nothing is created; check the record)`);
    const before = await snapshot(row.id);
    const position = it.card - 1;
    const others = it.keepOtherSections ? before.placements.filter((p) => p.section_id !== section.id) : [];
    const want = {
      ...before,
      name: { ...before.name, en: it.name.en, fa: it.name.fa },
      description: { ...before.description, en: it.description.en, fa: it.description.fa },
      price: Number(it.price), listed: true, seasons: rec.seasons,
      fa_draft: [...new Set([...before.fa_draft.filter((f) => f !== 'name'), 'description'])].sort(),
      placements: [...others, { section_id: section.id, position }].sort((a, b) => a.section_id.localeCompare(b.section_id)),
    };
    const same = JSON.stringify({ ...before, fa_draft: [...before.fa_draft].sort() }) === JSON.stringify(want);
    const done = (await client.query(`select 1 from revisions where table_name = 'items' and row_id = $1 and by->>'kind' = 'record' and by->>'id' = $2 limit 1`, [row.id, file])).rowCount > 0;
    if (done) { counts.keptAfterEdit += same ? 0 : 1; counts.unchanged += same ? 1 : 0; lines.push(`${it.card}. ${it.name.en}: applied before, ${same ? 'still as the record' : 'edited since (kept as it is now)'}`); continue; }
    if (same) { counts.unchanged++; lines.push(`${it.card}. ${it.name.en}: already as the record`); continue; }
    if (!dry) {
      await client.query('update items set name = $2, description = $3, price = $4, listed = true, seasons = $5, fa_draft = $6, updated_at = now(), updated_by = $7 where id = $1', [row.id, want.name, want.description, want.price, want.seasons, want.fa_draft, by]);
      if (!it.keepOtherSections) await client.query('delete from item_sections where item_id = $1 and section_id <> $2', [row.id, section.id]);
      await client.query('insert into item_sections (item_id, section_id, position) values ($1, $2, $3) on conflict (item_id, section_id) do update set position = excluded.position', [row.id, section.id, position]);
      await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1, 'items', $2, 'update', $3, $4, $5)`, [rec.venue, row.id, before, await snapshot(row.id), by]);
    }
    counts.applied++;
    const was = before.name.en !== it.name.en ? ` (was "${before.name.en}")` : '';
    lines.push(`${it.card}. ${it.name.en}${was}: ${dry ? 'would apply' : 'applied'}, $${it.price}, ${rec.seasons.join('+')}, in the Seasonal section at ${it.card}${it.keepOtherSections ? `, kept in ${others.length} other section(s)` : `, taken out of ${before.placements.filter((p) => p.section_id !== section.id).length} other section(s)`}`);
  }
  // no item of the record may share its English name with another item of the venue (Kian: reuse, no duplicates); pairs that were there
  // before and are not the record's are listed, never changed (known data problems are flagged for the client, not fixed)
  const dup = (await client.query(`select name->>'en' as en, count(*)::int as n from items where venue_id = $1 group by 1 having count(*) > 1 order by 1`, [rec.venue])).rows;
  const mine = dup.filter((d) => rec.items.some((it) => it.name.en === d.en));
  if (mine.length) throw new Error(`the record's names shared with another ${rec.venue} item: ${mine.map((d) => `${d.en} (${d.n})`).join(', ')}`);
  if (dup.length) lines.push(`other ${rec.venue} items sharing an English name, not the record's (left as they are): ${dup.map((d) => `${d.en} (${d.n})`).join(', ')}`);
  await client.query(dry ? 'rollback' : 'commit');
} catch (e) { await client.query('rollback'); console.error(e.message); process.exitCode = 1; } finally { await client.end(); }
for (const l of lines) console.log(l);
console.log(JSON.stringify({ record: file, ...counts, dry }));
