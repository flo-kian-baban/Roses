#!/usr/bin/env node
// Welcome screen acceptance (Kian, 2026-10-09: the overlay that replaced the logo intro), measured by Playwright on the iPhone 13
// viewport for senso and kebab-land:
//   greeting boundaries with a mocked device clock (the browser context runs in UTC, so the wall clock is the mocked instant): 04:59 /
//     05:00 / 11:59 / 12:00 / 16:59 / 17:00, read from the html attribute the head script sets, both languages shown (the season is the
//     page's since the PM's decision of 2026-10-09, current season only: its boundaries are render tests in scripts/season-drill.mjs);
//   the scene of the season the page was rendered for: at most 20 particles, every running animation on transform or opacity only;
//     reduced motion: shown but still, the fade instant (with a transition: the 150 ms fade of Kian's ruling);
//   the tap: the menu visible within 300 ms (measured in the page from the click to the overlay gone), the language set and stored,
//     pre-highlighted on the next load (English, then Persian, whose greeting line then reads first); on a page with a transition into
//     the menu (Senso since 2026-10-10, Kian's ruling; the transitions themselves: scripts/transition-drill.mjs) the menu usable within
//     300 ms (the overlay lets taps through, the menu no longer inert, the page scrollable) and the overlay gone within 900 ms;
//   a section anchor in the URL: the browser scrolls there behind the overlay, the choice puts the page at the top with the first tab active (Kian, 2026-10-09, later);
//   keyboard and labels: Tab reaches the first button and Enter chooses it; role dialog, aria-modal, buttons ≥ 44 px tall with a name; the menu
//     behind is inert while the overlay is up and reachable again after the choice;
//   JavaScript off: the menu visible, no overlay; the kill switch on the Style route (owner): off → no overlay in the HTML and the menu shown
//     directly, on → back, both recorded; the default colours pass the thresholds (greeting 3:1, buttons 4.5:1);
//   budget: the added inline code (the overlay markup with its scene and script, plus the head decision script) ≤ 15 KB gzipped on senso
//     (the picked artwork included) and ≤ 10 KB on kebab-land, the welcome CSS block ≤ 10 KB; recordings and stills per season: the season drill.
// Needs the production server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue, for the kill switch).
//   DRILL_ADMIN_PIN=… node scripts/welcome-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/welcome --jpeg
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium, devices, webkit } from 'playwright';
import { connectDb } from './load-env.mjs';
import { scratchTarget } from './scratch-target.mjs';

