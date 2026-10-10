#!/usr/bin/env node
// Touch targets in the admin on a phone (the PM, 2026-10-09): every interactive element is at least 44 × 44 CSS px to the finger (a
// smaller visual is fine when its tap area is padded to 44 × 44); the only exception is an inline text link inside a sentence.
// Measured on the iPhone 13 viewport (390 × 664) and on the iPhone SE at Safari's visible height (375 × 548), on every admin screen:
// the sign-in screens (venue picker, PIN, email and password), the Menu tab (with the venue and account menus, a section's menu, the
// add-item sheet, the item editor with More and Advanced open, the price being edited, the preview overlay and the Saved · Undo toast;
// the item editor again for an item with add-ons on Senso, and on Kebab Land's Menu tab for an item with sizes and one with combo
// parts, chosen from the database so their row buttons are on screen; the delete confirmation), the Style tab (the phone's bottom sheet: its
// default with the Layout group, a colour open, the Welcome group, the sheet at full height), the Details tab, Team and + Add venue.
// The tap area is measured the way a finger meets it: each element is scrolled into view; along the two lines through its centre its extent
// is its own box joined with its labels' boxes (a label taps its input) and its ::before/::after pads (an invisible pad counts), and that
// extent counts only if document.elementFromPoint at every whole pixel at least 1 px inside its edges lands on the element, on something
// inside it or on its label, so anything lying over it fails; otherwise the hits are counted from the centre outwards, pixel by pixel. The
// outermost pixel row is left out of the check because Chromium rounds a point to a whole pixel: a 44 px box at a fractional position (a
// menu at top 309.75) answers for 43 rows while its neighbour answers for 45 (run 2026-10-10T01-46-59Z; reproduced by hand). An element whose centre lands on something else is "covered" (behind a sheet or an
// overlay: not visible to the finger on that screen); it is listed, not failed, and measured on the screen where it is uncovered.
// An inline text link is an <a> laid out inline whose block holds other words; it is listed as exempt. Each element is measured once
// per viewport, on the first screen where it is visible (after a page load, what was measured already is marked seen). The drill changes
// one price for the toast and puts it back with Undo; a price not back fails the drill.
//   DRILL_ADMIN_PIN=… node scripts/touch-drill.mjs --base http://127.0.0.1:<port> --out reports/checks/<stamp>/touch [--jpeg]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/touch');
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const MIN = 44;
const transcript = [], results = [], measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// items whose editor shows rows with their own buttons (remove a size, an add-on, a combo part)
const db = await connectDb('touch-drill', (t) => log('db', t));
const pick = async (venue, col) => (await db.query(`select i.id from items i where i.venue_id = $1 and jsonb_array_length(coalesce(i.${col}, '[]'::jsonb)) > 0 and exists (select 1 from item_sections x where x.item_id = i.id) order by i.listed desc, i.id limit 1`, [venue])).rows[0]?.id ?? null;
const ITEMS = { addOns: await pick('senso', 'add_ons'), sizes: await pick('kebab-land', 'variants'), parts: await pick('kebab-land', 'components') };
await db.end();
log('setup', `items opened in the editor: add-ons ${ITEMS.addOns} (senso), sizes ${ITEMS.sizes} and combo parts ${ITEMS.parts} (kebab-land)`);
const browser = await chromium.launch();
const VIEWPORTS = [
  { id: 'iphone13', label: 'iPhone 13 (390 × 664)', device: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  { id: 'se', label: 'iPhone SE (375 × 548, Safari\'s visible height)', device: { ...devices['iPhone SE (3rd gen)'], viewport: { width: 375, height: 548 }, screen: { width: 375, height: 667 }, defaultBrowserType: 'chromium' } },
];

// In the page: every interactive element not measured yet on this page load, with its tap area.
const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=radio], [role=tab], [role=checkbox], [role=menuitem], [role=option], [tabindex]:not([tabindex="-1"])';
const MEASURE = ({ min, SEL }) => {
  window.__touch = window.__touch || { seen: new WeakSet(), ids: new WeakMap(), n: 0, load: Math.random().toString(36).slice(2, 8) };
  const T = window.__touch;
  const idOf = (el) => { if (!T.ids.has(el)) T.ids.set(el, `${T.load}:${++T.n}`); return T.ids.get(el); };
  const labelOf = (el) => (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('type') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const isBlock = (n) => !/^inline/.test(getComputedStyle(n).display);
  const inlineLink = (el) => {
    if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
    let b = el.parentElement; while (b && !isBlock(b)) b = b.parentElement;
    if (!b) return false;
    const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let other = '';
    for (let t = walk.nextNode(); t; t = walk.nextNode()) if (!t.parentElement.closest('a')) other += t.textContent;
    return /[A-Za-z؀-ۿ]{2,}/.test(other);
  };
  const describe = (n) => (n ? `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${n.getAttribute('aria-label') ? `[${n.getAttribute('aria-label').slice(0, 30)}]` : ''}${n.className && typeof n.className === 'string' ? `.${n.className.split(/\s+/).slice(0, 2).join('.')}` : ''}` : 'nothing');
  const rows = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (T.seen.has(el) || el.closest('[inert]')) continue;
    const closed = el.closest('details:not([open])'); if (closed && el.parentElement !== closed) continue; // inside a closed dropdown (Chromium still gives it boxes): measured once it opens
    const cs = getComputedStyle(el);
    const labels = el.labels ? [...el.labels].filter((l) => l.getClientRects().length) : [];
    const own = el.getClientRects().length > 0 && cs.visibility !== 'hidden';
    if (!own && !labels.length) continue; // not rendered on this screen
    const r0 = el.getBoundingClientRect();
    const tiny = r0.width <= 1 || r0.height <= 1; // visually hidden (sr-only): its label is what the finger meets
    if (tiny && !labels.length) continue;
    const targets = [...(own && !tiny ? [el] : []), ...labels];
    const area = (n) => { const r = n.getBoundingClientRect(); return r.width * r.height; };
    const target = targets.sort((a, b) => area(b) - area(a))[0];
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const r = target.getBoundingClientRect();
    const cx = Math.min(Math.max(Math.round(r.left + r.width / 2), 0), innerWidth - 1), cy = Math.min(Math.max(Math.round(r.top + r.height / 2), 0), innerHeight - 1); // whole pixels
    const hit = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const n = document.elementFromPoint(x, y); return !!n && (n === el || el.contains(n) || labels.some((l) => l === n || l.contains(n))); };
    const row = { id: idOf(el), tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || null, type: el.getAttribute('type') || null, label: labelOf(el), box: `${Math.round(r0.width)}×${Math.round(r0.height)}`, via: target === el ? null : 'label' };
    if (inlineLink(el)) { rows.push({ ...row, status: 'exempt', tapW: null, tapH: null }); T.seen.add(el); continue; }
    if (!hit(cx, cy)) { rows.push({ ...row, status: 'covered', coveredBy: describe(document.elementFromPoint(cx, cy)), tapW: null, tapH: null }); continue; }
    // whole pixels that still land on the element, counted from the centre outwards along one direction (capped at 80)
    const reach = (dx, dy) => { let k = 0; while (k < 80 && hit(cx + dx * (k + 1), cy + dy * (k + 1))) k++; return k; };
    const l = reach(-1, 0), rt = reach(1, 0), up = reach(0, -1), dn = reach(0, 1);
    // the extent along one line through the centre: the boxes of the element, its labels and its pads, merged; null when a whole pixel at
    // least 1 px inside it does not land on the element (something lies over it) or when the centre is outside them
    const padRects = (n) => ['::before', '::after'].map((pe) => {
      const cs = getComputedStyle(n, pe); if (!cs.content || cs.content === 'none' || cs.content === 'normal' || cs.position !== 'absolute') return null;
      const pw = parseFloat(cs.width), ph = parseFloat(cs.height); if (!(pw > 0 && ph > 0)) return null;
      const nr = n.getBoundingClientRect(), ns = getComputedStyle(n), m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : null;
      const left = nr.left + parseFloat(ns.borderLeftWidth) + parseFloat(cs.left) + (m ? m.m41 : 0), top = nr.top + parseFloat(ns.borderTopWidth) + parseFloat(cs.top) + (m ? m.m42 : 0);
      return { left, top, right: left + pw, bottom: top + ph };
    }).filter(Boolean);
    const boxes = [...(own && !tiny ? [el.getBoundingClientRect()] : []), ...labels.map((x) => x.getBoundingClientRect()), ...padRects(el)];
    const along = (vertical) => {
      const c = vertical ? cy : cx, o = vertical ? cx : cy;
      const iv = boxes.filter((b) => (vertical ? b.left <= o && o < b.right : b.top <= o && o < b.bottom)).map((b) => (vertical ? [b.top, b.bottom] : [b.left, b.right])).sort((x, y) => x[0] - y[0]);
      const merged = []; for (const [a0, z0] of iv) { const last = merged[merged.length - 1]; if (last && a0 <= last[1] + 0.01) last[1] = Math.max(last[1], z0); else merged.push([a0, z0]); }
      const span = merged.find(([a0, z0]) => a0 <= c && c < z0); if (!span) return null;
      const lo = Math.max(span[0], c - 80, 0), hi = Math.min(span[1], c + 81, vertical ? innerHeight : innerWidth);
      for (let q = Math.ceil(lo + 1); q <= Math.floor(hi - 1); q++) if (!(vertical ? hit(cx, q) : hit(q, cy))) return null;
      return Math.min(span[1] - span[0], 161);
    };
    const gw = along(false), gh = along(true);
    const w = Math.round((gw ?? l + rt + 1) * 10) / 10, h = Math.round((gh ?? up + dn + 1) * 10) / 10;
    // under 44: what the finger meets just past each edge, so a failure explains itself
    const past = w >= min - 0.01 && h >= min - 0.01 ? null : { left: describe(document.elementFromPoint(cx - l - 1, cy)), right: describe(document.elementFromPoint(cx + rt + 1, cy)), above: describe(document.elementFromPoint(cx, cy - up - 1)), below: describe(document.elementFromPoint(cx, cy + dn + 1)), rect: `${r.left.toFixed(2)},${r.top.toFixed(2)} ${r.width.toFixed(2)}×${r.height.toFixed(2)}` };
    rows.push({ ...row, tapW: w, tapH: h, measuredBy: gw != null && gh != null ? 'box' : 'hits', status: w >= min - 0.01 && h >= min - 0.01 ? 'ok' : 'UNDER', ...(past ? { past } : {}) });
    T.seen.add(el);
  }
  return rows;
};

