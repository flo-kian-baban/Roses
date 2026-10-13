#!/usr/bin/env node
// Applies a menu research record (data/import/<date>/<venue>/research.json; Kian via the PM, 2026-10-12) to the venue's items: descriptions
// where they are empty, and allergen and dietary drafts with their basis. Rules (the PM's brief):
//   - only empty fields are written: the English description where it is empty (flagged 'description' in items.drafts), the Persian
//     description where it is empty (flagged 'description' in fa_draft, like every Persian draft); names, prices, sections and every
//     existing text are never changed (checked before the commit: the run stops if any of them would change);
//   - the allergens and the dietary words are written only where the item has none (an owner's own note is kept as it is and listed),
//     flagged 'allergens' (always: an empty list means the research found none) and 'dietary' (when it proposes one), so the public page
//     leaves them out until an owner or admin confirms them;
//   - the basis (the assumed key ingredients, the source for the dish type, the note, the record's file) is appended to the item's internal
//     source column as { source: 'research', … }, never rendered; it also marks the item as done for this record.
// One revision row per item changed, as { kind: 'record', id: <file>, name: 'Research' }, with the before and after snapshots in the admin's
// shape. Idempotent: an item that already carries this record's research entry is left as it is now (an edit or a Confirm in the admin since
// wins). A pg_dump backup of the database is taken first whenever something is to be written (BACKUP_DIR, else backups/; --no-backup skips it).
//   node tools/import/research-apply.mjs data/import/2026-10-12/senso/research.json [--dry] [--no-backup]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [arg, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry'), noBackup = rest.includes('--no-backup');
if (!arg) { console.error('usage: node tools/import/research-apply.mjs <research.json> [--dry] [--no-backup]'); process.exit(2); }
const file = path.relative(process.cwd(), path.resolve(arg)).split(path.sep).join('/'); // the record's id: its path from the repo root, however it was typed
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
const by = { kind: 'record', id: file, name: rec.recordedBy || 'Research' };
const ALLERGENS = new Set(rec.vocabulary.allergens), DIETARY = new Set(rec.vocabulary.dietary);
const COLS = 'id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, seasons, drafts';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-research-apply' });
await client.connect();
const db = (await client.query('select current_database() as d')).rows[0].d;
const snapshot = async (id) => {
  const { id: _id, ...row } = (await client.query(`select ${COLS} from items where id = $1`, [id])).rows[0]; void _id;
  const placements = (await client.query('select section_id, position from item_sections where item_id = $1 order by position', [id])).rows;
  return { ...row, price: row.price === null ? null : Number(row.price), placements };
};
const blank = (s) => !s || !String(s).trim();
const frozen = (s) => JSON.stringify({ name: s.name, price: s.price, variants: s.variants, add_ons: s.add_ons, components: s.components, listed: s.listed, seasons: s.seasons, placements: s.placements });

