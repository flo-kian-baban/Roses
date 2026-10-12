#!/usr/bin/env node
// Preview control bar acceptance (Kian, 2026-10-09; the bar moved into the Style tab on 2026-10-10), measured by Playwright:
//   the bar is in the Style tab only: at the top of the tab on a laptop, in the bottom sheet's header on a phone; none beside the
//     iPhone, none on the Menu tab, none in the phone's full-screen preview;
//   task target on the iPhone 13 viewport with the tap count: from the Menu tab, preview the welcome screen in Winter, in the evening,
//     in Persian (Style, Winter, Evening, FA: choosing a season or a time of day shows the welcome screen) in at most 4 taps; the
//     greeting and the scene match; the customers' page and venues.style are unchanged (byte for byte, nothing saved);
//   every switch of the bar shows within 300 ms, on the phone and on a laptop: the four screens, the two languages, the four seasons
//     (another season's scene is fetched from the admin API), the three times of day, Replay;
//   the preview keeps its frame across the tabs (no reload on a tab switch): the Menu tab shows the menu, the Style tab its own screen
//     again on return;
//   after a save in the Style tab the preview stays on its screen: the section list open again, the item popup open again (position
//     memory for a colour save is in the Style drill);
//   a language button on the previewed welcome screen opens the menu in that language inside the preview;
//   the customers' HTML carries no preview markup and is identical before and after the drill.
// Needs the production server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DRILL_ADMIN_PIN=… node scripts/preview-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/preview --jpeg
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000', VENUE = 'senso';
const out = path.resolve(args.out || 'reports/checkpoint-b/preview');
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const transcript = []; const results = []; const measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('preview-drill', (t) => log('db', t));
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); log('shot', f); return f; };
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t }; await sleep(120); } return { ok: false, ms: Date.now() - t, html }; }
async function signin(page, venue) { await page.goto(`${base}/admin/${venue}`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); await page.waitForSelector('[data-item]'); }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
const frameReady = (p) => p.waitForFunction((v) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return !!d && d.readyState === 'complete' && d.location.pathname === `/${v}`; }, VENUE);
const fe = (p, fn, arg) => p.evaluate(([src, a]) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return d ? (new Function('d', 'arg', `return (${src})(d, arg)`))(d, a) : null; }, [fn.toString(), arg]);
// what the frame shows
const PROBE = (d) => { const h = d.documentElement, w = d.getElementById('welcome'), s = d.getElementById('sheet'), l = d.getElementById('sections-dialog'); const vis = (sel) => { const e = d.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }; return { welcome: w ? getComputedStyle(w).display : 'absent', state: h.dataset.welcome || null, season: w?.dataset.season ?? null, scene: [...d.querySelectorAll('#welcome .scene')].map((e) => e.dataset.scene).join('+'), particles: d.querySelectorAll('#welcome .scene .p').length, greet: h.dataset.greet ?? null, greetShown: ['morning', 'afternoon', 'evening'].filter((g) => vis(`.welcome-greet .g[data-g="${g}"]`)).join('+'), lang: h.lang, dir: h.dir, sheet: !!s?.open, sheetTitle: (s?.querySelector('h2 [lang=en]') ?? s?.querySelector('h2.sheet-title'))?.textContent ?? null, sheetPrice: s?.querySelector('.sheet-price bdi')?.textContent ?? null, list: !!l?.open, y: Math.round(d.defaultView.scrollY), running: w ? w.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0, mark: d.rosesMark ?? null }; };
const probe = (p) => fe(p, PROBE);
const pressed = (p) => p.evaluate(() => ({ screen: document.querySelector('[data-preview-screen][aria-pressed="true"]')?.dataset.previewScreen ?? null, lang: document.querySelector('[data-preview-lang][aria-pressed="true"]')?.dataset.previewLang ?? null, season: document.querySelector('[data-preview-season][aria-pressed="true"]')?.dataset.previewSeason ?? null, slot: document.querySelector('[data-preview-slot][aria-pressed="true"]')?.dataset.previewSlot ?? null }));
// a bar switch, timed from the click until the frame shows it (polled every 10 ms; the poll itself costs a few ms)
async function switchTo(p, sel, pred, label, limit = 300) { const t = Date.now(); await p.click(sel); let ms = null; while (Date.now() - t < 4000) { if (pred(await probe(p))) { ms = Date.now() - t; break; } await sleep(10); } return { label, ms, ok: ms != null && ms <= limit }; }
const styleOf = async () => JSON.stringify((await db.query(`select style from venues where id = $1`, [VENUE])).rows[0].style);

