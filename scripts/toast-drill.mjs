#!/usr/bin/env node
// The toast rule on every admin screen (the PM, 2026-11-19: "while a toast or its strip shows, no tappable control sits under it on any
// admin screen, including the Menu list and Details. Reserve the toast's height at the bottom of the scroll area while it shows"),
// measured by Playwright on a scratch server at 390 × 664 (the iPhone 13 viewport) and at 360 px (360 × 780):
//   with three toasts: the one-line "Hidden · Undo" of a save (it goes after 10 s, so it is made afresh for each screen it is read
//     on: 16 readings a phone); the red "Not saved. No connection…" of a save that did not go through, two lines on a phone, which
//     stays until it is closed (every screen below: 34 readings a phone); and the longest the admin has, "…, but the customers' page
//     did not update." with Try again and Undo, five lines on a phone, which also stays (one screen of each kind of strip and the
//     sheets, which must end under it: 16 readings a phone);
//   on every screen a toast can show on (the admin's list of screens, scripts/layout-rules.mjs adminScreens, and the states between):
//     the Menu tab at the row just changed, at its top, mid-way and at its end; the venue switcher and the account menu open; a
//     section's menu opened low on the screen; a section being reordered; the Add item, Add section, Rename and Delete section sheets;
//     the phone's full-screen preview; the item editor at its top and its end, its Goes well with card, and its sheets (the Goes well
//     with picker, the section picker, Delete item); the Details tab at its top, mid-way and at its end; the Style tab's sheet down, at
//     half and full, a colour open, each of the four dropdowns of the preview controls open, the Layout group;
//   what must hold at each (UNDER_TOAST in scripts/layout-rules.mjs: a tap tried at every second pixel of the toast and its strip):
//     no control under the toast or its strip; at the bottom of the screen the toast lies wholly in a strip that is drawn solid, 8 px
//     of it above the toast; with a sheet open the toast is at the top and the sheet starts at least 8 px under it;
//   and: the page does not move when the strip comes (the Menu and Details tabs are as tall with the one-line toast as without);
//     at the page's end every control can be brought above the strip; after a colour's save did not go through on the phone, the open
//     colour's swatches are still in view above the strip; the screens outside the page editor (the sign-in screens, Team, Add venue)
//     have no toast.
// On a laptop (1440 × 900 and 1280 × 800) the same is measured on the Menu, Details and Style tabs and in the item editor, with the
// one-line and the red toast, for information: the brief's sizes are the two phones, and on a laptop the toast stays centred in the
// window, so a long one reaches past the editor's column.
// The drill makes its own section and items on Senso through the admin API and removes them at the end; the tagline and the layout
// it changes are put back. Needs a scratch server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node scripts/toast-drill.mjs --base http://127.0.0.1:<port> --out reports/checks/<stamp>/toast [--jpeg]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from './load-env.mjs';
import { scratchTarget } from './scratch-target.mjs';
import { UNDER_TOAST } from './layout-rules.mjs';

