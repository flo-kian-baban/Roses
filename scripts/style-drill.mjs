#!/usr/bin/env node
// Style tab acceptance (Kian, 2026-10-08: colours grouped by page region, linked colours, readability guard), measured by Playwright:
//   day-one defaults: every colour variable the public pages serve equals the colour the code had before the tokens (the six
//     pure-black places now use the kit's ink, listed as the known difference);
//   task target on an iPhone viewport with the tap count: change the category bar background (Style tab, group, swatch);
//   the preview shows a saved colour within 1 s with "Saved · Undo"; the public page carries it; Undo restores it;
//   linked colours: a new row background re-derives its Auto text tokens, a Custom token stays as set; Reset group, then Undo;
//   the readability guard, in the UI and on the route: gold on cream refused (≈2.5:1) with a one-tap nearest fix, navy on cream
//     allowed (≈12:1), Kebab Land red on #141414 refused for body text (≈3.1:1) and allowed for a large heading;
//   the preview and the controls point at each other: a tap on a region opens its group, an open group outlines its region; the
//     Welcome group (Kian, 2026-10-09) shows the welcome screen live in the preview, its preview-only season switch changes the
//     frame's scene and saves nothing, and a colour saved in it shows on the overlay within 1 s;
//   the controls stay the master (Kian, 2026-10-08): after a tap in the preview, a colour saved in another group keeps that group
//     open through the save, the data reload and the preview reload (the regression of the "jump" bug); a tap on the open group's
//     region keeps the open colour;
//   section layout (Kian, 2026-10-08): a section switched to Grid in the Layout group renders two-column cards on the public page
//     (same item popup), the preview shows it, Undo puts the list back; staff cannot set it (the admin drill checks the 403);
//   Reset all colours with its confirmation, then Undo; the Persian view keeps the same colours.
//   2026-10-09, later (the preview control bar): every group switches the preview to its screen (Welcome, the item popup, the menu
//     scrolled to the region) with its region outlined; Compare (toggled on the laptop, held on the phone) shows the venue's default
//     colours in the preview; What changed lists exactly the custom tokens as default → current, and its per-colour reset goes through
//     the readability guard; the scroll position and the screen are kept through a colour save; Discard this session's changes puts
//     the snapshot taken when the tab opened back in one step (served variables compared) and Undo brings the discarded state back;
//     on the phone the Style tab is a bottom sheet under the live preview and keeps at least 45 % of the viewport for the preview
//     while a colour is being edited.
//   The PM's review of the batch (2026-10-09): the Style snapshot lasts the whole visit to the venue's editor (kept across tab switches
//     without a page load; Discard restores it and starts again from what it put back; a reload or leaving the venue starts it again);
//     the phone layout measured on a small phone too, the iPhone SE (375 px wide at Safari's visible height, 548 px, and 553 px with
//     the top address bar): the preview's share with a colour open (target ≥ 45 %), the room left to the controls, and the controls
//     at the same heights as on the iPhone 13 (never shrunk below their touch size).
// Needs the production server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DRILL_ADMIN_PIN=… node scripts/style-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/style --jpeg
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/checkpoint-b/style');
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const transcript = []; const results = []; const measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('style-drill', (t) => log('db', t));
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); log('shot', f); };
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t }; await sleep(120); } return { ok: false, ms: Date.now() - t, html }; }
async function waitDb(sql, params, pred, ms = 5000) { const t = Date.now(); let row; while (Date.now() - t < ms) { row = (await db.query(sql, params)).rows[0]; if (pred(row)) return { ok: true, ms: Date.now() - t, row }; await sleep(50); } return { ok: false, ms: Date.now() - t, row }; }
const colorsOf = async (venue) => (await db.query(`select coalesce(style->'colors', '{}'::jsonb) as c from venues where id = $1`, [venue])).rows[0].c;
async function signin(page, venue) { await page.goto(`${base}/admin/${venue}`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); await page.waitForSelector('[data-item]'); }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
// the colour variables as served: --c-rows-name:#1d1d1f …
const cssVar = (key) => `--c-${key.replace(/\./g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
// The Style tab's phone layout with a colour open: the preview's share of the viewport, the sheet's header and the room left to the
// controls, and the size of every control of the open colour (its row, Auto, the swatches, the custom picker, the hex field, Back to auto).
const sheetGeo = (page) => page.evaluate(() => {
  const f = document.querySelector('iframe[data-preview-frame]')?.getBoundingClientRect(), sh = document.querySelector('[data-style-sheet]'); if (!f || !sh) return null;
  const s = sh.getBoundingClientRect(), head = sh.firstElementChild.getBoundingClientRect(), body = sh.querySelector('[data-style-sheet-body]')?.getBoundingClientRect();
  const tok = document.querySelector('[data-style-token] > button[aria-expanded="true"]')?.parentElement;
  const controls = tok ? [...tok.querySelectorAll('button, input')].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { label: (e.getAttribute('aria-label') || e.textContent || e.type || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; }) : [];
  const visible = Math.min(f.bottom, s.top) - f.top;
  return { frameTop: Math.round(f.top), sheetTop: Math.round(s.top), visible: Math.round(visible), pct: Math.round((visible / innerHeight) * 1000) / 10, innerHeight, innerWidth, detent: sh.dataset.styleSheet, tokenOpen: !!tok, sheetH: Math.round(s.height), headH: Math.round(head.height), controlsH: body ? Math.round(body.height) : null, controls };
});
const varsOf = (html) => Object.fromEntries([...html.matchAll(/(--c-[a-z-]+):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const publicVar = (html, key) => varsOf(html)[cssVar(key)];
const layoutOf = (html, sectionId) => { const m = html.match(new RegExp(`<section[^>]*data-id="${sectionId}"[\\s\\S]*?</section>`)); return m ? (m[0].match(/<ul class="[^"]*"[^>]*data-layout="([^"]+)"/) || [])[1] ?? null : null; };
const styleJson = async (venue) => JSON.stringify((await db.query(`select style from venues where id = $1`, [venue])).rows[0].style);
// WCAG 2 contrast, the same maths as src/venues/tokens.ts
const lin = (x) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r1 = (n) => Math.round(n * 10) / 10;

// The look of the two brand pages before the tokens (recorded from the code at commit 8cffa11, the white kit of 2026-10-07).
const INK = '#1d1d1f', GREY = '#6b6b6b', LINE = '#e6e6e6', BAND = '#f3f3f3', WHITE = '#ffffff';
const KIT = { 'page.bg': WHITE, 'page.text': INK, 'page.band': BAND, 'header.bg': WHITE, 'header.langBg': '#f2f2f2', 'header.langText': INK, 'tabs.bg': WHITE, 'tabs.text': GREY, 'tabs.active': '#000000', 'tabs.indicator': '#000000', 'tabs.list': '#000000', 'tabs.line': LINE, 'headings.title': INK, 'headings.note': GREY, 'rows.bg': WHITE, 'rows.name': INK, 'rows.desc': GREY, 'rows.price': INK, 'rows.chipBg': BAND, 'rows.chipText': INK, 'rows.photo': BAND, 'rows.line': LINE, 'sheet.bg': WHITE, 'sheet.title': '#000000', 'sheet.price': '#000000', 'sheet.body': '#545454', 'sheet.muted': GREY, 'sheet.line': LINE, 'sheet.hero': BAND, 'sheet.closeBg': WHITE, 'sheet.closeIcon': '#000000', 'sheet.dim': '#000000', 'footer.bg': WHITE, 'footer.address': GREY, 'footer.hours': GREY };
const BEFORE = {
  senso: { ...KIT, 'footer.label': INK, 'footer.phone': '#042c7c' },
  'kebab-land': { ...KIT, 'header.tile': '#141414', 'footer.label': '#b92e2e', 'footer.address': INK, 'footer.phone': '#b92e2e' },
};
const KNOWN_DIFF = { 'tabs.active': INK, 'tabs.indicator': INK, 'tabs.list': INK, 'sheet.title': INK, 'sheet.price': INK, 'sheet.closeIcon': INK }; // pure black → the kit's ink (Page text)

// an API cookie from the PIN, and both venues' colours reset in case an earlier run stopped early
const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie.startsWith('roses_session=')) { console.error('PIN sign-in failed'); process.exit(1); }
for (const v of ['senso', 'kebab-land']) { const r = await api('/api/admin/style', { action: 'reset', venue: v }, cookie); log('setup', `reset ${v} → ${r.status}`); }
await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE); await waitPublic('kebab-land', (h) => publicVar(h, 'rows.bg') === WHITE);

// ---- 1. day-one defaults: the served variables equal the pre-token look (the six known differences aside)
for (const venue of ['senso', 'kebab-land']) {
  const html = await publicHtml(venue); const vars = varsOf(html);
  const expected = BEFORE[venue]; const same = [], diff = [], known = [], missing = [];
  for (const [k, v] of Object.entries(expected)) { const got = vars[cssVar(k)]; if (!got) missing.push(k); else if (got === v) same.push(k); else if (KNOWN_DIFF[k] === got) known.push(`${k} ${v}→${got}`); else diff.push(`${k} expected ${v} got ${got}`); }
  const extra = Object.keys(vars).filter((n) => !n.startsWith('--c-welcome-') && !Object.keys(expected).some((k) => cssVar(k) === n)); // the welcome screen's tokens (2026-10-09) are new and have no pre-token look; the welcome drill checks their defaults
  const g = await fetch(`${base}/api/admin/style?venue=${venue}`, { headers: { cookie } }); const j = await g.json().catch(() => null);
  const badLabels = (j?.tokens || []).filter((t) => !/^[A-Z“]/.test(t.label) || /[._-]{1}[a-z]/.test(t.label.replace(/-list/, '')) || t.label.includes('.'));
  check(`day-one-${venue}`, diff.length === 0 && missing.length === 0 && extra.length === 0 && known.length === 6 && j?.groups?.length === 8 && badLabels.length === 0, `${venue}: ${same.length} of ${Object.keys(expected).length} served colours equal the pre-token look; known differences (pure black → ink) ${known.length}: ${known.join(', ')}; unexpected ${diff.length}${diff.length ? ` (${diff.join('; ')})` : ''}; missing ${missing.length}; extra variables ${extra.length}; API: ${j?.groups?.length} groups, ${j?.tokens?.length} tokens with plain-words labels (${badLabels.length} not), palette of ${j?.palette?.length} venue colours, layout options ${(j?.layout || []).map((o) => o.key).join('+')}`);
  await fs.writeFile(path.join(out, `day-one-${venue}.json`), JSON.stringify({ venue, served: vars, expected, same, known, diff, missing, extra, api: j && { groups: j.groups, tokens: j.tokens, palette: j.palette, layout: j.layout } }, null, 2));
}

// ---- 2. phone: the task target with the tap count
let i13 = null; // the iPhone 13's sheet geometry with a colour open, compared with the small phone's below
{
  const phone = await browser.newContext(DEVICE); const p = await phone.newPage();
  p.on('pageerror', (e) => log('pageerror', e.message));
  await signin(p, 'senso');
  let taps = 0; const tap = async (sel) => { taps++; await p.click(sel); };
  await tap('a[href="/admin/senso?tab=style"]'); await p.waitForSelector('[data-style-group="tabs"]');
  await snap(p, 'style-phone');
  await tap('[data-style-group="tabs"] > button'); await p.waitForSelector('[data-style-token="tabs.bg"] input[type=color]');
  const firstOpen = await p.getAttribute('[data-style-token="tabs.bg"] > button', 'aria-expanded');
  const sw = p.locator('[data-style-token="tabs.bg"] button[aria-label^="Bar background: "]');
  let pick = null; for (let i = 0; i < await sw.count(); i++) { const lab = await sw.nth(i).getAttribute('aria-label'); const c = (lab.match(/#[0-9a-f]{6}/i) || [])[0]?.toLowerCase(); if (c && c !== WHITE) { pick = { i, c, lab }; break; } }
  await snap(p, 'style-phone-group');
  const tTap = Date.now(); await tap(`[data-style-token="tabs.bg"] button[aria-label="${pick.lab}"]`);
  const saved = await waitDb(`select style->'colors'->>'tabs.bg' as c from venues where id='senso'`, [], (r) => r?.c === pick.c);
  const pub = await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === pick.c);
  const toast = await p.waitForSelector('[role=status]:has-text("Saved")').then(() => true).catch(() => false);
  await snap(p, 'style-phone-saved');
  check('t-bar-bg', taps === 3 && firstOpen === 'true' && saved.ok && pub.ok && toast, `change the category bar background: ${taps} taps (Style tab, group, swatch "${pick.lab}"); the group opened with its first token ready (${firstOpen === 'true'}); saved ${saved.ms} ms after the tap, on the public page after ${pub.ms} ms (${Date.now() - tTap} ms after the tap); "Saved · Undo" shown: ${toast}`);
  measure(`change the category bar background: ${taps} taps (Style tab, group, swatch) + 0 extra; on the public page in ${pub.ms} ms`);
  { // the Style tab on a phone (Kian, 2026-10-09): the live preview on top, the controls in a bottom sheet; with a colour open the preview keeps ≥ 45 % of the viewport (the sheet offers collapsed and half only); Compare held on touch shows the default colours
    const geo = () => sheetGeo(p);
    const gEditing = await geo(); i13 = gEditing;
    await snap(p, 'style-phone-editing');
    await p.click('[data-style-sheet-handle]'); await sleep(350); const gTap = await geo();
    await snap(p, 'style-phone-collapsed');
    await p.click('[data-style-sheet-handle]'); await sleep(350); const gBack = await geo();
    const frameVarP = (n) => p.evaluate((n) => { const d = document.querySelector('iframe[data-preview-frame]')?.contentDocument; return d ? getComputedStyle(d.documentElement).getPropertyValue(n).trim() : null; }, n);
    const cmp = p.locator('[data-preview-compare]'); await cmp.scrollIntoViewIfNeeded();
    await cmp.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, isPrimary: true }); await sleep(150); const held = await frameVarP('--c-tabs-bg'); const heldPressed = await cmp.getAttribute('aria-pressed');
    await snap(p, 'style-phone-compare-held');
    await cmp.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, isPrimary: true }); await sleep(150); const released = await frameVarP('--c-tabs-bg');
    check('phone-style-layout', !!gEditing && gEditing.tokenOpen && gEditing.detent === 'half' && gEditing.pct >= 45 && gTap?.detent === 'collapsed' && gTap.pct > gEditing.pct && gBack?.detent === 'half' && gBack.pct >= 45 && held === WHITE && heldPressed === 'true' && released === pick.c, `Style tab on the iPhone 13 viewport: the preview on top (frame from ${gEditing?.frameTop} px), the controls in a bottom sheet at "${gEditing?.detent}" with the colour open: ${gEditing?.visible} of ${gEditing?.innerHeight} px of preview = ${gEditing?.pct} % (target ≥ 45); the handle while a colour is open: ${gTap?.detent} (${gTap?.pct} %), then ${gBack?.detent} (${gBack?.pct} %), never full; Compare held on touch → the bar background shows the venue default ${held} (pressed ${heldPressed}), released → ${released} (the saved colour)`);
    measure(`Style tab on a phone: with a colour open the preview keeps ${gEditing?.pct} % of the viewport (${gEditing?.visible} of ${gEditing?.innerHeight} px; target ≥ 45 %); Compare held → the default colours, released → the saved ones`);
  }
  await p.click('[role=status] button:has-text("Undo")'); await p.waitForSelector('[role=status]:has-text("Undone")');
  const back = await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === WHITE);
  const dbBack = (await colorsOf('senso'))['tabs.bg'] ?? null;
  check('t-bar-bg-undo', back.ok && dbBack === null, `Undo → the bar background is Auto again (venues.style.colors has no tabs.bg: ${dbBack === null}), ${WHITE} back on the public page after ${back.ms} ms`);
  // the custom picker: the same three taps, then choosing in the phone's picker (the drill hands the value to the input)
  taps = 2; // Style tab and the group are already open
  taps++; await p.fill('[data-style-token="tabs.bg"] input[type=color]', '#fff8ee');
  const saved2 = await waitDb(`select style->'colors'->>'tabs.bg' as c from venues where id='senso'`, [], (r) => r?.c === '#fff8ee');
  check('t-bar-bg-custom', saved2.ok, `custom colour: ${taps} taps (Style tab, group, Custom) + choosing in the picker → #fff8ee saved ${saved2.ms} ms after choosing`);
  measure(`change the category bar background with the custom picker: ${taps} taps + choosing; saved in ${saved2.ms} ms`);
  await p.click('[role=status] button:has-text("Undo")'); await p.waitForSelector('[role=status]:has-text("Undone")');
  await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === WHITE);
  await phone.close();
}
{ // a small phone (the PM, 2026-10-09): the iPhone SE (2nd/3rd gen), 375 px wide, at Safari's visible height: 548 px with iOS's bottom tab
  // bar (the 667 px screen less the 20 px status bar and 99 px of address bar and toolbar; the same convention as the iPhone 13 viewport's
  // 664 px), and 553 px with the top address bar. The same task state as above: the Style tab, the Category tabs group, its first colour open.
  const rows = [];
  for (const h of [548, 553]) {
    const ctx = await browser.newContext({ ...devices['iPhone SE (3rd gen)'], viewport: { width: 375, height: h }, screen: { width: 375, height: 667 }, defaultBrowserType: 'chromium' }); const p = await ctx.newPage();
    p.on('pageerror', (e) => log('pageerror', e.message));
    await signin(p, 'senso');
    await p.click('a[href="/admin/senso?tab=style"]'); await p.waitForSelector('[data-style-group="tabs"]');
    await p.click('[data-style-group="tabs"] > button'); await p.waitForSelector('[data-style-token="tabs.bg"] input[type=color]'); await sleep(400);
    const g = await sheetGeo(p); rows.push({ h, ...g });
    if (h === 548) await snap(p, 'style-phone-se');
    await ctx.close();
  }
  const se = rows[0], se2 = rows[1];
  // controls matched by name (the colour row, Auto, each swatch, the custom picker, the hex field; Back to auto shows only for a custom colour)
  const kind = (c) => c.label.replace(/^[^:]+: /, '').replace(/#[0-9a-f]{3,6}.*$/i, '').trim() || 'colour row';
  const i13h = Object.fromEntries((i13?.controls ?? []).map((c) => [kind(c), c.h]));
  const matched = se.controls.filter((c) => kind(c) in i13h);
  const sameHeights = matched.length >= 10 && matched.every((c) => c.h === i13h[kind(c)]);
  const sizes = (g) => [...new Set(g.controls.map((c) => `${kind(c)} ${c.w}×${c.h}`))].join(', ');
  check('phone-style-layout-se', se.tokenOpen && se.detent === 'half' && se.pct >= 45 && se2.pct >= 45 && sameHeights, `Style tab on the iPhone SE at Safari's visible height (${se.innerWidth} × ${se.innerHeight}) with a colour open: the preview ${se.visible} of ${se.innerHeight} px = ${se.pct} % (target ≥ 45; at ${se2.innerWidth} × ${se2.innerHeight}: ${se2.visible} px = ${se2.pct} %); the sheet at "${se.detent}" is ${se.sheetH} px: its header (handle and preview bar) ${se.headH} px, the controls ${se.controlsH} px, scrolling inside (iPhone 13: ${i13?.sheetH} px, header ${i13?.headH}, controls ${i13?.controlsH}); every control of the open colour at the same height as on the iPhone 13 (${sameHeights}, ${matched.length} compared): ${sizes(se)}`);
  measure(`Style tab on a small phone (iPhone SE, ${se.innerWidth} × ${se.innerHeight}, Safari's visible height): with a colour open the preview keeps ${se.pct} % of the viewport (${se.visible} of ${se.innerHeight} px; target ≥ 45 %; ${se2.pct} % at ${se2.innerHeight} px); the controls get ${se.controlsH} px of the sheet (${i13?.controlsH} px on the iPhone 13) at their full size`);
}

// ---- 3. laptop: the preview, linked colours, the guard, the regions, resets
const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const l = await laptop.newPage();
l.on('pageerror', (e) => log('pageerror', e.message));
await signin(l, 'senso');
await l.goto(`${base}/admin/senso?tab=style`); await l.waitForSelector('[data-style-group="rows"]');
const frameReady = () => l.waitForFunction(() => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return !!d && d.readyState === 'complete' && d.location.pathname === '/senso'; });
await frameReady();
const frameVar = (name) => l.evaluate((n) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; if (!d || d.readyState !== 'complete') return null; return getComputedStyle(d.documentElement).getPropertyValue(n).trim(); }, name);
const frameEval = (fn, arg) => l.evaluate(([src, a]) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return d ? (new Function('d', 'arg', `return (${src})(d, arg)`))(d, a) : null; }, [fn.toString(), arg]);
const openGroup = async (g) => { if ((await l.getAttribute(`[data-style-group="${g}"] > button`, 'aria-expanded')) !== 'true') await l.click(`[data-style-group="${g}"] > button`); await l.waitForSelector(`[data-style-group="${g}"][data-open]`); };
const openToken = async (key) => { if ((await l.getAttribute(`[data-style-token="${key}"] > button`, 'aria-expanded')) !== 'true') await l.click(`[data-style-token="${key}"] > button`); await l.waitForSelector(`[data-style-token="${key}"] input[aria-label$=": hex"]`); };
const setHex = async (key, value) => { await openToken(key); const sel = `[data-style-token="${key}"] input[aria-label$=": hex"]`; await l.fill(sel, value); await l.press(sel, 'Enter'); };
const tokenState = async (key) => ({ state: await l.getAttribute(`[data-style-token="${key}"]`, 'data-state'), value: (await l.textContent(`[data-style-token="${key}"] [data-style-value]`))?.trim().toLowerCase(), why: (await l.textContent(`[data-style-token="${key}"] [data-style-why]`))?.trim() });
await snap(l, 'style-laptop');
{ // the preview shows a saved colour within 1 s, with Saved · Undo; the public page carries it; Undo restores it
  await openGroup('rows');
  const tEnter = Date.now(); await setHex('rows.bg', '#fff8ee');
  let shownAt = null; while (Date.now() - tEnter < 6000) { if ((await frameVar('--c-rows-bg')) === '#fff8ee') { shownAt = Date.now() - tEnter; break; } await sleep(20); }
  const toast = await l.waitForSelector('[role=status]:has-text("Saved")').then(() => true).catch(() => false);
  const pub = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#fff8ee');
  const outlined = await frameEval((d) => !!d.querySelector('main section ul.roses-region'));
  await snap(l, 'preview-colour');
  check('preview-1s', shownAt != null && shownAt <= 1000 && toast && pub.ok && outlined, `row background #fff8ee shows in the preview ${shownAt} ms after Enter (target ≤ 1000); "Saved · Undo" shown: ${toast}; on the public page after ${pub.ms} ms; the item rows stay outlined in the preview: ${outlined}`);
  measure(`preview shows a saved colour after ${shownAt} ms`);
  await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
  const back = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE);
  await sleep(300); const st = await tokenState('rows.bg');
  check('preview-undo', back.ok && st.state === 'auto' && st.value === WHITE, `Undo → ${WHITE} back on the public page after ${back.ms} ms; the token reads "${st.why}" (${st.state}, ${st.value})`);
}
{ // linked colours: a dark row background re-derives the Auto text tokens; a Custom token stays as set; Reset group, then Undo
  await setHex('rows.bg', '#141414');
  const pub = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#141414' && publicVar(h, 'rows.name') === WHITE);
  const v = varsOf(await publicHtml('senso'));
  await sleep(300); const name = await tokenState('rows.name'), desc = await tokenState('rows.desc'), price = await tokenState('rows.price');
  await snap(l, 'linked-dark-rows');
  check('linked-auto', pub.ok && v['--c-rows-name'] === WHITE && v['--c-rows-desc'] === '#a1a1a6' && v['--c-rows-price'] === WHITE && v['--c-rows-line'] === '#353535' && name.state === 'auto' && desc.state === 'auto', `row background → #141414: item name ${v['--c-rows-name']} (${name.state}: "${name.why}"), description ${v['--c-rows-desc']} (${desc.state}), price ${v['--c-rows-price']} (${price.state}), line between rows ${v['--c-rows-line']} (a light shade of the dark background); on the public page after ${pub.ms} ms`);
  await setHex('rows.price', '#ffc14d');
  const pub2 = await waitPublic('senso', (h) => publicVar(h, 'rows.price') === '#ffc14d');
  await sleep(300); const price2 = await tokenState('rows.price');
  await setHex('rows.bg', '#2a2a2a');
  const pub3 = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#2a2a2a');
  const v3 = varsOf(await publicHtml('senso'));
  await sleep(300); const price3 = await tokenState('rows.price'), name3 = await tokenState('rows.name');
  await snap(l, 'linked-custom-stays');
  check('linked-custom', pub2.ok && price2.state === 'custom' && pub3.ok && v3['--c-rows-price'] === '#ffc14d' && price3.state === 'custom' && v3['--c-rows-name'] === WHITE && name3.state === 'auto' && v3['--c-rows-line'] === '#484848', `price set to #ffc14d (${price2.state}; on the public page after ${pub2.ms} ms); row background → #2a2a2a: price stays ${v3['--c-rows-price']} (${price3.state}), item name re-derived ${v3['--c-rows-name']} (${name3.state}), line ${v3['--c-rows-line']}; on the public page after ${pub3.ms} ms`);
  { // Compare (laptop: a toggle) shows the venue's default colours in the preview and the saved ones again; What changed lists exactly the custom tokens, default → current
    const pressedBar = () => l.getAttribute('[data-preview-compare]', 'aria-pressed');
    await l.click('[data-preview-compare]'); await sleep(250);
    const on = { bg: await frameVar('--c-rows-bg'), price: await frameVar('--c-rows-price'), pressed: await pressedBar() };
    await snap(l, 'compare-on');
    await l.click('[data-preview-compare]'); await sleep(250);
    const off = { bg: await frameVar('--c-rows-bg'), price: await frameVar('--c-rows-price'), pressed: await pressedBar() };
    const list = await l.$$eval('[data-style-changed]', (els) => els.map((e) => ({ key: e.dataset.styleChanged, def: e.dataset.default, cur: e.dataset.current })));
    const followed = (await l.textContent('[data-style-followed]').catch(() => '')) || '';
    const dbCustom = Object.keys(await colorsOf('senso')).sort();
    const bg = list.find((x) => x.key === 'rows.bg'), price = list.find((x) => x.key === 'rows.price');
    await snap(l, 'what-changed');
    check('compare-what-changed', on.bg === WHITE && on.price === INK && on.pressed === 'true' && off.bg === '#2a2a2a' && off.price === '#ffc14d' && off.pressed === 'false' && list.length === 2 && list.map((x) => x.key).sort().join() === dbCustom.join() && bg?.def === WHITE && bg?.cur === '#2a2a2a' && price?.def === INK && price?.cur === '#ffc14d' && /Item name/.test(followed), `Compare on → the preview shows the defaults (row background ${on.bg}, price ${on.price}; pressed ${on.pressed}); off → the saved colours again (${off.bg}, ${off.price}); What changed lists ${list.length} colours [${list.map((x) => `${x.key} ${x.def}→${x.cur}`).join(', ')}] = the custom tokens in the database [${dbCustom.join(', ')}]; the Auto colours that followed: "${followed.trim()}"`);
    // the per-colour reset goes through the readability guard: Row background back to white with the yellow price kept is refused (nothing saved); the price reset first passes, then the background
    await l.click('[data-style-changed-reset="rows.bg"]');
    const refused = await l.waitForSelector('[data-style-changed="rows.bg"] [data-style-refused]', { timeout: 5000 }).then((e) => e.textContent()).catch(() => null);
    await sleep(400); const stillBg = (await colorsOf('senso'))['rows.bg'] ?? null;
    await snap(l, 'what-changed-refused');
    let taps = 0; const tapL = async (sel) => { taps++; await l.click(sel); };
    await tapL('[data-style-changed-reset="rows.price"]'); await l.waitForSelector('[role=status]:has-text("Reset")');
    const priceGone = await waitDb(`select style->'colors'->>'rows.price' as c from venues where id='senso'`, [], (r) => r?.c == null);
    const pubPrice = await waitPublic('senso', (h) => publicVar(h, 'rows.price') === WHITE && publicVar(h, 'rows.bg') === '#2a2a2a');
    await sleep(500); const list2 = await l.$$eval('[data-style-changed]', (els) => els.map((e) => e.dataset.styleChanged));
    await tapL('[data-style-changed-reset="rows.bg"]'); await l.waitForSelector('[role=status]:has-text("Reset")');
    const bgGone = await waitDb(`select coalesce(style->'colors', '{}'::jsonb) as c from venues where id='senso'`, [], (r) => r && Object.keys(r.c).length === 0);
    const pubBg = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE && publicVar(h, 'rows.price') === INK);
    await sleep(500); const list3 = await l.$$eval('[data-style-changed]', (els) => els.length);
    check('changed-reset-guard', !!refused && /4\.5:1/.test(refused) && /Price/.test(refused) && stillBg === '#2a2a2a' && priceGone.ok && pubPrice.ok && list2.join() === 'rows.bg' && bgGone.ok && pubBg.ok && list3 === 0, `Reset on Row background (#2a2a2a → Auto white) while the price is #ffc14d: refused by the guard with "${(refused || '').trim()}", nothing saved (database still ${stillBg}); Reset on Price → Auto again (database ${priceGone.ok}, white on the dark rows on the public page after ${pubPrice.ms} ms), the list then [${list2.join(', ')}]; Reset on Row background → passes (database empty ${bgGone.ok}, white rows and ink price on the public page after ${pubBg.ms} ms), the list empty (${list3 === 0}); ${taps} taps for the two resets`);
    measure(`per-colour reset from What changed: 1 tap each, through the readability guard (a refusal shown in the row); on the public page in ${pubPrice.ms} / ${pubBg.ms} ms`);
    // the two custom colours again for the Reset group step
    await setHex('rows.bg', '#2a2a2a'); await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#2a2a2a');
    await setHex('rows.price', '#ffc14d'); await waitPublic('senso', (h) => publicVar(h, 'rows.price') === '#ffc14d');
  }
  const colorsBefore = await colorsOf('senso');
  await l.click('[data-style-group="rows"] button:has-text("Reset group to venue default")'); await l.waitForSelector('[role=status]:has-text("Group reset")');
  const pub4 = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE && publicVar(h, 'rows.price') === INK);
  const colorsAfter = await colorsOf('senso');
  await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
  const pub5 = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#2a2a2a' && publicVar(h, 'rows.price') === '#ffc14d');
  const colorsUndone = await colorsOf('senso');
  check('reset-group', Object.keys(colorsBefore).length === 2 && Object.keys(colorsAfter).length === 0 && pub4.ok && pub5.ok && JSON.stringify(colorsUndone) === JSON.stringify(colorsBefore), `Reset group to venue default: ${Object.keys(colorsBefore).length} custom colours of the rows → ${Object.keys(colorsAfter).length}, the public page back to the defaults after ${pub4.ms} ms; Undo → both custom colours back (${JSON.stringify(colorsUndone)}), on the public page after ${pub5.ms} ms`);
  await l.click('[data-style-group="rows"] button:has-text("Reset group to venue default")'); await l.waitForSelector('[role=status]:has-text("Group reset")');
  await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE);
}
{ // the readability guard in the UI: gold on cream refused with the ratio, the threshold and a one-tap fix; navy on cream allowed
  await openGroup('page'); await setHex('page.bg', '#fff8ee');
  const pubCream = await waitPublic('senso', (h) => publicVar(h, 'page.bg') === '#fff8ee' && publicVar(h, 'rows.bg') === '#fff8ee');
  await openGroup('rows'); await setHex('rows.price', '#cc9434');
  const refused = await l.waitForSelector('[data-style-token="rows.price"] [data-style-refused]', { timeout: 5000 }).then((e) => e.textContent()).catch(() => null);
  const suggestion = await l.getAttribute('[data-style-token="rows.price"] [data-style-suggestion]', 'data-style-suggestion').catch(() => null);
  await sleep(500); const stillDb = (await colorsOf('senso'))['rows.price'] ?? null; const stillPub = publicVar(await publicHtml('senso'), 'rows.price');
  await snap(l, 'guard-refused');
  const ratioGold = r1(contrast('#cc9434', '#fff8ee'));
  check('guard-gold', pubCream.ok && !!refused && /2\.5:1/.test(refused) && /4\.5:1/.test(refused) && !!suggestion && stillDb === null && stillPub === INK, `gold #cc9434 as the price on cream #fff8ee: refused with "${(refused || '').trim()}" (measured ${ratioGold}:1); nothing saved (database: ${stillDb}, public page still ${stillPub}); one-tap fix offered: ${suggestion}`);
  const tFix = Date.now(); await l.click('[data-style-token="rows.price"] [data-style-suggestion]');
  const fixed = await waitDb(`select style->'colors'->>'rows.price' as c from venues where id='senso'`, [], (r) => r?.c === suggestion);
  const pubFix = await waitPublic('senso', (h) => publicVar(h, 'rows.price') === suggestion);
  const ratioFix = r1(contrast(suggestion, '#fff8ee'));
  check('guard-fix', fixed.ok && pubFix.ok && ratioFix >= 4.5, `one tap on "Use ${suggestion}" → saved ${fixed.ms} ms later, on the public page after ${pubFix.ms} ms (${Date.now() - tFix} ms after the tap); ${suggestion} on cream measures ${ratioFix}:1`);
  measure(`readability guard: refusal shown with the ratio and a one-tap fix; the fix saved in ${fixed.ms} ms`);
  await openGroup('headings'); await setHex('headings.title', '#042c7c');
  const navy = await waitDb(`select style->'colors'->>'headings.title' as c from venues where id='senso'`, [], (r) => r?.c === '#042c7c');
  const noRefusal = !(await l.$('[data-style-token="headings.title"] [data-style-refused]'));
  check('guard-navy', navy.ok && noRefusal, `navy #042c7c as the section title on cream: allowed (measured ${r1(contrast('#042c7c', '#fff8ee'))}:1, needs 3:1 for a heading), saved ${navy.ms} ms after Enter`);
  await snap(l, 'guard-allowed');
  // Reset all colours: a confirmation, then Undo
  const before = await colorsOf('senso');
  await l.click('[data-style-reset-all]'); await l.waitForSelector('[role=dialog][aria-label="Reset all colours?"]');
  await l.click('[role=dialog][aria-label="Reset all colours?"] button:has-text("Reset all colours")'); await l.waitForSelector('[role=status]:has-text("All colours reset")');
  const cleared = await waitDb(`select coalesce(style->'colors', '{}'::jsonb) as c from venues where id='senso'`, [], (r) => r && Object.keys(r.c).length === 0);
  const pubReset = await waitPublic('senso', (h) => publicVar(h, 'page.bg') === WHITE && publicVar(h, 'rows.price') === INK && publicVar(h, 'headings.title') === INK);
  await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
  const undone = await colorsOf('senso');
  const pubUndo = await waitPublic('senso', (h) => publicVar(h, 'page.bg') === '#fff8ee' && publicVar(h, 'headings.title') === '#042c7c');
  check('reset-all', Object.keys(before).length === 3 && cleared.ok && pubReset.ok && JSON.stringify(undone) === JSON.stringify(before) && pubUndo.ok, `Reset all colours (confirmed in the sheet): ${Object.keys(before).length} custom colours → 0 (${cleared.ms} ms), the public page back to the defaults after ${pubReset.ms} ms; Undo → all ${Object.keys(undone).length} back, on the public page after ${pubUndo.ms} ms`);
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, await cookieOf(laptop)); await waitPublic('senso', (h) => publicVar(h, 'page.bg') === WHITE);
}
{ // the guard on the route (server side), both venues
  const c = await cookieOf(laptop);
  const r = async (venue, colors) => { const x = await api('/api/admin/style', { action: 'update', venue, patch: { colors } }, c); return { status: x.status, error: x.json?.error, guard: x.json?.guard }; };
  const kDark = await r('kebab-land', { 'page.bg': '#141414' });
  const kRed = await r('kebab-land', { 'rows.price': '#b92e2e' });
  const kHead = await r('kebab-land', { 'headings.title': '#b92e2e' });
  const kVars = varsOf(await (await waitPublic('kebab-land', (h) => publicVar(h, 'headings.title') === '#b92e2e')).html || await publicHtml('kebab-land'));
  const sCream = await r('senso', { 'page.bg': '#fff8ee' });
  const sGold = await r('senso', { 'rows.price': '#cc9434' });
  const sGoldHead = await r('senso', { 'headings.title': '#cc9434' });
  const sNavy = await r('senso', { 'rows.price': '#042c7c' });
  const ok = kDark.status === 200 && kRed.status === 400 && r1(kRed.guard?.ratio) === 3.1 && kRed.guard?.threshold === 4.5 && kHead.status === 200 && kVars['--c-footer-label'] === WHITE
    && sCream.status === 200 && sGold.status === 400 && r1(sGold.guard?.ratio) === 2.5 && sGoldHead.status === 400 && r1(sGoldHead.guard?.ratio) === 2.5 && sGoldHead.guard?.threshold === 3 && sNavy.status === 200;
  check('guard-route', ok, `route: Kebab Land page → #141414 ${kDark.status} (the brand-red location labels fall back to Auto: footer label now ${kVars['--c-footer-label']}); red #b92e2e as the price on it → ${kRed.status} "${kRed.error}" (ratio ${r1(kRed.guard?.ratio)}, needs ${kRed.guard?.threshold}); the same red as a section title → ${kHead.status} (large text, needs 3); Senso page → cream ${sCream.status}; gold #cc9434 as the price → ${sGold.status} (ratio ${r1(sGold.guard?.ratio)}, needs ${sGold.guard?.threshold}, suggested ${sGold.guard?.suggestion?.value}); gold as a section title → ${sGoldHead.status} (needs ${sGoldHead.guard?.threshold}); navy #042c7c as the price → ${sNavy.status} (${r1(contrast('#042c7c', '#fff8ee'))}:1)`);
  await fs.writeFile(path.join(out, 'guard-route.json'), JSON.stringify({ kDark, kRed, kHead, sCream, sGold, sGoldHead, sNavy }, null, 2));
  for (const v of ['senso', 'kebab-land']) await api('/api/admin/style', { action: 'reset', venue: v }, c);
  await waitPublic('senso', (h) => publicVar(h, 'page.bg') === WHITE); await waitPublic('kebab-land', (h) => publicVar(h, 'page.bg') === WHITE);
}
{ // the preview and the controls point at each other
  await l.reload(); await l.waitForSelector('[data-style-group="rows"]'); await frameReady();
  const t1 = Date.now();
  await frameEval((d) => { d.querySelector('main footer p').click(); });
  await l.waitForSelector('[data-style-group="footer"][data-open]'); const dt = Date.now() - t1;
  const footerOutlined = await frameEval((d) => d.querySelector('main footer')?.classList.contains('roses-region'));
  const inView = await l.evaluate(() => { const r = document.querySelector('[data-style-group="footer"]').getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; });
  await snap(l, 'region-tapped');
  check('region-tap', footerOutlined && inView, `tapped the footer in the preview → the Footer group opened ${dt} ms later (1 tap), scrolled into view: ${inView}; the footer is outlined in the preview: ${footerOutlined}`);
  measure(`tap a region in the preview: 1 tap; its group open after ${dt} ms`);
  { // every group switches the preview to the screen where it is visible and outlines its region (Kian, 2026-10-09)
    const EXPECT = { page: 'menu', header: 'menu', tabs: 'menu', headings: 'menu', rows: 'menu', sheet: 'sheet', footer: 'menu', welcome: 'welcome' };
    const SEL = { page: 'html.roses-region-page', header: 'main > header.roses-region', tabs: '#tabs.roses-region', headings: 'main section h2.roses-region', rows: 'main section ul.roses-region', sheet: 'dialog#sheet[open].roses-region', footer: 'main footer.roses-region', welcome: '#welcome.roses-region' };
    const rows = [];
    for (const g of Object.keys(EXPECT)) {
      const t = Date.now(); await openGroup(g);
      let st = null, ok = false;
      while (Date.now() - t < 3000) {
        st = await frameEval((d, sel) => { const w = d.getElementById('welcome'), s = d.getElementById('sheet'); const els = [...d.querySelectorAll(sel)]; const inView = els.some((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < d.defaultView.innerHeight; }); return { welcome: getComputedStyle(w).display, sheet: !!s?.open, outlined: els.length, inView, y: Math.round(d.defaultView.scrollY) }; }, SEL[g]);
        ok = (EXPECT[g] === 'welcome' ? st.welcome === 'grid' : EXPECT[g] === 'sheet' ? st.sheet && st.welcome === 'none' : st.welcome === 'none' && !st.sheet) && st.outlined > 0 && (g === 'page' || g === 'welcome' || st.inView);
        if (ok) break; await sleep(30);
      }
      const bar = await l.$eval('[data-preview-screen][aria-pressed="true"]', (e) => e.dataset.previewScreen).catch(() => null);
      rows.push({ g, ms: Date.now() - t, ...st, bar, ok: ok && bar === EXPECT[g] });
    }
    await snap(l, 'groups-screens');
    check('groups-screens', rows.every((r) => r.ok), `opening each group switches the preview to its screen and outlines its region: ${rows.map((r) => `${r.g} → ${r.bar} (${r.ok ? 'ok' : 'WRONG'}: overlay ${r.welcome}, popup ${r.sheet}, ${r.outlined} outlined${r.g === 'page' || r.g === 'welcome' ? '' : `, in view ${r.inView}`}, scrollY ${r.y}) in ${r.ms} ms`).join('; ')}`);
    measure(`opening a Style group switches the preview to its screen within ${Math.max(...rows.map((r) => r.ms))} ms (all 8 groups)`);
  }
  await openGroup('tabs'); await sleep(150);
  const tabsOutlined = await frameEval((d) => d.querySelector('#tabs')?.classList.contains('roses-region') && !d.querySelector('main footer')?.classList.contains('roses-region'));
  await openGroup('sheet'); await sleep(300);
  const sheet = await frameEval((d) => { const s = d.getElementById('sheet'); return { open: s?.open, outlined: s?.classList.contains('roses-region') }; });
  await snap(l, 'region-sheet');
  await openGroup('welcome'); await sleep(400);
  const welcome = await frameEval((d) => { const w = d.getElementById('welcome'); const s = d.getElementById('sheet'); return { display: w ? getComputedStyle(w).display : 'absent', visible: !!w && w.getClientRects().length > 0 && getComputedStyle(w).visibility === 'visible', sheetClosed: !s?.open, running: w ? w.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0, season: d.getElementById('welcome')?.dataset.season, scene: [...d.querySelectorAll('#welcome .scene')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.scene).join('+') }; });
  await snap(l, 'region-welcome');
  // the preview-only season switch: Winter shows the winter scene in the frame; nothing is saved; Now puts the frame back on today's season
  const styleBefore = JSON.stringify((await db.query(`select style from venues where id='senso'`)).rows[0].style);
  await l.click('[data-preview-season="winter"]');
  { const t = Date.now(); while (Date.now() - t < 4000 && !(await frameEval((d) => !!d.querySelector('#welcome .scene-winter .p')))) await sleep(50); } // the scene is fetched from the admin API and swapped in (current season only, the PM 2026-10-09)
  const winter = await frameEval((d) => ({ season: d.getElementById('welcome')?.dataset.season, scene: [...d.querySelectorAll('#welcome .scene')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.scene).join('+'), flakes: d.querySelectorAll('#welcome .scene-winter .p').length, running: d.getElementById('welcome').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length }));
  await snap(l, 'region-welcome-winter');
  const styleAfter = JSON.stringify((await db.query(`select style from venues where id='senso'`)).rows[0].style);
  await l.click(`[data-preview-season="${welcome.season}"]`); await sleep(250); // the page's own season again
  const now = await frameEval((d) => d.getElementById('welcome')?.dataset.season);
  const thisSeason = welcome.season; // the season the page was rendered for (America/Toronto; the PM, 2026-10-09)
  check('welcome-season', welcome.display === 'grid' && welcome.visible && welcome.sheetClosed && welcome.running > 0 && welcome.scene === welcome.season && winter.season === 'winter' && winter.scene === 'winter' && winter.flakes > 0 && winter.flakes <= 20 && winter.running > 0 && styleAfter === styleBefore && now === thisSeason, `Welcome group open → the welcome screen shown live in the preview (display ${welcome.display}, visible ${welcome.visible}, ${welcome.running} animations running, today's scene ${welcome.scene}; the sheet closed again: ${welcome.sheetClosed}); Winter in the season switch → the frame shows the winter scene (${winter.scene}, ${winter.flakes} flakes, ${winter.running} animations) and venues.style is unchanged (${styleAfter === styleBefore}); Now → ${now} (the page's own season ${thisSeason})`);
  // a colour saved in the Welcome group shows on the overlay in the preview within 1 s; the group and the overlay stay through the save
  await openToken('welcome.bg'); const tBg = Date.now(); await setHex('welcome.bg', '#e8f0ff');
  let bgAt = null; while (Date.now() - tBg < 6000) { if ((await frameEval((d) => { const w = d.getElementById('welcome'); return w && getComputedStyle(w).display !== 'none' ? getComputedStyle(w).backgroundColor : null; })) === 'rgb(232, 240, 255)') { bgAt = Date.now() - tBg; break; } await sleep(30); }
  const pubBg = await waitPublic('senso', (h) => publicVar(h, 'welcome.bg') === '#e8f0ff');
  await l.waitForSelector('[role=status]:has-text("Saved")'); await frameReady(); await sleep(900);
  const stillOpen = (await l.$$eval('[data-style-group][data-open]', (els) => els.map((e) => e.getAttribute('data-style-group')))).join();
  const stillShown = await frameEval((d) => { const w = d.getElementById('welcome'); return !!w && getComputedStyle(w).display !== 'none' && getComputedStyle(w).backgroundColor; });
  await snap(l, 'welcome-colour');
  check('welcome-colour', bgAt != null && bgAt <= 1000 && pubBg.ok && stillOpen === 'welcome' && stillShown === 'rgb(232, 240, 255)', `welcome background #e8f0ff shows on the overlay in the preview ${bgAt} ms after Enter (target ≤ 1000); on the public page after ${pubBg.ms} ms; after the save, the data reload and the preview reload the open group is still [${stillOpen}] and the overlay still shown in that colour (${stillShown})`);
  measure(`welcome colour: on the overlay in the preview after ${bgAt} ms`);
  await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")'); await waitPublic('senso', (h) => publicVar(h, 'welcome.bg') !== '#e8f0ff');
  await frameEval((d) => { d.querySelector('li.item h3').click(); });
  await l.waitForSelector('[data-style-group="rows"][data-open]');
  const rowsOutlined = await frameEval((d) => !!d.querySelector('main section ul.roses-region') && getComputedStyle(d.getElementById('welcome')).display === 'none');
  check('region-outline', tabsOutlined && sheet.open && sheet.outlined && welcome.display !== 'none' && welcome.sheetClosed && rowsOutlined, `opening a group outlines its region: Category tabs → #tabs outlined (${tabsOutlined}); Item popup → the first item's sheet opened and outlined (${sheet.open && sheet.outlined}); Welcome → the welcome screen shown (display ${welcome.display}, sheet closed again: ${welcome.sheetClosed}); a tap on an item row → Item rows open and its lists outlined, the welcome screen gone again (${rowsOutlined})`);
  // the controls are the master: a preview tap, then a colour saved in another group; the group stays open through the save,
  // the data reload and the preview reload (before the fix of 2026-10-08 the tapped group reopened after every save)
  await frameEval((d) => { d.querySelector('main footer p').click(); }); await l.waitForSelector('[data-style-group="footer"][data-open]');
  await openGroup('tabs'); await openToken('tabs.text');
  const tSave = Date.now(); await setHex('tabs.text', '#4a4a4a');
  const pubTabs = await waitPublic('senso', (h) => publicVar(h, 'tabs.text') === '#4a4a4a');
  await l.waitForSelector('[role=status]:has-text("Saved")'); await frameReady(); await sleep(900); // the data refetch and the preview reload have both happened
  const openAfter = await l.$$eval('[data-style-group][data-open]', (els) => els.map((e) => e.getAttribute('data-style-group')));
  const tokenAfter = await l.getAttribute('[data-style-token="tabs.text"] > button', 'aria-expanded');
  const outlinedAfter = await frameEval((d) => ({ tabs: !!d.querySelector('#tabs.roses-region'), footer: !!d.querySelector('main footer.roses-region') }));
  const scrolledTo = await l.evaluate(() => { const r = document.querySelector('[data-style-group="tabs"]').getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; });
  // a tap on the open group's own region keeps the open colour
  await frameEval((d) => { d.querySelector('#tabs a').click(); }); await sleep(400);
  const tokenAfterTap = await l.getAttribute('[data-style-token="tabs.text"] > button', 'aria-expanded');
  const openAfterTap = await l.$$eval('[data-style-group][data-open]', (els) => els.map((e) => e.getAttribute('data-style-group')));
  await snap(l, 'no-jump-after-save');
  check('no-jump', openAfter.join() === 'tabs' && tokenAfter === 'true' && outlinedAfter.tabs && !outlinedAfter.footer && scrolledTo && tokenAfterTap === 'true' && openAfterTap.join() === 'tabs' && pubTabs.ok, `footer tapped in the preview, then Category tabs opened on the left and Tab text saved as #4a4a4a (on the public page after ${pubTabs.ms} ms): ${Date.now() - tSave} ms later the open group is still [${openAfter.join(', ')}] with Tab text open (${tokenAfter}), the preview outlines the tabs (${outlinedAfter.tabs}) and not the footer (${!outlinedAfter.footer}), the group is in view (${scrolledTo}); a tap on the tab bar in the preview keeps Tab text open (${tokenAfterTap}) and the group [${openAfterTap.join(', ')}]`);
  await l.click('[role=status] button:has-text("Undo")').catch(() => {}); await l.waitForSelector('[role=status]:has-text("Undone")', { timeout: 10000 }).catch(() => {}); await waitPublic('senso', (h) => publicVar(h, 'tabs.text') !== '#4a4a4a'); // wait for the undo's answer like every other Undo step: the route regenerates the public page before it answers
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, await cookieOf(laptop)); await waitPublic('senso', (h) => publicVar(h, 'tabs.text') === '#6b6b6b');
  { // position and screen kept through a colour save (Kian, 2026-10-09): the footer in view on the Menu screen, a colour saved → the same scroll position, no welcome screen, no popup; the popup open (Item popup group), its colour saved → open again
    const probe = () => frameEval((d) => ({ y: Math.round(d.defaultView.scrollY), welcome: getComputedStyle(d.getElementById('welcome')).display, sheet: !!d.getElementById('sheet')?.open, sheetOutlined: !!d.querySelector('dialog#sheet[open].roses-region') }));
    const bar = () => l.$eval('[data-preview-screen][aria-pressed="true"]', (e) => e.dataset.previewScreen).catch(() => null);
    await openGroup('footer'); await sleep(300);
    const before = await probe();
    await setHex('footer.address', '#333333'); await l.waitForSelector('[role=status]:has-text("Saved")'); await waitPublic('senso', (h) => publicVar(h, 'footer.address') === '#333333'); await frameReady(); await sleep(900);
    const after = await probe(); const barAfter = await bar();
    await snap(l, 'position-kept');
    await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")'); await waitPublic('senso', (h) => publicVar(h, 'footer.address') === '#6b6b6b');
    await openGroup('sheet'); await sleep(400);
    const sheetBefore = await probe();
    await setHex('sheet.title', '#333333'); await l.waitForSelector('[role=status]:has-text("Saved")'); await waitPublic('senso', (h) => publicVar(h, 'sheet.title') === '#333333'); await frameReady(); await sleep(900);
    const sheetAfter = await probe(); const barSheet = await bar();
    await snap(l, 'popup-kept');
    await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")'); await waitPublic('senso', (h) => publicVar(h, 'sheet.title') === INK);
    check('position-kept', before.y > 0 && Math.abs(after.y - before.y) <= 4 && after.welcome === 'none' && !after.sheet && barAfter === 'menu' && sheetBefore.sheet && sheetAfter.sheet && sheetAfter.sheetOutlined && sheetAfter.welcome === 'none' && barSheet === 'sheet', `Footer group open (the frame scrolled to the footer, scrollY ${before.y}), Address saved → after the save and the reload the frame is at scrollY ${after.y} (same place: ${Math.abs(after.y - before.y) <= 4}), screen ${barAfter}, overlay ${after.welcome}, popup ${after.sheet}; Item popup group open (popup ${sheetBefore.sheet}), Title saved → the popup open again (${sheetAfter.sheet}) and outlined (${sheetAfter.sheetOutlined}), screen ${barSheet}, overlay ${sheetAfter.welcome}`);
    measure(`after a colour save the preview keeps its position (scrollY ${before.y} → ${after.y}) and its screen (the popup open again)`);
  }
  // section layout: a section switched to Grid in the Layout group
  {
    const sec = (await db.query(`select s.id, s.name->>'en' as name, s.layout, (select count(*)::int from item_sections x join items i on i.id = x.item_id and i.listed where x.section_id = s.id) as n from sections s where s.venue_id = 'senso' and s.listed and s.name->>'en' = 'Fresh Juice'`)).rows[0];
    const cardsOf = (html) => { const m = html.match(new RegExp(`<section[^>]*data-id="${sec.id}"[\\s\\S]*?</section>`)); if (!m) return null; const ul = m[0].match(/<ul class="([^"]*)"[^>]*data-layout="([^"]+)"/); return { classes: ul?.[1] || '', layout: ul?.[2] || null, cards: (m[0].match(/<li class="item card /g) || []).length, rows: (m[0].match(/<li class="item flex /g) || []).length, templates: (m[0].match(/<template class="detail"/g) || []).length, placeholders: (m[0].match(/aspect-square w-full rounded-xl bg-\(--c-rows-photo\)" aria-hidden/g) || []).length }; };
    // start from List (2026-10-08): the scratch copy comes from the working database, where Fresh Juice was set to Grid after this
    // step was written, and a tap on a radio that is already selected sends nothing (no save, no toast): the step measured nothing
    if ((await l.getAttribute(`[data-section-layout="${sec.id}"]`, 'data-layout')) !== 'list') { await l.click(`[data-section-layout="${sec.id}"] button[role=radio]:has-text("List")`); await waitDb('select layout from sections where id = $1', [sec.id], (r) => r?.layout === 'list'); await waitPublic('senso', (h) => cardsOf(h)?.layout === 'list'); await l.waitForSelector('[role=status]:has-text("List")'); await sleep(400); }
    const before = cardsOf(await publicHtml('senso'));
    let taps = 0; const tap = async (sel) => { taps++; await l.click(sel); };
    await l.evaluate((id) => document.querySelector(`[data-section-layout="${id}"]`)?.scrollIntoView({ block: 'center' }), sec.id);
    const t0 = Date.now(); await tap(`[data-section-layout="${sec.id}"] button[role=radio]:has-text("Grid")`);
    const toast = await l.waitForSelector('[role=status]:has-text("Grid")', { timeout: 5000 }).then(() => true).catch(() => false); // checked at once: the toast lasts 10 s and the customers' page below takes its time to load
    const savedGrid = await waitDb('select layout from sections where id = $1', [sec.id], (r) => r?.layout === 'grid');
    const pubGrid = await waitPublic('senso', (h) => cardsOf(h)?.layout === 'grid');
    const after = cardsOf(pubGrid.html || await publicHtml('senso'));
    let shownAt = null; const tp = Date.now(); while (Date.now() - tp < 6000) { if (await frameEval((d, id) => !!d.querySelector(`section[data-id="${id}"] ul[data-layout="grid"]`), sec.id)) { shownAt = Date.now() - t0; break; } await sleep(40); }
    const frameGrid = await frameEval((d, id) => { const ul = d.querySelector(`section[data-id="${id}"] ul[data-layout="grid"]`); if (!ul) return null; const cs = getComputedStyle(ul); const cards = [...ul.querySelectorAll('li.item')]; const r = cards.slice(0, 2).map((c) => c.getBoundingClientRect()); return { display: cs.display, columns: cs.gridTemplateColumns.split(' ').length, cards: cards.length, sideBySide: r.length === 2 && Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right, photoW: Math.round(cards[0].querySelector('img, div[aria-hidden]')?.getBoundingClientRect().width || 0) }; }, sec.id);
    // the popup opens from a card like from a row: on the customers' page (in the Style tab's preview every tap is intercepted by design: it picks a region)
    const cust = await laptop.newPage(); await cust.goto(`${base}/senso`, { waitUntil: 'load' }); await cust.waitForFunction(() => document.documentElement.dataset.welcome === 'show'); await cust.evaluate(() => document.querySelector('#welcome button[data-lang="en"]').click()); await cust.waitForFunction(() => document.documentElement.dataset.welcome === 'off');
    const sheet = await cust.evaluate((id) => { const card = document.querySelector(`section[data-id="${id}"] li.item.card`); card.click(); const s = document.getElementById('sheet'); const title = s.querySelector('h2 [lang=en]')?.textContent; const open = s.open; s.close(); return { open, title, cardTitle: card.querySelector('h3 [lang=en]')?.textContent }; }, sec.id);
    await cust.close();
    const control = await l.getAttribute(`[data-section-layout="${sec.id}"]`, 'data-layout');
    await snap(l, 'section-grid');
    const ok = before?.layout === 'list' && before.rows === sec.n && before.cards === 0 && savedGrid.ok && pubGrid.ok && after?.layout === 'grid' && after.cards === sec.n && after.rows === 0 && after.templates === sec.n && /grid-cols-2/.test(after.classes)
      && shownAt != null && shownAt <= 1000 && frameGrid?.display === 'grid' && frameGrid.columns === 2 && frameGrid.sideBySide && frameGrid.photoW > 150 && sheet.open && sheet.title === sheet.cardTitle && toast && control === 'grid';
    check('section-grid', ok, `"${sec.name}" (${sec.n} shown items) switched to Grid: ${taps} tap in the Layout group; saved ${savedGrid.ms} ms after the tap, the public page renders ${after?.cards} cards in ${after?.layout === 'grid' ? 'a two-column grid' : after?.layout} (${after?.rows} rows left, ${after?.templates} popups, ${after?.placeholders} photo placeholders) after ${pubGrid.ms} ms; the preview shows the grid ${shownAt} ms after the tap (display ${frameGrid?.display}, ${frameGrid?.columns} columns, first two cards side by side: ${frameGrid?.sideBySide}, photo ${frameGrid?.photoW} px wide); a tap on a card opens the popup "${sheet.title}" (${sheet.open}); "Grid · Undo" shown: ${toast}; the control reads ${control}`);
    measure(`switch a section to the grid layout: ${taps} tap (Layout group); on the public page in ${pubGrid.ms} ms; in the preview after ${shownAt} ms`);
    await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
    const backList = await waitPublic('senso', (h) => cardsOf(h)?.layout === 'list');
    const dbBack = (await db.query('select layout from sections where id = $1', [sec.id])).rows[0].layout;
    await sleep(300); const controlBack = await l.getAttribute(`[data-section-layout="${sec.id}"]`, 'data-layout');
    const rec = (await db.query(`select action, before->>'layout' as b, after->>'layout' as a from revisions where table_name = 'sections' and row_id = $1 order by id desc limit 2`, [sec.id])).rows;
    const bad = await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'tiles' } }, await cookieOf(laptop));
    check('section-grid-undo', backList.ok && dbBack === 'list' && controlBack === 'list' && cardsOf(backList.html || await publicHtml('senso'))?.rows === sec.n && rec.length === 2 && rec[1].action === 'update' && rec[1].b === 'list' && rec[1].a === 'grid' && rec[0].action === 'restore' && bad.status === 400, `Undo → "${sec.name}" is a list again (database ${dbBack}, control ${controlBack}), ${sec.n} rows back on the public page after ${backList.ms} ms; change records: ${rec.map((r) => `${r.action} ${r.b ?? '∅'}→${r.a ?? '∅'}`).join(', ')}; an unknown layout on the route → ${bad.status} "${bad.json?.error}"`);
  }
  // the Persian view keeps the same colours
  const en = await frameVar('--c-page-bg'); await l.click('[aria-label="Preview language"] button:has-text("FA")'); await sleep(300);
  const fa = await frameEval((d) => ({ dir: d.documentElement.dir, bg: getComputedStyle(d.documentElement).getPropertyValue('--c-page-bg').trim() }));
  check('persian-same', fa.dir === 'rtl' && fa.bg === en, `Persian view: dir=${fa.dir}, page background ${fa.bg} (English ${en})`);
  await l.click('[aria-label="Preview language"] button:has-text("EN")');
}
{ // Discard this session's changes (Kian, 2026-10-09): the snapshot taken when the Style tab opened (colours, the template's switches, every section's layout) back in one step; Undo brings the discarded state back
  const c = await cookieOf(laptop);
  const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = 'senso' and listed and name->>'en' = 'Fresh Juice'`)).rows[0];
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, c);
  await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { colors: { 'tabs.bg': '#fff8ee' }, welcome: true } }, c);
  await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'list' } }, c);
  const pub0 = await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === '#fff8ee' && /id="welcome"/.test(h) && layoutOf(h, sec.id) === 'list');
  const vars0 = varsOf(pub0.html || await publicHtml('senso')); const style0 = await styleJson('senso');
  await l.goto(`${base}/admin/senso?tab=style`); await l.waitForSelector('[data-style-group="rows"]'); await frameReady(); await sleep(400);
  const disabledAtOpen = await l.$eval('[data-style-discard]', (e) => e.disabled);
  // three changes in the session: a colour, the welcome switch, a section's layout
  await openGroup('rows'); await setHex('rows.bg', '#141414'); await l.waitForSelector('[role=status]:has-text("Saved")'); await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#141414');
  await openGroup('welcome'); await l.click('[data-style-option="welcome"] input[role=switch]'); await waitPublic('senso', (h) => !/id="welcome"/.test(h));
  await l.evaluate((id) => document.querySelector(`[data-section-layout="${id}"]`)?.scrollIntoView({ block: 'center' }), sec.id);
  await l.click(`[data-section-layout="${sec.id}"] button[role=radio]:has-text("Grid")`); await waitDb('select layout from sections where id = $1', [sec.id], (r) => r?.layout === 'grid');
  const pub1 = await waitPublic('senso', (h) => layoutOf(h, sec.id) === 'grid' && publicVar(h, 'rows.bg') === '#141414' && !/id="welcome"/.test(h));
  const vars1 = varsOf(pub1.html || await publicHtml('senso')); const style1 = await styleJson('senso');
  await sleep(500); const changes = await l.getAttribute('[data-style-discard]', 'data-changes');
  await l.evaluate(() => document.querySelector('[data-style-discard]')?.scrollIntoView({ block: 'center' })); await snap(l, 'discard-before');
  let taps = 0; const tapL = async (sel) => { taps++; await l.click(sel); };
  const tD = Date.now();
  await tapL('[data-style-discard]'); await l.waitForSelector('[role=dialog][aria-label="Discard this session\'s changes?"]'); await tapL('[role=dialog] button:has-text("Discard changes")');
  await l.waitForSelector('[role=status]:has-text("Discarded")');
  const pubD = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE && /id="welcome"/.test(h) && layoutOf(h, sec.id) === 'list');
  const varsD = varsOf(pubD.html || await publicHtml('senso')); const styleD = await styleJson('senso'); const layoutD = (await db.query('select layout from sections where id = $1', [sec.id])).rows[0].layout;
  await sleep(600); const listD = await l.$$eval('[data-style-changed]', (els) => els.map((e) => e.dataset.styleChanged)); const changesD = await l.getAttribute('[data-style-discard]', 'data-changes');
  await snap(l, 'discard-after');
  const tU = Date.now(); await l.click('[role=status] button:has-text("Undo")'); await l.waitForSelector('[role=status]:has-text("Undone")');
  const pubU = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#141414' && !/id="welcome"/.test(h) && layoutOf(h, sec.id) === 'grid');
  const varsU = varsOf(pubU.html || await publicHtml('senso')); const styleU = await styleJson('senso'); const layoutU = (await db.query('select layout from sections where id = $1', [sec.id])).rows[0].layout;
  const sameD = JSON.stringify(varsD) === JSON.stringify(vars0), sameU = JSON.stringify(varsU) === JSON.stringify(vars1);
  const diffD = Object.keys({ ...vars0, ...varsD }).filter((k) => vars0[k] !== varsD[k]);
  check('discard', disabledAtOpen === true && changes === '3' && pubD.ok && sameD && styleD === style0 && layoutD === 'list' && listD.join() === 'tabs.bg' && changesD === '0' && pubU.ok && sameU && styleU === style1 && layoutU === 'grid', `Style tab opened on a snapshot (bar background cream, welcome on, "${sec.name}" as a list; Discard disabled: ${disabledAtOpen}); then rows #141414, welcome off, "${sec.name}" to Grid (the button counts ${changes} changes); Discard (${taps} taps: Discard, confirm) → the public page serves exactly the snapshot's ${Object.keys(vars0).length} colour variables after ${pubD.ms} ms (identical: ${sameD}${diffD.length ? `; differ: ${diffD.join(', ')}` : ''}), welcome on, layout ${layoutD}, venues.style equal to the snapshot (${styleD === style0}), What changed back to [${listD.join(', ')}], the button counts ${changesD}; ${Date.now() - tD} ms after the first tap; Undo → the discarded state back after ${pubU.ms} ms (${Date.now() - tU} ms after the tap): variables identical (${sameU}), venues.style (${styleU === style1}), layout ${layoutU}`);
  measure(`Discard this session's changes: ${taps} taps (Discard, confirm); the opening snapshot back on the public page in ${pubD.ms} ms; Undo → the discarded state back in ${pubU.ms} ms`);
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, c); await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { welcome: true } }, c); await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'list' } }, c);
  await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === WHITE && /id="welcome"/.test(h) && layoutOf(h, sec.id) === 'list');
}
{ // The session lasts the whole visit to the venue's editor (the PM, 2026-10-09, replacing "switching tabs and back opens a new session"):
  // the snapshot is taken the first time the Style tab opens and kept across tab switches (no page load); Discard restores it and the
  // session starts again from what it put back; a reload starts it again, and so does leaving the venue (the venue menu: plain links)
  const c = await cookieOf(laptop);
  const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = 'senso' and listed and name->>'en' = 'Fresh Juice'`)).rows[0];
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, c);
  await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { colors: { 'tabs.bg': '#fff8ee' }, welcome: true } }, c);
  await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'list' } }, c);
  await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === '#fff8ee' && publicVar(h, 'rows.bg') === WHITE && /id="welcome"/.test(h) && layoutOf(h, sec.id) === 'list');
  const vars0 = varsOf(await publicHtml('senso')); const style0 = await styleJson('senso');
  const count = async () => { await sleep(500); return Number(await l.getAttribute('[data-style-discard]', 'data-changes')); };
  const TAB = { menu: ['a[href="/admin/senso"]:has-text("Menu")', '[data-item]'], style: ['a[href="/admin/senso?tab=style"]:has-text("Style")', '[data-style-group="rows"]'], details: ['a[href="/admin/senso?tab=details"]:has-text("Details")', '[data-details-tab]'] };
  const tabTo = async (t) => { await l.click(TAB[t][0]); await l.waitForSelector(TAB[t][1]); };
  const venueTo = async (v) => { await l.click('summary[aria-label="Switch venue"]'); await l.click(`details[open] a[href="/admin/${v}"]`); await l.waitForURL(`${base}/admin/${v}`); await l.waitForSelector('[data-item]'); };
  await l.goto(`${base}/admin/senso?tab=style`); await l.waitForSelector('[data-style-group="rows"]'); await frameReady();
  await l.evaluate(() => { window.__visit = 'one'; }); // gone after any page load
  const c0 = await count();
  await openGroup('rows'); await setHex('rows.bg', '#141414'); await l.waitForSelector('[role=status]:has-text("Saved")'); await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#141414');
  const c1 = await count();
  await tabTo('menu'); await tabTo('details'); await tabTo('style');
  const c1b = await count();
  await l.evaluate((id) => document.querySelector(`[data-section-layout="${id}"]`)?.scrollIntoView({ block: 'center' }), sec.id);
  await l.click(`[data-section-layout="${sec.id}"] button[role=radio]:has-text("Grid")`); await waitDb('select layout from sections where id = $1', [sec.id], (r) => r?.layout === 'grid');
  await waitPublic('senso', (h) => layoutOf(h, sec.id) === 'grid');
  const c2 = await count();
  await tabTo('menu'); await tabTo('style');
  const c2b = await count(); const sameVisit = await l.evaluate(() => window.__visit === 'one');
  await snap(l, 'discard-visit-before');
  await l.evaluate(() => document.querySelector('[data-style-discard]')?.scrollIntoView({ block: 'center' }));
  await l.click('[data-style-discard]'); await l.waitForSelector('[role=dialog][aria-label="Discard this session\'s changes?"]'); await l.click('[role=dialog] button:has-text("Discard changes")');
  await l.waitForSelector('[role=status]:has-text("Discarded")');
  const pubD = await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === WHITE && layoutOf(h, sec.id) === 'list');
  const varsD = varsOf(await publicHtml('senso')); const styleD = await styleJson('senso'); const layoutD = (await db.query('select layout from sections where id = $1', [sec.id])).rows[0].layout;
  const sameD = JSON.stringify(varsD) === JSON.stringify(vars0); const diffD = Object.keys({ ...vars0, ...varsD }).filter((k) => vars0[k] !== varsD[k]);
  const cD = await count();
  await openGroup('rows'); await setHex('rows.bg', '#141414'); await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#141414');
  const cAfter = await count();
  await l.reload(); await l.waitForSelector('[data-style-group="rows"]'); await frameReady();
  const cReload = await count(); const reloaded = await l.evaluate(() => window.__visit === undefined);
  await openGroup('rows'); await setHex('rows.bg', '#262626'); await waitPublic('senso', (h) => publicVar(h, 'rows.bg') === '#262626');
  const cLeft = await count();
  await venueTo('kebab-land'); await venueTo('senso'); await tabTo('style');
  const cBack = await count();
  check('discard-visit', c0 === 0 && c1 === 1 && c1b === 1 && c2 === 2 && c2b === 2 && sameVisit && pubD.ok && sameD && styleD === style0 && layoutD === 'list' && cD === 0 && cAfter === 1 && cReload === 0 && reloaded && cLeft === 1 && cBack === 0, `the snapshot lasts the whole visit: Style tab opened (the button counts ${c0}); rows #141414 → ${c1}; Menu, Details, back to Style without a page load → still ${c1b}; "${sec.name}" to Grid → ${c2}; Menu and back → ${c2b} (same page throughout: ${sameVisit}); Discard → the public page serves exactly the first snapshot's ${Object.keys(vars0).length} colour variables after ${pubD.ms} ms (identical: ${sameD}${diffD.length ? `; differ: ${diffD.join(', ')}` : ''}), venues.style equal to it (${styleD === style0}), layout ${layoutD}; the button counts ${cD} after the Discard and ${cAfter} after a new change (the session starts again from what the Discard put back); a reload → ${cReload} with the rows still #141414 (a new page: ${reloaded}); one change → ${cLeft}, then the venue menu to kebab-land and back to senso → ${cBack}`);
  measure(`Discard this session's changes: the snapshot kept through 5 tab switches (the button counted ${c1b} then ${c2b}); a reload, leaving the venue and a Discard each start it again (${cReload} / ${cBack} / ${cD})`);
  await api('/api/admin/style', { action: 'reset', venue: 'senso' }, c); await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { welcome: true } }, c); await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'list' } }, c);
  await waitPublic('senso', (h) => publicVar(h, 'tabs.bg') === WHITE && publicVar(h, 'rows.bg') === WHITE && /id="welcome"/.test(h) && layoutOf(h, sec.id) === 'list');
}
await laptop.close();
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'style-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'style-drill.txt'), [`Style drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((x) => `${x.at} [${x.step}] ${x.text}`)].join('\n') + '\n');
console.log(`STYLE DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
