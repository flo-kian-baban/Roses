#!/usr/bin/env node
// Menu research acceptance (Kian via the PM, 2026-10-12), on the suite's scratch copy and its server:
//   coverage-<venue>   every shown item has an English and a Persian description (counts: existing, written by the research), except
//                      the placeholders withdrawn on Kian's ruling of 2026-10-13 (the records' `withdrawn`; the owner writes them)
//   basis-<venue>      every shown item has an allergen draft with a basis (key ingredients and a source URL), or the owner's own note kept
//   lexicon-<venue>    every ingredient a description names (English and Persian, existing and new; tools/import/research-lexicon.mjs) is in
//                      the item's key ingredients and its allergen is in the item's allergen draft
//   claims             the new descriptions: 0 health-claim words and 0 superlatives (the word lists are printed); English ≤ 25 words
//   public-<venue>     the public HTML carries no allergen or dietary note still to confirm; the confirmed ones show as "Contains: …"
//   notice-<venue>     the general allergy notice in English and Persian on every venue's page (the temporary venue included)
//   confirm-api        Confirm through the item route: "Contains: …" in English and Persian on the public page, Undo takes it off again
//   confirm-ui         on the iPhone 13 viewport: "Allergens to confirm" in the Needs-attention bar, the item's draft box with its basis,
//                      Confirm (44 × 44), "Confirmed · Undo"; measured with its tap count
//   csv-<venue>        reports/research-review-<venue>.csv: one row per shown item; exported from the database and read back unchanged = 0 changes;
//                      a proposed fix on every contradiction, those rows first (Fresh Berry Mojito-Virgin first on Kebab Land), none applied unticked
//   DRILL_ADMIN_PIN=… node scripts/research-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/research --venues senso,kebab-land,<temp>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';
import { LEXICON, named, reflected, CLAIM_WORDS, SUPERLATIVES, wordsIn } from '../tools/import/research-lexicon.mjs';
import { currentRows, toCsv, parseCsv } from '../tools/import/research-review-lib.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/research'); fs.mkdirSync(out, { recursive: true });
const venues = ['senso', 'kebab-land'], pageVenues = (args.venues || venues.join(',')).split(',').filter(Boolean);
const pin = process.env.DRILL_ADMIN_PIN;
const results = [], measures = [], transcript = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok: !!ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (t) => { measures.push(t); console.log(`MEASURE: ${t}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('research-drill', (t) => log('db', t));
const WORDS = JSON.parse(fs.readFileSync(path.resolve('src/lib/allergens.json'), 'utf8')); // the app's own words and notice (src/lib/allergens.ts reads the same file)
const notice = WORDS.notice;
const allergenFa = (w) => [...WORDS.allergens, ...WORDS.ownerWords].find((a) => a.en === w.trim().toLowerCase())?.fa ?? w;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const fetchHtml = async (v) => (await fetch(`${base}/${v}`, { cache: 'no-store' })).text();
// an item's <li> blocks in the page (a seasonal item has two), with everything nested in them (its popup template)
function liBlocks(html, id) {
  const outBlocks = []; let from = 0;
  for (;;) {
    const at = html.indexOf(`data-id="${id}"`, from); if (at < 0) break;
    const start = html.lastIndexOf('<li', at); if (start < 0 || html.slice(start, at).includes('>')) { from = at + 1; continue; }
    let depth = 0, i = start; const re = /<\/?li\b/g; re.lastIndex = start; let m;
    while ((m = re.exec(html))) { depth += m[0] === '<li' ? 1 : -1; if (depth === 0) { i = html.indexOf('>', m.index) + 1; break; } }
    outBlocks.push(html.slice(start, i).replace(/<!-- -->/g, '')); from = i; // React separates adjacent text with <!-- -->
  }
  return outBlocks;
}

// ---- the data: every shown item of both venues, with its research basis; the records (withdrawn placeholders, contradictions)
const records = Object.fromEntries(venues.map((v) => [v, fs.readdirSync('data/import').sort().map((d) => path.join('data/import', d, v, 'research.json')).filter((f) => fs.existsSync(f)).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).items)]));
const rowsBy = {};
for (const v of venues) rowsBy[v] = await currentRows(db, v);
const newDescs = [];
for (const v of venues) {
  const rows = rowsBy[v];
  const withdrawn = new Set(records[v].filter((i) => i.withdrawn).map((i) => i.name));
  const missingEn = rows.filter((r) => !r.item.description.en?.trim() && !withdrawn.has(r.cells.item)), missingFa = rows.filter((r) => !r.item.description.fa?.trim() && !withdrawn.has(r.cells.item));
  const ownerToWrite = rows.filter((r) => withdrawn.has(r.cells.item));
  const wroteEn = rows.filter((r) => r.wrote.has('en')).length, wroteFa = rows.filter((r) => r.wrote.has('fa')).length;
  const hasEn = rows.filter((r) => r.item.description.en?.trim()).length, hasFa = rows.filter((r) => r.item.description.fa?.trim()).length;
  check(`coverage-${v}`, rows.length > 0 && !missingEn.length && !missingFa.length, `${rows.length} shown items: English ${hasEn} (${hasEn - wroteEn} existing, ${wroteEn} written by the research), Persian ${hasFa} (${hasFa - wroteFa} existing, ${wroteFa} written by the research); for the owner to write (placeholders withdrawn, Kian 2026-10-13): ${ownerToWrite.map((r) => `${r.cells.item}${r.item.description.en || r.item.description.fa ? ' (has text again)' : ''}`).join(', ') || 'none'}${missingEn.length ? `; no English: ${missingEn.map((r) => r.cells.item).join(', ')}` : ''}${missingFa.length ? `; no Persian: ${missingFa.map((r) => r.cells.item).join(', ')}` : ''}`);
  measure(`${v}: ${rows.length} shown items; descriptions English ${hasEn - wroteEn} existing + ${wroteEn} new, Persian ${hasFa - wroteFa} existing + ${wroteFa} new; ${ownerToWrite.length} for the owner to write`);
  const noBasis = rows.filter((r) => !r.basis || !(r.basis.ingredients ?? []).length || !/^https:\/\//.test(r.basis.url ?? ''));
  const kept = rows.filter((r) => r.basis && (r.basis.kept ?? []).length);
  const draft = rows.filter((r) => r.item.drafts.includes('allergens')), confirmed = rows.filter((r) => r.basis && (r.basis.wrote ?? []).includes('allergens') && !r.item.drafts.includes('allergens'));
  check(`basis-${v}`, !noBasis.length && draft.length + confirmed.length + kept.length >= rows.length, `${rows.length - noBasis.length} of ${rows.length} with a basis (key ingredients and a source URL); allergen notes: ${draft.length} drafts to confirm, ${confirmed.length} confirmed or corrected since, ${kept.length} the owner's own note kept (${kept.map((r) => r.cells.item).join(', ') || 'none'})${noBasis.length ? `; WITHOUT a basis: ${noBasis.map((r) => r.cells.item).join(', ')}` : ''}`);
  // the lexicon: each ingredient a description names → in the key ingredients, its allergen in the allergen draft
  const misses = [];
  let namedCount = 0;
  for (const r of rows) {
    const texts = [r.item.description.en, r.item.description.fa].filter(Boolean).join(' \n ');
    const allergens = new Set((r.basis && !(r.basis.wrote ?? []).includes('allergens') ? r.basis.allergens : r.item.notes.allergens).map((a) => String(a).toLowerCase()));
    const ingredients = (r.basis?.ingredients ?? []).map((x) => String(x).toLowerCase());
    for (const n of named(texts)) {
      namedCount++;
      const inIngredients = reflected(n, ingredients);
      if (n.allergen && !allergens.has(n.allergen)) misses.push(`${r.cells.item}: "${n.word}" → ${n.allergen}, not in the allergens (${[...allergens].join(', ') || 'none'})`);
      if (!inIngredients) misses.push(`${r.cells.item}: "${n.word}" (${n.ingredient}) not in the key ingredients (${ingredients.join(', ')})`);
    }
  }
  check(`lexicon-${v}`, misses.length === 0, `${namedCount} ingredient mentions in ${rows.length} items' descriptions (English and Persian; lexicon of ${LEXICON.length} ingredients) checked against the key ingredients and the allergen draft: ${misses.length ? `${misses.length} not reflected: ${misses.slice(0, 40).join('; ')}` : 'every one reflected'}`);
  for (const r of rows) {
    if (r.wrote.has('en')) newDescs.push({ v, item: r.cells.item, lang: 'en', text: r.item.description.en });
    if (r.wrote.has('fa')) newDescs.push({ v, item: r.cells.item, lang: 'fa', text: r.item.description.fa });
  }
}
{
  const claims = newDescs.map((d) => ({ ...d, hits: wordsIn(d.text, CLAIM_WORDS) })).filter((d) => d.hits.length);
  const sup = newDescs.map((d) => ({ ...d, hits: wordsIn(d.text, SUPERLATIVES) })).filter((d) => d.hits.length);
  const long = newDescs.filter((d) => d.lang === 'en' && d.text.trim().split(/\s+/).length > 25);
  check('claims', claims.length === 0 && sup.length === 0 && long.length === 0, `${newDescs.length} new descriptions (${newDescs.filter((d) => d.lang === 'en').length} English, ${newDescs.filter((d) => d.lang === 'fa').length} Persian) scanned: health-claim words ${claims.length} hits${claims.length ? ` (${claims.map((d) => `${d.item} ${d.lang}: ${d.hits.join(', ')}`).join('; ')})` : ''}, superlatives ${sup.length} hits${sup.length ? ` (${sup.map((d) => `${d.item} ${d.lang}: ${d.hits.join(', ')}`).join('; ')})` : ''}, English over 25 words ${long.length}${long.length ? ` (${long.map((d) => d.item).join(', ')})` : ''}`);
  measure(`health-claim scan of ${newDescs.length} new descriptions: ${claims.length} hits; words: ${CLAIM_WORDS.join(', ')}`);
  measure(`superlative scan: ${sup.length} hits; words: ${SUPERLATIVES.join(', ')}`);
}

// ---- the public pages: no note still to confirm; the confirmed ones as "Contains: …"; the notice in both languages
for (const v of venues) {
  const html = await fetchHtml(v);
  const drafted = rowsBy[v].filter((r) => r.item.drafts.some((f) => f === 'allergens' || f === 'dietary'));
  const leaks = [];
  for (const r of drafted) for (const li of liBlocks(html, r.id)) {
    if (r.item.drafts.includes('allergens') && /class="contains"/.test(li)) leaks.push(`${r.cells.item}: a "Contains" line`);
    if (r.item.drafts.includes('dietary')) for (const d of r.item.notes.dietary) if (new RegExp(`class="chip"><span lang="en">${d}<`).test(li)) leaks.push(`${r.cells.item}: the chip "${d}"`);
  }
  const shownLis = drafted.reduce((n, r) => n + liBlocks(html, r.id).length, 0);
  const confirmedWith = rowsBy[v].filter((r) => !r.item.drafts.includes('allergens') && r.item.notes.allergens.length);
  const contains = (html.match(/<p class="contains">/g) || []).length;
  const expected = confirmedWith.reduce((n, r) => n + liBlocks(html, r.id).length, 0);
  check(`public-${v}`, shownLis >= drafted.length && leaks.length === 0 && contains === expected, `${drafted.length} items with notes still to confirm (${shownLis} rows or cards on the page): ${leaks.length ? `LEAKED: ${leaks.join('; ')}` : 'none of their allergens or dietary words in the HTML'}; "Contains" lines on the page ${contains}, expected ${expected} (the confirmed items with allergens: ${confirmedWith.map((r) => r.cells.item).join(', ') || 'none'})`);
}
for (const v of pageVenues) {
  const html = await fetchHtml(v);
  const en = html.includes(esc(notice.en)), fa = html.includes(esc(notice.fa));
  check(`notice-${v}`, en && fa, `the general allergy notice on /${v}: English ${en}, Persian ${fa}`);
}

// ---- Confirm through the API, seen on the public page, and Undo
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
async function waitPublic(v, pred, ms = 10000) { const t = Date.now(); while (Date.now() - t < ms) { const h = await fetchHtml(v); if (pred(h)) return { ok: true, ms: Date.now() - t }; await sleep(150); } return { ok: false, ms: Date.now() - t }; }
let cookie = null;
if (pin) {
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
}
// The drill sets its own precondition (an item with drafted allergens) when none is left, e.g. once every draft has been confirmed: on a
// copy only (the scratch copy of a suite run, never the working database), then the page is regenerated by a save that changes nothing.
async function ensureDraft() {
  if (rowsBy.senso.some((r) => r.item.drafts.includes('allergens') && r.item.notes.allergens.length)) return null;
  const dbn = (await db.query('select current_database() as d')).rows[0].d;
  if (!/_check_|_research|_audit|_dev/.test(dbn)) return `no Senso item with drafted allergens, and ${dbn} is not a copy, so none is made`;
  const r = rowsBy.senso.find((x) => x.basis) ?? rowsBy.senso[0];
  await db.query(`update items set drafts = array(select distinct unnest(drafts || '{allergens}')), notes = jsonb_set(notes, '{allergens}', $2::jsonb) where id = $1`, [r.id, JSON.stringify(r.item.notes.allergens.length ? r.item.notes.allergens : ['milk'])]);
  await api('/api/admin/item', { action: 'update', id: r.id, patch: {} }, cookie);
  rowsBy.senso = await currentRows(db, 'senso');
  return `precondition set on the copy ${dbn}: "${r.cells.item}" given drafted allergens`;
}
{
  const made = cookie?.startsWith('roses_session=') ? await ensureDraft() : null;
  if (made) log('confirm-api', made);
  const pick = rowsBy.senso.find((r) => r.item.drafts.includes('allergens') && r.item.notes.allergens.length >= 1);
  if (!cookie?.startsWith('roses_session=') || !pick) check('confirm-api', false, `not run: ${!pick ? made || 'no Senso item with drafted allergens' : 'PIN sign-in failed'}`);
  else {
    const en = `Contains: ${pick.item.notes.allergens.join(', ')}`, fa = `حاوی: ${pick.item.notes.allergens.map(allergenFa).join('، ')}`;
    const has = (h) => liBlocks(h, pick.id).some((li) => li.includes(en) && li.includes(fa));
    const before = has(await fetchHtml('senso'));
    const r = await api('/api/admin/item', { action: 'confirm', id: pick.id }, cookie);
    const shown = await waitPublic('senso', has);
    const after = (await db.query('select drafts from items where id = $1', [pick.id])).rows[0].drafts;
    const u = await api('/api/admin/undo', { venue: 'senso', revisions: r.json?.revisions ?? [] }, cookie);
    const gone = await waitPublic('senso', (h) => !has(h));
    const back = (await db.query('select drafts from items where id = $1', [pick.id])).rows[0].drafts;
    check('confirm-api', !before && r.status === 200 && !after.includes('allergens') && shown.ok && u.status === 200 && gone.ok && back.includes('allergens'), `"${pick.cells.item}": before Confirm the page shows no "Contains" for it (${!before}); confirm → ${r.status}, drafts after ${JSON.stringify(after)}; "${en}" and "${fa}" on the public page after ${shown.ms} ms (${shown.ok}); Undo → ${u.status}, off the page again after ${gone.ms} ms (${gone.ok}), drafts back ${JSON.stringify(back)}`);
  }
}

// ---- the admin on the iPhone 13 viewport: the Needs-attention chip, the draft box, Confirm, Undo
if (cookie?.startsWith('roses_session=')) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const [name, value] = cookie.split('=');
  await ctx.addCookies([{ name, value, url: base }]);
  const page = await ctx.newPage();
  let taps = 0; const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); await loc.tap(); taps++; };
  try {
    await page.goto(`${base}/admin/senso`, { waitUntil: 'networkidle' });
    const want = (await currentRows(db, 'senso')).filter((r) => r.item.drafts.some((f) => f === 'allergens' || f === 'dietary')).length;
    const hiddenToConfirm = (await db.query(`select count(*)::int as n from items where venue_id = 'senso' and not listed and drafts && array['allergens','dietary']`)).rows[0].n;
    const chip = page.getByRole('button', { name: /^Allergens to confirm \(\d+\)$/ });
    const chipText = await chip.textContent({ timeout: 8000 }).catch(() => null);
    const n = Number((chipText || '').match(/\((\d+)\)/)?.[1] ?? NaN);
    const t1 = Date.now();
    await tap(chip);
    const rows = await page.locator('li[data-item]').count();
    await tap(page.locator('li[data-item] button[aria-label^="Edit "]').first());
    const box = page.locator('[data-research-draft]');
    await box.waitFor({ timeout: 8000 });
    const boxText = await box.textContent();
    const btn = box.getByRole('button', { name: 'Confirm the allergens and dietary notes' });
    const bb = await btn.boundingBox();
    const itemName = (await page.locator('[role="dialog"]').first().getAttribute('aria-label') || '').replace(/^Edit /, '');
    const id = (await db.query(`select id from items where venue_id = 'senso' and name->>'en' = $1 and listed`, [itemName])).rows[0]?.id;
    await tap(btn);
    await page.getByRole('status').filter({ hasText: 'Confirmed' }).waitFor({ timeout: 8000 });
    const ms = Date.now() - t1;
    const afterC = (await db.query('select drafts from items where id = $1', [id])).rows[0]?.drafts ?? [];
    await page.screenshot({ path: path.join(out, 'confirm-ui.jpg'), type: 'jpeg', quality: 60 });
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).tap();
    await page.getByRole('status').filter({ hasText: 'Undone' }).waitFor({ timeout: 8000 });
    const afterU = (await db.query('select drafts from items where id = $1', [id])).rows[0]?.drafts ?? [];
    check('confirm-ui', n === want + hiddenToConfirm && rows >= 1 && /Based on:/.test(boxText || '') && bb && bb.width >= 44 && bb.height >= 44 && !afterC.some((f) => f === 'allergens' || f === 'dietary') && afterU.includes('allergens'),
      `iPhone 13: the bar's chip "${chipText}" (expected ${want + hiddenToConfirm}: ${want} shown + ${hiddenToConfirm} hidden items with notes to confirm), ${rows} rows after tapping it; "${itemName}" opened with its draft box (${/Based on:/.test(boxText || '') ? 'with its basis' : 'NO basis'}), Confirm ${bb ? `${Math.round(bb.width)} × ${Math.round(bb.height)}` : 'not found'} px; after Confirm drafts ${JSON.stringify(afterC)}, after Undo ${JSON.stringify(afterU)}`);
    measure(`confirm an item's researched allergens from the Menu tab on the iPhone 13 viewport: ${taps} taps (the Needs-attention chip, the item, Confirm), ${ms} ms to "Confirmed · Undo"`);
  } catch (e) { check('confirm-ui', false, `error: ${e.message}`); await page.screenshot({ path: path.join(out, 'confirm-ui-error.jpg'), type: 'jpeg', quality: 60 }).catch(() => {}); }
  await browser.close();
} else check('confirm-ui', false, 'not run: PIN sign-in failed');

