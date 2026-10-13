#!/usr/bin/env node
// The fields the menu research must never change (Kian via the PM, 2026-10-12: "names, prices and sections: 0 rows changed"), snapshotted
// before and after an apply and compared. Items: names (English and Persian), price, the sizes' names and prices, the add-ons' names and
// prices, shown/hidden, seasons and placements (section and position); sections: names, position, shown/hidden, layout.
//   node tools/import/research-frozen.mjs snapshot reports/menu-research/frozen-before.json
//   node tools/import/research-frozen.mjs compare reports/menu-research/frozen-before.json reports/menu-research/frozen-after.json
import fs from 'node:fs';
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';

loadEnv();
const [mode, a, b] = process.argv.slice(2);
async function snapshot() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-research-frozen' }); await c.connect();
  const database = (await c.query('select current_database() as d')).rows[0].d;
  const items = (await c.query(`select i.id, i.venue_id, i.name, i.price::text as price, i.variants, i.add_ons, i.listed, i.seasons,
      coalesce((select json_agg(json_build_object('section_id', x.section_id, 'position', x.position) order by x.section_id) from item_sections x where x.item_id = i.id), '[]') as placements
    from items i order by i.id`)).rows.map((r) => ({ ...r, variants: r.variants.map((v) => ({ label: v.label, price: v.price })), add_ons: r.add_ons.map((x) => ({ group: x.group, label: x.label, price: x.price, required: x.required })) }));
  const sections = (await c.query('select id, venue_id, name, position, listed, layout, seasonal from sections order by id')).rows;
  await c.end();
  return { database, at: new Date().toISOString(), items, sections };
}
if (mode === 'snapshot') { const s = await snapshot(); fs.writeFileSync(a, JSON.stringify(s, null, 1)); console.log(`${a}: ${s.items.length} items, ${s.sections.length} sections of ${s.database}`); }
else if (mode === 'compare') {
  const before = JSON.parse(fs.readFileSync(a, 'utf8')), after = b ? JSON.parse(fs.readFileSync(b, 'utf8')) : await snapshot();
  const diff = (x, y, key) => { const m = new Map(y.map((r) => [r.id, r])); const out = { changed: [], missing: [], added: y.filter((r) => !x.some((q) => q.id === r.id)).map((r) => r.id) }; for (const r of x) { const s = m.get(r.id); if (!s) out.missing.push(r.id); else for (const k of key) if (JSON.stringify(r[k]) !== JSON.stringify(s[k])) out.changed.push({ id: r.id, name: r.name?.en, field: k, before: r[k], after: s[k] }); } return out; };
  const items = diff(before.items, after.items, ['venue_id', 'name', 'price', 'variants', 'add_ons', 'listed', 'seasons', 'placements']);
  const sections = diff(before.sections, after.sections, ['venue_id', 'name', 'position', 'listed', 'layout', 'seasonal']);
  const by = (f) => new Set(items.changed.filter((c) => f.includes(c.field)).map((c) => c.id)).size;
  const summary = { before: { database: before.database, at: before.at, items: before.items.length, sections: before.sections.length }, after: { database: after.database, at: after.at, items: after.items.length, sections: after.sections.length },
    rowsChanged: { names: by(['name']), prices: by(['price', 'variants', 'add_ons']), sections: by(['placements']) + sections.changed.length, listing: by(['listed']), seasons: by(['seasons']) },
    items: { changed: items.changed.length, missing: items.missing.length, added: items.added.length }, sections: { changed: sections.changed.length, missing: sections.missing.length, added: sections.added.length }, details: { items, sections } };
  const zero = Object.values(summary.rowsChanged).every((n) => n === 0) && !items.missing.length && !items.added.length && !sections.missing.length && !sections.added.length;
  console.log(JSON.stringify({ ...summary, details: undefined, zero }, null, 1));
  if (!zero) { console.log(JSON.stringify(summary.details, null, 1)); process.exitCode = 1; }
} else { console.error('usage: research-frozen.mjs snapshot <file> | compare <before> [<after>]'); process.exit(2); }
