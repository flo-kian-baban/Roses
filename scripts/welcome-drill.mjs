#!/usr/bin/env node
// Welcome screen acceptance (Kian, 2026-10-09: the overlay that replaced the logo intro), measured by Playwright on the iPhone 13
// viewport for senso and kebab-land:
//   greeting boundaries with a mocked device clock (the browser context runs in UTC, so the wall clock is the mocked instant): 04:59 /
//     05:00 / 11:59 / 12:00 / 16:59 / 17:00, read from the html attribute the head script sets, both languages shown (the season is the
//     page's since the PM's decision of 2026-10-09, current season only: its boundaries are render tests in scripts/season-drill.mjs);
//   the scene of the season the page was rendered for: at most 20 particles, every running animation on transform or opacity only;
//     reduced motion: shown but still, the fade instant;
//   the tap: the menu visible within 300 ms (measured in the page from the click to the overlay gone), the language set and stored,
//     pre-highlighted on the next load (English, then Persian, whose greeting line then reads first);
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
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/welcome');
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
// The tap, timed inside the page: from the click on the button to the overlay gone (display none, visibility hidden or opacity 0).
const TAP = (lang) => new Promise((res) => {
  const w = document.getElementById('welcome'), b = w.querySelector(`button[data-lang="${lang}"]`); const start = performance.now(); b.click();
  const tick = () => { const cs = getComputedStyle(w); const t = performance.now() - start; const gone = cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0;
    if (gone || t > 3000) res({ ms: Math.round(t), gone, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, welcome: document.documentElement.dataset.welcome, lang: document.documentElement.dataset.lang, dir: document.documentElement.dir, rowVisible: !!document.querySelector('main li.item') && document.querySelector('main li.item').getClientRects().length > 0, inert: document.querySelector('main') ? document.querySelector('main').inert : null, y: Math.round(scrollY) });
    else requestAnimationFrame(tick); };
  tick();
});
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
  check(`reduced-motion-${venue}`, r.welcome === 'show' && r.display === 'grid' && r.running === 0 && r.particlesVisible >= 8 && r.en?.opacity === 1 && r.fa?.opacity === 1 && r.buttons.every((b) => b.opacity === 1) && r.logo?.opacity === 1 && r.headerVisible && tap.gone && tap.ms <= 60, `${venue} with reduced motion: the welcome screen shown (display ${r.display}) with ${r.running} animations running, ${r.particlesVisible} particles of the ${r.particles} standing still in view, greeting and buttons fully visible at once (opacities ${r.en?.opacity}, ${r.fa?.opacity}, ${r.buttons.map((b) => b.opacity).join('/')}), the page behind visible (${r.headerVisible}); a tap removes it without a fade in ${tap.ms} ms`);
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
  check(`tap-${venue}`, entrance && first.saved === null && first.buttons.every((b) => b.pressed === null) && first.inert === true && tapEn.gone && tapEn.ms <= 300 && tapEn.lang === 'en' && tapEn.rowVisible && offEn && afterEn.display === 'none' && afterEn.inert === false && (afterEn.stored || []).includes('roses-lang=en'), `${venue} first visit: no language pre-highlighted (saved ${first.saved}, pressed ${first.buttons.map((b) => b.pressed).join('/')}), the menu inert behind the overlay (${first.inert}); tap English → the overlay gone and the menu visible after ${tapEn.ms} ms (target ≤ 300; lang ${tapEn.lang}, first row visible ${tapEn.rowVisible}), then display ${afterEn.display}, the menu reachable again (inert ${afterEn.inert}); stored: ${(afterEn.stored || []).join(', ')}`);
  measure(`${venue}: tap a language → menu visible in ${tapEn.ms} ms`);
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
  check(`remembered-${venue}`, again.welcome === 'show' && again.saved === 'en' && enBtn?.pressed === 'true' && faBtn?.pressed === null && enBtn.bg === active && faBtn.bg === plain && tapFa.gone && tapFa.ms <= 300 && tapFa.lang === 'fa' && tapFa.dir === 'rtl' && afterFa.faHeadingVisible && (afterFa.stored || []).includes('roses-lang=fa') && third.saved === 'fa' && faBtn3?.pressed === 'true' && enBtn3?.pressed === null && faBtn3.bg === active && third.dir === 'rtl' && third.fa.top < third.en.top && (third.stored || []).join() === 'roses-lang=fa', `${venue} reload: the welcome screen again with English pre-highlighted (saved ${again.saved}; English pressed ${enBtn?.pressed}, filled ${enBtn?.bg} = remembered-button colour ${active}: ${enBtn?.bg === active}; Persian plain ${faBtn?.bg}); tap فارسی → Persian page after ${tapFa.ms} ms (dir ${tapFa.dir}, a Persian heading visible ${afterFa.faHeadingVisible}); reload: فارسی pre-highlighted (${faBtn3?.pressed}), the Persian greeting line first (${third.fa?.top} px above the English at ${third.en?.top}); stored keys: ${(third.stored || []).join(', ')}`);
  measure(`${venue}: tap فارسی → Persian menu visible in ${tapFa.ms} ms`);
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

// (recordings and one still per season per venue: scripts/season-drill.mjs, which renders every season with a fixed server clock)

await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'welcome-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'welcome-drill.txt'), [`Welcome drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`WELCOME DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