const htmlBefore = { senso: await publicHtml('senso'), 'kebab-land': await publicHtml('kebab-land') };
const styleBefore = await styleOf();
const pageSeason = (htmlBefore.senso.match(/id="welcome"[^>]*data-season="([a-z]+)"/) || [])[1];
const otherSeason = pageSeason === 'winter' ? 'summer' : 'winter';
const bars = (p) => p.$$eval('[data-preview-bar]', (els) => els.map((e) => e.dataset.previewBar));
const STYLE_TAB = `a[href="/admin/${VENUE}?tab=style"]:visible`, MENU_TAB = `a[href="/admin/${VENUE}"]:visible:has-text("Menu")`;

// ---- A. phone (iPhone 13): the task target from the Menu tab, then every switch timed
{
  const phone = await browser.newContext(DEVICE); const p = await phone.newPage();
  p.on('pageerror', (e) => log('pageerror', e.message));
  await signin(p, VENUE);
  // the Menu tab and its full-screen preview carry no bar (Kian, 2026-10-10: the bar belongs to the Style tab)
  const onMenu = await bars(p);
  await p.click('button:has-text("Preview")'); await frameReady(p); await sleep(200);
  const inOverlay = await bars(p); const status = (await p.textContent('[data-preview-status]').catch(() => '')) || '';
  await snap(p, 'menu-preview-no-bar');
  await p.click('div:has(> [data-preview-area]) > div > button:has-text("Edit")'); await p.waitForSelector('[data-item]');
  check('bar-style-only-phone', onMenu.length === 0 && inOverlay.length === 0 && /Tap anything to edit it/.test(status), `phone, Menu tab: ${onMenu.length} preview bars; its full-screen preview: ${inOverlay.length} bars, its top row reads "${status.trim()}"`);
  let taps = 0; const tap = async (sel) => { taps++; await p.click(sel); };
  await tap(STYLE_TAB); await p.waitForSelector('[data-style-sheet] [data-preview-bar="phone"]'); await frameReady(p); await sleep(200);
  const before = await probe(p);
  const stillBar = await snap(p, 'preview-bar-phone');
  const tWinter = Date.now(); await tap(`[data-preview-season="${otherSeason}"]`);
  let shownAt = null; while (Date.now() - tWinter < 4000) { const s = await probe(p); if (s.welcome === 'grid' && s.scene === otherSeason && s.particles > 0) { shownAt = Date.now() - tWinter; break; } await sleep(10); }
  await tap('[data-preview-slot="evening"]'); await sleep(60);
  await tap('[data-preview-lang="fa"]'); await sleep(120);
  const after = await probe(p); const bar = await pressed(p);
  const htmlAfter = await publicHtml('senso'); const styleAfter = await styleOf();
  const still = await snap(p, `preview-phone-welcome-${otherSeason}-evening-fa`);
  const ok = taps === 4 && before.welcome === 'none' && after.welcome === 'grid' && after.scene === otherSeason && after.season === otherSeason && after.particles > 0 && after.particles <= 20 && after.greet === 'evening' && after.greetShown === 'evening' && after.lang === 'fa' && after.dir === 'rtl' && after.running > 0 && bar.screen === 'welcome' && bar.season === otherSeason && bar.slot === 'evening' && bar.lang === 'fa' && htmlAfter === htmlBefore.senso && styleAfter === styleBefore && shownAt != null;
  check('t-welcome-preview', ok, `from the Menu tab on the phone: ${taps} taps (Style, ${otherSeason[0].toUpperCase() + otherSeason.slice(1)}, Evening, FA) → the welcome screen (display ${after.welcome}, ${after.running} animations running) with the ${after.scene} scene (${after.particles} particles; the page's own season is ${pageSeason}) ${shownAt} ms after the season tap, the evening greeting (data-greet ${after.greet}, shown: ${after.greetShown}), Persian (lang ${after.lang}, dir ${after.dir}); the bar reads ${JSON.stringify(bar)}; the customers' page byte-identical: ${htmlAfter === htmlBefore.senso}; venues.style unchanged: ${styleAfter === styleBefore}; stills ${stillBar}, ${still}`);
  measure(`preview the welcome screen in ${otherSeason}, in the evening, in Persian from the Menu tab: ${taps} taps (Style, season, time of day, language); the scene shown ${shownAt} ms after the season tap`);
  // every switch of the bar, timed
  const t = [];
  t.push(await switchTo(p, '[data-preview-screen="menu"]', (s) => s.welcome === 'none' && !s.sheet && !s.list, 'Menu'));
  t.push(await switchTo(p, '[data-preview-screen="sheet"]', (s) => s.sheet && s.welcome === 'none', 'Item popup'));
  t.push(await switchTo(p, '[data-preview-screen="list"]', (s) => s.list && !s.sheet, 'Section list'));
  t.push(await switchTo(p, '[data-preview-screen="welcome"]', (s) => s.welcome === 'grid' && !s.list, 'Welcome'));
  t.push(await switchTo(p, '[data-preview-lang="en"]', (s) => s.lang === 'en' && s.dir === 'ltr', 'EN'));
  t.push(await switchTo(p, '[data-preview-lang="fa"]', (s) => s.lang === 'fa' && s.dir === 'rtl', 'FA'));
  for (const season of ['fall', 'winter', 'spring', 'summer']) t.push(await switchTo(p, `[data-preview-season="${season}"]`, (s) => s.scene === season && s.season === season && s.particles > 0, `${season}${season === pageSeason ? ' (the page\'s own)' : ''}`));
  for (const slot of ['morning', 'afternoon', 'evening']) t.push(await switchTo(p, `[data-preview-slot="${slot}"]`, (s) => s.greet === slot && s.greetShown === slot, slot));
  // Replay on an artwork scene (senso's fall and winter) draws fresh particles; on every scene the entrance animations start over
  await p.click(`[data-preview-season="${pageSeason === 'winter' ? 'winter' : 'fall'}"]`); await sleep(300);
  const firstParticle = await fe(p, (d) => { const e = d.querySelector('#welcome .scene .p'); if (e) e.setAttribute('data-drill-old', '1'); return { marked: !!e, engine: !!d.querySelector('#welcome .scene[data-engine]'), scene: d.querySelector('#welcome .scene')?.dataset.scene }; });
  await sleep(1500); // well into the entrance, so a restart is visible as a small current time
  t.push(await switchTo(p, '[data-preview-replay]', (s) => s.welcome === 'grid', 'Replay'));
  await sleep(100); const replaced = await fe(p, (d) => ({ oldGone: !d.querySelector('#welcome .scene .p[data-drill-old]'), particles: d.querySelectorAll('#welcome .scene .p').length, logoAnim: d.querySelector('#welcome .welcome-card img, #welcome .welcome-card .welcome-name')?.getAnimations().map((a) => Math.round(a.currentTime)).join(',') ?? null }));
  const restarted = replaced.logoAnim != null && Number(replaced.logoAnim.split(',')[0]) < 600;
  const worst = Math.max(...t.map((x) => x.ms ?? 9999));
  check('bar-timing-phone', t.every((x) => x.ok) && firstParticle.marked && (!firstParticle.engine || replaced.oldGone) && restarted, `every switch shows within 300 ms on the phone (worst ${worst} ms): ${t.map((x) => `${x.label} ${x.ms ?? 'never'} ms`).join(', ')}; Replay on the ${firstParticle.scene} scene 1.5 s into the entrance: the logo's entrance animation back at ${replaced.logoAnim} ms (restarted: ${restarted})${firstParticle.engine ? `, a fresh artwork scene drawn (old particles gone: ${replaced.oldGone}, ${replaced.particles} particles)` : ` (a fixed scene: ${replaced.particles} particles restart with it)`}`);
  measure(`preview bar on the phone: every switch within ${worst} ms (screens, languages, seasons fetched from the admin API, times of day, Replay)`);
  await p.click('[data-preview-lang="en"]'); await p.click(`[data-preview-season="${pageSeason}"]`); await p.click('[data-preview-slot="afternoon"]'); await p.click('[data-preview-screen="menu"]');
  await phone.close();
}