// The target is a scratch server, or the drill stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('scripts/welcome-drill.mjs', { options: { base: 'server', out: 'path', jpeg: 'flag' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const jpeg = process.argv.includes('--jpeg');
const base = args.base;
const out = path.resolve(args.out);
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const transcript = []; const results = []; const measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('welcome-drill', (t) => log('db', t));
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium', timezoneId: 'UTC' };
const VENUES = ['senso', 'kebab-land'];
const browser = await chromium.launch();
const ext = jpeg ? 'jpg' : 'png';
const shot = async (page, name) => { const f = `${name}.${ext}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 80 } : {}) }); log('shot', f); return f; };
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t, html }; await sleep(120); } return { ok: false, ms: Date.now() - t, html }; }
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
const utc = (y, m, d, hh = 10, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh, mm));
// WCAG 2 contrast, the same maths as src/venues/tokens.ts
const lin = (x) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r1 = (n) => Math.round(n * 10) / 10;
const varsOf = (html) => Object.fromEntries([...html.matchAll(/(--c-[a-z-]+):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

// What the overlay shows right now, read inside the page.
const PROBE = () => {
  const h = document.documentElement, w = document.getElementById('welcome');
  const cs = w ? getComputedStyle(w) : null;
  const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const vis = (el) => shown(el) && Number(getComputedStyle(el).opacity) > 0;
  const g = h.dataset.greet || null;
  const slot = g && w ? w.querySelector(`.g[data-g="${g}"]`) : null;
  const line = (lang) => { const e = slot && slot.querySelector(`[lang=${lang}]`); return e ? { text: e.textContent, shown: shown(e), opacity: Number(getComputedStyle(e).opacity), top: Math.round(e.getBoundingClientRect().top) } : null; };
  const anims = w ? w.getAnimations({ subtree: true }) : [];
  const running = anims.filter((a) => a.playState === 'running');
  const props = [...new Set(running.flatMap((a) => (a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))) : [])))];
  const scene = w ? [...w.querySelectorAll('.scene')].filter((e) => getComputedStyle(e).display !== 'none') : [];
  const particles = scene.length === 1 ? [...scene[0].querySelectorAll('.p')] : [];
  let stored = null; try { stored = Object.keys(localStorage).filter((k) => k.startsWith('roses-')).map((k) => `${k}=${localStorage.getItem(k)}`); } catch { stored = null; }
  const logo = w ? w.querySelector('.welcome-card img, .welcome-name') : null;
  return {
    welcome: h.dataset.welcome || null, display: cs ? cs.display : 'absent', opacity: cs ? cs.opacity : null, visibility: cs ? cs.visibility : null, bg: cs ? cs.backgroundColor : null,
    greet: g, season: w ? w.dataset.season || null : null, saved: h.dataset.langSaved || null, lang: h.dataset.lang, dir: h.dir || 'ltr',
    en: line('en'), fa: line('fa'), otherSlotsHidden: w ? [...w.querySelectorAll('.g')].filter((e) => e.dataset.g !== g).every((e) => getComputedStyle(e).display === 'none') : null,
    buttons: w ? [...w.querySelectorAll('button[data-lang]')].map((b) => { const r = b.getBoundingClientRect(); const c = getComputedStyle(b); return { lang: b.dataset.lang, name: (b.getAttribute('aria-label') || b.textContent || '').trim(), pressed: b.getAttribute('aria-pressed'), h: Math.round(r.height), w: Math.round(r.width), bg: c.backgroundColor, color: c.color, opacity: Number(c.opacity) }; }) : [],
    shownScenes: scene.map((e) => e.dataset.scene), particles: particles.length, particlesVisible: particles.filter((p) => vis(p) && p.getBoundingClientRect().bottom > 0 && p.getBoundingClientRect().top < innerHeight).length,
    running: running.length, animatedProps: props, role: w ? w.getAttribute('role') : null, modal: w ? w.getAttribute('aria-modal') : null, inert: (() => { const m = document.querySelector('main'); return m ? m.inert : null; })(),
    logo: logo ? { visible: vis(logo), opacity: Number(getComputedStyle(logo).opacity) } : null, stored,
    rowVisible: vis(document.querySelector('main li.item')), headerVisible: vis(document.querySelector('main > header')), faHeadingVisible: !!document.querySelector('main h2 [lang=fa]') && document.querySelector('main h2 [lang=fa]').getClientRects().length > 0,
    y: Math.round(scrollY),
  };
};
// The tap, timed inside the page: from the click on the button to the overlay gone (display none, visibility hidden or opacity 0); also
// the moment the menu is usable (the overlay lets taps through, the menu no longer inert, the page scrollable), the page's transition
// into the menu if it carries one (#welcome-tx), and whether the overlay faded (an opacity strictly between 0 and 1 seen).
const TAP = (lang) => new Promise((res) => {
  const w = document.getElementById('welcome'), b = w.querySelector(`button[data-lang="${lang}"]`), m = document.querySelector('main'), tx = document.getElementById('welcome-tx'); let usable = null, faded = false; const start = performance.now(); b.click();
  const tick = () => { const cs = getComputedStyle(w); const t = performance.now() - start; const o = Number(cs.opacity); if (o > 0 && o < 1) faded = true;
    if (usable === null && (cs.display === 'none' || cs.pointerEvents === 'none') && !(m && m.inert) && getComputedStyle(document.body).overflowY !== 'hidden') usable = Math.round(t);
    const gone = cs.display === 'none' || cs.visibility === 'hidden' || o === 0;
    if (gone || t > 3000) res({ ms: Math.round(t), gone, usableMs: usable, faded, tx: tx ? tx.dataset.tx || 'yes' : null, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, welcome: document.documentElement.dataset.welcome, lang: document.documentElement.dataset.lang, dir: document.documentElement.dir, rowVisible: !!document.querySelector('main li.item') && document.querySelector('main li.item').getClientRects().length > 0, inert: document.querySelector('main') ? document.querySelector('main').inert : null, y: Math.round(scrollY) });
    else requestAnimationFrame(tick); };
  tick();
});
// The tap's targets: the menu visible within 300 ms; with a transition into the menu (Kian, 2026-10-10) usable within 300 ms and gone within 900 ms.
const tapOk = (tap) => (tap.tx ? tap.gone && tap.usableMs !== null && tap.usableMs <= 300 && tap.ms <= 900 : tap.gone && tap.ms <= 300);
const tapText = (tap) => (tap.tx ? `the menu usable after ${tap.usableMs} ms and the overlay gone after ${tap.ms} ms (transition ${tap.tx}; targets ≤ 300 and ≤ 900)` : `the overlay gone and the menu visible after ${tap.ms} ms (target ≤ 300)`);
// Reduced motion: the overlay goes at once; with a transition, in the 150 ms fade (an opacity seen between 0 and 1, gone in 120–230 ms).
const reducedOk = (tap) => (tap.tx ? tap.gone && tap.faded && tap.ms >= 120 && tap.ms <= 230 : tap.gone && tap.ms <= 60);
const settled = (page) => page.waitForFunction(() => { const b = document.querySelector('#welcome button[data-lang="fa"]'); return !!b && Number(getComputedStyle(b).opacity) === 1; }, null, { timeout: 5000 }).then(() => true).catch(() => false);
const off = (page) => page.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 5000 }).then(() => true).catch(() => false);
const sceneId = (venue) => (venue === 'senso' ? 'senso' : 'kebab');

// ---- 1. greeting boundaries with a mocked clock (senso)
{
  const ctx = await browser.newContext(DEVICE);
  const load = async (venue, when, waitEntrance) => { const page = await ctx.newPage(); await page.clock.setFixedTime(when); await page.goto(`${base}/${venue}`, { waitUntil: 'load' }); if (waitEntrance) await settled(page); const p = await page.evaluate(PROBE); await page.close(); return p; };
  const GREET = [[4, 59, 'evening'], [5, 0, 'morning'], [11, 59, 'morning'], [12, 0, 'afternoon'], [16, 59, 'afternoon'], [17, 0, 'evening']];
  const rows = [];
  for (const [hh, mm, want] of GREET) { const p = await load('senso', utc(2026, 10, 9, hh, mm), true); rows.push({ time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, want, got: p.greet, en: p.en?.text, fa: p.fa?.text, bothShown: !!p.en?.shown && !!p.fa?.shown && p.en.opacity === 1 && p.fa.opacity === 1, otherSlotsHidden: p.otherSlotsHidden, shown: p.welcome === 'show' && p.display === 'grid' }); }
  const ok = rows.every((r) => r.got === r.want && r.bothShown && r.otherSlotsHidden && r.shown);
  check('greeting-boundaries', ok, `senso, device clock mocked (UTC): ${rows.map((r) => `${r.time} → ${r.got}${r.got === r.want ? '' : ` (wanted ${r.want})`} "${r.en}" / "${r.fa}"`).join('; ')}; both languages shown and the other two greetings hidden in every case: ${ok}`);
  // the season boundaries are render tests with a fixed server clock in scripts/season-drill.mjs (the PM, 2026-10-09)
  await ctx.close();
}

// ---- 2. the scene and its motion; reduced motion
for (const venue of VENUES) {
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(utc(2026, 10, 9, 10, 30));
  await page.goto(`${base}/${venue}`, { waitUntil: 'load' }); await sleep(900);
  const p = await page.evaluate(PROBE);
  const onlyTO = p.animatedProps.every((x) => x === 'transform' || x === 'opacity');
  check(`scene-${venue}`, p.welcome === 'show' && !!p.season && p.shownScenes.join() === p.season && p.particles <= 20 && p.particles >= 10 && p.running > 0 && onlyTO && p.logo?.visible && p.role === 'dialog' && p.modal === 'true' && errors.length === 0, `${venue} ${p.season} scene (the page's season; the only scene in the HTML: ${p.shownScenes.join('+')}): ${p.particles} particles (≤ 20), ${p.running} animations running, properties animated: ${p.animatedProps.join(', ') || 'none'} (transform and opacity only: ${onlyTO}); logo visible: ${p.logo?.visible}; role ${p.role}, aria-modal ${p.modal}; page errors: ${errors.length}`);
  await ctx.close();
  const rctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' }); const rp = await rctx.newPage();
  await rp.clock.setFixedTime(utc(2026, 10, 9, 10, 30));
  await rp.goto(`${base}/${venue}`, { waitUntil: 'load' }); await sleep(150);
  const r = await rp.evaluate(PROBE);
  await shot(rp, `${venue}-reduced-motion`);
  const tap = await rp.evaluate(TAP, 'en');
  check(`reduced-motion-${venue}`, r.welcome === 'show' && r.display === 'grid' && r.running === 0 && r.particlesVisible >= 8 && r.en?.opacity === 1 && r.fa?.opacity === 1 && r.buttons.every((b) => b.opacity === 1) && r.logo?.opacity === 1 && r.headerVisible && reducedOk(tap), `${venue} with reduced motion: the welcome screen shown (display ${r.display}) with ${r.running} animations running, ${r.particlesVisible} particles of the ${r.particles} standing still in view, greeting and buttons fully visible at once (opacities ${r.en?.opacity}, ${r.fa?.opacity}, ${r.buttons.map((b) => b.opacity).join('/')}), the page behind visible (${r.headerVisible}); a tap removes it ${tap.tx ? `in the 150 ms fade (transition ${tap.tx}; an opacity between 0 and 1 seen: ${tap.faded}), gone after ${tap.ms} ms (120–230)` : `without a fade in ${tap.ms} ms`}`);
  await rctx.close();
}

// ---- 3. the tap and the remembered language (no mocked clock)
for (const venue of VENUES) {
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  await page.goto(`${base}/${venue}`, { waitUntil: 'load' }); const entrance = await settled(page);
  const first = await page.evaluate(PROBE);
  await shot(page, `${venue}-first-visit`);
  const tapEn = await page.evaluate(TAP, 'en'); const offEn = await off(page); await sleep(100);
  const afterEn = await page.evaluate(PROBE);
  await shot(page, `${venue}-after-english`);
  check(`tap-${venue}`, entrance && first.saved === null && first.buttons.every((b) => b.pressed === null) && first.inert === true && tapOk(tapEn) && tapEn.lang === 'en' && tapEn.rowVisible && offEn && afterEn.display === 'none' && afterEn.inert === false && (afterEn.stored || []).includes('roses-lang=en'), `${venue} first visit: no language pre-highlighted (saved ${first.saved}, pressed ${first.buttons.map((b) => b.pressed).join('/')}), the menu inert behind the overlay (${first.inert}); tap English → ${tapText(tapEn)} (lang ${tapEn.lang}, first row visible ${tapEn.rowVisible}), then display ${afterEn.display}, the menu reachable again (inert ${afterEn.inert}); stored: ${(afterEn.stored || []).join(', ')}`);
  measure(`${venue}: tap a language → ${tapEn.tx ? `menu usable in ${tapEn.usableMs} ms, transition ${tapEn.tx} over in ${tapEn.ms} ms` : `menu visible in ${tapEn.ms} ms`}`);
  await page.reload({ waitUntil: 'load' }); await settled(page);
  const again = await page.evaluate(PROBE); const vars = varsOf(await publicHtml(venue));
  const enBtn = again.buttons.find((b) => b.lang === 'en'), faBtn = again.buttons.find((b) => b.lang === 'fa');
  await shot(page, `${venue}-reload-english-remembered`);
  const tapFa = await page.evaluate(TAP, 'fa'); await off(page); await sleep(100);
  const afterFa = await page.evaluate(PROBE);
  await page.reload({ waitUntil: 'load' }); await settled(page);
  const third = await page.evaluate(PROBE); const faBtn3 = third.buttons.find((b) => b.lang === 'fa'), enBtn3 = third.buttons.find((b) => b.lang === 'en');
  await shot(page, `${venue}-reload-persian-remembered`);
  const active = rgb(vars['--c-welcome-active-bg']), plain = rgb(vars['--c-welcome-btn-bg']);
  check(`remembered-${venue}`, again.welcome === 'show' && again.saved === 'en' && enBtn?.pressed === 'true' && faBtn?.pressed === null && enBtn.bg === active && faBtn.bg === plain && tapOk(tapFa) && tapFa.lang === 'fa' && tapFa.dir === 'rtl' && afterFa.faHeadingVisible && (afterFa.stored || []).includes('roses-lang=fa') && third.saved === 'fa' && faBtn3?.pressed === 'true' && enBtn3?.pressed === null && faBtn3.bg === active && third.dir === 'rtl' && third.fa.top < third.en.top && (third.stored || []).join() === 'roses-lang=fa', `${venue} reload: the welcome screen again with English pre-highlighted (saved ${again.saved}; English pressed ${enBtn?.pressed}, filled ${enBtn?.bg} = remembered-button colour ${active}: ${enBtn?.bg === active}; Persian plain ${faBtn?.bg}); tap فارسی → Persian page: ${tapText(tapFa)} (dir ${tapFa.dir}, a Persian heading visible ${afterFa.faHeadingVisible}); reload: فارسی pre-highlighted (${faBtn3?.pressed}), the Persian greeting line first (${third.fa?.top} px above the English at ${third.en?.top}); stored keys: ${(third.stored || []).join(', ')}`);
  measure(`${venue}: tap فارسی → ${tapFa.tx ? `Persian menu usable in ${tapFa.usableMs} ms, transition ${tapFa.tx} over in ${tapFa.ms} ms` : `Persian menu visible in ${tapFa.ms} ms`}`);
  await ctx.close();
}

// ---- 4. a section anchor in the URL; keyboard; labels and sizes
{
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  await page.goto(`${base}/senso`, { waitUntil: 'load' });
  const ids = await page.evaluate(() => [...document.querySelectorAll('main section[id]')].map((s) => s.id));
  const target = ids[Math.min(2, ids.length - 1)];
  await page.goto(`${base}/senso#${target}`, { waitUntil: 'load' }); await settled(page);
  const before = await page.evaluate(PROBE);
  const tap = await page.evaluate(TAP, 'en'); await off(page); await sleep(400);
  const a = await page.evaluate(() => ({ y: Math.round(scrollY), active: document.querySelector('#tabs a.active')?.dataset.tab ?? null, hash: location.hash }));
  await shot(page, 'senso-anchor-after-choice');
  check('anchor', before.welcome === 'show' && before.y > 0 && tap.gone && a.y === 0 && a.active === ids[0], `/senso#${target}: the welcome screen first (${before.welcome}) over the page the browser had scrolled to the anchor (scrollY ${before.y}); after the choice the page starts from the top (scrollY ${a.y}, first tab active: ${a.active}); the URL keeps its hash (${a.hash})`);
  // keyboard: Tab from the top of the page reaches the English button, Enter chooses it
  await page.goto(`${base}/senso`, { waitUntil: 'load' }); await settled(page);
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()}[data-lang=${e.getAttribute('data-lang')}]` : null; });
  await page.keyboard.press('Enter'); const chosen = await off(page);
  const k = await page.evaluate(PROBE);
  const names = before.buttons.map((b) => `${b.lang}: "${b.name}" ${b.w}×${b.h} px`);
  check('keyboard-labels', focused === 'button[data-lang=en]' && chosen && k.lang === 'en' && before.buttons.length === 2 && before.buttons.every((b) => b.h >= 44 && b.name.length > 0) && before.role === 'dialog' && before.modal === 'true', `Tab focuses ${focused}, Enter chooses it (overlay off: ${chosen}, lang ${k.lang}); buttons ${names.join(', ')} (≥ 44 px tall, named); role ${before.role}, aria-modal ${before.modal}`);
  await ctx.close();
}

// ---- 5. JavaScript off: the menu shows directly, no overlay
for (const venue of VENUES) {
  const ctx = await browser.newContext({ ...DEVICE, javaScriptEnabled: false }); const page = await ctx.newPage();
  await page.goto(`${base}/${venue}`, { waitUntil: 'load' }); await sleep(200);
  let j;
  try { j = await page.evaluate(() => ({ welcome: document.documentElement.dataset.welcome || null, greet: document.documentElement.dataset.greet || null, overlay: !!document.getElementById('welcome'), display: getComputedStyle(document.getElementById('welcome')).display, rowVisible: !!document.querySelector('main li.item') && document.querySelector('main li.item').getClientRects().length > 0, headerVisible: document.querySelector('main > header').getClientRects().length > 0 })); }
  catch (e) { j = { error: e.message, overlayVisible: await page.locator('#welcome').isVisible().catch(() => null), rowVisible: await page.locator('main li.item').first().isVisible().catch(() => null) }; }
  await shot(page, `${venue}-javascript-off`);
  const ok = j.error ? j.overlayVisible === false && j.rowVisible === true : j.welcome === null && j.greet === null && j.overlay && j.display === 'none' && j.rowVisible && j.headerVisible;
  check(`javascript-off-${venue}`, ok, `${venue} with JavaScript off: ${j.error ? `overlay visible ${j.overlayVisible}, first row visible ${j.rowVisible} (evaluate unavailable: ${j.error})` : `no data-welcome (${j.welcome}) and no greeting decided (${j.greet}); the overlay markup is in the page (${j.overlay}) but display ${j.display}; header and first row visible: ${j.headerVisible}, ${j.rowVisible}`}`);
  await ctx.close();
}

// ---- 6. the kill switch on the Style route (owner), recorded; the default colours; the budget
{
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('roses_session=')) { check('signin', false, 'PIN sign-in failed'); }
  else {
    const hasWelcome = (h) => /id="welcome"/.test(h) && /dataset\.welcome='show'/.test(h);
    const offR = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { welcome: false } }, cookie);
    const gone = await waitPublic('senso', (h) => !hasWelcome(h));
    const dbOff = (await db.query(`select style->>'welcome' as w from venues where id='senso'`)).rows[0].w;
    const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
    await page.goto(`${base}/senso`, { waitUntil: 'load' }); await sleep(150);
    const p = await page.evaluate(PROBE);
    await shot(page, 'senso-welcome-off');
    await ctx.close();
    const onR = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { welcome: true } }, cookie);
    const back = await waitPublic('senso', hasWelcome);
    const dbOn = (await db.query(`select style->>'welcome' as w from venues where id='senso'`)).rows[0].w;
    const scripts = (back.html.match(/<script[^>]*>/g) || []).length, wantScripts = /data-engine=/.test(back.html) ? 5 : 4; // the artwork engine is its own script right after the scene (senso)
    check('kill-switch', offR.status === 200 && gone.ok && dbOff === 'false' && p.display === 'absent' && p.welcome === null && p.rowVisible && p.headerVisible && onR.status === 200 && back.ok && dbOn === 'true' && scripts === wantScripts, `Welcome screen off (Style route, owner) → the public HTML carries no overlay after ${gone.ms} ms (venues.style.welcome ${dbOff}); the menu shows directly (overlay ${p.display}, first row visible ${p.rowVisible}); on again → back after ${back.ms} ms (${dbOn}); ${scripts} inline script tags with it on (head decision, ${wantScripts === 5 ? 'artwork engine, ' : ''}welcome, language toggle, menu; wanted ${wantScripts})`);
    measure(`kill switch: off → the menu shows directly after ${gone.ms} ms; on → the welcome screen back after ${back.ms} ms`);
    // defaults: the thresholds the guard enforces on a save hold for what is served
    for (const venue of VENUES) {
      const v = varsOf(await publicHtml(venue));
      const pairs = [['welcome.text', 'welcome.bg', 3], ['welcome.btnText', 'welcome.btnBg', 4.5], ['welcome.activeText', 'welcome.activeBg', 4.5]].map(([a, b, th]) => { const ka = `--c-${a.replace(/\./g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, kb = `--c-${b.replace(/\./g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`; return { pair: `${a} on ${b}`, a: v[ka], b: v[kb], ratio: v[ka] && v[kb] ? r1(contrast(v[ka], v[kb])) : null, th }; });
      const scene = ['leaves', 'snow', 'blossoms', 'light'].map((k) => `${k} ${v[`--c-welcome-${k}`]}`);
      check(`defaults-${venue}`, pairs.every((x) => x.ratio != null && x.ratio >= x.th), `${venue} served defaults: background ${v['--c-welcome-bg']}; ${pairs.map((x) => `${x.pair} ${x.a} / ${x.b} = ${x.ratio}:1 (needs ${x.th})`).join('; ')}; scene colours: ${scene.join(', ')}`);
    }
    // budget: the inline code added for the welcome screen, gzipped (senso ≤ 15 KB with the picked artwork, the PM 2026-10-09; kebab-land ≤ 10 KB); and the stylesheet block
    const css = await fs.readFile('src/styles/public.css', 'utf8').then((t) => t.slice(t.indexOf('/* ---------- Welcome screen'), t.indexOf('/* ---------- Menu kit'))).catch(() => '');
    const gz = (s) => zlib.gzipSync(Buffer.from(s)).length;
    const cssGz = gz(css);
    for (const venue of VENUES) {
      const html = await publicHtml(venue);
      const overlay = html.slice(html.indexOf('<div id="welcome"'), html.indexOf('<main'));
      const head = (html.match(/<script[^>]*>\(function\(\)\{var h=document\.documentElement,l=null;[\s\S]*?<\/script>/) || [''])[0];
      const limit = venue === 'senso' ? 15360 : 10240;
      const inlineRaw = overlay.length + head.length, inlineGz = gz(overlay + head);
      const season = (html.match(/id="welcome"[^>]*data-season="([a-z]+)"/) || [])[1];
      check(`budget-${venue}`, overlay.length > 0 && head.length > 0 && inlineGz <= limit && css.length > 0 && cssGz <= 10240, `${venue} (${season} scene): inline code added to the page (the overlay with its scene and script ${overlay.length} B, the head decision script ${head.length} B): ${inlineRaw} B raw, ${inlineGz} B gzipped (≤ ${limit}); the welcome block of the stylesheet: ${css.length} B raw, ${cssGz} B gzipped (≤ 10 240)`);
      measure(`${venue}: inline code for the welcome screen (${season} scene): ${(inlineGz / 1024).toFixed(1)} KB gzipped (${(inlineRaw / 1024).toFixed(1)} KB raw); its stylesheet block ${(cssGz / 1024).toFixed(1)} KB gzipped`);
    }
  }
}


