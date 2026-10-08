#!/usr/bin/env node
// Style tab acceptance (Kian, 2026-10-08: colours grouped by page region, linked colours, readability guard), measured by Playwright:
//   day-one defaults: every colour variable the public pages serve equals the colour the code had before the tokens (the six
//     pure-black places now use the kit's ink, listed as the known difference);
//   task target on an iPhone viewport with the tap count: change the category bar background (Style tab, group, swatch);
//   the preview shows a saved colour within 1 s with "Saved · Undo"; the public page carries it; Undo restores it;
//   linked colours: a new row background re-derives its Auto text tokens, a Custom token stays as set; Reset group, then Undo;
//   the readability guard, in the UI and on the route: gold on cream refused (≈2.5:1) with a one-tap nearest fix, navy on cream
//     allowed (≈12:1), Kebab Land red on #141414 refused for body text (≈3.1:1) and allowed for a large heading;
//   the preview and the controls point at each other: a tap on a region opens its group, an open group outlines its region;
//   the controls stay the master (Kian, 2026-10-08): after a tap in the preview, a colour saved in another group keeps that group
//     open through the save, the data reload and the preview reload (the regression of the "jump" bug); a tap on the open group's
//     region keeps the open colour;
//   section layout (Kian, 2026-10-08): a section switched to Grid in the Layout group renders two-column cards on the public page
//     (same item popup), the preview shows it, Undo puts the list back; staff cannot set it (the admin drill checks the 403);
//   Reset all colours with its confirmation, then Undo; the Persian view keeps the same colours.
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
const varsOf = (html) => Object.fromEntries([...html.matchAll(/(--c-[a-z-]+):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const publicVar = (html, key) => varsOf(html)[cssVar(key)];
// WCAG 2 contrast, the same maths as src/venues/tokens.ts
const lin = (x) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r1 = (n) => Math.round(n * 10) / 10;

// The look of the two brand pages before the tokens (recorded from the code at commit 8cffa11, the white kit of 2026-10-07).
const INK = '#1d1d1f', GREY = '#6b6b6b', LINE = '#e6e6e6', BAND = '#f3f3f3', WHITE = '#ffffff';
const KIT = { 'page.bg': WHITE, 'page.text': INK, 'page.band': BAND, 'header.bg': WHITE, 'header.langBg': '#f2f2f2', 'header.langText': INK, 'tabs.bg': WHITE, 'tabs.text': GREY, 'tabs.active': '#000000', 'tabs.indicator': '#000000', 'tabs.list': '#000000', 'tabs.line': LINE, 'headings.title': INK, 'headings.note': GREY, 'rows.bg': WHITE, 'rows.name': INK, 'rows.desc': GREY, 'rows.price': INK, 'rows.chipBg': BAND, 'rows.chipText': INK, 'rows.photo': BAND, 'rows.line': LINE, 'sheet.bg': WHITE, 'sheet.title': '#000000', 'sheet.price': '#000000', 'sheet.body': '#545454', 'sheet.muted': GREY, 'sheet.line': LINE, 'sheet.hero': BAND, 'sheet.closeBg': WHITE, 'sheet.closeIcon': '#000000', 'sheet.dim': '#000000', 'footer.bg': WHITE, 'footer.address': GREY, 'footer.hours': GREY, 'intro.bg': WHITE };
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
  const extra = Object.keys(vars).filter((n) => !Object.keys(expected).some((k) => cssVar(k) === n));
  const g = await fetch(`${base}/api/admin/style?venue=${venue}`, { headers: { cookie } }); const j = await g.json().catch(() => null);
  const badLabels = (j?.tokens || []).filter((t) => !/^[A-Z“]/.test(t.label) || /[._-]{1}[a-z]/.test(t.label.replace(/-list/, '')) || t.label.includes('.'));
  check(`day-one-${venue}`, diff.length === 0 && missing.length === 0 && extra.length === 0 && known.length === 6 && j?.groups?.length === 8 && badLabels.length === 0, `${venue}: ${same.length} of ${Object.keys(expected).length} served colours equal the pre-token look; known differences (pure black → ink) ${known.length}: ${known.join(', ')}; unexpected ${diff.length}${diff.length ? ` (${diff.join('; ')})` : ''}; missing ${missing.length}; extra variables ${extra.length}; API: ${j?.groups?.length} groups, ${j?.tokens?.length} tokens with plain-words labels (${badLabels.length} not), palette of ${j?.palette?.length} venue colours, layout options ${(j?.layout || []).map((o) => o.key).join('+')}`);
  await fs.writeFile(path.join(out, `day-one-${venue}.json`), JSON.stringify({ venue, served: vars, expected, same, known, diff, missing, extra, api: j && { groups: j.groups, tokens: j.tokens, palette: j.palette, layout: j.layout } }, null, 2));
}

// ---- 2. phone: the task target with the tap count
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
  await openGroup('tabs'); await sleep(150);
  const tabsOutlined = await frameEval((d) => d.querySelector('#tabs')?.classList.contains('roses-region') && !d.querySelector('main footer')?.classList.contains('roses-region'));
  await openGroup('sheet'); await sleep(300);
  const sheet = await frameEval((d) => { const s = d.getElementById('sheet'); return { open: s?.open, outlined: s?.classList.contains('roses-region') }; });
  await snap(l, 'region-sheet');
  await openGroup('intro'); await sleep(300);
  const intro = await frameEval((d) => { const i = d.getElementById('intro'); const s = d.getElementById('sheet'); return { display: i ? getComputedStyle(i).display : 'absent', sheetClosed: !s?.open }; });
  await snap(l, 'region-intro');
  await frameEval((d) => { d.querySelector('li.item h3').click(); });
  await l.waitForSelector('[data-style-group="rows"][data-open]');
  const rowsOutlined = await frameEval((d) => !!d.querySelector('main section ul.roses-region') && getComputedStyle(d.getElementById('intro')).display === 'none');
  check('region-outline', tabsOutlined && sheet.open && sheet.outlined && intro.display !== 'none' && intro.sheetClosed && rowsOutlined, `opening a group outlines its region: Category tabs → #tabs outlined (${tabsOutlined}); Item popup → the first item's sheet opened and outlined (${sheet.open && sheet.outlined}); Intro → the logo overlay shown frozen (display ${intro.display}, sheet closed again: ${intro.sheetClosed}); a tap on an item row → Item rows open and its lists outlined (${rowsOutlined})`);
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
    const savedGrid = await waitDb('select layout from sections where id = $1', [sec.id], (r) => r?.layout === 'grid');
    const pubGrid = await waitPublic('senso', (h) => cardsOf(h)?.layout === 'grid');
    const after = cardsOf(pubGrid.html || await publicHtml('senso'));
    let shownAt = null; const tp = Date.now(); while (Date.now() - tp < 6000) { if (await frameEval((d, id) => !!d.querySelector(`section[data-id="${id}"] ul[data-layout="grid"]`), sec.id)) { shownAt = Date.now() - t0; break; } await sleep(40); }
    const frameGrid = await frameEval((d, id) => { const ul = d.querySelector(`section[data-id="${id}"] ul[data-layout="grid"]`); if (!ul) return null; const cs = getComputedStyle(ul); const cards = [...ul.querySelectorAll('li.item')]; const r = cards.slice(0, 2).map((c) => c.getBoundingClientRect()); return { display: cs.display, columns: cs.gridTemplateColumns.split(' ').length, cards: cards.length, sideBySide: r.length === 2 && Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right, photoW: Math.round(cards[0].querySelector('img, div[aria-hidden]')?.getBoundingClientRect().width || 0) }; }, sec.id);
    // the popup opens from a card like from a row: on the customers' page (in the Style tab's preview every tap is intercepted by design: it picks a region)
    const cust = await laptop.newPage(); await cust.goto(`${base}/senso`, { waitUntil: 'load' }); await cust.waitForFunction(() => document.documentElement.dataset.intro === 'done');
    const sheet = await cust.evaluate((id) => { const card = document.querySelector(`section[data-id="${id}"] li.item.card`); card.click(); const s = document.getElementById('sheet'); const title = s.querySelector('h2 [lang=en]')?.textContent; const open = s.open; s.close(); return { open, title, cardTitle: card.querySelector('h3 [lang=en]')?.textContent }; }, sec.id);
    await cust.close();
    const toast = await l.waitForSelector('[role=status]:has-text("Grid")').then(() => true).catch(() => false);
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
await laptop.close();
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'style-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'style-drill.txt'), [`Style drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((x) => `${x.at} [${x.step}] ${x.text}`)].join('\n') + '\n');
console.log(`STYLE DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
