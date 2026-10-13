#!/usr/bin/env node
// Admin audit, the item editor rebuild (Kian, 2026-10-13): the nine audit tasks and three new ones, measured with the same method and the
// same counting helpers as audit-drill.mjs (everything between "import fs" and "// ===== the tasks" is that file's, verbatim), on the
// iPhone 13 viewport, once on the build before the rebuild (--ui before: the paths of audit-drill-after.mjs, unchanged) and once on the
// rebuilt editor (--ui after: the same tasks the shortest way a person would on the new screens). Counted per task, as before:
//   taps (every tap on a control, focusing a field and each choice in a select), fields typed, keys (Enter, Tab),
//   scrolls (each time the next control was not tappable in the 390 × 664 viewport, with the distance scrolled),
//   app wait (wall time from the first tap to the change visible on the public page, screenshot time excluded),
//   done (the final state read back from the public page and the scratch database).
// New in this file: "in the editor", the same counts from the moment the item editor is open (the PM's targets of this batch are
// worded from the editor: "hide an item from the editor: 1 tap", "duplicate an item ≤ 2 taps"); the full counts, from the Menu tab
// with the search, stay the comparison with every earlier run. And three tasks: t10 hide an item from its editor, t11 see every
// section an item is in, t12 duplicate an item (the copy checked field by field in the database, then one Undo removes it).
// Runs only against a scratch copy (refuses any database but roses_audit) and a server on a free port.
//   DATABASE_URL=…/roses_audit node audit-drill-editor.mjs --ui before|after --sp <scratch dir with port, admin.env, audit-iced-tea.jpg> --out <folder>
// Credentials are read from <sp>/admin.env at run time and never written anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import pg from '/Users/kianbaban/Roses/node_modules/pg/lib/index.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const SP = args.sp, OUT = path.resolve(args.out || '.');
const ONLY = args.only ? args.only.split(',') : null;
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const base = `http://127.0.0.1:${fs.readFileSync(path.join(SP, 'port'), 'utf8').trim()}`;
const cred = Object.fromEntries(fs.readFileSync(path.join(SP, 'admin.env'), 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const JPEG = path.join(SP, 'audit-iced-tea.jpg');
const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://x/none');
if (dbUrl.pathname !== '/roses_audit') { console.error('refusing: DATABASE_URL must name roses_audit'); process.exit(2); }
const db = new pg.Client({ connectionString: dbUrl.toString(), application_name: 'roses-audit:drill' });
await db.connect();
if ((await db.query('select current_database() d')).rows[0].d !== 'roses_audit') { console.error('refusing: not roses_audit'); process.exit(2); }

const VENUE = 'senso';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const sec = Object.fromEntries((await q(`select id, name->>'en' n from sections where venue_id=$1`, [VENUE])).map((r) => [r.n, r.id]));
const itemIn = async (name, section) => (await q(`select i.id from items i join item_sections x on x.item_id=i.id where i.venue_id=$1 and i.name->>'en'=$2 and x.section_id=$3`, [VENUE, name, sec[section]]))[0]?.id;
const publicHtml = async () => (await fetch(`${base}/${VENUE}`, { cache: 'no-store' })).text();
// every <li … data-id="id"> chunk of the public page up to its </template> (the item popup's content travels in a template)
const chunks = (html, id) => { const out = []; let i = 0; while ((i = html.indexOf(`data-id="${id}"`, i)) >= 0) { const e = html.indexOf('</template>', i); out.push(html.slice(i, e < 0 ? i + 4000 : e)); i += 10; } return out; };
// the public page's sections: id → [item ids] (sections are not nested; see menu-kit.tsx)
// the visible text of a chunk (tags removed, nothing inserted between them): "<li><span>Small</span><bdi>$5.49</bdi>" → "Small$5.49"
const text = (c) => c.replace(/<template[^>]*>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const pubHas = (html, id, ...res) => chunks(html, id).some((c) => res.every((r) => (r instanceof RegExp ? r.test(text(c)) : text(c).includes(r))));
const sectionsOf = (html) => { const m = {}; for (const s of html.split('<section').slice(1)) { const id = (s.match(/^[^>]*data-id="([^"]+)"/) || [])[1]; if (!id) continue; m[id] = [...s.split('</section>')[0].matchAll(/<li class="item[^"]*"[^>]*data-id="([^"]+)"/g), ...s.split('</section>')[0].matchAll(/<li[^>]*class="[^"]*card[^"]*"[^>]*data-id="([^"]+)"/g)].map((x) => x[1]); } return m; };
async function waitPublic(pred, ms = 15000) { const t = Date.now(); let html = ''; const fin = (ok) => { if (T) { T.publicWait = Date.now() - t; T.excludedAtEnd = T.excluded; } return { ok, at: Date.now(), html }; }; while (Date.now() - t < ms) { html = await publicHtml(); if (pred(html)) return fin(true); await sleep(100); } return fin(false); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const pageErrors = [];
// Requests to the admin API in flight, counted inside the page (fetch wrapped by an init script, so the count is exact when
// the next action starts). In the measured runs every action first waits until none is in flight: a person does not outpace the
// server (a human takes a second or more per field). The probe P1 does not wait (FAST) and shows what then happens.
let FAST = false;
await ctx.addInitScript(() => {
  window.__inflight = 0; const f = window.fetch;
  window.fetch = function (input, init) { const u = String(input && input.url ? input.url : input); const mine = u.includes('/api/admin/'); if (mine) window.__inflight++; const p = f.call(this, input, init); if (mine) p.then((r) => r.clone().text().catch(() => null), () => null).finally(() => { setTimeout(() => { window.__inflight--; }, 0); }); return p; };
});
if (process.env.AUDIT_DEBUG) {
  await ctx.addInitScript(() => {
    const L = (...a) => console.log('PAGE', Math.round(performance.now()), ...a);
    document.addEventListener('input', (e) => L('input', e.target.getAttribute('aria-label'), JSON.stringify(e.target.value)), true);
    document.addEventListener('focusin', (e) => L('focusin', e.target.getAttribute('aria-label') || e.target.tagName), true);
    document.addEventListener('focusout', (e) => L('focusout', e.target.getAttribute('aria-label') || e.target.tagName), true);
    document.addEventListener('keydown', (e) => L('keydown', e.key, document.activeElement?.getAttribute('aria-label'), 'composing', e.isComposing, 'target', e.target.getAttribute?.('aria-label') || e.target.tagName), true);
    window.addEventListener('keydown', (e) => L('keydown-bubbled', e.key, 'prevented', e.defaultPrevented), false);
    document.addEventListener('beforeinput', (e) => L('beforeinput', e.inputType, e.data, e.target.getAttribute('aria-label')), true);
    const f = window.fetch; window.fetch = function (i, o) { L('fetch>', String(i), o?.body?.slice?.(0, 160)); const p = f.call(this, i, o); p.then(() => L('fetch<', String(i))); return p; };
  });
  page.on('console', (m) => { if (m.text().startsWith('PAGE')) console.log('     ' + m.text()); });
}
async function idle() { if (FAST) return; const t = Date.now(); await page.waitForFunction(() => window.__inflight === 0, null, { timeout: 20000, polling: 10 }).catch(() => null); if (T) T.serverWait += Date.now() - t; await settle(); }
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`); });

// ---- sign in once (not part of any task)
await page.goto(`${base}/admin/${VENUE}`);
await page.fill('input[name=pin]', cred.AUDIT_ADMIN_PIN);
await page.click('button[type=submit]');
await page.waitForURL(`${base}/admin/${VENUE}`);
await page.waitForSelector('[data-item]');

// ---- the task recorder
let T = null;
const results = [];
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const now = () => Date.now();
function step(text) { const s = { ms: T.t0 ? now() - T.t0 - T.excluded : 0, text }; T.steps.push(s); console.log(`  [${T.name}] +${s.ms} ms  ${text}`); }
const DEBUG = !!process.env.AUDIT_DEBUG;
async function dbg(l) { if (!DEBUG) return; console.log('     DBG', l, JSON.stringify(await page.locator('[role=dialog] input[aria-label^="Size "]').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}=${e.value}`))), 'focus:', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName), 'inflight', await page.evaluate(() => window.__inflight)); }
async function shot(name) {
  const t = now();
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))), new Promise((r) => setTimeout(r, 700))])).catch(() => null);
  const f = `${T.name}-${String(++T.shot).padStart(2, '0')}-${name}.jpg`;
  await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 60 });
  T.shots.push(f);
  T.excluded += now() - t;
}
// Is the control tappable where it is now: its centre inside the viewport and the topmost element there is the control
// (or inside it, or inside the same <label>)? If not, the reason (below the fold, under a sticky bar, under the toast).
async function tappable(loc) {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (r.height === 0) return { ok: false, why: 'not laid out' };
    if (cy < 0) return { ok: false, why: 'above the screen', min: Math.round(-r.top) };
    if (cy > innerHeight) return { ok: false, why: `below the fold (${Math.round(cy - innerHeight)} px under the screen's bottom edge)`, min: Math.round(r.bottom - innerHeight) };
    const hit = document.elementFromPoint(cx, cy);
    const lab = el.closest('label');
    if (hit && (hit === el || el.contains(hit) || (lab && lab.contains(hit)))) return { ok: true };
    const coverEl = hit?.closest('[role=status]') || hit?.closest('header') || hit?.closest('.glass');
    const cover = hit?.closest('[role=status]') ? 'the Saved · Undo toast' : hit?.closest('header') ? 'the top bar' : hit?.closest('.glass') ? 'a sticky bar' : (hit?.tagName || 'nothing').toLowerCase();
    const cr = coverEl?.getBoundingClientRect();
    return { ok: false, why: `covered by ${cover}`, min: cr ? (cr.top > cy ? Math.round(r.bottom - cr.top) : Math.round(cr.bottom - r.top)) : null };
  });
}
async function ensure(loc, what) {
  await loc.waitFor({ state: 'attached', timeout: 10000 });
  const v = await tappable(loc);
  if (v.ok) return;
  const d = await loc.evaluate((el) => {
    const conts = []; for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) conts.push(p); }
    const before = conts.map((c) => c.scrollTop), wb = scrollY;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const moved = conts.reduce((n, c, i) => n + Math.abs(c.scrollTop - before[i]), 0) + Math.abs(scrollY - wb);
    return { moved: Math.round(moved), where: conts.length && conts.some((c, i) => c.scrollTop !== before[i]) ? 'the item panel' : 'the page' };
  });
  T.scrolls++; T.scrollPx += d.moved; T.scrollMinPx += Math.max(0, v.min ?? d.moved);
  T.lost.push(`${what}: ${v.why}; scrolled ${d.where} ${d.moved} px (to mid-screen; at least ${Math.max(0, v.min ?? d.moved)} px to bring it fully on screen)`);
  step(`SCROLL ${d.moved} px (${d.where}) to reach ${what}: ${v.why}; at least ${Math.max(0, v.min ?? d.moved)} px needed`);
  await settle();
  const v2 = await tappable(loc);
  if (!v2.ok) step(`still not tappable after the scroll: ${v2.why}`);
}
async function tap(loc, what) {
  await idle();
  await ensure(loc, what);
  if (!T.t0) { T.t0 = now(); T.excluded = 0; }
  T.taps++; step(`TAP ${what}`);
  await loc.tap();
  await settle();
  await dbg(`after tap ${what}`);
}
// a text entry: tap the field (counted), then type; an existing value is replaced (an "overwrite": on a phone, select-all first)
async function type(loc, text, what) {
  await tap(loc, `${what} (field)`);
  const had = await loc.inputValue();
  if (had) { T.overwrites.push(`${what}: "${had}"`); await loc.fill(text); step(`TYPE "${text}" over "${had}"`); }
  else { await page.keyboard.insertText(text); step(`TYPE "${text}"`); }
  T.fields++;
  await dbg(`after type ${what}`);
}
async function key(k, what) { await idle(); T.keys++; step(`KEY ${k}${what ? ` (${what})` : ''}`); await page.keyboard.press(k); await settle(); }
async function choose(loc, label, what) { await idle(); await ensure(loc, what); if (!T.t0) { T.t0 = now(); T.excluded = 0; } T.taps += 2; step(`TAP ${what} + choose "${label}" (2 taps)`); await loc.selectOption({ label }); await settle(); }
const toastText = () => page.locator('[role=status]').textContent({ timeout: 300 }).catch(() => null);
async function startTask(name, title) {
  await page.goto(`${base}/admin/${VENUE}`); await page.waitForSelector('[data-item]');
  await page.evaluate(() => window.scrollTo(0, 0)); await settle();
  T = { name, title, taps: 0, fields: 0, keys: 0, scrolls: 0, scrollPx: 0, scrollMinPx: 0, serverWait: 0, publicWait: 0, overwrites: [], lost: [], notes: [], steps: [], shots: [], shot: 0, t0: 0, excluded: 0 };
  console.log(`\n== ${name}: ${title}`);
  await shot('start');
}
function endTask({ done, endAt, path: p, detail }) {
  const ex = T.excludedAtEnd ?? T.excluded; // screenshots taken before the end mark only (the "saved" shot comes after it)
  const wait = endAt && T.t0 ? endAt - T.t0 - ex : null;
  const r = { task: T.name, title: T.title, taps: T.taps, fields: T.fields, keys: T.keys, scrolls: T.scrolls, scrollPx: T.scrollPx, scrollMinPx: T.scrollMinPx, appWaitMs: wait, waitingForSavesMs: T.serverWait, waitingForPublicPageMs: T.publicWait, rawWallMs: endAt && T.t0 ? endAt - T.t0 : null, screenshotMsExcluded: ex, done, path: p, overwrites: T.overwrites, lost: T.lost, notes: T.notes, detail, steps: T.steps, shots: T.shots };
  results.push(r);
  const line = `${T.name.startsWith('p') ? 'PROBE' : 'MEASURE'}: ${T.name} | taps ${T.taps} | fields ${T.fields} | keys ${T.keys} | scrolls ${T.scrolls} (${T.scrollPx} px) | app wait ${wait ?? 'n/a'} ms | done ${done ? 'yes' : 'no'} | ${p}`;
  r.line = line; console.log(line);
}
const dlg = () => page.locator('[role=dialog][aria-label^="Edit "]');
const rowBtn = (sectionName, id) => page.locator(`#sec-${sec[sectionName]} [data-item="${id}"] button[aria-label^="Edit"]`);
const search = async (text) => { await type(page.locator('input[aria-label="Search items"]'), text, 'Search items'); };
async function openItem(sectionName, id, name) { await tap(rowBtn(sectionName, id), `the "${name}" row in ${sectionName}`); await dlg().waitFor(); }
async function openMore() { await tap(dlg().locator('button[aria-expanded]:has-text("More")'), 'More'); await dlg().locator('textarea').first().waitFor(); }
async function openAdvanced() { await tap(dlg().locator('button[aria-expanded]:has-text("Advanced")'), 'Advanced'); await dlg().getByRole('button', { name: 'Add a choice' }).waitFor(); }
const sizeRows = () => dlg().locator('input[aria-label^="Size "][aria-label$="price"]').count();
const addonRows = () => dlg().locator('input[aria-label$=" choice"]').count();
const dbItem = async (id) => (await q('select name, price, variants, add_ons, notes, description, photo, listed from items where id=$1', [id]))[0];
const placementsOf = async (id) => (await q(`select s.name->>'en' n from item_sections x join sections s on s.id=x.section_id where x.item_id=$1 order by s.position`, [id])).map((r) => r.n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');



// ===== the tasks
const UI = args.ui === 'after' ? 'after' : args.ui === 'before' ? 'before' : null;
if (!UI) { console.error('--ui before|after is required'); process.exit(2); }
// in the editor: the counts from the moment the item editor is open (marked once per task)
const markEditor = () => { if (T.mark) return; T.mark = { taps: T.taps, fields: T.fields, keys: T.keys, scrolls: T.scrolls, scrollPx: T.scrollPx }; step('the editor is open: the "in the editor" counts start here'); };
// seen, not tapped: brought on screen when it is not (counted as a scroll, as before)
const see = async (loc, what) => { await idle(); await ensure(loc, what); if (!T.t0) { T.t0 = now(); T.excluded = 0; } step(`SEE ${what}`); };
const finish = (o) => {
  endTask(o);
  const r = results[results.length - 1]; const m = T.mark;
  r.inEditor = m ? { taps: r.taps - m.taps, fields: r.fields - m.fields, keys: r.keys - m.keys, scrolls: r.scrolls - m.scrolls, scrollPx: r.scrollPx - m.scrollPx } : null;
  r.ui = UI;
  if (r.inEditor) { r.line += ` | in the editor: taps ${r.inEditor.taps} | fields ${r.inEditor.fields} | keys ${r.inEditor.keys} | scrolls ${r.inEditor.scrolls} (${r.inEditor.scrollPx} px)`; console.log(`  in the editor: taps ${r.inEditor.taps}, fields ${r.inEditor.fields}, keys ${r.inEditor.keys}, scrolls ${r.inEditor.scrolls} (${r.inEditor.scrollPx} px)`); }
  return r;
};
const openIt = async (sectionName, id, name) => { await openItem(sectionName, id, name); markEditor(); };
const typeHere = async (text, what) => { await idle(); const had = await page.evaluate(() => document.activeElement?.value ?? ''); T.fields++; await page.keyboard.insertText(text); step(`TYPE "${text}"${had ? ` over the selected "${had}"` : ''} (${what}, the cursor already there)`); if (had) T.overwrites.push(`${what}: "${had}" (selected on focus, typed over)`); await settle(); };
const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName);
// "+ Sizes" in Basics (before) or "+ Size" in Price & choices (after): one tap opens the first row with the cursor in it
const SIZE_BTN = UI === 'before' ? { name: 'Sizes', what: '+ Sizes (Basics)' } : { name: 'Size', what: '+ Size (Price & choices)' };
const CHOICE_BTN = UI === 'before' ? { name: 'Choices (milk, extras…)', what: '+ Choices (Basics)' } : { name: 'Choice group', what: '+ Choice group (Price & choices)' };
async function sizesFrom(list) {
  await tap(dlg().getByRole('button', { name: SIZE_BTN.name, exact: true }), SIZE_BTN.what);
  await dlg().locator('input[aria-label="Size 1"]').waitFor();
  step(`cursor in "${await focusedLabel()}"; Size 1 price shows "${await dlg().locator('input[aria-label="Size 1 price"]').inputValue()}"`);
  await shot('sizes-started');
  for (let i = 0; i < list.length; i++) {
    if (i > 0) { await dlg().locator(`input[aria-label="Size ${i + 1}"]`).waitFor(); step(`cursor in "${await focusedLabel()}"`); }
    await typeHere(list[i].label, `Size ${i + 1} name`);
    await key('Tab', 'to the price');
    const had = await dlg().locator(`input[aria-label="Size ${i + 1} price"]`).inputValue();
    if (had !== list[i].price) await typeHere(list[i].price, `Size ${i + 1} price`);
    await key('Enter', i < list.length - 1 ? 'saves the row and opens the next' : 'saves the row');
    await shot(`size-${i + 1}`);
  }
}
const want = (name) => !ONLY || ONLY.includes(name);
const ids = {
  americano: await itemIn('Americano', 'Hot Beverage'), cappuccino: await itemIn('Cappuccino', 'Hot Beverage'), turkish: await itemIn('Turkish Coffee', 'Hot Beverage'),
  latte: await itemIn('Latte', 'Hot Beverage'), icedAmericano: await itemIn('Iced Americano', 'Cold Beverage'), mocha: await itemIn('Mocha', 'Hot Beverage'),
  soup: await itemIn('Pumpkin Soup', 'Appetizer'),
};
const lattes = await q(`select i.id, i.name->>'en' n, i.listed from items i join item_sections x on x.item_id=i.id where x.section_id=$1 and i.name->>'en' ilike '%latte%' order by x.position`, [sec['Hot Beverage']]);
console.log(`ui: ${UI}\nitems:`, ids, '\nlattes in Hot Beverage:', lattes.map((l) => `${l.n}${l.listed ? '' : ' (hidden)'}`).join(', '));
const SEASON = (() => { const m = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', month: 'numeric' }).format(new Date())) - 1; return m >= 8 && m <= 10 ? 'Fall' : m === 11 || m <= 1 ? 'Winter' : m <= 4 ? 'Spring' : 'Summer'; })();

// ===== 1. Two sizes on Americano
if (want('t1-sizes')) {
  await startTask('t1-sizes', 'Americano: one price → Small 5.49 / Large 6.49');
  await search('Americano'); await shot('search');
  await openIt('Hot Beverage', ids.americano, 'Americano'); await shot('panel');
  await sizesFrom([{ label: 'Small', price: '5.49' }, { label: 'Large', price: '6.49' }]);
  const w = await waitPublic((h) => pubHas(h, ids.americano, 'Small$5.49', 'Large$6.49'));
  await shot('saved');
  const row = await dbItem(ids.americano);
  const ok = w.ok && row.price == null && JSON.stringify(row.variants.map((v) => [v.label.en, Number(v.price)])) === JSON.stringify([['Small', 5.49], ['Large', 6.49]]);
  finish({ done: ok, endAt: w.at, path: `search "Americano" → row → ${SIZE_BTN.what} (the cursor in Size 1, its price the item's 5.99) → Small, Tab, 5.49 over it, Enter → Large, Tab, 6.49, Enter`, detail: { variants: row.variants, price: row.price } });
}

// ===== 2. A Milk choice on every latte of Hot Beverage
if (want('t2-milk')) {
  await startTask('t2-milk', `Milk (Whole milk 0, Lactose-free 0, Oat milk +1) on the ${lattes.length} lattes of Hot Beverage: ${lattes.map((l) => l.n).join(', ')}`);
  await search('Latte'); await shot('search');
  const first = lattes.find((l) => l.id === ids.latte) ?? lattes[0];
  await openIt('Hot Beverage', first.id, first.n); await shot('open');
  await tap(dlg().getByRole('button', { name: CHOICE_BTN.name, exact: true }), CHOICE_BTN.what);
  step(`cursor in "${await focusedLabel()}"`);
  await typeHere('Milk', 'the group\'s name'); await key('Enter', 'to the first choice');
  for (const [label, price, last] of [['Whole milk', '', false], ['Lactose-free', '', false], ['Oat milk', '1', true]]) {
    await typeHere(label, `choice "${label}"`); await key('Tab', 'to its price');
    if (price) await typeHere(price, `${label}'s extra price`);
    await key('Enter', last ? 'saves the row' : 'saves the row and opens the next');
  }
  await shot('milk-on-latte');
  await tap(UI === 'before' ? dlg().locator('[data-choice-group="Milk"] button:has-text("Copy to other items")') : dlg().locator('[data-choice-group="Milk"]').getByRole('button', { name: 'Copy to other items…' }), `${UI === 'before' ? 'Copy to other items…' : 'Copy to…'} (the Milk group)`);
  const sheet = page.locator('[role=dialog][aria-label^="Copy “Milk”"]'); await sheet.waitFor(); await shot('copy-sheet');
  for (const l of lattes.filter((x) => x.id !== first.id)) await tap(sheet.locator('[data-copy-section="Hot Beverage"] label', { hasText: l.n }).locator('input[type=checkbox]').first(), `tick ${l.n}`);
  await shot('ticked');
  await tap(sheet.getByRole('button', { name: /^Copy to \d+ items?$/ }), 'Copy to N items');
  await sheet.waitFor({ state: 'detached' });
  const milkOk = (a) => { const m = a.filter((x) => x.group?.en === 'Milk'); return JSON.stringify(m.map((x) => [x.label.en, Number(x.price)])) === JSON.stringify([['Whole milk', 0], ['Lactose-free', 0], ['Oat milk', 1]]); };
  const listedIds = lattes.filter((l) => l.listed).map((l) => l.id);
  const w = await waitPublic((h) => listedIds.every((id) => pubHas(h, id, /MilkOptional/, /Whole milk(?!\+)/, /Lactose-free(?!\+)/, /Oat milk\+\$1(?![.\d])/)));
  await shot('saved');
  const toast = await toastText();
  const rows = await Promise.all(lattes.map(async (l) => ({ name: l.n, listed: l.listed, ok: milkOk((await dbItem(l.id)).add_ons) })));
  finish({ done: w.ok && rows.every((r) => r.ok), endAt: w.at, path: `search "Latte" → ${first.n} → ${CHOICE_BTN.what} → Milk, Enter → Whole milk, Tab, Enter → Lactose-free, Tab, Enter → Oat milk, Tab, 1, Enter → Copy to other items… → tick the other ${lattes.length - 1} lattes → Copy`, detail: { lattes: rows, toast } });
}

// ===== 3. One option's price: Oat milk +1 → +1.25 on Latte (the Milk group is its second, after "syrup")
if (want('t3-option-price')) {
  await startTask('t3-option-price', 'Latte: Oat milk +1 → +1.25');
  await search('Latte'); await shot('search');
  await openIt('Hot Beverage', ids.latte, 'Latte'); await shot('panel');
  if (UI === 'before') { await tap(dlg().locator('button[aria-expanded]:has-text("Advanced")'), 'Advanced'); await dlg().locator('[data-choices]').waitFor(); await shot('advanced'); }
  const price = dlg().locator('input[aria-label^="Milk "][aria-label$="extra price"]').nth(2);
  T.notes.push(`Oat milk's price field: ${await price.getAttribute('aria-label')}`);
  await type(price, '1.25', 'Oat milk extra price'); await key('Enter', 'saves');
  const w = await waitPublic((h) => pubHas(h, ids.latte, /Oat milk\+\$1\.25/));
  await shot('saved');
  const a = (await dbItem(ids.latte)).add_ons.find((x) => x.label.en === 'Oat milk');
  finish({ done: w.ok && Number(a?.price) === 1.25, endAt: w.at, path: `search "Latte" → row → ${UI === 'before' ? 'Advanced → ' : ''}Oat milk's extra price: overwrite 1→1.25 → Enter`, detail: { oat: a } });
}

// ===== 4. An extra with a price: Extra shot +1.50 on Cappuccino
if (want('t4-extra')) {
  await startTask('t4-extra', 'Cappuccino: optional add-on "Extra shot" +$1.50');
  await search('Cappuccino'); await shot('search');
  await openIt('Hot Beverage', ids.cappuccino, 'Cappuccino'); await shot('panel');
  await tap(dlg().getByRole('button', { name: CHOICE_BTN.name, exact: true }), CHOICE_BTN.what);
  step(`cursor in "${await focusedLabel()}"`);
  T.notes.push('Group left empty (shortest path, as before): the customers\' popup titles it "Options · Optional"');
  await key('Enter', 'past the group\'s name to the first choice');
  await typeHere('Extra shot', 'the choice'); await key('Tab', 'to its price'); await typeHere('1.50', 'the extra price'); await key('Enter', 'saves the row');
  const w = await waitPublic((h) => pubHas(h, ids.cappuccino, /Extra shot\+\$1\.50/));
  await shot('saved');
  const a = (await dbItem(ids.cappuccino)).add_ons;
  finish({ done: w.ok && a.length === 1 && a[0].label.en === 'Extra shot' && Number(a[0].price) === 1.5 && !a[0].required, endAt: w.at, path: `search "Cappuccino" → row → ${CHOICE_BTN.what} → Enter (no group) → Extra shot, Tab, 1.50, Enter`, detail: { add_ons: a } });
}

// ===== 5. Description in English and Persian on Turkish Coffee
const EN = 'Strong coffee brewed in a copper pot, served with a sweet.';
const FA = 'قهوه غلیظ دم شده در قهوه جوش مسی با یک شیرینی';
if (want('t5-description')) {
  await startTask('t5-description', 'Turkish Coffee: an English and a Persian description');
  await search('Turkish'); await shot('search');
  await openIt('Hot Beverage', ids.turkish, 'Turkish Coffee'); await shot('panel');
  if (UI === 'before') { await tap(dlg().locator('button[aria-expanded]:has-text("More")'), 'More'); await dlg().locator('textarea').first().waitFor(); await shot('more'); }
  await type(dlg().locator('textarea[aria-label="Description"]'), EN, 'Description');
  await type(dlg().locator('textarea[aria-label="Description (فارسی)"]'), FA, 'Description (فارسی)');
  await tap(dlg().locator('button:has-text("Done")'), 'Done (the Persian box saves when it loses focus)');
  const w = await waitPublic((h) => pubHas(h, ids.turkish, EN, FA));
  await shot('saved');
  const d = (await dbItem(ids.turkish)).description;
  finish({ done: w.ok && d.en === EN && d.fa === FA, endAt: w.at, path: `search "Turkish" → row → ${UI === 'before' ? 'More → ' : ''}Description → Description (فارسی) → Done`, detail: { description: d } });
}

// ===== 6. Allergens on Turkish Coffee
if (want('t6-allergens')) {
  await startTask('t6-allergens', 'Turkish Coffee: allergens "milk"');
  await search('Turkish'); await shot('search');
  await openIt('Hot Beverage', ids.turkish, 'Turkish Coffee'); await shot('panel');
  // the group is closed unless the item has allergen or dietary drafts waiting for Confirm (open by default since the PM's note of 2026-10-13); a person taps it only when closed
  if (UI === 'after' && (await dlg().locator('button[aria-expanded="false"][data-group="allergens"]').count())) { await tap(dlg().locator('button[aria-expanded="false"][data-group="allergens"]'), 'Allergens & diet (closed)'); await dlg().locator('[data-allergen="milk"]').waitFor(); await shot('allergens-open'); }
  else if (UI === 'after') T.notes.push('Allergens & diet already open (the item has drafts waiting for Confirm)');
  await tap(dlg().locator('[data-allergen="milk"]'), `the Milk chip (${UI === 'before' ? 'Good to know' : 'Allergens & diet'})`);
  const w = await waitPublic((h) => pubHas(h, ids.turkish, 'Contains: milk', 'حاوی: شیر'));
  await shot('saved');
  const n = (await dbItem(ids.turkish)).notes;
  finish({ done: w.ok && JSON.stringify(n.allergens) === '["milk"]', endAt: w.at, path: `search "Turkish" → row → ${T.steps.some((x) => /Allergens & diet \(closed\)/.test(x.text)) ? 'Allergens & diet → ' : ''}the Milk chip`, detail: { notes: n } });
}

// ===== 7. A new item with a description, a photo and two sizes
if (want('t7-new-item')) {
  await startTask('t7-new-item', 'Cold Beverage: new "Audit Iced Tea", Small 4.99 / Large 5.99, a description, a photo');
  const NAME = 'Audit Iced Tea', DESC = 'Black tea over ice with lemon.';
  await choose(page.locator('select[aria-label="Jump to section"]'), 'Cold Beverage', 'Jump to section');
  await page.waitForFunction((id) => { const r = document.getElementById(`sec-${id}`)?.getBoundingClientRect(); return r && Math.abs(r.top - 160) < 40; }, sec['Cold Beverage'], { timeout: 5000 }).catch(() => null);
  await sleep(50); await shot('jumped');
  await tap(page.locator(`button[aria-label="Add item to Cold Beverage"]`), '+ Add on Cold Beverage');
  const sheet = page.locator('[role=dialog][aria-label="Add item to Cold Beverage"]'); await sheet.waitFor();
  await shot('sheet');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  if (focused === 'Name') { await page.keyboard.insertText(NAME); T.fields++; step(`TYPE "${NAME}" (the Name field has the focus already)`); }
  else await type(sheet.locator('input[name=name]'), NAME, 'Name');
  await type(sheet.locator('input[name=price]'), '4.99', 'Price (the Small price; the sheet has one price only)');
  await ensure(sheet.locator('label:has(input[aria-label="Choose a photo"])'), 'Add photo');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), (async () => { T.taps++; step('TAP Add photo (opens the phone\'s chooser)'); await sheet.locator('label:has(input[aria-label="Choose a photo"])').tap(); })()]);
  T.taps++; step('TAP choose the photo in the phone\'s chooser (counted as 1; iOS may add one more)');
  await fc.setFiles(JPEG);
  await sheet.locator('[data-photo-field="set"]').waitFor({ timeout: 15000 });
  await shot('sheet-filled');
  await tap(sheet.locator('button[type=submit]'), 'Add item');
  await sheet.waitFor({ state: 'detached' });
  await page.locator(`[role=dialog][aria-label="Edit ${NAME}"]`).waitFor({ timeout: 5000 });
  const id = (await q(`select id from items where venue_id=$1 and name->>'en'=$2`, [VENUE, NAME]))[0]?.id;
  step(`created ${id}; the editor opened on it${UI === 'before' ? ' with More open' : ''}`); markEditor();
  await shot('editor-opened');
  await type(dlg().locator('textarea[aria-label="Description"]'), DESC, 'Description');
  await sizesFrom([{ label: 'Small', price: '4.99' }, { label: 'Large', price: '5.99' }]);
  const w = await waitPublic((h) => { const c = chunks(h, id); const s = sectionsOf(h); return c.some((x) => /src="\/uploads\/senso\/photo-/.test(x)) && pubHas(h, id, 'Small$4.99', 'Large$5.99', DESC) && (s[sec['Cold Beverage']] || []).includes(id); });
  await shot('saved');
  const row = await dbItem(id);
  finish({ done: w.ok && row.listed && !!row.photo?.key && row.description.en === DESC && JSON.stringify(row.variants.map((v) => [v.label.en, Number(v.price)])) === JSON.stringify([['Small', 4.99], ['Large', 5.99]]), endAt: w.at,
    path: `Jump to section → Cold Beverage → + Add → name, price 4.99, Add photo + choose → Add item (the editor opens on it${UI === 'before' ? ', More open' : ''}) → Description → ${SIZE_BTN.what} → Small, Tab, Enter → Large, Tab, 5.99, Enter`, detail: { id, listed: row.listed, photo: row.photo, variants: row.variants, description: row.description } });
}

// ===== 8. Move Iced Americano from Cold Beverage to Hot Beverage
if (want('t8-move')) {
  await startTask('t8-move', 'Iced Americano: Cold Beverage → Hot Beverage (ends in Hot Beverage only)');
  await search('Iced Americano'); await shot('search');
  await openIt('Cold Beverage', ids.icedAmericano, 'Iced Americano'); await shot('panel');
  await tap(dlg().locator('[data-section-picker]'), UI === 'before' ? 'Section (Basics)' : 'Change (Where & when)');
  const sheet = page.locator('[role=dialog][aria-label^="Move “Iced Americano”"]'); await sheet.waitFor(); await shot('picker');
  await tap(sheet.locator('[data-move-to="Hot Beverage"]'), 'Hot Beverage');
  await sheet.waitFor({ state: 'detached' });
  const w = await waitPublic((h) => { const s = sectionsOf(h); return (s[sec['Hot Beverage']] || []).includes(ids.icedAmericano) && !(s[sec['Cold Beverage']] || []).includes(ids.icedAmericano); });
  await shot('saved');
  const pl = await placementsOf(ids.icedAmericano);
  finish({ done: w.ok && JSON.stringify(pl) === '["Hot Beverage"]', endAt: w.at, path: `search "Iced Americano" → row → ${UI === 'before' ? 'Section' : 'Change'} → Hot Beverage`, detail: { placements: pl } });
}

// ===== 9. Hide the Milkshake section (not part of the editor: the same path in both runs)
if (want('t9-hide-section')) {
  await startTask('t9-hide-section', 'hide the Milkshake section');
  await choose(page.locator('select[aria-label="Jump to section"]'), 'Milkshake', 'Jump to section');
  await page.waitForFunction((id) => { const r = document.getElementById(`sec-${id}`)?.getBoundingClientRect(); return r && Math.abs(r.top - 160) < 40; }, sec['Milkshake'], { timeout: 5000 }).catch(() => null);
  await sleep(50); await shot('jumped');
  await tap(page.locator('input[role=switch][aria-label^="Milkshake: shown"]'), 'the Milkshake section switch');
  const w = await waitPublic((h) => !h.includes(`data-id="${sec['Milkshake']}"`));
  await shot('saved');
  const s = (await q('select listed from sections where id=$1', [sec['Milkshake']]))[0];
  finish({ done: w.ok && s.listed === false, endAt: w.at, path: 'Jump to section → Milkshake → the section\'s switch', detail: { listed: s.listed } });
}

// ===== 10. Hide an item from its editor (Mocha)
if (want('t10-hide-item')) {
  await startTask('t10-hide-item', 'Mocha: hide it from its editor');
  await search('Mocha'); await shot('search');
  await openIt('Hot Beverage', ids.mocha, 'Mocha'); await shot('panel');
  const sw = UI === 'before' ? dlg().locator('input[role=switch][aria-label="Shown. Tap to hide"]') : dlg().locator('[data-status] input[role=switch]');
  await tap(sw, UI === 'before' ? 'the Shown switch (Basics)' : 'the Shown switch (the status, top)');
  const w = await waitPublic((h) => !h.includes(`data-id="${ids.mocha}"`));
  await shot('saved');
  const row = await dbItem(ids.mocha);
  finish({ done: w.ok && row.listed === false, endAt: w.at, path: `search "Mocha" → row → the Shown switch (${UI === 'before' ? 'the last row of Basics' : 'the status at the top'})`, detail: { listed: row.listed } });
}

// ===== 11. See every section an item is in (Pumpkin Soup: Appetizer and the Seasonal section, shown as this season's menu)
if (want('t11-sections')) {
  await startTask('t11-sections', 'Pumpkin Soup: see every section it is in');
  const where = (await q(`select s.name->>'en' n, s.seasonal from item_sections x join sections s on s.id=x.section_id where x.item_id=$1 order by s.seasonal desc, s.position`, [ids.soup]));
  await search('Pumpkin Soup'); await shot('search');
  await openIt('Appetizer', ids.soup, 'Pumpkin Soup'); await shot('panel');
  let seen = [];
  if (UI === 'before') {
    // the Section row of Basics names the item's own sections only (the Seasonal one is left out); "Also show in…" lists them all, ticked
    T.notes.push(`Section row of Basics reads "${(await dlg().locator('[data-section-picker]').textContent())?.trim()}"`);
    await tap(dlg().locator('[data-section-picker]'), 'Section (Basics)');
    const sheet = page.locator('[role=dialog][aria-label^="Move “Pumpkin Soup”"]'); await sheet.waitFor();
    await tap(sheet.locator('summary'), 'Also show in another section…');
    const ticked = sheet.locator('label:has(input[type=checkbox]:checked)');
    for (let i = 0; i < await ticked.count(); i++) { const t = (await ticked.nth(i).textContent()).trim(); await see(ticked.nth(i), `ticked: ${t}`); seen.push(t.replace(/Hidden$/, '').trim()); }
    await shot('seen');
    seen = seen.map((n) => (n === 'Seasonal' ? 'Seasonal' : n));
  } else {
    const chips = dlg().locator('[data-where] [data-section-chip]');
    await see(dlg().locator('[data-where]'), 'the section chips (Where & when)');
    seen = await chips.allTextContents(); seen = seen.map((t) => t.trim());
    await shot('seen');
  }
  const wantNames = where.map((w) => (w.seasonal ? (UI === 'before' ? w.n : `${SEASON} Menu`) : w.n));
  const ok = JSON.stringify([...seen].sort()) === JSON.stringify([...wantNames].sort());
  finish({ done: ok, endAt: now(), path: UI === 'before' ? 'search "Pumpkin Soup" → row → Section → Also show in another section… (the ticked boxes)' : 'search "Pumpkin Soup" → row → (the chips under Where & when)', detail: { seen, placements: wantNames } });
}

// ===== 12. Duplicate an item (Latte, after tasks 2 and 3: two choice groups, its description, photo and allergen drafts); one Undo removes the copy
if (want('t12-duplicate')) {
  await startTask('t12-duplicate', 'Latte: duplicate it');
  if (UI === 'before') {
    T.notes.push('No Duplicate in this build');
    finish({ done: false, endAt: null, path: 'not in this build', detail: { notAvailable: true } });
  } else {
    const orig = (await q('select name, description, price, variants, add_ons, components, serves, photo, notes, drafts, fa_draft, seasons, listed from items where id=$1', [ids.latte]))[0];
    const origSec = (await placementsOf(ids.latte));
    await search('Latte'); await shot('search');
    await openIt('Hot Beverage', ids.latte, 'Latte'); await shot('panel');
    await tap(dlg().locator('button[aria-expanded="false"][data-group="other"]'), 'Other (collapsed)');
    await tap(dlg().getByRole('button', { name: 'Duplicate', exact: true }), 'Duplicate');
    const copyDlg = page.locator('[role=dialog][aria-label="Edit Latte (copy)"]'); await copyDlg.waitFor({ timeout: 8000 });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Name', null, { timeout: 3000 }).catch(() => null);
    const sel = await page.evaluate(() => { const a = document.activeElement; return { label: a?.getAttribute('aria-label'), value: a?.value, all: !!a && a.value?.length > 0 && a.selectionStart === 0 && a.selectionEnd === a.value.length }; });
    const at = now();
    await shot('copy-open');
    const copy = (await q(`select id, name, description, price, variants, add_ons, components, serves, photo, notes, drafts, fa_draft, seasons, listed from items where venue_id=$1 and name->>'en'='Latte (copy)'`, [VENUE]))[0];
    const copySec = copy ? await placementsOf(copy.id) : [];
    const same = (k) => JSON.stringify(copy?.[k]) === JSON.stringify(orig[k]);
    const fields = ['description', 'price', 'variants', 'add_ons', 'components', 'serves', 'photo', 'notes', 'drafts', 'seasons'];
    const diff = fields.filter((k) => !same(k));
    const pubHidden = !(await publicHtml()).includes(`data-id="${copy?.id}"`);
    const ok = !!copy && copy.listed === false && copy.name.en === 'Latte (copy)' && copy.name.fa === (orig.name.fa ? `${orig.name.fa} (کپی)` : null) && diff.length === 0 && JSON.stringify(copySec) === JSON.stringify(origSec) && pubHidden && sel.label === 'Name' && sel.all;
    const r = finish({ done: ok, endAt: at, path: 'search "Latte" → row → Other → Duplicate (the editor opens on the copy, its name selected)', detail: { copy: copy && { id: copy.id, name: copy.name, listed: copy.listed, sections: copySec }, original: { sections: origSec }, differing: diff, focus: sel, onPublicPage: !pubHidden } });
    // one Undo removes the copy (not counted in the task)
    const tu = now(); await page.locator('[role=status] button:has-text("Undo")').tap(); await page.locator('[role=status]:has-text("Undone")').waitFor({ timeout: 8000 }).catch(() => null);
    let gone = false; for (let i = 0; i < 50 && !gone; i++) { gone = !(await q('select 1 from items where id=$1', [copy?.id]))[0]; if (!gone) await sleep(100); }
    const panelClosed = (await page.locator('[role=dialog][aria-label="Edit Latte (copy)"]').count()) === 0;
    r.detail.undo = { gone, panelClosed, ms: now() - tu, originalUntouched: JSON.stringify((await q('select name, add_ons, listed from items where id=$1', [ids.latte]))[0]) === JSON.stringify({ name: orig.name, add_ons: orig.add_ons, listed: orig.listed }) };
    console.log(`  Undo: the copy gone from the database ${gone} (${r.detail.undo.ms} ms), its editor closed ${panelClosed}, the original untouched ${r.detail.undo.originalUntouched}`);
    if (!gone) r.done = false;
  }
}

await browser.close();
await db.end();
const out = { at: new Date().toISOString(), ui: UI, base, viewport: devices['iPhone 13'].viewport, commit: process.env.AUDIT_COMMIT || '?', pageErrors, results };
fs.writeFileSync(path.join(OUT, `audit-editor-${UI}-results${ONLY ? `-${ONLY.join('+')}` : ''}.json`), JSON.stringify(out, null, 2));
console.log('\n' + results.map((r) => r.line).join('\n'));
if (pageErrors.length) console.log('page errors:', pageErrors);
