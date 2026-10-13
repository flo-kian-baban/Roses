// Ten sample items per venue for the reply (the PM, 2026-10-12): from the working database after the apply, spread over the sections
// (the first item with research-written text in each section, in the page's order, until ten), with English, Persian, the allergen draft
// and its basis. node reports/menu-research/samples.mjs > reports/menu-research/samples.md
import pg from 'pg';
import { loadEnv } from '../../scripts/load-env.mjs';
import { currentRows } from '../../tools/import/research-review-lib.mjs';
loadEnv();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-research-samples' }); await c.connect();
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const out = [`# Ten sample items per venue (database ${(await c.query('select current_database() as d')).rows[0].d}, ${new Date().toISOString()})`, ''];
for (const v of ['senso', 'kebab-land']) {
  const rows = (await currentRows(c, v)).filter((r) => r.wrote.has('en') || r.wrote.has('fa'));
  const picked = [], seen = new Set();
  for (const r of rows) { const s = r.cells.section; if (!seen.has(s)) { seen.add(s); picked.push(r); } if (picked.length === 10) break; }
  for (const r of rows) { if (picked.length >= 10) break; if (!picked.includes(r)) picked.push(r); }
  out.push(`## ${v}`, '', '| Section | Item | English | Persian | Allergens (draft) | Dietary (draft) | Basis: key ingredients | Source |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of picked) out.push(`| ${cell(r.cells.section)} | ${cell(r.cells.item)} | ${cell(r.item.description.en)} | ${cell(r.item.description.fa)} | ${cell(r.cells.allergens) || '—'} | ${cell(r.cells.dietary) || '—'} | ${cell(r.cells['key ingredients'])} | ${cell(r.cells.source)} |`);
  out.push('');
}
await c.end();
console.log(out.join('\n'));