// The target is a scratch server, or the drill stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('scripts/toast-drill.mjs', { options: { base: 'server', out: 'path', jpeg: 'flag' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const jpeg = process.argv.includes('--jpeg');
const base = args.base, VENUE = 'senso', out = path.resolve(args.out), pin = process.env.DRILL_ADMIN_PIN;
await fs.mkdir(out, { recursive: true });
const transcript = [], results = [], measures = [], seen = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok: !!ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('toast-drill', (t) => log('db', t));
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }).catch(() => {}); log('shot', f); };
async function signin(page) { await page.goto(`${base}/admin/${VENUE}`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${VENUE}`); await page.waitForSelector('[data-item]'); }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
let cookie = null;
async function api(p, body) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }

// ---- the drill's own section and items (removed at the end)
const SEC = 'Drill toast section', ITEMS = ['Drill toast item 1', 'Drill toast item 2', 'Drill toast item 3'];
const cleanup = async () => { await db.query(`delete from items where venue_id = $1 and name->>'en' = any($2)`, [VENUE, ITEMS]); await db.query(`delete from sections where venue_id = $1 and name->>'en' = $2`, [VENUE, SEC]); };
await cleanup();
const browser = await chromium.launch();
{ const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); await signin(p); cookie = await cookieOf(c); await c.close(); }
const taglineBefore = (await db.query(`select tagline->>'en' as t from venues where id = $1`, [VENUE])).rows[0]?.t ?? null;
const sec = (await api('/api/admin/section', { action: 'create', venue: VENUE, name: { en: SEC, fa: null } })).json?.section?.id;
const ids = [];
for (const [i, name] of ITEMS.entries()) ids.push((await api('/api/admin/item', { action: 'create', venue: VENUE, section_id: sec, name: { en: name, fa: null }, price: 3 + i })).json?.item?.id);
if (!sec || ids.some((x) => !x)) { console.error('TOAST DRILL: could not make its section and items'); await cleanup(); await db.end(); await browser.close(); process.exit(1); }
log('setup', `section "${SEC}" with ${ids.length} items on ${VENUE}`);
const other = (await db.query(`select id, name->>'en' as name from sections where venue_id = $1 and not seasonal and listed and name->>'en' <> $2 order by position limit 1 offset 2`, [VENUE, SEC])).rows[0];

// ---- measuring
// One reading of the rule on the screen as it is: the toast is waited for, the sheet's height (200 ms) and the toast's entrance left to end.
async function mark(page, view, kind, screen, { top = false, extra = null, shotName = null } = {}) {
  await page.waitForSelector('.toast', { timeout: 6000 }).catch(() => {});
  await sleep(420);
  const m = await page.evaluate(UNDER_TOAST);
  const card = top ? await page.evaluate(() => { const c = document.querySelector('[data-sheet-card]'); return c ? Math.round(c.getBoundingClientRect().top) : null; }) : null;
  const more = extra ? await extra() : {};
  seen.push({ view, kind, screen, top, m, card, ...more });
  if (shotName) await snap(page, shotName);
}
const TOP_MAX = 60; // with a sheet open the toast starts 12 px from the top edge (more on a phone with a notch)
const fine = (s) => {
  const m = s.m; if (!m.toast || m.under.length) return false;
  if (s.top) return m.sheet && !m.zone && m.toast.top <= TOP_MAX && s.card !== null && s.card >= m.toast.bottom + 8;
  return !m.sheet && !!m.zone && m.zone.solid && m.bare === 0 && m.zone.top <= m.toast.top - 8 && m.zone.bottom >= m.toast.bottom && (s.lowest === undefined || s.lowest <= m.zone.top);
};
const say = (s) => { const m = s.m; return `${s.screen}: ${!m.toast ? 'NO TOAST' : `toast ${m.toast.top}–${m.toast.bottom} px`}${s.top ? `, the sheet from ${s.card} px` : `, strip ${m.zone ? `${m.zone.top}–${m.zone.bottom} px${m.zone.solid ? '' : ' NOT SOLID'}` : 'MISSING'}`}${m.bare && !s.top ? `, ${m.bare} of the toast's points over no strip` : ''}${s.lowest !== undefined ? `, the lowest control ends at ${s.lowest} px` : ''}${m.under.length ? `, UNDER IT: ${m.under.slice(0, 3).join('; ')}` : ''}`; };

// ---- moving about (the strip hides what scrolls behind it, so a control is brought to the middle of the screen before it is tapped)
const mid = async (page, sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(120); };
const tap = async (page, sel) => { await mid(page, sel); await page.locator(sel).first().click({ timeout: 6000 }); };
const scrollPage = async (page, where) => { await page.evaluate((w) => { const max = document.documentElement.scrollHeight - innerHeight; scrollTo(0, w === 'top' ? 0 : w === 'end' ? max : Math.round(max / 2)); }, where); await sleep(200); };
const escape = async (page) => { await page.keyboard.press('Escape'); await sleep(250); };
const ROW = `li[data-item="${ids[1]}"]`, SWITCH = `${ROW} input[role=switch]`;
const toastText = (page) => page.evaluate(() => document.querySelector('.toast')?.innerText.replace(/\s+/g, ' ').trim() ?? null);
const noToast = async (page) => { for (let i = 0; i < 3 && await page.locator('.toast').count(); i++) { const x = page.locator('.toast button[aria-label="Close"]'); if (await x.count()) await x.click().catch(() => {}); else await page.waitForSelector('.toast', { state: 'detached', timeout: 12000 }).catch(() => {}); await sleep(150); } };
// the lowest control of the tab's own column, once the page is at its end (the top bar and the tab row are above; the toast is not counted)
const lowest = (page) => page.evaluate(() => {
  const col = document.querySelector('.toast-band')?.parentElement; if (!col) return { lowest: null };
  const CONTROL = 'a[href], button, input, textarea, select, summary, label, [role=button], [role=switch], [role=radio]';
  let low = 0; for (const c of col.querySelectorAll(CONTROL)) { if (c.closest('.toast, [data-toast-zone]')) continue; const r = c.getBoundingClientRect(); if (r.width > 0 && r.height > 0) low = Math.max(low, r.bottom); }
  return { lowest: Math.round(low) };
});
// The toasts. kind 'saved': a real save, the one-line toast, gone after 10 s. 'red': the request is cut, so the save does not go through;
// the toast stays until it is closed. 'long': the save goes through and the customers' page is reported as not regenerated (the suite's
// test seam); the toast stays.
async function toggle(page, kind, sel = SWITCH, url = '**/api/admin/item') {
  if (kind === 'red') await page.route(url, (r) => r.abort());
  if (kind === 'long') await page.route(url, (r) => r.continue({ headers: { ...r.request().headers(), 'x-roses-test': 'unpublished' } }));
  await tap(page, sel);
  await page.waitForSelector('.toast', { timeout: 8000 });
  await page.waitForFunction((k) => { const t = document.querySelector('.toast')?.innerText ?? ''; return k === 'red' ? /Not saved/.test(t) : k === 'long' ? /did not update/.test(t) : /Hidden|Shown|Saved/.test(t); }, kind, { timeout: 8000 }).catch(() => {});
  if (kind !== 'saved') await page.unroute(url);
  await sleep(150);
}
const menuTab = async (page) => { const l = page.locator('a[aria-current], a').filter({ hasText: /^Menu$/ }).first(); await l.click(); await page.waitForSelector('[data-item]'); await sleep(200); };
const openTab = async (page, name) => { await page.locator('a').filter({ hasText: new RegExp(`^${name}$`) }).first().click(); await sleep(350); };
const sheetTo = async (page, detent) => { for (let i = 0; i < 4 && (await page.getAttribute('[data-style-sheet]', 'data-style-sheet')) !== detent; i++) { await page.click('[data-style-sheet-handle]', { position: { x: 20, y: 10 } }); await sleep(450); } return (await page.getAttribute('[data-style-sheet]', 'data-style-sheet')) === detent; };
const panelScroll = (page, where) => page.evaluate((w) => { const p = document.querySelector('.item-panel'); const s = p && [...p.querySelectorAll('*')].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1); if (s) s.scrollTop = w === 'end' ? s.scrollHeight : 0; }, where);

// The tour with a toast that stays, the toast up throughout. The red toast: every screen in turn. The longest toast (short: true): one
// screen of each kind of strip (the page's band, the item editor's, the preview's, the Style sheet's in its three places) and the
// sheets, which must end under it; the screens between differ from those only in what scrolls behind the strip.
async function tour(page, v, kind, short = false) {
  const at = (screen, o) => mark(page, v.id, kind, screen, o).catch((e) => { seen.push({ view: v.id, kind, screen, top: !!o?.top, m: { toast: null, under: [], zone: null, bare: 0, sheet: false }, error: e.message.split('\n')[0] }); });
  const step = async (name, fn) => { try { await fn(); } catch (e) { seen.push({ view: v.id, kind, screen: name, top: false, m: { toast: null, under: [], zone: null, bare: 0, sheet: false }, error: `not reached: ${e.message.split('\n')[0].slice(0, 140)}` }); await escape(page).catch(() => {}); } };
  await step('Menu', async () => {
    await at('Menu, at the row just changed', { shotName: kind === 'red' && v.shots ? `menu-${kind}-${v.key}` : null });
    if (!short) { await scrollPage(page, 'top'); await at('Menu, at its top'); }
    await scrollPage(page, 'mid'); await at('Menu, mid-way');
    await scrollPage(page, 'end'); await at('Menu, at its end', { extra: () => lowest(page) });
  });
  if (!short) await step('the venue switcher open', async () => { await scrollPage(page, 'top'); await page.click('summary[aria-label="Switch venue"]'); await page.waitForSelector('details[open] a[href="/admin/new"]'); await at('the venue switcher open'); await page.click('summary[aria-label="Switch venue"]'); });
  if (!short) await step('the account menu open', async () => { await page.click('summary[aria-label="Account"]'); await page.waitForSelector('details[open] form[action="/api/admin/logout"]'); await at('the account menu open'); await page.click('summary[aria-label="Account"]'); });
  if (!short) await step('a section\'s menu, opened low on the screen', async () => {
    const b = `button[aria-label="Section menu: ${other.name}"]`;
    await page.locator(b).evaluate((el) => { const r = el.getBoundingClientRect(); scrollBy(0, r.bottom - (innerHeight - 170)); }); await sleep(200); // its button 170 px above the screen's bottom edge: the menu under it reaches the strip
    await page.locator(b).click(); await page.waitForSelector('[role=menu]');
    await at('a section\'s menu, opened low on the screen', { shotName: kind === 'red' && v.shots ? `section-menu-${v.key}` : null }); await escape(page);
  });
  if (!short) await step('a section being reordered', async () => {
    await tap(page, `button[aria-label="Section menu: ${SEC}"]`); await page.waitForSelector('[role=menu]'); await page.click('[role=menu] button:has-text("Reorder items")'); await page.waitForSelector(`[data-reorder="${sec}"]`);
    await at('a section being reordered'); await tap(page, '[data-reorder-done]');
  });
  for (const [name, open, title] of [
    ['the Add item sheet', async () => { await tap(page, `[aria-label="Add item to ${SEC}"]`); }, null],
    ['the Add section sheet', async () => { await tap(page, 'button:has-text("Add section")'); }, 'Add section'],
    ['the Rename section sheet', async () => { await tap(page, `button[aria-label="Section menu: ${SEC}"]`); await page.click('[role=menu] button:has-text("Rename")'); }, 'Rename section'],
    ['the Delete section sheet', async () => { await tap(page, `button[aria-label="Section menu: ${SEC}"]`); await page.click('[role=menu] button:has-text("Delete section")'); }, 'Delete this section?'],
  ]) if (!short || !title) await step(name, async () => { await open(); await page.waitForSelector(title ? `[role=dialog][aria-label="${title}"]` : '[data-sheet]'); await at(name, { top: true, shotName: name === 'the Add item sheet' && kind === 'long' && v.shots ? `sheet-long-${v.key}` : null }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 }); });
  await step('the full-screen preview', async () => {
    await scrollPage(page, 'top'); await page.locator('button:has-text("Preview")').first().click(); await page.waitForSelector('[data-preview-area] iframe'); await sleep(500);
    await at('the full-screen preview', { shotName: kind === 'red' && v.shots ? `preview-${v.key}` : null }); await page.locator('button:has-text("Edit")').first().click(); await sleep(250);
  });
  await step('the item editor', async () => {
    await tap(page, `${ROW} button[aria-label^="Edit "]`); await page.waitForSelector('.item-panel');
    await panelScroll(page, 'top'); await sleep(150); await at('the item editor, at its top');
    await panelScroll(page, 'end'); await sleep(150); await at('the item editor, at its end');
    if (!short) { await page.locator('.item-panel [data-pairs]').evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(150); await at('the item editor, its Goes well with card'); }
    await page.locator('.item-panel [data-pairs-add]').evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(120);
    await page.click('.item-panel [data-pairs-add]'); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"] [data-pair-pick]'); await at('the Goes well with picker', { top: true, shotName: kind === 'long' && v.shots ? `picker-long-${v.key}` : null }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 });
    await page.locator('.item-panel [data-where] button').first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(120); await page.locator('.item-panel [data-where] button').first().click(); await page.waitForSelector('[data-sheet]'); await at('the section picker', { top: true }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 });
    if (!short) { await page.locator('.item-panel button:has-text("Delete item")').evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(120); await page.click('.item-panel button:has-text("Delete item")'); await page.waitForSelector('[data-sheet]'); await at('the Delete item sheet', { top: true }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 }); }
    await page.click('.item-panel [data-back]'); await page.waitForSelector('.item-panel', { state: 'detached', timeout: 4000 });
  });
  await step('Details', async () => {
    await openTab(page, 'Details'); await page.waitForSelector('[data-details-tab]');
    await scrollPage(page, 'top'); await at('Details, at its top');
    if (!short) { await scrollPage(page, 'mid'); await at('Details, mid-way'); }
    await scrollPage(page, 'end'); await at('Details, at its end', { extra: () => lowest(page) });
  });
  await step('Style', async () => {
    await scrollPage(page, 'top'); await openTab(page, 'Style'); await page.waitForSelector('[data-style-sheet]'); await sleep(400);
    for (const d of ['half', 'full', 'collapsed']) { if (!await sheetTo(page, d)) throw new Error(`the sheet did not reach ${d}`); await at(`Style, the sheet ${d === 'collapsed' ? 'down' : `at ${d}`}`, { shotName: kind === 'red' && v.shots ? `style-${d}-${v.key}` : null }); }
    for (const k of short ? ['season'] : ['screen', 'lang', 'season', 'slot']) { await page.click(`[data-preview-pick="${k}"]`); await page.waitForSelector(`[data-preview-menu="${k}"] [role=menuitemradio]`); await at(`Style, the sheet down, the ${k} dropdown open`); await escape(page); }
    await sheetTo(page, 'half');
    for (const k of short ? ['screen'] : ['screen', 'slot']) { await page.locator(`[data-preview-pick="${k}"]`).evaluate((el) => el.scrollIntoView({ inline: 'center', block: 'nearest' })); await sleep(120); await page.click(`[data-preview-pick="${k}"]`); await page.waitForSelector(`[data-preview-menu="${k}"] [role=menuitemradio]`); await at(`Style, the sheet at half, the ${k} dropdown open`, { shotName: k === 'screen' && kind === 'red' && v.shots ? `style-dropdown-${v.key}` : null }); await escape(page); }
    if (!short) {
      await page.click('[data-style-group="tabs"] > button'); await page.waitForSelector('[data-style-token="tabs.bg"] [data-style-swatches]'); await sleep(450); await at('Style, a colour open');
      await page.click('[data-style-group="tabs"] > button'); await sleep(300); await sheetTo(page, 'full');
      await page.locator('[data-style-group="layout"]').evaluate((el) => el.scrollIntoView({ block: 'start' })); await sleep(200); await at('Style, the Layout group');
    }
    await sheetTo(page, 'half'); await page.locator('[data-style-phone] a').filter({ hasText: /^Menu$/ }).click(); await page.waitForSelector('[data-item]'); await sleep(250);
  });
}

// The one-line toast of a real save goes after 10 s: it is made afresh for each screen (the drill's own row hidden or shown again,
// the tagline, the layout of the drill's own section), and the screen is read while it shows.
async function quick(page, v) {
  const kind = 'saved';
  const at = (screen, o) => mark(page, v.id, kind, screen, o);
  // A new save takes the old toast's place at once. A toast just made is known by its Undo, which does not answer for its first 600 ms
  // (the words can be the same as the last one's: "Saved" twice).
  const made = async () => { await page.waitForSelector('.toast [data-undo]:disabled', { timeout: 8000 }); await sleep(150); };
  const next = async (sel) => { await tap(page, sel); await made(); };
  const fresh = () => next(SWITCH);
  const step = async (name, fn) => { try { await fn(); } catch (e) { seen.push({ view: v.id, kind, screen: name, top: false, m: { toast: null, under: [], zone: null, bare: 0, sheet: false }, error: `not reached: ${e.message.split('\n')[0].slice(0, 140)}` }); await escape(page).catch(() => {}); } };
  await step('Menu', async () => {
    await fresh(); await at('Menu, at the row just changed', { extra: async () => ({ row: await page.locator(ROW).evaluate((el) => Math.round(el.getBoundingClientRect().bottom)) }), shotName: v.shots ? `menu-saved-${v.key}` : null });
    await fresh(); await scrollPage(page, 'mid'); await at('Menu, mid-way');
    await fresh(); await scrollPage(page, 'end'); await at('Menu, at its end', { extra: () => lowest(page) });
  });
  await step('a section\'s menu, opened low on the screen', async () => {
    await fresh(); const b = `button[aria-label="Section menu: ${other.name}"]`;
    await page.locator(b).evaluate((el) => { const r = el.getBoundingClientRect(); scrollBy(0, r.bottom - (innerHeight - 150)); }); await sleep(200);
    await page.locator(b).click(); await page.waitForSelector('[role=menu]'); await at('a section\'s menu, opened low on the screen'); await escape(page);
  });
  await step('the Add item sheet', async () => { await fresh(); await tap(page, `[aria-label="Add item to ${SEC}"]`); await page.waitForSelector('[data-sheet]'); await at('the Add item sheet', { top: true }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 }); });
  await step('the full-screen preview', async () => { await fresh(); await scrollPage(page, 'top'); await page.locator('button:has-text("Preview")').first().click(); await page.waitForSelector('[data-preview-area] iframe'); await at('the full-screen preview'); await page.locator('button:has-text("Edit")').first().click(); await sleep(250); });
  await step('the item editor', async () => {
    await tap(page, `${ROW} button[aria-label^="Edit "]`); await page.waitForSelector('.item-panel');
    const sw = '.item-panel [data-status] input[role=switch]';
    await next(sw); await at('the item editor, at its top');
    await next(sw); await panelScroll(page, 'end'); await sleep(150); await at('the item editor, at its end');
    await page.locator('.item-panel [data-pairs-add]').evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(120);
    await page.click('.item-panel [data-pairs-add]'); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"] [data-pair-pick]'); await at('the Goes well with picker', { top: true }); await escape(page); await page.waitForSelector('[data-sheet]', { state: 'detached', timeout: 4000 });
    await page.click('.item-panel [data-back]'); await page.waitForSelector('.item-panel', { state: 'detached', timeout: 4000 });
  });
  await step('Details', async () => {
    await noToast(page); await openTab(page, 'Details'); await page.waitForSelector('[data-details-tab]'); // without a toast, for the page's height before one
    const f = '[data-details-tab] input[aria-label="Tagline"]';
    const tall0 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.fill(f, 'Drill toast tagline'); await page.press(f, 'Enter'); await made();
    await at('Details, at its top', { extra: async () => ({ pageBefore: tall0, pageWith: await page.evaluate(() => document.documentElement.scrollHeight) }) });
    await scrollPage(page, 'end'); await at('Details, at its end', { extra: () => lowest(page) });
    await scrollPage(page, 'top'); await page.fill(f, taglineBefore ?? ''); await page.press(f, 'Enter'); await made(); await at('Details, the tagline put back');
  });
  await step('Style', async () => {
    await scrollPage(page, 'top'); await openTab(page, 'Style'); await page.waitForSelector('[data-style-sheet]'); await sleep(400);
    if (!await sheetTo(page, 'full')) throw new Error('the sheet did not reach full');
    const li = `[data-section-layout="${sec}"]`, grid = `${li} button:has-text("Grid")`, list = `${li} button:has-text("List")`;
    await page.locator(li).evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(150);
    await page.click(grid); await made(); await at('Style, the sheet at full', { shotName: v.shots ? `style-full-saved-${v.key}` : null });
    await sheetTo(page, 'collapsed'); await at('Style, the sheet down', { shotName: v.shots ? `style-down-saved-${v.key}` : null });
    await sheetTo(page, 'half'); await at('Style, the sheet at half');
    await sheetTo(page, 'full'); await page.locator(li).evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(150); await page.click(list); await made(); await at('Style, the layout put back');
    await sheetTo(page, 'half'); await page.locator('[data-style-phone] a').filter({ hasText: /^Menu$/ }).click(); await page.waitForSelector('[data-item]'); await sleep(250);
  });
}

const VIEWS = [
  { id: '390 × 664', key: '390', shots: true, ctx: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  { id: '360 px (360 × 780)', key: '360', shots: true, ctx: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
];
const moved = [], swatches = [];
for (const v of VIEWS) {
  const ctx = await browser.newContext(v.ctx); const page = await ctx.newPage(); await signin(page);
  const bringRow = async () => { await page.goto(`${base}/admin/${VENUE}`); await page.waitForSelector(ROW); await mid(page, ROW); };
  // the page as tall with the one-line toast as without it (the strip takes no room)
  await bringRow(); const tall0 = await page.evaluate(() => document.documentElement.scrollHeight);
  await toggle(page, 'saved'); await sleep(300); const tall1 = await page.evaluate(() => document.documentElement.scrollHeight);
  moved.push({ view: v.id, tab: 'Menu', before: tall0, with: tall1 });
  log('saved', `${v.id}: “${await toastText(page)}”`);
  await quick(page, v);
  for (const kind of ['red', 'long']) {
    await noToast(page); await bringRow(); await toggle(page, kind);
    log(kind, `${v.id}: “${await toastText(page)}”`);
    await tour(page, v, kind, kind === 'long');
    await noToast(page);
  }
  // a colour's save that does not go through, on the phone: the strip comes under the sheet's body and the open colour's swatches stay in view
  try {
    await page.goto(`${base}/admin/${VENUE}?tab=style`); await page.waitForSelector('[data-style-sheet]'); await sleep(400);
    await page.click('[data-style-group="sheet"] > button'); await sleep(300);
    const tok = '[data-style-token="sheet.hero"]';
    if (!await page.locator(`${tok} [data-style-swatches]`).count()) { await page.locator(`${tok} button`).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.locator(`${tok} button`).first().click(); }
    await page.waitForSelector(`${tok} [data-style-swatches]`); await sleep(500);
    const place = () => page.evaluate((tok) => { const s = document.querySelector(`${tok} [data-style-swatches]`).getBoundingClientRect(), b = document.querySelector('[data-style-sheet-body]').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(s.bottom), body: [Math.round(b.top), Math.round(b.bottom)] }; }, tok);
    const before = await place();
    await page.route('**/api/admin/style', (r) => r.abort());
    const sw = page.locator(`${tok} [data-style-swatches] button`); const n = await sw.count(); let tapped = false;
    for (let i = n - 1; i >= 0 && !tapped; i--) { await sw.nth(i).click(); tapped = await page.waitForSelector('.toast', { timeout: 2500 }).then(() => true).catch(() => false); }
    await page.unroute('**/api/admin/style'); await sleep(700);
    const after = await place(); const m = await page.evaluate(UNDER_TOAST);
    swatches.push({ view: v.id, before, after, toast: m.toast, zone: m.zone, under: m.under, bare: m.bare, tapped });
    seen.push({ view: v.id, kind: 'red', screen: 'Style, a colour\'s save did not go through', top: false, m });
    await snap(page, `style-colour-red-${v.key}`);
  } catch (e) { swatches.push({ view: v.id, error: e.message.split('\n')[0] }); }
  await ctx.close();
}

// ---- the screens outside the page editor: no toast, no strip
const none = [];
{
  const ctx = await browser.newContext(VIEWS[0].ctx); const page = await ctx.newPage();
  for (const [name, url, sel] of [['Sign-in: venue picker', '/admin', 'input[name=pin]'], ['Sign-in: PIN', `/admin/${VENUE}`, 'input[name=pin]'], ['Sign-in: email and password', `/admin/${VENUE}?mode=admin`, 'input[name=email]']]) {
    await page.goto(base + url); await page.waitForSelector(sel); none.push({ name, toast: await page.locator('.toast, [data-toast-zone]').count() });
  }
  await signin(page);
  for (const [name, url, sel] of [['Team', '/admin/team', 'input[name=name]'], ['Add venue', '/admin/new', 'input[aria-label="Venue name"]']]) {
    await page.goto(base + url); await page.waitForSelector(sel); none.push({ name, toast: await page.locator('.toast, [data-toast-zone]').count() });
  }
  await ctx.close();
}

// ---- a laptop, for information: 1440 and 1280 px wide, the one-line toast and the red one
const laptop = [];
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); await signin(page);
  const read = async (screen) => { await page.waitForSelector('.toast', { timeout: 6000 }).catch(() => {}); await sleep(400); laptop.push({ view: `${w} × ${h}`, screen, m: await page.evaluate(UNDER_TOAST) }); };
  try {
    await mid(page, ROW); await page.locator(SWITCH).click(); await page.waitForSelector('.toast'); await read('Menu, the one-line toast');
    await page.locator(`${ROW} button[aria-label^="Edit "]`).click(); await page.waitForSelector('.item-panel'); await read('the item editor, the one-line toast');
    await page.click('.item-panel [data-back]'); await sleep(250);
    await page.route('**/api/admin/item', (r) => r.abort()); await page.locator(SWITCH).click(); await page.waitForFunction(() => /Not saved/.test(document.querySelector('.toast')?.innerText ?? '')); await page.unroute('**/api/admin/item');
    await read('Menu, the red toast'); if (w === 1440) await snap(page, 'laptop-menu-red');
    await page.locator(`${ROW} button[aria-label^="Edit "]`).click(); await page.waitForSelector('.item-panel'); await read('the item editor, the red toast');
    await page.click('.item-panel [data-back]'); await sleep(250);
    await openTab(page, 'Details'); await page.waitForSelector('[data-details-tab]'); await read('Details, the red toast');
    await openTab(page, 'Style'); await page.waitForSelector('[data-style-tab]'); await read('Style, the red toast');
    await page.locator('.toast button[aria-label="Close"]').click().catch(() => {});
    // the row shown again, as the drill found it
    await openTab(page, 'Menu'); await page.waitForSelector(ROW); await sleep(200);
    if (!(await page.locator(SWITCH).isChecked())) { await mid(page, ROW); await page.locator(SWITCH).click(); await sleep(400); }
  } catch (e) { laptop.push({ view: `${w} × ${h}`, screen: 'not reached', error: e.message.split('\n')[0] }); }
  await ctx.close();
}

// ---- judged
for (const v of VIEWS) {
  const mine = seen.filter((s) => s.view === v.id), bad = mine.filter((s) => s.error || !fine(s));
  const kinds = ['saved', 'red', 'long'].map((k) => `${mine.filter((s) => s.kind === k).length} with the ${k === 'saved' ? 'one-line toast of a save' : k === 'red' ? 'red toast of a save that did not go through' : 'longest toast (the customers\' page not updated)'}`);
  const heights = ['saved', 'red', 'long'].map((k) => { const hs = [...new Set(mine.filter((s) => s.kind === k && s.m.toast).map((s) => s.m.toast.bottom - s.m.toast.top))]; return `${k} ${hs.join('/')} px`; }).join(', ');
  const n = (k) => mine.filter((s) => s.kind === k).length;
  check(`toast-rule-${v.key}`, n('saved') >= 16 && n('red') >= 34 && n('long') >= 16 && bad.length === 0, `${v.id}: ${mine.length} readings on every screen a toast can show on (${kinds.join(', ')}; toast heights: ${heights}): no tappable control under the toast or its strip; at the bottom the toast wholly in a solid strip with 8 px above it, with a sheet open at the top with the sheet at least 8 px under it. ${bad.length ? `${bad.length} NOT MET: ${bad.slice(0, 6).map((s) => `[${s.kind}] ${s.error ? `${s.screen}: ${s.error}` : say(s)}`).join(' | ')}` : `e.g. ${mine.filter((s) => ['Menu, mid-way', 'the Add item sheet', 'Style, the sheet down', 'Details, at its end'].includes(s.screen) && s.kind === 'red').map(say).join(' | ')}`}`);
}
const rows = seen.filter((s) => s.row !== undefined);
check('toast-row-above-strip', rows.length === VIEWS.length && rows.every((s) => s.m.zone && s.row <= s.m.zone.top), `the Menu row just changed ends above the strip: ${rows.map((s) => `${s.view}: the row ends at ${s.row} px, the strip starts at ${s.m.zone?.top} px`).join('; ')}`);
const detailsMoved = seen.filter((s) => s.pageBefore !== undefined).map((s) => ({ view: s.view, tab: 'Details', before: s.pageBefore, with: s.pageWith }));
const allMoved = [...moved, ...detailsMoved];
check('toast-page-not-moved', allMoved.length === VIEWS.length * 2 && allMoved.every((x) => x.before === x.with), `the strip takes no room in the page (its height with the one-line toast up and without): ${allMoved.map((x) => `${x.view} ${x.tab} ${x.before} → ${x.with} px`).join('; ')}`);
const ends = seen.filter((s) => s.lowest !== undefined);
check('toast-end-of-page-clear', ends.length >= VIEWS.length * 6 && ends.every((s) => s.lowest !== null && s.m.zone && s.lowest <= s.m.zone.top), `at the page's end every control is above the strip, whatever the toast's height (${ends.length} readings): ${ends.map((s) => `${s.view} [${s.kind}] ${s.screen.split(',')[0]}: the lowest control ends at ${s.lowest} px, the strip starts at ${s.m.zone?.top} px`).join('; ')}`);
// in view: wholly above the strip, or, where the body left above the strip is shorter than the swatches, from the body's top edge
const inView = (x) => x.after.top >= x.after.body[0] - 1 && (x.after.bottom <= x.zone.top || x.after.top <= x.after.body[0] + 7);
check('toast-swatches-in-view', swatches.length === VIEWS.length && swatches.every((x) => !x.error && x.tapped && x.zone && x.under.length === 0 && x.after.body[1] <= x.zone.top + 1 && inView(x)), `a colour's save that does not go through on the phone (the Style sheet at half): the sheet's body ends at the strip and the open colour's swatches stay in view in it (wholly, or from the body's top edge where it is shorter than they are): ${swatches.map((x) => x.error ? `${x.view}: ${x.error}` : `${x.view}: swatches ${x.before.top}–${x.before.bottom} px before, ${x.after.top}–${x.after.bottom} px with the toast (the body ${x.after.body[0]}–${x.after.body[1]} px, the strip from ${x.zone?.top} px)`).join('; ')}`);
check('toast-none-elsewhere', none.length === 5 && none.every((x) => x.toast === 0), `the screens outside the page editor have no toast and no strip: ${none.map((x) => `${x.name} ${x.toast}`).join(', ')}`);
for (const x of laptop) measure(`laptop ${x.view}, information only: ${x.error ? `${x.screen}: ${x.error}` : `${x.screen}: toast ${x.m.toast ? `${x.m.toast.left}–${x.m.toast.right} px across` : 'none'}, its strip ${x.m.zone ? `${x.m.zone.left}–${x.m.zone.right} px across` : 'none'}, ${x.m.bare} of the toast's ${x.m.toast ? Math.round((x.m.toast.right - x.m.toast.left) * (x.m.toast.bottom - x.m.toast.top) / 4) : 0} points over no strip; under the toast or a strip: ${x.m.under.length ? x.m.under.slice(0, 3).join('; ') : 'no control'}`}`);

// ---- clean-up: the drill's own rows gone, the tagline as it was
await cleanup();
const tagNow = (await db.query(`select tagline->>'en' as t from venues where id = $1`, [VENUE])).rows[0]?.t ?? null;
check('toast-drill-clean', tagNow === taglineBefore && (await db.query(`select count(*) from sections where venue_id = $1 and name->>'en' = $2`, [VENUE, SEC])).rows[0].count === '0', `the drill's section and items removed, the tagline as before (${JSON.stringify(taglineBefore)})`);
await api('/api/admin/publish', { venue: VENUE });
await browser.close(); await db.end();

const failed = results.filter((r) => !r.ok);
const lines = [`Toast drill — ${new Date().toISOString()} — ${base}`, '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.step}: ${r.text}`), '', ...measures.map((m) => `MEASURE  ${m}`), '', 'Every reading:', ...seen.map((s) => `  ${fine(s) && !s.error ? 'ok  ' : 'MISS'} ${s.view} [${s.kind}] ${s.error ? `${s.screen}: ${s.error}` : say(s)}`), ''];
await fs.writeFile(path.join(out, 'toast-drill.txt'), lines.join('\n'));
await fs.writeFile(path.join(out, 'toast-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), results, measures, seen, moved: allMoved, swatches, none, laptop }, null, 1));
console.log(`TOAST DRILL ${failed.length ? 'FAIL' : 'PASS'} (${results.length - failed.length}/${results.length})${failed.length ? `: ${failed.map((r) => r.step).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
