#!/usr/bin/env node
// Saves of one item by Kian's account within 2 seconds of each other (the PM, 2026-10-13, after the save-order fix ca1d718): read only.
// From the change record (revisions) of the working database: every item Kian's account saved 2 or more times within 2 s, each save in
// the order it was committed with the fields it changed (before → after), and each field's value stored now. The race the fix closes
// needs two saves of the same field in flight together (the later-typed one committed first, the older one last, so the older value
// stays); saves of different fields merge on the server whatever their order. So each field written 2 or more times in a burst is
// checked: its last committed value against the value stored now, and for a revert (a part of the field set back, by the last write, to
// what it was before the burst after an earlier write had changed it, or rows dropped), the signature of an older save landing last.
// Limits: the record holds the commit order (ids) and each transaction's start (at), not the order the saves were typed, so a revert can
// also be a person's own correction within 2 s; such a burst is flagged for a look, never changed.
//   DATABASE_URL=… node reports/save-order/saves-within-2s.mjs [--since 2026-10-07T00:00:00Z] [--json out.json]
import fs from 'node:fs';
import pg from '/Users/kianbaban/Roses/node_modules/pg/lib/index.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const SINCE = args.since || '2026-10-07T00:00:00Z';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-readonly:saves-within-2s' });
await db.connect();
await db.query('begin read only');
const who = (await db.query(`select distinct by->>'id' as id from revisions where table_name = 'items' and by->>'kind' = 'admin' and by->>'name' = 'Kian'`)).rows.map((r) => r.id);
if (who.length !== 1) { console.error(`expected one admin account named Kian, found ${who.length}`); process.exit(2); }
const KIAN = who[0];
const revs = (await db.query(`select id, row_id, action, before, after, by, at from revisions where table_name = 'items' and by->>'kind' = 'admin' and by->>'id' = $1 and at >= $2 order by row_id, id`, [KIAN, SINCE])).rows;
const FIELDS = ['name', 'description', 'price', 'variants', 'add_ons', 'components', 'serves', 'photo', 'notes', 'listed', 'seasons', 'placements', 'fa_draft', 'drafts'];
const J = (v) => JSON.stringify(v ?? null);
const norm = (f, v) => (f === 'price' && v != null ? Number(v) : f === 'placements' ? (v ?? []).map((p) => p.section_id).sort() : v ?? null);
const changed = (r) => FIELDS.filter((f) => J(norm(f, r.before?.[f])) !== J(norm(f, r.after?.[f])));
// a short, readable value
const show = (f, v) => {
  v = norm(f, v);
  if (v == null) return '—';
  if (f === 'variants') return v.length ? v.map((x) => `${x.label?.en ?? '?'} ${x.price == null ? '(no price)' : `$${Number(x.price)}`}`).join(', ') : '(none)';
  if (f === 'add_ons') return v.length ? v.map((x) => `${x.group?.en ? `${x.group.en}: ` : ''}${x.label?.en ?? '?'} +$${Number(x.price) || 0}${x.required ? ' (must)' : ''}`).join(', ') : '(none)';
  if (f === 'name' || f === 'description') return `EN "${v.en ?? ''}" · FA "${v.fa ?? ''}"`;
  if (f === 'notes') return `allergens [${(v.allergens ?? []).join(', ')}], diet [${(v.dietary ?? []).join(', ')}], halal ${v.halal}${v.text?.en || v.text?.fa ? `, note EN "${v.text?.en ?? ''}" FA "${v.text?.fa ?? ''}"` : ''}`;
  if (f === 'photo') return v.url ?? '—';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
};
// the race's signature in one field across a burst: a later write sets back a part (a key of an object, a row of a list, the value itself)
// that an earlier write of the burst had changed, to what it was before that earlier write; or drops rows an earlier write had added
function parts(v) { // the comparable parts of a value: rows of a list (and their keys), keys of an object, or the value itself
  if (Array.isArray(v)) return Object.fromEntries(v.flatMap((row, i) => (row && typeof row === 'object' ? Object.entries(row).map(([k, x]) => [`row ${i + 1} ${k}`, x]) : [[`row ${i + 1}`, row]])));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v));
  return { value: v };
}
function revert(f, writes) {
  const out = [];
  for (let i = 0; i < writes.length; i++) for (let k = i + 1; k < writes.length; k++) {
    const a = parts(norm(f, writes[i].before?.[f])), b = parts(norm(f, writes[i].after?.[f])), c0 = parts(norm(f, writes[k].before?.[f])), c = parts(norm(f, writes[k].after?.[f]));
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (J(a[key]) === J(b[key])) continue; // not changed by the earlier write
      if (J(c0[key]) === J(b[key]) && J(c[key]) === J(a[key])) out.push(`#${writes[k].id} set ${f} ${key} back to ${J(a[key])} after #${writes[i].id} had set it to ${J(b[key])}`);
    }
    const nb = Array.isArray(norm(f, writes[i].after?.[f])) ? norm(f, writes[i].after?.[f]).length : null, nc = Array.isArray(norm(f, writes[k].after?.[f])) ? norm(f, writes[k].after?.[f]).length : null;
    if (f !== 'placements' && nb != null && nc != null && nc < nb) out.push(`#${writes[k].id} left ${f} with ${nc} rows after #${writes[i].id} had ${nb}`);
  }
  return [...new Set(out)];
}
const byItem = new Map(); for (const r of revs) { if (!byItem.has(r.row_id)) byItem.set(r.row_id, []); byItem.get(r.row_id).push(r); }
const bursts = [];
for (const [id, list] of byItem) {
  let cur = [list[0]];
  const flush = () => { if (cur.length >= 2) bursts.push({ id, saves: cur }); };
  for (let i = 1; i < list.length; i++) { if (new Date(list[i].at) - new Date(cur[cur.length - 1].at) <= 2000) cur.push(list[i]); else { flush(); cur = [list[i]]; } }
  flush();
}
const report = [];
for (const b of bursts) {
  const now = (await db.query(`select name, description, price, variants, add_ons, components, serves, photo, notes, listed, seasons, fa_draft, drafts, venue_id from items where id = $1`, [b.id])).rows[0] ?? null;
  if (now) now.placements = (await db.query('select section_id, position from item_sections where item_id = $1', [b.id])).rows;
  const laterRows = (await db.query(`select id, by->>'name' as by, by->>'kind' as kind, action, before, after, at from revisions where table_name = 'items' and row_id = $1 and id > $2 order by id`, [b.id, b.saves[b.saves.length - 1].id])).rows, later = laterRows;
  const fields = {};
  for (const s of b.saves) for (const f of changed(s)) (fields[f] ??= []).push(s);
  const perField = Object.entries(fields).map(([f, writes]) => {
    const lastAfter = writes[writes.length - 1].after?.[f], stored = now ? now[f] : null;
    // writes of this field after the burst, by anyone: the stored value is compared with the newest write of the field
    const laterWrites = laterRows.filter((l) => J(norm(f, l.before?.[f])) !== J(norm(f, l.after?.[f]))).map((l) => ({ rev: l.id, by: `${l.kind} ${l.by}`, action: l.action, at: l.at, to: show(f, l.after?.[f]), after: l.after?.[f] }));
    const newest = laterWrites.length ? laterWrites[laterWrites.length - 1].after : lastAfter;
    const storedMatches = J(norm(f, newest)) === J(norm(f, stored));
    return { field: f, writes: writes.length, gapsMs: writes.slice(1).map((w, i) => new Date(w.at) - new Date(writes[i].at)), values: writes.map((w) => ({ rev: w.id, at: w.at, from: show(f, w.before?.[f]), to: show(f, w.after?.[f]) })), lastWritten: show(f, lastAfter), storedNow: now ? show(f, stored) : '(item deleted)', storedMatches, signs: writes.length >= 2 ? revert(f, writes) : [], laterWrites };
  });
  const name = now?.name?.en ?? b.saves[b.saves.length - 1].after?.name?.en ?? b.saves[0].before?.name?.en ?? '?';
  report.push({ item: b.id, name, venue: now?.venue_id ?? null, first: b.saves[0].at, last: b.saves[b.saves.length - 1].at, saves: b.saves.map((s) => ({ rev: s.id, at: s.at, action: s.action, undo_of: s.by?.undo_of ?? null, fields: changed(s), values: changed(s).map((f) => `${f}: ${show(f, s.before?.[f])} → ${show(f, s.after?.[f])}`) })), fields: perField, laterChanges: later.map((l) => `${l.id} ${l.action} by ${l.kind} ${l.by} at ${new Date(l.at).toISOString()}`), flagged: perField.some((p) => p.signs.length || !p.storedMatches) });
}
await db.query('rollback'); await db.end();
const out = { at: new Date().toISOString(), database: new URL(process.env.DATABASE_URL).pathname.slice(1), account: { kind: 'admin', name: 'Kian' } /* its id left out of the files: the repo holds menu content only */, since: SINCE, itemSaves: revs.length, items: byItem.size, bursts: report.length, flagged: report.filter((r) => r.flagged).length, report };
if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 2));
console.log(`account admin Kian; item saves since ${SINCE}: ${revs.length} on ${byItem.size} items; bursts (2+ saves of one item within 2 s): ${report.length}; flagged: ${out.flagged}`);
for (const r of report) {
  console.log(`\n${r.flagged ? 'FLAG ' : ''}${r.name} (${r.venue}, ${r.item}): ${r.saves.length} saves, ${new Date(r.first).toISOString()} → ${new Date(r.last).toISOString()}`);
  for (const s of r.saves) console.log(`  #${s.rev} ${new Date(s.at).toISOString()} ${s.action}${s.undo_of ? ` (undo of #${s.undo_of})` : ''}: ${s.values.join('; ') || '(no field changed)'}`);
  for (const p of r.fields) {
    const after = p.laterWrites.length ? `; written again after the burst ${p.laterWrites.length}× (last #${p.laterWrites[p.laterWrites.length - 1].rev} by ${p.laterWrites[p.laterWrites.length - 1].by}: ${p.laterWrites[p.laterWrites.length - 1].to})` : '; not written after the burst';
    const gaps = p.values.slice(1).map((v, i) => new Date(v.at) - new Date(p.values[i].at));
    console.log(`  field ${p.field}, written ${p.writes}× in the burst${gaps.length ? ` (${gaps.map((g) => `${g} ms`).join(', ')} between the transactions' starts)` : ''}: last ${p.lastWritten}${after}; stored now ${p.storedNow} (${p.storedMatches ? 'matches the newest write' : 'DIFFERS from the newest write'})${p.signs.length ? `; SIGN: ${p.signs.join('; ')}` : ''}`);
  }
}
