// The menu research review sheet (Kian via the PM, 2026-10-12): reports/research-review-<venue>.csv, one row per item shown on the venue's
// page, built from the database as it is now (the export) and compared with the database again when it comes back (the apply), so the two
// can never disagree on what a column means. Columns, in the PM's order:
//   section | item | price (read-only) | existing description | new EN | new FA | key ingredients | allergens | dietary | source | confirmed | correction
// Editable by the reviewer: new EN and new FA (only on rows where the research wrote them), allergens, dietary (comma separated), confirmed
// ("yes" confirms the row's allergens and dietary words as they stand) and correction (free text a person reads; never applied by a script).
// Read-only: section, item (the key: the item's English name), price, existing description, key ingredients, source.
// Since 2026-10-13 (Kian): "proposed fix" carries, for each existing description that contradicts the research, a corrected English and
// Persian text (and the notes, where the fix touches them), from the record (`fix` in data/import/<date>/<venue>/research.json); nothing
// changes until "apply fix" says yes; the text in the cell is what is applied (the reviewer may edit it); "applied" when the database
// already holds the fix. Those rows come first in the sheet, in the record's order (Fresh Berry Mojito-Virgin first).
import fs from 'node:fs';
import path from 'node:path';

export const COLUMNS = ['section', 'item', 'price (read-only)', 'existing description', 'new EN', 'new FA', 'key ingredients', 'allergens', 'dietary', 'source', 'confirmed', 'correction', 'proposed fix', 'apply fix'];
export const BASIS = `jsonb_path_query_first(i.source, '$[*] ? (@.source == "research")')`;

const money = (n) => (n == null ? '' : Number(n).toFixed(2).replace(/\.00$/, ''));
const priceOf = (i) => (i.price != null ? money(i.price) : i.variants.map((v) => `${v.label?.en ?? ''} ${money(v.price)}`.trim()).join(' / '));
export const listOf = (s) => String(s ?? '').split(/[,;،]/).map((x) => x.trim()).filter(Boolean);
export const YES = /^(yes|y|true|x|✓|✔|confirmed|بله)$/i;