// ---- B. laptop: the bar at the top of the Style tab, the Style tab's screen across the tabs, the screen kept through a save, a language
// tap on the previewed welcome screen
const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const l = await laptop.newPage();
l.on('pageerror', (e) => log('pageerror', e.message));
await signin(l, VENUE); await frameReady(l); await sleep(300);
const cookie = await cookieOf(laptop);
{ // the bar is in the Style tab, at its top, and stays in view while the tab scrolls; nothing beside the iPhone
  const onMenu = await bars(l);
  await l.click(STYLE_TAB); await l.waitForSelector('[data-style-group="rows"]'); await sleep(300);
  const onStyle = await bars(l);
  const where = await l.evaluate(() => { const b = document.querySelector('[data-preview-bar]'), aside = document.querySelector('aside'); return { inAside: !!aside?.querySelector('[data-preview-bar]'), inColumn: !!b?.closest('[data-style-bar]'), top: Math.round(b?.getBoundingClientRect().top ?? -1), groupTop: Math.round(document.querySelector('[data-style-group]')?.getBoundingClientRect().top ?? -1) }; });
  await l.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
  const scrolled = await l.evaluate(() => { const r = document.querySelector('[data-preview-bar]')?.getBoundingClientRect(); return { y: Math.round(window.scrollY), top: Math.round(r?.top ?? -1), visible: !!r && r.top >= 0 && r.bottom <= innerHeight }; });
  await l.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  check('bar-style-only-laptop', onMenu.length === 0 && onStyle.join() === 'laptop' && !where.inAside && where.inColumn && where.top < where.groupTop && scrolled.y > 0 && scrolled.visible, `laptop: Menu tab ${onMenu.length} bars; Style tab ${onStyle.length} (${onStyle.join()}), in the Style column ${where.inColumn}, beside the iPhone ${where.inAside}, its top at ${where.top} px above the first group (${where.groupTop} px); the tab scrolled by ${scrolled.y} px → the bar still in view at ${scrolled.top} px (${scrolled.visible})`);
}
{
  const t = [];
  t.push(await switchTo(l, '[data-preview-screen="welcome"]', (s) => s.welcome === 'grid', 'Welcome'));
  t.push(await switchTo(l, `[data-preview-season="${otherSeason}"]`, (s) => s.scene === otherSeason && s.particles > 0, otherSeason));
  t.push(await switchTo(l, '[data-preview-slot="morning"]', (s) => s.greet === 'morning', 'morning'));
  t.push(await switchTo(l, '[data-preview-lang="fa"]', (s) => s.lang === 'fa', 'FA'));
  await sleep(900); const still = await snap(l, 'preview-bar-laptop');
  t.push(await switchTo(l, '[data-preview-lang="en"]', (s) => s.lang === 'en', 'EN'));
  t.push(await switchTo(l, '[data-preview-screen="sheet"]', (s) => s.sheet && s.welcome === 'none', 'Item popup'));
  t.push(await switchTo(l, '[data-preview-screen="list"]', (s) => s.list && !s.sheet, 'Section list'));
  t.push(await switchTo(l, '[data-preview-screen="menu"]', (s) => !s.list && !s.sheet && s.welcome === 'none', 'Menu'));
  const worst = Math.max(...t.map((x) => x.ms ?? 9999));
  const note = await l.textContent('[data-preview-note]');
  check('bar-timing-laptop', t.every((x) => x.ok) && /preview only/i.test(note || '') && /customers/i.test(note || ''), `every switch shows within 300 ms on the laptop (worst ${worst} ms): ${t.map((x) => `${x.label} ${x.ms ?? 'never'} ms`).join(', ')}; the bar says "${(note || '').trim()}"; still ${still}`);
  measure(`preview bar on the laptop: every switch within ${worst} ms`);
}
{ // the frame is kept across the tabs (no reload): the Menu tab shows the menu, the Style tab its own screen again on return
  await l.click('[data-preview-screen="welcome"]'); await sleep(100);
  await fe(l, (d) => { d.rosesMark = 'kept'; });
  await l.click(MENU_TAB); await l.waitForSelector('[data-item]'); await sleep(300);
  const onMenu = await probe(l); const barsMenu = await bars(l); const urlMenu = l.url();
  await l.click(STYLE_TAB); await l.waitForSelector('[data-style-group="rows"]'); await sleep(300);
  const onStyle = await probe(l); const barStyle = await pressed(l); const urlStyle = l.url();
  check('screen-across-tabs', onMenu.welcome === 'none' && barsMenu.length === 0 && onMenu.mark === 'kept' && onStyle.welcome === 'grid' && barStyle.screen === 'welcome' && onStyle.mark === 'kept' && /tab=style$/.test(urlStyle) && !/tab=/.test(urlMenu), `Style tab on Welcome → Menu tab shows the menu (overlay ${onMenu.welcome}, ${barsMenu.length} bars) in the same frame (${onMenu.mark}; URL ${urlMenu}) → back to Style: Welcome again (${barStyle.screen}, overlay ${onStyle.welcome}), the frame still the same document (${onStyle.mark}; URL ${urlStyle})`);
  measure('switching tabs keeps the preview frame (no reload); the Style tab\'s screen comes back with it');
}
{ // a language tap on the previewed welcome screen
  const t = Date.now();
  await fe(l, (d) => { d.querySelector('#welcome button[data-lang="fa"]').click(); });
  let s = null; while (Date.now() - t < 3000) { s = await probe(l); if (s.welcome === 'none' && s.lang === 'fa') break; await sleep(10); }
  const bar = await pressed(l);
  check('welcome-lang-tap', s.welcome === 'none' && s.lang === 'fa' && s.dir === 'rtl' && s.state === 'off' && bar.lang === 'fa' && bar.screen === 'menu', `tap on فارسی inside the previewed welcome screen → the menu in Persian ${Date.now() - t} ms later (overlay ${s.welcome}, lang ${s.lang}, dir ${s.dir}); the page's own handler did not run (data-welcome stays "${s.state}"); the bar follows: language ${bar.lang}, screen ${bar.screen}`);
  await l.click('[data-preview-lang="en"]');
}
{ // after a save in the Style tab the preview stays on its screen: a section's layout saved with the section list open, then with the item popup open
  const sec = (await db.query(`select id, name->>'en' as name, layout from sections where venue_id = $1 and listed order by position desc limit 1`, [VENUE])).rows[0];
  await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'list' } }, cookie); // the precondition (a scratch copy carries Kian's own choices)
  await l.reload(); await l.waitForSelector(`[data-section-layout="${sec.id}"]`); await frameReady(l); await sleep(300);
  const layoutBtn = (v) => `[data-section-layout="${sec.id}"] button[role=radio]:has-text("${v}")`;
  await l.click('[data-preview-screen="list"]'); await sleep(300);
  const listBefore = await probe(l);
  await l.click(layoutBtn('Grid')); await l.waitForSelector('[role=status]:has-text("Grid")'); await frameReady(l); await sleep(900);
  const listAfter = await probe(l); const barList = await pressed(l);
  const still1 = await snap(l, 'list-kept-after-save');
  await l.click('[data-preview-screen="sheet"]'); await sleep(400);
  const sheetBefore = await probe(l);
  await l.click(layoutBtn('List')); await l.waitForSelector('[role=status]:has-text("List")'); await frameReady(l); await sleep(900);
  const sheetAfter = await probe(l); const barSheet = await pressed(l);
  const still2 = await snap(l, 'popup-kept-after-save');
  const layout = (await db.query('select layout from sections where id = $1', [sec.id])).rows[0].layout;
  check('screen-kept-after-save', listBefore.list && listAfter.list && !listAfter.sheet && listAfter.welcome === 'none' && barList.screen === 'list' && sheetBefore.sheet && sheetAfter.sheet && sheetAfter.sheetTitle === sheetBefore.sheetTitle && sheetAfter.welcome === 'none' && barSheet.screen === 'sheet' && layout === 'list', `Style tab, section list open, "${sec.name}" saved as Grid → after the reload the list is open again (${listAfter.list}; popup ${listAfter.sheet}, overlay ${listAfter.welcome}; the bar on ${barList.screen}); item popup on "${sheetBefore.sheetTitle}", "${sec.name}" saved as List → the popup open again on "${sheetAfter.sheetTitle}" (overlay ${sheetAfter.welcome}; the bar on ${barSheet.screen}); the section back to ${layout}; stills ${still1}, ${still2}`);
  measure('after a save in the Style tab the preview is back on its screen (section list; item popup)');
  await l.click('[data-preview-screen="menu"]');
  if (sec.layout !== 'list') await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: sec.layout } }, cookie); // as it was, so the customers' page compares byte for byte
}
{ // seasonal items (Kian, 2026-10-12): the bar's season switch shows each season's Seasonal section in the preview; the customers' page
  // is unchanged by it. Four of Senso's items put in its Seasonal section through the admin, one per season; removed again afterwards.
  const ck = await cookieOf(laptop);
  const TITLE = { fall: 'Fall specials', winter: 'Winter specials', spring: 'Spring specials', summer: 'Summer specials' };
  const ss = (await db.query(`select id from sections where venue_id = $1 and seasonal`, [VENUE])).rows[0].id;
  const its = (await db.query(`select i.id, i.name->>'en' as name, array(select section_id from item_sections where item_id = i.id order by position) as secs from items i where i.venue_id = $1 and i.listed and cardinality(i.seasons) = 0 and not exists (select 1 from item_sections x where x.item_id = i.id and x.section_id = $2) and exists (select 1 from item_sections x join sections s on s.id = x.section_id where x.item_id = i.id and s.listed) order by i.name->>'en' limit 4`, [VENUE, ss])).rows;
  const SEAS = ['fall', 'winter', 'spring', 'summer'], by = {};
  for (let i = 0; i < 4; i++) { by[SEAS[i]] = its[i]; await api('/api/admin/item', { action: 'update', id: its[i].id, patch: { seasons: [SEAS[i]], section_ids: [...its[i].secs, ss] } }, ck); }
  const seasonalIn = (h) => { const m = h.match(/<section[^>]*class="[^"]*\bseasonal\b[^"]*"[^>]*>[\s\S]*?<\/section>/); return m ? m[0] : null; };
  for (let t = Date.now(); Date.now() - t < 10000 && !(seasonalIn(await publicHtml(VENUE)) || '').includes(by[pageSeason].id);) await sleep(150);
  const pubBefore = await publicHtml(VENUE);
  // the items were saved through the API, not the editor: the admin page reloaded (Style tab), its frame shows the page as saved
  await l.click(STYLE_TAB).catch(() => {}); await l.reload(); await l.waitForSelector('[data-preview-season]'); await frameReady(l); await l.click('[data-preview-screen="menu"]');
  for (let t = Date.now(); Date.now() - t < 8000;) { const x = await fe(l, (d) => !!d.querySelector('section.seasonal')); if (x) break; await sleep(100); }
  const rows = [];
  for (const S of [...SEAS.filter((x) => x !== pageSeason), pageSeason]) {
    const t0 = Date.now(); await l.click(`[data-preview-season="${S}"]`);
    let seen = null, ms = null;
    while (Date.now() - t0 < 5000) { seen = await fe(l, (d) => { const sec = d.querySelector('section.seasonal'); return sec ? { title: sec.querySelector('h2 span[lang="en"]')?.textContent ?? sec.querySelector('h2')?.textContent, ids: [...sec.querySelectorAll('li.item')].map((li) => li.dataset.id), first: d.querySelector('main section[data-id]') === sec } : null; }); if (seen && seen.title === TITLE[S] && seen.ids.join() === by[S].id && seen.first) { ms = Date.now() - t0; break; } await sleep(20); }
    rows.push({ S, ok: ms !== null, ms, seen });
  }
  const pubAfter = await publicHtml(VENUE);
  await snap(l, 'preview-seasonal');
  check('preview-seasonal', rows.every((r) => r.ok) && pubAfter === pubBefore && !!seasonalIn(pubBefore), `Style tab on a laptop, the bar's season switched through ${rows.map((r) => r.S).join(', ')} with four of Senso's items in its Seasonal section (one per season): the frame shows ${rows.map((r) => `${r.S} → ${r.ok ? `“${TITLE[r.S]}” with ${by[r.S].name}, first, ${r.ms} ms` : `NOT (${JSON.stringify(r.seen)})`}`).join('; ')}; the customers' page byte for byte the same before and after the switches (${pubAfter === pubBefore}, ${pubBefore.length} B; it shows ${pageSeason}'s section only)`);
  measure(`the preview's season switch shows that season's Seasonal section within ${Math.max(...rows.map((r) => r.ms ?? 9999))} ms`);
  for (const S of SEAS) await api('/api/admin/item', { action: 'update', id: by[S].id, patch: { seasons: [], section_ids: by[S].secs } }, ck);
  for (let t = Date.now(); Date.now() - t < 10000 && seasonalIn(await publicHtml(VENUE));) await sleep(150);
}
await laptop.close();
{ // the customers' HTML: no preview markup, identical before and after (nothing of the bar is saved)
  const after = { senso: await publicHtml('senso'), 'kebab-land': await publicHtml('kebab-land') };
  const markers = (h) => (h.match(/roses-preview|data-preview|roses-show-welcome|roses-region|rosesSynthetic/g) || []).length;
  const same = Object.keys(after).every((v) => after[v] === htmlBefore[v]);
  check('public-unchanged', same && markers(after.senso) === 0 && markers(after['kebab-land']) === 0, `the customers' HTML of both venues is byte-identical before and after the drill (${same}; senso ${after.senso.length} B, kebab-land ${after['kebab-land'].length} B) and carries no preview markup (${markers(after.senso) + markers(after['kebab-land'])} markers)`);
}
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'preview-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'preview-drill.txt'), [`Preview drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((x) => `${x.at} [${x.step}] ${x.text}`)].join('\n') + '\n');
console.log(`PREVIEW DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
