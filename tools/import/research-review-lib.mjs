// The menu research review sheet (Kian via the PM, 2026-10-12): reports/research-review-<venue>.csv, one row per item shown on the venue's
// page, built from the database as it is now (the export) and compared with the database again when it comes back (the apply), so the two
// can never disagree on what a column means. Columns, in the PM's order:
//   section | item | price (read-only) | existing description | new EN | new FA | key ingredients | allergens | dietary | source | confirmed | correction
// Editable by the reviewer: new EN and new FA (only on rows where the research wrote them), allergens, dietary (comma separated), confirmed
// ("yes" confirms the row's allergens and dietary words as they stand) and correction (free text a person reads; never applied by a script).
// Read-only: section, item (the key: the item's English name), price, existing description, key ingredients, source.
export const COLUMNS = ['section', 'item', 'price (read-only)', 'existing description', 'new EN', 'new FA', 'key ingredients', 'allergens', 'dietary', 'source', 'confirmed', 'correction'];
export const BASIS = `jsonb_path_query_first(i.source, '$[*] ? (@.source == "research")')`;

const money = (n) => (n == null ? '' : Number(n).toFixed(2).replace(/\.00$/, ''));
const priceOf = (i) => (i.price != null ? money(i.price) : i.variants.map((v) => `${v.label?.en ?? ''} ${money(v.price)}`.trim()).join(' / '));
export const listOf = (s) => String(s ?? '').split(/[,;،]/).map((x) => x.trim()).filter(Boolean);
export const YES = /^(yes|y|true|x|✓|✔|confirmed|بله)$/i;

// The venue's shown items, in the page's order (the Seasonal section first, then by section and item position), as review rows.
export async function currentRows(client, venue) {
  const items = (await client.query(
    `select i.id, i.name, i.price, i.variants, i.description, i.notes, i.drafts, i.fa_draft, ${BASIS} as basis,
            (select string_agg(case when s.seasonal then 'Seasonal' else s.name->>'en' end, ' + ' order by s.seasonal desc, s.position) from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id) as section,
            (select min(case when s.seasonal then -1 else s.position end) from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id) as sp,
            (select min(x.position) from item_sections x where x.item_id = i.id) as ip
       from items i where i.venue_id = $1 and i.listed
      order by sp nulls last, ip nulls last, i.name->>'en'`, [venue])).rows;
  return items.map((i) => {
    const b = i.basis || null, wrote = new Set(b?.wrote ?? []);
    const existing = [!wrote.has('en') && i.description.en ? `EN: ${i.description.en}` : null, !wrote.has('fa') && i.description.fa ? `FA: ${i.description.fa}` : null].filter(Boolean).join('\n');
    const confirmed = !i.drafts.includes('allergens') && !i.drafts.includes('dietary');
    return {
      id: i.id, item: i, basis: b, wrote,
      cells: {
        'section': i.section ?? '', 'item': i.name.en ?? '', 'price (read-only)': priceOf(i), 'existing description': existing,
        'new EN': wrote.has('en') ? i.description.en ?? '' : '', 'new FA': wrote.has('fa') ? i.description.fa ?? '' : '',
        'key ingredients': (b?.ingredients ?? []).join(', '), 'allergens': i.notes.allergens.join(', '), 'dietary': i.notes.dietary.join(', '),
        'source': b?.url ?? '', 'confirmed': b && confirmed ? 'yes' : '', 'correction': '',
      },
    };
  });
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