// ---- the review sheets: one row per shown item; exported and read back unchanged = 0 changes
for (const v of venues) {
  const committed = path.resolve(`reports/research-review-${v}.csv`);
  const committedRows = fs.existsSync(committed) ? parseCsv(fs.readFileSync(committed, 'utf8')).length : null;
  const fresh = path.join(out, `research-review-${v}.csv`);
  fs.writeFileSync(fresh, toCsv(await currentRows(db, v)));
  const r = spawnSync(process.execPath, ['tools/import/research-review-apply.mjs', v, fresh, '--dry', '--reviewer', 'round trip'], { encoding: 'utf8', env: process.env });
  const j = (() => { try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; } })();
  const now = await currentRows(db, v);
  const contradictions = records[v].filter((i) => i.contradiction).map((i) => i.name);
  const fixRows = now.filter((x) => x.fix), firstFix = now.findIndex((x) => !x.fix);
  const fixesOk = contradictions.every((n) => fixRows.some((x) => x.cells.item === n)) && fixRows.every((x) => x.cells['proposed fix']) && (firstFix === -1 || firstFix === fixRows.length) && (v !== 'kebab-land' || now[0]?.cells.item === 'Fresh Berry Mojito-Virgin');
  check(`csv-${v}`, committedRows === rowsBy[v].length && r.status === 0 && j && j.rows === rowsBy[v].length && j.changed === 0 && j.notFound === 0 && j.fixesApplied === 0 && fixesOk, `reports/research-review-${v}.csv: ${committedRows ?? 'MISSING'} rows for ${rowsBy[v].length} shown items; exported now and read back with --dry: ${j ? `${j.rows} rows, ${j.changed} changed, ${j.unchanged} unchanged, ${j.fixesApplied} fixes applied, ${j.notFound} not found, ${j.readOnlyIgnored} read-only differences` : `exit ${r.status}: ${r.stderr.slice(0, 200)}`}; proposed fixes ${fixRows.length} for ${contradictions.length} contradictions, first in the sheet (${now.slice(0, fixRows.length).map((x) => x.cells.item).join(', ')}), ${fixRows.filter((x) => x.cells['apply fix'] === 'applied').length} already applied`);
}

await db.end();
const pass = results.every((r) => r.ok);
fs.writeFileSync(path.join(out, 'research-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
fs.writeFileSync(path.join(out, 'research-drill.txt'), [`Research drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`)].join('\n'));
console.log(`RESEARCH DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