// What the record would do to each item (a dry pass first, so the backup is taken only when something is to be written).
async function plan() {
  const out = [];
  for (const it of rec.items) {
    const row = (await client.query(`select id, source from items where venue_id = $1 and ${it.importKey ? 'import_key = $2' : 'id = $2::uuid'}`, [rec.venue, it.importKey ?? it.id])).rows[0];
    if (!row) { out.push({ it, missing: true }); continue; }
    const done = (row.source || []).some((s) => s && s.source === 'research' && s.file === file);
    if (done) { out.push({ it, id: row.id, done: true }); continue; }
    const bad = [...it.allergens.filter((a) => !ALLERGENS.has(a)), ...it.dietary.filter((d) => !DIETARY.has(d))];
    if (bad.length) throw new Error(`${it.name}: words outside the record's vocabulary: ${bad.join(', ')}`);
    const before = await snapshot(row.id);
    const after = structuredClone(before);
    const wrote = [];
    if (it.newEn && blank(before.description.en)) { after.description = { ...after.description, en: it.newEn }; after.drafts = [...new Set([...after.drafts, 'description'])]; wrote.push('en'); }
    if (it.newFa && blank(before.description.fa)) { after.description = { ...after.description, fa: it.newFa }; after.fa_draft = [...new Set([...after.fa_draft, 'description'])]; wrote.push('fa'); }
    const kept = [];
    if (before.notes.allergens.length === 0) { after.notes = { ...after.notes, allergens: it.allergens }; after.drafts = [...new Set([...after.drafts, 'allergens'])]; wrote.push('allergens'); }
    else kept.push(`allergens (the owner's: ${before.notes.allergens.join(', ')})`);
    if (before.notes.dietary.length === 0) { if (it.dietary.length) { after.notes = { ...after.notes, dietary: it.dietary }; after.drafts = [...new Set([...after.drafts, 'dietary'])]; wrote.push('dietary'); } }
    else kept.push(`dietary (the owner's: ${before.notes.dietary.join(', ')})`);
    after.drafts.sort(); after.fa_draft.sort();
    if (frozen(before) !== frozen(after)) throw new Error(`${it.name}: a name, price, section or listing would change; nothing applied`);
    const basis = { source: 'research', file, at: rec.date, ingredients: it.ingredients, url: it.source, sourceTitle: it.sourceTitle, note: it.note ?? null, confidence: it.confidence, allergens: it.allergens, dietary: it.dietary, wrote, kept };
    out.push({ it, id: row.id, before, after, basis, wrote, kept });
  }
  return out;
}

const counts = { items: rec.items.length, applied: 0, alreadyApplied: 0, missing: 0, newEn: 0, newFa: 0, allergenDrafts: 0, dietaryDrafts: 0, ownerNotesKept: 0 };
const lines = [];
try {
  const steps = await plan();
  const todo = steps.filter((s) => s.after);
  if (todo.length && !dry && !noBackup) {
    const dir = process.env.BACKUP_DIR || 'backups';
    const out = path.join(dir, `${db}-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-before-research-${rec.venue}.dump`); // the venue in the name: two records applied in the same second keep both backups
    const b = spawnSync('bash', ['scripts/db-backup.sh', '--out', out], { encoding: 'utf8', env: { ...process.env, ROSES_DB: db } });
    if (b.status !== 0) throw new Error(`backup failed, nothing applied: ${b.stderr || b.stdout}`);
    lines.push(b.stdout.trim().split('\n')[0]);
  }
  await client.query('begin');
  for (const s of steps) {
    if (s.missing) { counts.missing++; lines.push(`MISSING ${s.it.name} (${s.it.importKey ?? s.it.id}): no such ${rec.venue} item; skipped`); continue; }
    if (s.done) { counts.alreadyApplied++; continue; }
    const { before, after, basis } = s;
    if (!dry) {
      await client.query('update items set description = $2, notes = $3, drafts = $4, fa_draft = $5, source = source || $6::jsonb, updated_at = now(), updated_by = $7 where id = $1',
        [s.id, after.description, after.notes, after.drafts, after.fa_draft, JSON.stringify([basis]), by]);
      await client.query(`insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1, 'items', $2, 'update', $3, $4, $5)`, [rec.venue, s.id, before, await snapshot(s.id), by]);
      if (frozen(await snapshot(s.id)) !== frozen(before)) throw new Error(`${s.it.name}: a frozen field changed in the database; rolled back`);
    }
    counts.applied++;
    if (s.wrote.includes('en')) counts.newEn++;
    if (s.wrote.includes('fa')) counts.newFa++;
    if (s.wrote.includes('allergens')) counts.allergenDrafts++;
    if (s.wrote.includes('dietary')) counts.dietaryDrafts++;
    if (s.kept.length) { counts.ownerNotesKept++; lines.push(`${s.it.name}: kept ${s.kept.join('; ')}; the research (${s.it.allergens.join(', ') || 'no allergen'}${s.it.dietary.length ? `; ${s.it.dietary.join(', ')}` : ''}) is recorded in its basis only`); }
  }
  await client.query(dry ? 'rollback' : 'commit');
} catch (e) { await client.query('rollback').catch(() => {}); console.error(e.message); process.exitCode = 1; } finally { await client.end(); }
for (const l of lines) console.log(l);
console.log(JSON.stringify({ record: file, database: db, ...counts, dry }));