// ---- pre-go-live audit, Part B (the PM's fix batch A2, 2026-11-03): one check per fix on the customers' pages ----
{ const enter = async (page, venue, lang = 'en') => { await page.goto(`${base}/${venue}`); await page.click(`#welcome button[data-lang="${lang}"]`).catch(() => {}); await sleep(1100); };
  const wk = await webkit.launch();
  // #1: in Persian the footer's address and phone number read left to right (their digit groups showed reversed)
  for (const venue of VENUES) {
    const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage(); await enter(p, venue, 'fa');
    const locs = (await db.query('select locations from venues where id=$1', [venue])).rows[0].locations;
    const want = locs.flatMap((l) => [l.address, l.phone]).filter(Boolean);
    const got = await p.evaluate(() => [...document.querySelectorAll('footer bdi[dir="ltr"]')].map((b) => ({ text: b.textContent.trim(), dir: getComputedStyle(b).direction })));
    check(`persian-footer-${venue}`, want.length > 0 && want.every((w) => got.some((g) => g.text === w && g.dir === 'ltr')), `${venue} in Persian: the footer's ${want.length} address and phone line(s) each in a left-to-right run: ${JSON.stringify(got)}`);
    await ctx.close();
  }
  // #3 (WebKit): the next long popup opens at its top, its ✕ in view
  { const tall = (await db.query(`select id from items where venue_id='senso' and listed order by jsonb_array_length(add_ons) + jsonb_array_length(variants) desc, length(coalesce(description->>'en','')) desc limit 2`)).rows.map((r) => r.id);
    const ctx = await wk.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); await enter(p, 'senso');
    const openItem = async (id) => { const li = p.locator(`main li.item[data-id="${id}"]`).first(); await li.scrollIntoViewIfNeeded(); await li.click(); await p.waitForSelector('#sheet[open]'); await sleep(500); };
    await openItem(tall[0]); const scrolled = await p.evaluate(() => { const d = document.getElementById('sheet'); d.scrollTop = d.scrollHeight; return d.scrollTop; });
    await p.click('#sheet-close'); await sleep(600);
    await openItem(tall[1]);
    const st = await p.evaluate(() => { const d = document.getElementById('sheet'), x = document.getElementById('sheet-close').getBoundingClientRect(); return { top: d.scrollTop, closeTop: Math.round(x.top), closeBottom: Math.round(x.bottom) }; });
    check('popup-top-webkit', scrolled > 0 && st.top === 0 && st.closeTop >= 0 && st.closeBottom <= 664, `WebKit, iPhone 13: a long popup scrolled ${scrolled} px and closed, the next long one opens at scroll ${st.top} with its ✕ at ${st.closeTop}–${st.closeBottom} px`);
    await ctx.close(); }
  // #7 (WebKit): a photo whose host does not answer shows the grey placeholder, not a broken-image icon
  { const ctx = await wk.newContext({ ...devices['iPhone 13'] }); await ctx.route(/^https:\/\/(mealsymedia\.s3\.amazonaws\.com|roseskebablands\.com|sensocafe\.ca)\//, (r) => r.abort());
    const p = await ctx.newPage(); await enter(p, 'kebab-land');
    for (let y = 0; y < 6; y++) { await p.evaluate(() => window.scrollBy(0, innerHeight)); await sleep(400); }
    const imgs = await p.evaluate(() => [...document.querySelectorAll('main img')].map((i) => ({ src: i.getAttribute('src') || '', w: i.naturalWidth, complete: i.complete })));
    const linked = imgs.filter((i) => !i.src.startsWith('/')), broken = imgs.filter((i) => i.complete && i.w === 0);
    const li = p.locator('main li.item[data-photo^="https://"]').first(); await li.scrollIntoViewIfNeeded(); await li.click(); await p.waitForSelector('#sheet[open]'); await sleep(900);
    const hero = await p.evaluate(() => ({ hidden: document.getElementById('sheet-hero').hidden, has: document.getElementById('sheet').classList.contains('has-photo') }));
    check('photo-fallback', linked.length > 0 && broken.length === 0 && hero.hidden && !hero.has, `Kebab Land with its photo host not answering (WebKit): ${linked.length} photo(s) reached, ${linked.filter((i) => i.src.startsWith('data:')).length} turned into the placeholder, broken images left ${broken.length}; a popup's photo left out: ${hero.hidden && !hero.has}`);
    await ctx.close(); }
  // #8: the language button, the popup's ✕, the section list's ✕ and a footer phone link take a tap over 44 × 44 px
  { const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage(); await enter(p, 'senso');
    const hit = (sel) => p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; return [[-21.5, -21.5], [21.5, -21.5], [-21.5, 21.5], [21.5, 21.5]].every(([dx, dy]) => { const t = document.elementFromPoint(cx + dx, cy + dy); return !!t && (t === el || el.contains(t)); }); }, sel);
    const res = { language: await hit('#lang-toggle') };
    await p.locator('main li.item').first().click(); await p.waitForSelector('#sheet[open]'); await sleep(500); res.popupClose = await hit('#sheet-close'); await p.keyboard.press('Escape'); await sleep(600);
    await p.click('#tabs-list'); await p.waitForSelector('#sections-dialog[open]'); await sleep(500); res.listClose = await hit('#list-close'); await p.keyboard.press('Escape'); await sleep(600);
    await p.locator('footer a[href^="tel:"]').first().scrollIntoViewIfNeeded(); await sleep(300); res.phone = await hit('footer a[href^="tel:"]');
    check('tap-areas', Object.values(res).every((x) => x === true), `44 × 44 px around each control's centre answers to it: ${JSON.stringify(res)}`);
    await ctx.close(); }
  // #10 (WebKit and the keyboard): an item given focus back when its popup closes shows no ring after a tap, and shows it after the keyboard
  { const ctx = await wk.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); await enter(p, 'senso');
    const li = p.locator('main li.item').nth(2); await li.scrollIntoViewIfNeeded(); await li.tap(); await p.waitForSelector('#sheet[open]'); await sleep(500); await p.locator('#sheet-close').tap(); await sleep(700);
    const touch = await p.evaluate(() => { const a = document.activeElement; return { item: !!a?.matches?.('li.item'), outline: a ? getComputedStyle(a).outlineStyle : null }; });
    await ctx.close();
    const c2 = await browser.newContext(DEVICE); const q = await c2.newPage(); await enter(q, 'senso');
    await q.locator('main li.item').nth(2).focus(); await q.keyboard.press('Enter'); await q.waitForSelector('#sheet[open]'); await sleep(500); await q.keyboard.press('Escape'); await sleep(700);
    const keys = await q.evaluate(() => { const a = document.activeElement; return { item: !!a?.matches?.('li.item'), outline: a ? getComputedStyle(a).outlineStyle : null }; });
    await c2.close();
    check('focus-ring-touch', touch.outline === 'none' && keys.item && keys.outline !== 'none', `after a tap and the ✕ (WebKit): focus on the item ${touch.item}, its outline ${touch.outline}; after Enter and Escape: focus on the item ${keys.item}, its outline ${keys.outline}`); }
  // #14: the keyboard path: the language chosen with Enter puts the focus on the menu's first heading; the category tabs are one stop, the arrows move between them
  { const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage(); await p.goto(`${base}/senso`); await p.focus('#welcome button[data-lang="en"]'); await p.keyboard.press('Enter'); await sleep(1100);
    const first = await p.evaluate(() => { const a = document.activeElement, h = document.querySelector('main h2'); return { onHeading: a === h, text: h?.textContent?.trim() }; });
    const stops = await p.evaluate(() => document.querySelectorAll('#tabs a[data-tab][tabindex="0"]').length);
    const all = await p.evaluate(() => document.querySelectorAll('#tabs a[data-tab]').length);
    await p.focus('#tabs a[data-tab][tabindex="0"]'); await p.keyboard.press('ArrowRight');
    const moved = await p.evaluate(() => { const tabs = [...document.querySelectorAll('#tabs a[data-tab]')]; return { at: tabs.indexOf(document.activeElement), stop: tabs.findIndex((t) => t.tabIndex === 0) }; });
    await p.keyboard.press('Tab'); const after = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check('keyboard-menu', first.onHeading && stops === 1 && all > 1 && moved.at === 1 && moved.stop === 1, `Enter on English → the focus on the first heading "${first.text}": ${first.onHeading}; the ${all} category tabs are ${stops} tab stop; ArrowRight → tab ${moved.at} focused (its stop ${moved.stop}); Tab from there → ${after}`);
    await ctx.close(); }
  // #9: an address that does not exist: a bilingual page, a link back to the venue when the address starts with one, none otherwise
  { const r = await fetch(`${base}/senso/nope`); const t = await r.text();
    const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage();
    await p.goto(`${base}/senso/nope`); const link = await p.locator('[data-back-to-menu]').getAttribute('href', { timeout: 5000 }).catch(() => null);
    await p.goto(`${base}/nope`); await sleep(800); const none = await p.locator('[data-back-to-menu]').count();
    await ctx.close();
    check('not-found', r.status === 404 && t.includes('Page not found') && t.includes('صفحه پیدا نشد') && link === '/senso' && none === 0, `GET /senso/nope → ${r.status}, both languages: ${t.includes('Page not found') && t.includes('صفحه پیدا نشد')}; its link back → ${link}; /nope offers a link: ${none > 0}`); }
  // #4: the square icons are linked and the preview images are there (their og: tags wait for the final domain)
  { const png = async (u) => { const r = await fetch(base + u); const b = Buffer.from(await r.arrayBuffer()); return r.status === 200 && b.subarray(1, 4).toString() === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : `HTTP ${r.status}`; };
    const res = {};
    for (const venue of VENUES) { const html = await publicHtml(venue); res[venue] = { iconLinked: html.includes(`rel="icon" type="image/png" sizes="192x192" href="/brand/${venue}-icon.png"`), touchLinked: html.includes(`rel="apple-touch-icon" href="/brand/${venue}-touch.png"`), icon: await png(`/brand/${venue}-icon.png`), touch: await png(`/brand/${venue}-touch.png`), share: await png(`/brand/${venue}-share.png`) }; }
    check('share-icons', Object.values(res).every((x) => x.iconLinked && x.touchLinked && x.icon === '192x192' && x.touch === '180x180' && x.share === '1200x630'), `per venue: ${JSON.stringify(res)}`); }
  await wk.close();
}

// (recordings and one still per season per venue: scripts/season-drill.mjs, which renders every season with a fixed server clock)

await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'welcome-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'welcome-drill.txt'), [`Welcome drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`WELCOME DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