// The venue's shown items, in the page's order (the Seasonal section first, then by section and item position), as review rows.
// The fixes proposed by the venue's research records, by import key (the newest record wins).
export function fixesOf(venue, root = 'data/import') {
  const out = new Map();
  if (!fs.existsSync(root)) return out;
  for (const d of fs.readdirSync(root).sort()) {
    const f = path.join(root, d, venue, 'research.json');
    if (!fs.existsSync(f)) continue;
    for (const it of JSON.parse(fs.readFileSync(f, 'utf8')).items) if (it.fix) out.set(it.importKey, { ...it.fix, file: f });
  }
  return out;
}
const notesLine = (n) => !n ? null : `Notes${n.keepDraft ? ' (still a draft, to confirm)' : ''}: ${'allergens' in n ? `allergens ${n.allergens.join(', ') || 'none'}` : ''}${'dietary' in n ? `; dietary ${n.dietary.join(', ') || 'none'}` : ''}${'text' in n && !n.text?.en && !n.text?.fa ? '; the note text removed' : ''}`;
export const fixCell = (fx) => !fx ? '' : [fx.description ? `EN: ${fx.description.en ?? ''}` : 'EN: (no change)', fx.description ? `FA: ${fx.description.fa ?? ''}` : 'FA: (no change)', notesLine(fx.notes), `Why: ${fx.why}`].filter(Boolean).join('\n');
// The cell read back: the English and Persian lines (as the reviewer left them).
export function parseFixCell(cell) {
  const get = (k) => { const m = String(cell ?? '').match(new RegExp(`^${k}: ?(.*)$`, 'm')); return m ? m[1].trim() : null; };
  const en = get('EN'), fa = get('FA');
  return { en: en === '(no change)' ? null : en, fa: fa === '(no change)' ? null : fa };
}
// What a fix makes of an item (the description from the cell, the notes from the record).
export function applyFix(item, fx, cell) {
  const t = parseFixCell(cell);
  const description = { ...item.description, ...(fx.description && t.en ? { en: t.en } : {}), ...(fx.description && t.fa ? { fa: t.fa } : {}) };
  let drafts = [...item.drafts], faDraft = [...item.fa_draft];
  if (fx.description && t.en) drafts = drafts.filter((f) => f !== 'description');
  if (fx.description && t.fa) faDraft = faDraft.filter((f) => f !== 'description');
  const notes = { ...item.notes };
  if (fx.notes) {
    for (const k of ['allergens', 'dietary', 'text']) if (k in fx.notes) notes[k] = fx.notes[k];
    drafts = fx.notes.keepDraft ? [...new Set([...drafts, 'allergens'])] : drafts.filter((f) => f !== 'allergens' && f !== 'dietary');
  }
  return { description, notes, drafts: drafts.sort(), fa_draft: faDraft.sort() };
}
const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function currentRows(client, venue) {
  const fixes = fixesOf(venue);
  const items = (await client.query(
    `select i.id, i.import_key, i.name, i.price, i.variants, i.description, i.notes, i.drafts, i.fa_draft, ${BASIS} as basis,
            (select string_agg(case when s.seasonal then 'Seasonal' else s.name->>'en' end, ' + ' order by s.seasonal desc, s.position) from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id) as section,
            (select min(case when s.seasonal then -1 else s.position end) from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id) as sp,
            (select min(x.position) from item_sections x where x.item_id = i.id) as ip
       from items i where i.venue_id = $1 and i.listed
      order by sp nulls last, ip nulls last, i.name->>'en'`, [venue])).rows;
  const rows = items.map((i) => {
    const b = i.basis || null, wrote = new Set(b?.wrote ?? []);
    const fx = fixes.get(i.import_key) ?? null;
    const cell = fixCell(fx);
    const applied = fx && sameState(applyFix(i, fx, cell), { description: i.description, notes: i.notes, drafts: [...i.drafts].sort(), fa_draft: [...i.fa_draft].sort() });
    const existing = [!wrote.has('en') && i.description.en ? `EN: ${i.description.en}` : null, !wrote.has('fa') && i.description.fa ? `FA: ${i.description.fa}` : null].filter(Boolean).join('\n');
    const confirmed = !i.drafts.includes('allergens') && !i.drafts.includes('dietary');
    return {
      id: i.id, item: i, basis: b, wrote,
      cells: {
        'section': i.section ?? '', 'item': i.name.en ?? '', 'price (read-only)': priceOf(i), 'existing description': existing,
        'new EN': wrote.has('en') ? i.description.en ?? '' : '', 'new FA': wrote.has('fa') ? i.description.fa ?? '' : '',
        'key ingredients': (b?.ingredients ?? []).join(', '), 'allergens': i.notes.allergens.join(', '), 'dietary': i.notes.dietary.join(', '),
        'source': b?.url ?? '', 'confirmed': b && confirmed ? 'yes' : '', 'correction': '',
        'proposed fix': cell, 'apply fix': applied ? 'applied' : '',
      },
      fix: fx,
    };
  });
  // the rows with a proposed fix first, in the record's order; then the page's order
  return [...rows.filter((r) => r.fix).sort((a, b) => (a.fix.order ?? 99) - (b.fix.order ?? 99)), ...rows.filter((r) => !r.fix)];
}

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const toCsv = (rows) => '﻿' + [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r.cells[c])).join(','))].join('\n') + '\n';

export function parseCsv(text) {
  const s = text.replace(/^﻿/, ''); const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) out.push(row); }
  const [head, ...body] = out;
  const idx = COLUMNS.map((c) => head.findIndex((h) => h.trim().toLowerCase() === c.toLowerCase()));
  if (idx.some((i) => i < 0)) throw new Error(`the CSV header must hold these columns: ${COLUMNS.join(' | ')}`);
  return body.map((r) => Object.fromEntries(COLUMNS.map((c, k) => [c, (r[idx[k]] ?? '').replace(/\r\n/g, '\n')])));
}
