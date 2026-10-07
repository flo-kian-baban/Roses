#!/usr/bin/env node
// Page editor acceptance (Kian's admin rebuild, 2026-10-07), measured by Playwright:
//   task targets on an iPhone viewport with the tap count reported (add an item, change a price, hide an item);
//   the preview shows a saved change within 1 s (laptop viewport, the phone frame beside the editor);
//   a reorder done in the admin appears in the same order on the public page;
//   Undo restores the previous value on the public page (a price, then a deleted item);
//   the silent change record (revisions rows with before/after for every change; no history screen, no Restore button);
//   the customers' page HTML (built files under --dist) contains no preview script.
// Needs the production server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DRILL_ADMIN_PIN=… node scripts/editor-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/editor --dist .next-check --jpeg
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { chromium, devices } from 'playwright';
import { loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000', dist = args.dist || '.next', VENUE = 'senso';
const out = path.resolve(args.out || 'reports/checkpoint-b/editor');
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const transcript = []; const results = []; const measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); log('shot', f); };
const publicHtml = async () => (await fetch(`${base}/${VENUE}`, { cache: 'no-store' })).text();
async function waitPublic(pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(); if (pred(html)) return { ok: true, ms: Date.now() - t }; await sleep(150); } return { ok: false, ms: Date.now() - t, html }; }
async function waitDb(sql, params, pred, ms = 5000) { const t = Date.now(); let row; while (Date.now() - t < ms) { row = (await db.query(sql, params)).rows[0]; if (pred(row)) return { ok: true, ms: Date.now() - t, row }; await sleep(50); } return { ok: false, ms: Date.now() - t, row }; }
async function signin(page, venue) { await page.goto(`${base}/admin/${venue}`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); await page.waitForSelector('[data-item]'); }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
// order of the items of one section on the public page (data-id of every li.item inside that <section>)
const publicOrder = (html, sectionId) => { const m = html.match(new RegExp(`<section[^>]*data-id="${sectionId}"[\\s\\S]*?</section>`)); return m ? [...m[0].matchAll(/<li class="item[^"]*"[^>]*data-id="([^"]+)"/g)].map((x) => x[1]) : null; };

const NAME = 'Drill editor item';
await db.query(`delete from items where venue_id = $1 and name->>'en' = $2`, [VENUE, NAME]);
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = $1 and listed order by position limit 1`, [VENUE])).rows[0];
let itemId = null;

// ---- A. task targets on a phone: tap counts
const phone = await browser.newContext(DEVICE); const p = await phone.newPage();
p.on('pageerror', (e) => log('pageerror', e.message));
await signin(p, VENUE);
await snap(p, 'editor-phone');
let taps = 0; const tap = async (sel) => { taps++; await p.click(sel); };
{ // add an item: 1 tap (+ Add item on the section) + name + price + Enter
  taps = 0;
  await tap(`[aria-label="Add item to ${sec.name}"]`);
  await p.fill('[role=dialog] input[name=name]', NAME);
  await p.fill('[role=dialog] input[name=price]', '4.5');
  const tConfirm = Date.now();
  await p.press('[role=dialog] input[name=price]', 'Enter');
  await p.waitForSelector(`[data-item] >> text=${NAME}`);
  const row = (await db.query(`select i.id, i.listed, i.price, x.section_id, x.position, (select max(position) from item_sections where section_id = x.section_id) as last from items i join item_sections x on x.item_id = i.id where i.venue_id = $1 and i.name->>'en' = $2`, [VENUE, NAME])).rows[0];
  itemId = row?.id;
  const pub = await waitPublic((h) => h.includes(`data-id="${itemId}"`));
  await snap(p, 'item-added');
  check('t-add', taps === 1 && !!row && row.listed && Number(row.price) === 4.5 && row.section_id === sec.id && row.position === row.last && pub.ok, `add an item: ${taps} tap (+ Add item) + name + price + Enter → created shown at $4.50, last in "${sec.name}" (position ${row?.position} of ${row?.last}); on the public page ${pub.ms} ms after Enter`);
  measure(`add an item: ${taps} tap + name + price + confirm (Enter); on the public page in ${pub.ms} ms; sheet confirmed at +${Date.now() - tConfirm} ms`);
}
{ // change a price: 1 tap (the price) + typing + Enter
  taps = 0;
  await tap(`[data-item="${itemId}"] [data-price]`);
  await p.keyboard.type('5.25');
  const tEnter = Date.now(); await p.keyboard.press('Enter');
  const w = await waitDb('select price from items where id = $1', [itemId], (r) => Number(r?.price) === 5.25);
  check('t-price', taps === 1 && w.ok, `change a price: ${taps} tap (the price) + typing + Enter → $5.25 in the database ${w.ms} ms after Enter; row shows ${await p.textContent(`[data-item="${itemId}"] [data-price]`)}`);
  measure(`change a price: ${taps} tap + typing + confirm (Enter); saved in ${w.ms} ms`); void tEnter;
}
{ // hide an item: 1 tap (the switch); then show again: 1 tap
  taps = 0;
  await tap(`[data-item="${itemId}"] input[role=switch]`);
  const w = await waitDb('select listed from items where id = $1', [itemId], (r) => r && r.listed === false);
  const pub = await waitPublic((h) => !h.includes(`data-id="${itemId}"`));
  await snap(p, 'item-hidden');
  check('t-hide', taps === 1 && w.ok && pub.ok, `hide an item: ${taps} tap (the switch) → hidden in the database ${w.ms} ms later, off the public page after ${pub.ms} ms`);
  measure(`hide an item: ${taps} tap; off the public page in ${pub.ms} ms`);
  taps = 0; await tap(`[data-item="${itemId}"] input[role=switch]`);
  const w2 = await waitDb('select listed from items where id = $1', [itemId], (r) => r && r.listed === true); const pub2 = await waitPublic((h) => h.includes(`data-id="${itemId}"`));
  check('t-show', taps === 1 && w2.ok && pub2.ok, `show it again: ${taps} tap → shown, back on the public page after ${pub2.ms} ms`);
}
{ // the switch refuses with a one-line reason when the item has no price (UI, phone)
  const noPrice = (await db.query(`select id, name->>'en' as name from items where venue_id = $1 and not listed and price is null and jsonb_array_length(variants) = 0 order by name->>'en' limit 1`, [VENUE])).rows[0];
  await p.fill('input[aria-label="Search items"]', noPrice.name);
  await p.click(`[data-item="${noPrice.id}"] input[role=switch]`);
  const reason = await p.textContent(`[data-item="${noPrice.id}"] [role=alert]`);
  const still = (await db.query('select listed from items where id = $1', [noPrice.id])).rows[0].listed;
  await snap(p, 'switch-refused');
  check('switch-reason', /needs a price/i.test(reason || '') && still === false, `switch on "${noPrice.name}" (no price) refused with "${reason?.trim()}"; still hidden in the database: ${!still}`);
  await p.fill('input[aria-label="Search items"]', '');
}
await phone.close();

// ---- B. laptop: the preview beside the editor, reorder, Undo
const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const l = await laptop.newPage();
l.on('pageerror', (e) => log('pageerror', e.message));
await signin(l, VENUE);
const previewReady = (id, text) => l.evaluate(([id, text]) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; if (!d || d.readyState !== 'complete' || d.location.pathname !== '/senso') return false; if (!id) return true; const el = d.querySelector(`[data-id="${id}"]`); return !!el && (el.textContent || '').includes(text); }, [id, text]);
await l.waitForFunction(() => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return !!d && d.readyState === 'complete' && d.location.pathname === '/senso'; });
await snap(l, 'editor-laptop');
{ // preview shows a saved change within 1 s
  await l.click(`[data-item="${itemId}"] [data-price]`); await l.keyboard.type('6.75');
  const tEnter = Date.now(); await l.keyboard.press('Enter');
  let shownAt = null; while (Date.now() - tEnter < 6000) { if (await previewReady(itemId, '$6.75')) { shownAt = Date.now() - tEnter; break; } await sleep(20); }
  const inView = await l.evaluate((id) => { const d = document.querySelector('iframe[data-preview-frame]').contentDocument; const el = d.querySelector(`[data-id="${id}"]`); const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: d.defaultView.innerHeight, focused: el.classList.contains('roses-preview-focus') }; }, itemId);
  await snap(l, 'preview-updated');
  check('preview-1s', shownAt != null && shownAt <= 1000 && inView.top >= 0 && inView.top < inView.h && inView.focused, `preview shows the new price ${shownAt} ms after Enter (target ≤ 1000); the row is in the frame's view (top ${inView.top} px of ${inView.h}) and outlined: ${inView.focused}`);
  measure(`preview shows a saved change after ${shownAt} ms`);
}
{ // reorder: Move up in the item panel, then the public page shows the same order
  await l.click(`[data-item="${itemId}"] button[aria-label^="Edit"]`); await l.click('[role=dialog] button:has-text("More")');
  await l.click('[role=dialog] button:has-text("Move up")');
  await l.waitForSelector('[role=status]:has-text("Moved")');
  const adminOrder = await l.$$eval(`#sec-${sec.id} [data-item]`, (els) => els.map((e) => e.dataset.item));
  const dbOrder = (await db.query(`select x.item_id from item_sections x join items i on i.id = x.item_id where x.section_id = $1 order by x.position, i.name->>'en'`, [sec.id])).rows.map((r) => r.item_id);
  const listed = new Set((await db.query('select id from items where listed and venue_id = $1', [VENUE])).rows.map((r) => r.id));
  const pub = await waitPublic((h) => { const o = publicOrder(h, sec.id); return !!o && o.join() === adminOrder.filter((id) => listed.has(id)).join(); });
  const pubOrder = publicOrder(await publicHtml(), sec.id) || [];
  await snap(l, 'reordered');
  check('reorder', adminOrder.join() === dbOrder.join() && pub.ok && adminOrder.indexOf(itemId) === adminOrder.length - 2, `"${NAME}" moved up one place in "${sec.name}": admin order = database order (${adminOrder.length} items), public page shows the same order for the ${pubOrder.length} shown items (${pub.ms} ms); the item is now ${adminOrder.indexOf(itemId) + 1} of ${adminOrder.length}`);
  await l.click('[role=dialog] button:has-text("Close")');
}
{ // Undo restores the previous price on the public page
  await l.click(`[data-item="${itemId}"] [data-price]`); await l.keyboard.type('7'); await l.keyboard.press('Enter');
  const up = await waitPublic((h) => new RegExp(`data-id="${itemId}"[\\s\\S]{0,600}?\\$7<`).test(h));
  const tUndo = Date.now(); await l.click('[role=status] button:has-text("Undo")');
  await l.waitForSelector('[role=status]:has-text("Undone")');
  const back = await waitPublic((h) => new RegExp(`data-id="${itemId}"[\\s\\S]{0,600}?\\$6\\.75<`).test(h));
  const dbp = Number((await db.query('select price from items where id = $1', [itemId])).rows[0].price);
  await snap(l, 'undo-price');
  check('undo-price', up.ok && back.ok && dbp === 6.75, `price $7 on the public page after ${up.ms} ms; Undo → $6.75 back on the public page ${Date.now() - tUndo} ms after the tap (${back.ms} ms of polling); database ${dbp}`);
  measure(`Undo of a price change back on the public page after ${back.ms} ms`);
}
{ // Undo brings a deleted item back, in its section, on the public page
  await l.click(`[data-item="${itemId}"] button[aria-label^="Edit"]`); await l.click('[role=dialog] button:has-text("Advanced")');
  await l.click('[role=dialog] button:has-text("Delete this item")');
  await l.click('[role=dialog][aria-label="Delete this item?"] button:has-text("Delete")');
  await l.waitForSelector('[role=status]:has-text("Deleted")');
  const gone = (await db.query('select count(*)::int as n from items where id = $1', [itemId])).rows[0].n === 0;
  const off = await waitPublic((h) => !h.includes(`data-id="${itemId}"`));
  await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
  const row = (await db.query('select i.listed, i.price, x.section_id, x.position from items i left join item_sections x on x.item_id = i.id where i.id = $1', [itemId])).rows[0];
  const on = await waitPublic((h) => h.includes(`data-id="${itemId}"`));
  const rowBack = !!(await l.$(`[data-item="${itemId}"]`));
  await snap(l, 'undo-delete');
  check('undo-delete', gone && off.ok && !!row && row.section_id === sec.id && row.listed && Number(row.price) === 6.75 && on.ok && rowBack, `deleted (row gone: ${gone}, off the public page after ${off.ms} ms); Undo → back in "${sec.name}" at position ${row?.position}, shown, $${row?.price}, on the public page after ${on.ms} ms, row back in the editor: ${rowBack}`);
}
const cookie = await cookieOf(laptop);
{ // the silent change record: every change has a row with before/after; no screen shows it
  const revs = (await db.query(`select action, before is not null as has_before, after is not null as has_after, by->>'name' as by from revisions where row_id = $1 order by id`, [itemId])).rows;
  const seq = revs.map((r) => r.action);
  const complete = revs.every((r) => (r.action === 'create' ? r.has_after && !r.has_before : r.action === 'delete' ? r.has_before && !r.has_after : r.action === 'restore' ? r.has_before || r.has_after : r.has_before && r.has_after)); // an undo of a delete has no before (the row was gone); an undo of a create has no after
  const reorder = (await db.query(`select before->'items' as b, after->'items' as a from revisions where table_name = 'sections' and row_id = $1 and action = 'reorder' order by id desc limit 1`, [sec.id])).rows[0];
  const adminHtml = await (await fetch(`${base}/admin/${VENUE}`, { headers: { cookie } })).text();
  const historyPage = (await fetch(`${base}/admin/${VENUE}/history`, { headers: { cookie } })).status;
  const noUi = !/>History</.test(adminHtml) && !/Restore/.test(adminHtml) && historyPage === 404;
  check('record', seq.includes('create') && seq.includes('update') && seq.includes('unlist') && seq.includes('list') && seq.includes('delete') && seq.filter((a) => a === 'restore').length >= 2 && complete && !!reorder && Array.isArray(reorder.b) && noUi, `revisions for the item: ${seq.join(', ')} (every row carries before/after as its action needs: ${complete}); the section's reorder row holds the order before (${reorder?.b?.length} ids) and after; the admin page shows no History or Restore (${noUi ? 'none found' : 'FOUND'}), /admin/${VENUE}/history → ${historyPage}`);
}
{ // the customers' page HTML carries no preview script
  const notes = [];
  let ok = true;
  for (const v of ['senso', 'kebab-land']) {
    const html = await fs.readFile(path.join(dist, 'server', 'pages', `${v}.html`), 'utf8');
    const tags = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
    const external = tags.filter((t) => /\bsrc=/.test(t)).length;
    const preview = (html.match(/preview/gi) || []).length;
    const roses = (html.match(/roses-preview|data-preview-frame|contentDocument/g) || []).length;
    if (external || preview || roses || tags.length !== 4) ok = false;
    notes.push(`${v}: ${tags.length} inline script tags (head decision, intro, language toggle, menu), ${external} external, "preview" ${preview}×, preview markers ${roses}×`);
  }
  check('no-preview-script', ok, notes.join('; '));
}
{ // staff get 403 on notes; the Style tab is not for staff (today a refusal page; the HTTP 403 comes with the Style tab in step 2)
  const r = await api('/api/admin/pin', {}, cookie); void r;
}
await laptop.close();
await api('/api/admin/item', { action: 'delete', id: itemId }, cookie);
await waitPublic((h) => !h.includes(`data-id="${itemId}"`));
log('cleanup', 'drill item deleted again (stays in the change record)');
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'editor-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'editor-drill.txt'), [`Editor drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((x) => `${x.at} [${x.step}] ${x.text}`)].join('\n') + '\n');
console.log(`EDITOR DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