const screens = []; // { viewport, screen, reached, error, rows }
async function shoot(page, name) { const f = `${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); return f; }
async function screen(vp, page, name, setup) {
  let reached = false, error = null, rows = [];
  try { await setup(); await sleep(250); rows = await page.evaluate(MEASURE, { min: MIN, SEL }); reached = true; } catch (e) { error = e.message.split('\n')[0]; }
  screens.push({ viewport: vp.id, screen: name, reached, error, rows });
  const under = rows.filter((x) => x.status === 'UNDER');
  log(`${vp.id} ${name}`, reached ? `${rows.filter((x) => x.status === 'ok' || x.status === 'UNDER').length} measured, ${under.length} under ${MIN}${under.length ? `: ${under.map((x) => `${x.tag} "${x.label}" ${x.tapW}×${x.tapH}`).join('; ')}` : ''}, ${rows.filter((x) => x.status === 'exempt').length} inline links, ${rows.filter((x) => x.status === 'covered').length} covered` : `NOT REACHED: ${error}`);
  if (reached && name.match(/^(menu|style|details|team|sign-in: PIN)$/)) await shoot(page, `${vp.id}-${name.replace(/\W+/g, '-')}`).catch(() => {});
}
// after a page load: everything on the page now was measured on this viewport's first load of it, so it is marked seen, not measured again
const markSeen = (page) => page.evaluate((SEL) => { window.__touch = window.__touch || { seen: new WeakSet(), ids: new WeakMap(), n: 0, load: Math.random().toString(36).slice(2, 8) }; for (const el of document.querySelectorAll(SEL)) window.__touch.seen.add(el); }, SEL);
const undone = []; // the toast's price change and its Undo, per viewport
const closeAll = async (page) => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); } await page.evaluate(() => document.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'))); };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext(vp.device); const p = await ctx.newPage();
  p.on('pageerror', (e) => log('pageerror', e.message));
  // sign-in screens (signed out)
  await screen(vp, p, 'sign-in: venue picker', async () => { await p.goto(`${base}/admin`); await p.waitForSelector('form, a[href^="/admin/"]'); });
  await screen(vp, p, 'sign-in: PIN', async () => { await p.goto(`${base}/admin/senso`); await p.waitForSelector('input[name=pin]'); });
  await screen(vp, p, 'sign-in: email and password', async () => { await p.goto(`${base}/admin/senso?mode=admin`); await p.waitForSelector('input[name=email]'); });
  await p.goto(`${base}/admin/senso`); await p.fill('input[name=pin]', pin); await p.click('button[type=submit]'); await p.waitForURL(`${base}/admin/senso`); await p.waitForSelector('[data-item]');
  // the Menu tab and what opens from it
  await screen(vp, p, 'menu', async () => { await p.evaluate(() => scrollTo(0, 0)); });
  await screen(vp, p, 'menu: venue menu open', async () => { await p.evaluate(() => scrollTo(0, 0)); await p.click('summary[aria-label="Switch venue"]'); await p.waitForSelector('details[open] a[href="/admin/new"], details[open] a[href^="/admin/"]'); });
  await closeAll(p);
  await screen(vp, p, 'menu: account menu open', async () => { await p.evaluate(() => scrollTo(0, 0)); await p.click('summary[aria-label="Account"]'); await p.waitForSelector('details[open] form[action="/api/admin/logout"]'); });
  await closeAll(p);
  await screen(vp, p, 'menu: section menu open', async () => { const b = p.locator('button[aria-label^="Section menu:"]').first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[role=menu]'); });
  await closeAll(p);
  await screen(vp, p, 'menu: add item sheet', async () => { const b = p.locator('button:has-text("Add item")').first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[role=dialog]'); });
  await closeAll(p); await p.waitForSelector('[role=dialog]', { state: 'detached', timeout: 3000 }).catch(() => {});
  const itemId = await p.getAttribute('[data-item]', 'data-item');
  await screen(vp, p, 'menu: price being edited', async () => { const b = p.locator(`[data-item="${itemId}"] [data-price]`); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector(`[data-item="${itemId}"] input[aria-label="Price"]`); });
  await p.keyboard.press('Escape'); await sleep(200);
  await screen(vp, p, 'menu: item editor', async () => { const b = p.locator(`[data-item="${itemId}"] button[aria-label^="Edit"]`); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('.item-panel'); });
  await screen(vp, p, 'menu: item editor, More and Advanced open', async () => {
    for (const t of ['More', 'Advanced']) { const b = p.locator(`.item-panel button[aria-expanded="false"]:has-text("${t}")`).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(200); } }
  });
  const done = async () => { if (await p.locator('.item-panel').count()) { await p.locator('.item-panel button:has-text("Done")').first().click(); await p.waitForSelector('.item-panel', { state: 'detached', timeout: 5000 }); } };
  await done();
  // the toast on this page load (everything else on it is measured already, so the toast is measured within its 10 s); Undo must put the price back
  let was = null;
  await screen(vp, p, 'menu: Saved · Undo toast', async () => {
    const b = p.locator(`[data-item="${itemId}"] [data-price]`); await b.scrollIntoViewIfNeeded(); was = (await b.textContent()).trim(); await b.click();
    const f = p.locator(`[data-item="${itemId}"] input[aria-label="Price"]`); const v = Number((await f.inputValue()) || '0'); await f.fill(String(Math.round((v + 0.25) * 100) / 100)); await f.press('Enter');
    await p.waitForSelector('[role=status]:has-text("Saved")');
  });
  { const t = Date.now(); await p.click('[role=status] button:has-text("Undo")', { timeout: 5000 }).catch(() => {}); await p.waitForSelector('[role=status]:has-text("Undone")', { timeout: 5000 }).catch(() => {});
    const back = (await p.locator(`[data-item="${itemId}"] [data-price]`).textContent().catch(() => '')).trim(); undone.push({ viewport: vp.id, was, back, ms: Date.now() - t }); log('toast', `${vp.id}: price ${was} changed for the toast, Undo → ${back}`); }
  await screen(vp, p, 'menu: preview open', async () => { await p.evaluate(() => scrollTo(0, 0)); await p.click('button:has-text("Preview")'); await p.waitForSelector('[data-preview-bar="phone"]'); });
  await p.goto(`${base}/admin/senso`); await p.waitForSelector('[data-item]'); await markSeen(p);
  const openItem = async (id) => {
    await done();
    const b = p.locator(`[data-item="${id}"] button[aria-label^="Edit"]`).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('.item-panel');
    for (const t of ['More', 'Advanced']) { const x = p.locator(`.item-panel button[aria-expanded="false"]:has-text("${t}")`).first(); if (await x.count()) { await x.scrollIntoViewIfNeeded(); await x.click(); await sleep(200); } }
  };
  await screen(vp, p, 'menu: item editor, an item with add-ons', async () => { await openItem(ITEMS.addOns); await p.waitForSelector('.item-panel button[aria-label^="Remove add-on"]'); });
  await done();
  await screen(vp, p, 'kebab-land menu', async () => { await p.goto(`${base}/admin/kebab-land`); await p.waitForSelector('[data-item]'); });
  await screen(vp, p, 'kebab-land: item editor, an item with sizes', async () => { await openItem(ITEMS.sizes); await p.waitForSelector('.item-panel button[aria-label^="Remove size"]'); });
  await screen(vp, p, 'kebab-land: item editor, an item with combo parts', async () => { await openItem(ITEMS.parts); await p.waitForSelector('.item-panel button[aria-label^="Remove part"]'); });
  await screen(vp, p, 'kebab-land: delete confirmation', async () => { const b = p.locator('.item-panel button:has-text("Delete")').first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[role=dialog][aria-label="Delete this item?"]'); });
  await p.goto(`${base}/admin/senso`); await p.waitForSelector('[data-item]'); await markSeen(p); // nothing was deleted: the confirmation is left by the page load
  // the Style tab (the phone layout: preview on top, controls in the bottom sheet)
  await screen(vp, p, 'style', async () => { await p.click('a[href="/admin/senso?tab=style"]'); await p.waitForSelector('[data-style-sheet]'); await p.waitForSelector('[data-style-group="tabs"]'); });
  await screen(vp, p, 'style: a colour open', async () => { await p.click('[data-style-group="tabs"] > button'); await p.waitForSelector('[data-style-token="tabs.bg"] input[type=color]'); });
  await screen(vp, p, 'style: Welcome group open', async () => { const b = p.locator('[data-style-group="welcome"] > button'); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[data-style-group="welcome"][data-open]'); });
  await screen(vp, p, 'style: sheet at full height', async () => {
    const g = p.locator('[data-style-group][data-open] > button').first(); if (await g.count()) { await g.click(); await sleep(250); } // no colour open, so the sheet may go full
    for (let i = 0; i < 3 && (await p.getAttribute('[data-style-sheet]', 'data-style-sheet')) !== 'full'; i++) { await p.click('[data-style-sheet-handle]'); await sleep(300); }
    if ((await p.getAttribute('[data-style-sheet]', 'data-style-sheet')) !== 'full') throw new Error('the sheet did not reach full');
  });
  await p.goto(`${base}/admin/senso?tab=details`);
  await screen(vp, p, 'details', async () => { await p.waitForSelector('[data-details-tab]'); });
  await screen(vp, p, 'team', async () => { await p.goto(`${base}/admin/team`); await p.waitForSelector('main'); });
  await screen(vp, p, '+ add venue', async () => { await p.goto(`${base}/admin/new`); await p.waitForSelector('main'); });
  await ctx.close();
}

// ---- results
const all = screens.flatMap((s) => s.rows.map((r) => ({ ...r, viewport: s.viewport, screen: s.screen })));
const lastStatus = new Map(); for (const r of all) lastStatus.set(`${r.viewport}|${r.id}`, r); // a covered element measured later counts as measured
const measured = all.filter((r) => r.status === 'ok' || r.status === 'UNDER');
const under = measured.filter((r) => r.status === 'UNDER');
const exempt = all.filter((r) => r.status === 'exempt');
const coveredOnly = [...lastStatus.values()].filter((r) => r.status === 'covered' && !measured.some((m) => m.viewport === r.viewport && m.id === r.id));
for (const vp of VIEWPORTS) {
  const m = measured.filter((r) => r.viewport === vp.id), u = under.filter((r) => r.viewport === vp.id);
  check(`touch-${vp.id}`, m.length > 0 && u.length === 0, `${vp.label}: ${m.length} interactive elements measured on ${screens.filter((s) => s.viewport === vp.id && s.reached).length} screens, ${u.length} with a tap area under ${MIN} × ${MIN}${u.length ? `: ${u.map((x) => `${x.screen}: ${x.tag}${x.role ? `[${x.role}]` : ''} "${x.label}" ${x.tapW}×${x.tapH} (box ${x.box}; at ${x.past?.rect}: above ${x.past?.above}, below ${x.past?.below}, left ${x.past?.left}, right ${x.past?.right})`).join('; ')}` : ''}; ${exempt.filter((r) => r.viewport === vp.id).length} inline text links exempt; ${coveredOnly.filter((r) => r.viewport === vp.id).length} covered on every screen they appeared on (listed)`);
  measure(`touch targets, ${vp.label}: ${m.length} measured, ${u.length} under ${MIN} × ${MIN}, smallest tap area ${m.length ? `${Math.min(...m.map((x) => x.tapW))} px wide, ${Math.min(...m.map((x) => x.tapH))} px tall` : '—'}; ${exempt.filter((r) => r.viewport === vp.id).length} inline links exempt`);
}
check('touch-toast-undo', undone.length === VIEWPORTS.length && undone.every((u) => u.was && u.back === u.was), `the price changed for the toast is back after Undo: ${undone.map((u) => `${u.viewport} ${u.was} → ${u.back}`).join('; ')}`);
const missing = screens.filter((s) => !s.reached);
check('touch-screens', missing.length === 0, `${screens.length - missing.length} of ${screens.length} screens reached (${VIEWPORTS.length} viewports × ${screens.length / VIEWPORTS.length})${missing.length ? `; not reached: ${missing.map((s) => `${s.viewport} ${s.screen} (${s.error})`).join('; ')}` : ''}`);
await browser.close();
const pass = results.every((r) => r.ok);
const line = (r) => `  ${r.status === 'UNDER' ? 'UNDER ' : r.status === 'ok' ? 'ok    ' : r.status === 'exempt' ? 'exempt' : 'covered'} ${r.tapW != null ? `${r.tapW}×${r.tapH}`.padEnd(9) : ''.padEnd(9)} ${r.tag}${r.role ? `[${r.role}]` : ''}${r.type && r.tag === 'input' ? `[${r.type}]` : ''} "${r.label}" (box ${r.box}${r.via ? ', tapped through its label' : ''}${r.coveredBy ? `, covered by ${r.coveredBy}` : ''}${r.past ? `; at ${r.past.rect}, just past its edges: above ${r.past.above}, below ${r.past.below}, left ${r.past.left}, right ${r.past.right}` : ''})`;
await fs.writeFile(path.join(out, 'touch-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), min: MIN, pass, results, measures, viewports: VIEWPORTS.map((v) => ({ id: v.id, label: v.label })), screens, transcript }, null, 2));
await fs.writeFile(path.join(out, 'touch-drill.txt'), [
  `Touch-target drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks): every visible interactive element of the admin on a phone, its tap area (hit-tested from its centre) against ${MIN} × ${MIN} CSS px; inline text links exempt.`, '',
  'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '',
  ...VIEWPORTS.flatMap((vp) => [`== ${vp.label}`, ...screens.filter((s) => s.viewport === vp.id).flatMap((s) => [`-- ${s.screen}${s.reached ? ` (${s.rows.length} new elements)` : ` NOT REACHED: ${s.error}`}`, ...s.rows.map(line)]), '']),
  'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n') + '\n');
console.log(`TOUCH DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
