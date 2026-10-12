#!/usr/bin/env node
// The welcome screen's transitions into the menu (owner and manager via Kian, 2026-10-10; src/lib/transitions.ts, src/lib/welcome-transitions.ts),
// Senso, every season (fall and winter since 2026-10-10, spring and summer since 2026-10-11), every concept T1–T10: 40 versions. Proven on a copy of the build with its own server, its clock fixed to a fall and then a
// winter instant (ROSES_NOW with the suite's flag ROSES_CHECK_SUITE=1, as in the season drill); each concept is chosen through the Style
// route as the owner would (the save regenerates the page) and stored in venues.style.transition (read back from the database):
//   served page: exactly one transition in the HTML, the chosen one for the page's season (its style and its script equal what the
//     admin's scene API renders for it, its key the only one named, no other concept's code), ≤ 3 KB gzipped (its style and script);
//     spring and summer pages carry none (the plain fade);
//   smoothness (Kian's ruling): iPhone 13 viewport, CDP CPU 4×, requestAnimationFrame from the tap to the overlay gone: median ≥ 50 fps
//     (the median frame interval), no long task > 50 ms, with an English tap (the page's own language on a first visit, so the tap changes
//     no layout); every animation of the transition on transform, opacity or an individual transform property, and ended before the
//     overlay goes (nothing cut); reported per concept as measured;
//   the same with a Persian tap, measured (the tap then lays the whole menu out again in Persian, a cost of the language switch that the
//     200 ms fade of 2026-10-09 has too); with it, the language is applied at the first frame after the tap, before the transition has
//     moved (no flash of the other language); and (the PM, 2026-10-11) a real check over the 20 Persian taps, persian-tap-senso: no long
//     task > 50 ms, listed in reports/checks/known-misses.json as "Persian tap, Senso" until the relayout task is ≤ 50 ms;
//   timing: total ≤ 900 ms (from the tap to the overlay gone, at CPU 4× and unthrottled); the menu scrollable and tappable within 300 ms
//     of the tap, measured with a real touch scroll right after the tap (the first scroll event and the page moved) and, on another load,
//     a real tap on the first item (its popup open), both during the transition;
//   reduced motion: a 150 ms fade for every concept (an opacity between 0 and 1 seen, gone in 120–230 ms, one animation: the overlay's
//     opacity; nothing of the concept built);
//   recordings (Playwright video, on disk only): all 40 versions on the iPhone 13 viewport;
//   one choice per season (Kian, 2026-10-11; src/venues/styles.ts transitionFall … transitionSummer): day one, the served pages of all four
//     seasons byte for byte the same with the venue's single choice of 2026-10-10 (put back through the Style route's restore) and with that
//     choice saved for each season; then four different concepts, one per season, and a render at each Toronto season boundary instant
//     (Feb 28 / Mar 1, May 31 / Jun 1, Aug 31 / Sep 1, Nov 30 / Dec 1) ships exactly that season's choice and nothing else;
//   WebKit (the PM, 2026-10-11), every version functionally in Playwright's WebKit with the iPhone 13 device (mobile emulation, touch):
//     it plays (the page names it, its animations on transform or opacity, none cut), ends ≤ 900 ms, the menu scrollable and tappable
//     within 300 ms during it (a real touch tap on the first item opening its popup; the scroll a real mouse wheel on a load with mobile
//     emulation off, same viewport, because Playwright's mobile WebKit has no scroll input: no wheel, no touch drag), the 150 ms fade under
//     reduced motion, no console or page error on its four loads; fps reported for information only (WebKit runs unthrottled: CPU
//     throttling is Chromium's CDP); each version compared with Chromium (animation count, animated properties, the checks' outcomes,
//     gone-after with the same interaction unthrottled within 100 ms), any difference reported. The PM's rule (2026-10-11, replacing a
//     re-measure on a miss): every WebKit time measurement runs 3 times, always, and passes or fails on the median; all three values are
//     printed; a run more than 2× the median is flagged as an outlier and still counted. Everything that is not a time (it plays, scrolled,
//     the popup open, the fade's single animation, no error) must hold in all three runs;
//   unchanged: Kebab Land's welcome behaviour byte for byte as the previous commit served it (scripts/fixtures/welcome-behaviour.json:
//     head script, tap script, the whole overlay with the logo's <img> as a placeholder, the public stylesheet by hash) in fall and in
//     winter; every venue on the default template (--venues) with the same head and tap scripts and stylesheet;
//   the admin preview (Style tab → Welcome → Transition, a row per season since 2026-10-11): on a laptop, a concept chosen in the Fall row
//     is saved and played in the preview's frame by the page's own code (the frame names the chosen concept and season, reaches "done" and
//     ends on the menu, the bar's screen then Menu); the Winter row's Play: the preview switches to winter (the bar too) and plays that
//     season's choice; Play again: played again; a concept chosen in the Spring row: played as the spring version; the bar's Summer: the
//     frame carries summer's choice; on the iPhone 13 viewport, a choice and Play in the Summer row of the Style tab's bottom sheet; and
//     every one of those plays as on the public page (Kian, 2026-10-10: the preview showed a jump): no swap
//     of the frame during it, the card settled at the tap and seen settled for ≥ 480 ms, none of the preview's outline while it plays,
//     frames with a median interval ≤ 20 ms, the menu ≤ 900 ms after the tap.
// At the end Senso's style is put back as it was (the Style route's restore). The drill's server is its own: the port must be free
// before it starts, and its listener must be the process it spawned (lsof).
//   DRILL_ADMIN_EMAIL=… DRILL_ADMIN_PIN=… node scripts/transition-drill.mjs --dist .next-check --copy .next-transition --port 3103 --out reports/checks/<stamp>/transition [--venues senso,kebab-land,<temp>] [--jpeg]
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { chromium, webkit, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';
import { behaviourOf, compareBehaviour, stylesheetHashes } from './welcome-behaviour-fixture.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const dist = args.dist || '.next-check', copy = args.copy || '.next-transition', port = Number(args.port || 3103);
const out = path.resolve(args.out || 'reports/transition'); fs.mkdirSync(out, { recursive: true });
const venues = (args.venues || 'senso,kebab-land').split(',').filter(Boolean);
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const base = `http://127.0.0.1:${port}`;
const transcript = [], results = [], measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gz = (s) => zlib.gzipSync(Buffer.from(s)).length;
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const WK_DEVICE = devices['iPhone 13'], WK_SCROLL = { ...devices['iPhone 13'], isMobile: false }; // WebKit: mobile emulation; the scroll load without it (mobile WebKit has no wheel)
const OK_PROPS = ['transform', 'opacity', 'scale', 'rotate', 'translate'];
const SEASONS = { fall: '2026-10-15T12:00:00-04:00', winter: '2026-12-15T12:00:00-05:00', spring: '2027-04-15T12:00:00-04:00', summer: '2027-07-15T12:00:00-04:00' };
const IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];
const ALL4 = ['fall', 'winter', 'spring', 'summer'];
const TXKEY = { fall: 'transitionFall', winter: 'transitionWinter', spring: 'transitionSpring', summer: 'transitionSummer' }; // src/venues/styles.ts TX_KEYS
// the Toronto season boundary instants (an hour before and after midnight on the 1st), with the season each must render
const BOUNDARIES = [
  { id: 'feb28', at: '2027-02-28T23:30:00-05:00', label: 'Feb 28 23:30 EST', want: 'winter' }, { id: 'mar1', at: '2027-03-01T00:30:00-05:00', label: 'Mar 1 00:30 EST', want: 'spring' },
  { id: 'may31', at: '2027-05-31T23:30:00-04:00', label: 'May 31 23:30 EDT', want: 'spring' }, { id: 'jun1', at: '2027-06-01T00:30:00-04:00', label: 'Jun 1 00:30 EDT', want: 'summer' },
  { id: 'aug31', at: '2026-08-31T23:30:00-04:00', label: 'Aug 31 23:30 EDT', want: 'summer' }, { id: 'sep1', at: '2026-09-01T00:30:00-04:00', label: 'Sep 1 00:30 EDT', want: 'fall' },
  { id: 'nov30', at: '2026-11-30T23:30:00-05:00', label: 'Nov 30 23:30 EST', want: 'fall' }, { id: 'dec1', at: '2026-12-01T00:30:00-05:00', label: 'Dec 1 00:30 EST', want: 'winter' },
];
const CHOICE = { fall: 'T2', winter: 'T5', spring: 'T8', summer: 'T3' }; // four different concepts for the boundary renders
const BUDGET = 3072, TOTAL = 900, USABLE = 300;
const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/welcome-behaviour.json', 'utf8'));
const db = await connectDb('transition-drill', (t) => log('db', t));

// ---- the copy of the build and its server (as in the season drill)
if (fs.existsSync(copy)) fs.rmSync(copy, { recursive: true, force: true });
try { execFileSync('cp', ['-Rc', dist, copy]); } catch { fs.cpSync(dist, copy, { recursive: true }); }
log('copy', `${dist} → ${copy}`);
const serverLog = fs.openSync(path.join(out, 'transition-server.log'), 'a');
let server = null;
const portFree = (host) => new Promise((res) => { const s = net.createServer(); s.once('error', (e) => res(e.code !== 'EADDRINUSE')); s.listen(port, host, () => s.close(() => res(true))); });
const listeners = () => spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map(Number);
async function start(season, at = null) {
  if (!(await portFree('127.0.0.1')) || !(await portFree('::1'))) throw new Error(`port ${port} is in use by a process this drill did not start; it is left alone`);
  const now = at ?? SEASONS[season];
  server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env: { ...process.env, NEXT_DIST_DIR: copy, ROSES_NOW: now, ROSES_CHECK_SUITE: '1', ROSES_APP_NAME: 'roses-check:transition-server' }, stdio: ['ignore', serverLog, serverLog] });
  fs.writeSync(serverLog, `\n--- server started with ROSES_NOW=${now} (${season ?? 'a boundary instant'}) and ROSES_CHECK_SUITE=1 at ${new Date().toISOString()}\n`);
  const t = Date.now();
  while (Date.now() - t < 30000) {
    try { const r = await fetch(`${base}/admin`, { method: 'HEAD', redirect: 'manual' }); if (r.status < 500) { const pids = listeners(); if (server.exitCode !== null || pids.length === 0 || pids.some((x) => x !== server.pid)) throw new Error(`port ${port}: listener ${pids.join(',') || 'none'} is not the drill's server (pid ${server.pid}, exit ${server.exitCode})`); return Date.now() - t; } }
    catch (e) { if (/not the drill's server/.test(e.message)) throw e; }
    await sleep(150);
  }
  throw new Error('transition server did not come up');
}
async function stop() { if (!server) return; server.kill('SIGTERM'); await new Promise((r) => { server.once('exit', r); setTimeout(r, 3000); }); server = null; }

// ---- the admin (the suite's temporary account, by PIN), the Style route, the public page
let cookie = '';
async function signIn() {
  const r = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('roses_session=')) throw new Error(`PIN sign-in failed (${r.status})`);
}
const api = async (p, body) => { const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const page = async (v) => (await fetch(`${base}/${v}`, { cache: 'no-store' })).text();
async function waitPage(v, pred, ms = 12000) { const t = Date.now(); let h = ''; while (Date.now() - t < ms) { h = await page(v); if (pred(h)) return { ok: true, ms: Date.now() - t, html: h }; await sleep(120); } return { ok: false, ms: Date.now() - t, html: h }; }
const seasonOf = (h) => (h.match(/<div id="welcome"[^>]*data-season="([a-z]+)"/) || [])[1] || null;
const all = (h, re) => [...new Set([...h.matchAll(re)].map((m) => m[1]))];

// ---- in the page: the transition measured from the tap (installed before it; the tap itself is a real touch from Playwright)
const RECORDER = () => {
  const R = window.__tx = { frames: [], long: [], click: null, off: null, first: null, anims: null };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => R.long.push({ s: e.startTime, d: e.duration }))).observe({ type: 'longtask' }); } catch { /* unsupported */ }
  const PROPS = ['offset', 'computedOffset', 'easing', 'composite'];
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#welcome button[data-lang]') || R.click !== null) return;
    R.click = performance.now();
    requestAnimationFrame(() => { const h = document.documentElement; const a = document.getAnimations().filter((x) => !(x instanceof CSSAnimation) && !(x instanceof CSSTransition)); R.first = { t: performance.now() - R.click, lang: h.dataset.lang, dir: h.dir, advanced: Math.max(0, ...a.map((x) => Number(x.currentTime) || 0)) };
      requestAnimationFrame(() => { const b = document.getAnimations().filter((x) => !(x instanceof CSSAnimation) && !(x instanceof CSSTransition));
        // the animations' times are on the document timeline (the frame's time), the tap and the overlay's end on performance.now(): converted with the offset between the two read here
        const off = document.timeline.currentTime - performance.now();
        R.anims = { count: b.length, props: [...new Set(b.flatMap((x) => (x.effect && x.effect.getKeyframes ? x.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !PROPS.includes(p))) : [])))], clockOffset: off, lastEnd: Math.max(0, ...b.map((x) => (x.startTime ?? document.timeline.currentTime) + x.effect.getComputedTiming().endTime - off - R.click)) }; }); });
  }, true);
  new MutationObserver(() => { if (document.documentElement.dataset.welcome === 'off' && R.off === null && R.click !== null) R.off = performance.now(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-welcome'] });
  const tick = (t) => { R.frames.push(t); if (R.off === null || t < R.off + 150) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
};
const RESULT = () => {
  const R = window.__tx; const f = R.frames.filter((t) => t >= R.click && t <= R.off); const g = f.slice(1).map((t, i) => t - f[i]); const s = [...g].sort((a, b) => a - b); const med = s.length ? s[Math.floor(s.length / 2)] : null;
  const long = R.long.filter((l) => l.s + l.d >= R.click && l.s <= R.off);
  return { offMs: Math.round(R.off - R.click), frames: f.length, medianGapMs: med && Math.round(med * 10) / 10, medianFps: med ? Math.round(1000 / med) : 0, worstGapMs: g.length ? Math.round(Math.max(...g)) : null, longTasks: long.length, longestTaskMs: long.length ? Math.round(Math.max(...long.map((l) => l.d))) : 0, first: R.first, anims: R.anims && { ...R.anims, lastEnd: Math.round(R.anims.lastEnd) } };
};
// Senso's photos are linked from the client's own hosts, which stall now and then (the page check's lesson of 2026-10-09): a load waits
// for the document, then for the page's own load at most 8 s, so one stalled photo can never stop the drill.
const open = async (p, url) => { await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {}); };
const settled = (p) => p.waitForFunction(() => { const b = document.querySelector('#welcome button[data-lang="fa"]'); return !!b && Number(getComputedStyle(b).opacity) === 1; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
const offWait = (p) => p.waitForFunction(() => window.__tx && window.__tx.off !== null && performance.now() > window.__tx.off + 200, null, { timeout: 8000 }).then(() => true).catch(() => false);

let browser = await chromium.launch();
let wk = null; // WebKit, launched with the first WebKit load
// One load of /senso: Chromium (page errors) or WebKit (page errors and console errors, the PM's check).
async function load(engine, opts) {
  const ctx = engine === 'webkit' ? await (wk ??= await webkit.launch()).newContext(opts) : await browser.newContext(opts);
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(engine === 'webkit' ? `page error: ${e.message}` : e.message));
  if (engine === 'webkit') p.on('console', (m) => { if (m.type() === 'error') errors.push(`console error: ${m.text()}`); });
  await open(p, `${base}/senso`);
  return { ctx, p, errors };
}
// Smoothness (and timing) at CPU 4× with a tap in `lang`.
async function smooth(lang) {
  const { ctx, p, errors } = await load('chromium', DEVICE); await settled(p); await sleep(250);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await sleep(500);
  await p.evaluate(RECORDER); await sleep(60);
  await p.tap(`#welcome button[data-lang="${lang}"]`);
  const done = await offWait(p); const r = done ? await p.evaluate(RESULT) : null;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await ctx.close();
  return { ...r, done, errors };
}
// WebKit, the PM's rule (2026-10-11): every time measurement runs 3 times, always; judged on the median; all three printed; a run more
// than 2× the median flagged as an outlier and still counted. A run without the value (nothing measured) counts as an infinite time.
const three = async (fn) => { const runs = []; for (let i = 0; i < 3; i++) runs.push(await fn()); return runs; };
const M3 = (runs, f) => { const v = runs.map((r) => { const x = f(r); return typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : Infinity; }); const m = [...v].sort((a, b) => a - b)[1]; return { v, m, out: Number.isFinite(m) && m > 0 ? v.filter((x) => x > 2 * m) : [] }; };
const ms3 = (s) => `median ${Number.isFinite(s.m) ? s.m : '—'} ms (runs ${s.v.map((x) => (Number.isFinite(x) ? x : '—')).join(' / ')}${s.out.length ? `; OUTLIER ${s.out.join(', ')} ms, over 2× the median, counted` : ''})`;
const j3 = (s) => ({ median: Number.isFinite(s.m) ? s.m : null, runs: s.v.map((x) => (Number.isFinite(x) ? x : null)), outliers: s.out.map((x) => (Number.isFinite(x) ? x : null)) });
// WebKit: the version plays from an English tap, unthrottled (fps for information only).
async function wkPlay() {
  const { ctx, p, errors } = await load('webkit', WK_DEVICE); await settled(p); await sleep(250);
  const key = await p.evaluate(() => document.getElementById('welcome')?.rosesTxKey ?? null);
  await p.evaluate(RECORDER); await sleep(60);
  await p.tap('#welcome button[data-lang="en"]');
  const done = await offWait(p); const r = done ? await p.evaluate(RESULT) : null;
  await ctx.close();
  return { ...r, done, key, errors };
}
// Usable within 300 ms: a real touch scroll right after the tap (the first scroll event and the page moved), or a real tap on the first item (its popup open).
// In WebKit (engine 'webkit') the scroll is a mouse wheel on a load without mobile emulation (see the header).
async function usable(kind, engine = 'chromium') {
  const wkit = engine === 'webkit';
  const { ctx, p, errors } = await load(engine, wkit ? (kind === 'scroll' ? WK_SCROLL : WK_DEVICE) : DEVICE); await settled(p); await sleep(250);
  await p.evaluate(RECORDER);
  const item = await p.evaluate(() => { const li = document.querySelector('main section li.item'); const r = li.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 60)), id: li.dataset.id }; });
  await p.evaluate(() => { const R = window.__tx; R.scroll = null; R.itemClick = null; R.sheet = null;
    addEventListener('scroll', () => { if (R.scroll === null && R.click !== null) R.scroll = { t: performance.now() - R.click, y: scrollY }; }, { passive: true });
    document.addEventListener('click', (e) => { if (R.itemClick === null && R.click !== null && e.target.closest && e.target.closest('main li.item')) R.itemClick = { t: performance.now() - R.click, id: e.target.closest('li.item').dataset.id }; }, true);
    const d = document.getElementById('sheet'); if (d) new MutationObserver(() => { if (d.open && R.sheet === null && R.click !== null) R.sheet = performance.now() - R.click; }).observe(d, { attributes: true, attributeFilter: ['open'] }); });
  const cdp = wkit ? null : await ctx.newCDPSession(p);
  await p.tap('#welcome button[data-lang="en"]');
  if (kind === 'scroll' && wkit) { await p.mouse.move(195, 520); await p.mouse.wheel(0, 260); }
  else if (kind === 'scroll') await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 520, xDistance: 0, yDistance: -260, speed: 2600, gestureSourceType: 'touch', preventFling: true });
  else await p.touchscreen.tap(item.x, item.y);
  await offWait(p); await sleep(150);
  const r = await p.evaluate(() => { const R = window.__tx; return { scroll: R.scroll && { t: Math.round(R.scroll.t), y: Math.round(R.scroll.y) }, y: Math.round(scrollY), itemClick: R.itemClick && { t: Math.round(R.itemClick.t), id: R.itemClick.id }, sheet: R.sheet === null ? null : Math.round(R.sheet), sheetOpen: !!document.getElementById('sheet')?.open, offMs: Math.round(R.off - R.click) }; });
  await ctx.close();
  return { ...r, item, errors };
}
// Reduced motion: the 150 ms fade.
async function reduced(engine = 'chromium') {
  const { ctx, p, errors } = await load(engine, { ...(engine === 'webkit' ? WK_DEVICE : DEVICE), reducedMotion: 'reduce' }); await p.waitForFunction(() => document.documentElement.dataset.welcome === 'show'); await sleep(150);
  const r = await p.evaluate(() => new Promise((res) => { const w = document.getElementById('welcome'); let faded = false, anims = null; const s = performance.now(); w.querySelector('button[data-lang="en"]').click();
    requestAnimationFrame(() => { const a = document.getAnimations().filter((x) => !(x instanceof CSSAnimation) && !(x instanceof CSSTransition)); anims = { count: a.length, targets: a.map((x) => (x.effect.target.id || x.effect.target.className || x.effect.target.tagName)), props: [...new Set(a.flatMap((x) => x.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((q) => !['offset', 'computedOffset', 'easing', 'composite'].includes(q)))))], built: !!w.querySelector('.txb, .txl') }; });
    const tick = () => { const cs = getComputedStyle(w), t = performance.now() - s, o = Number(cs.opacity); if (o > 0 && o < 1) faded = true; if (cs.display === 'none' || t > 2000) res({ ms: Math.round(t), faded, anims, welcome: document.documentElement.dataset.welcome }); else requestAnimationFrame(tick); }; tick(); }));
  await ctx.close();
  return { ...r, errors };
}
async function record(id, season) {
  const ctx = await browser.newContext({ ...DEVICE, recordVideo: { dir: out, size: { width: 390, height: 664 } } }); const p = await ctx.newPage();
  await open(p, `${base}/senso`); await settled(p); await sleep(900);
  await p.tap('#welcome button[data-lang="en"]'); await sleep(1300);
  const video = p.video(); await ctx.close();
  const file = path.join(out, `transition-${id}-${season}.webm`); await video.saveAs(file); await video.delete().catch(() => {});
  return { file, size: (await fsp.stat(file)).size };
}

// ---- the drill
const rows = [], boundaries = [];
let original = null;
try {
  for (const season of ALL4) {
    await stop(); const up = await start(season); await signIn();
    log('server', `${season} server up after ${up} ms (ROSES_NOW ${SEASONS[season]})`);
    if (!original) { const g = await api('/api/admin/style?venue=senso'); original = g.json?.style ?? {}; log('style', `Senso's style before the drill: transition ${original.transition ?? '(unset)'}; per season ${ALL4.map((x) => `${x} ${original[TXKEY[x]] ?? '(unset)'}`).join(', ')}`); }
    // what the admin's scene API renders for each concept in this season (the code the page must carry when it is chosen)
    const want = {};
    for (const id of IDS) { const r = await api(`/api/admin/welcome-scene?venue=senso&season=${season}&transition=${id}`); want[id] = r.json?.tx ?? null; }
    const jsAll = IDS.map((id) => want[id]?.js ?? '');
    let pre = 0; while (jsAll.every((j) => j[pre] === jsAll[0][pre]) && pre < jsAll[0].length) pre++;
    let suf = 0; while (jsAll.every((j) => j[j.length - 1 - suf] === jsAll[0][jsAll[0].length - 1 - suf]) && suf < jsAll[0].length - pre) suf++;
    const body = (id) => { const j = want[id]?.js ?? ''; return j.slice(pre, j.length - suf).replace(/T\d+-(fall|winter|spring|summer)/g, ''); };
    for (const id of IDS) {
      const k = `${id}-${season}`, w = want[id];
      const save = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { [TXKEY[season]]: id } });
      const stored = (await db.query(`select style->>$1 as t from venues where id = 'senso'`, [TXKEY[season]])).rows[0]?.t;
      const served = await waitPage('senso', (h) => h.includes(`data-tx="${k}"`));
      const h = served.html;
      const keys = all(h, /data-tx="([^"]+)"/g), named = all(h, /rosesTxKey='([^']+)'/g);
      const styleText = (h.match(/<style id="welcome-tx" data-tx="[^"]*">([\s\S]*?)<\/style>/) || [])[1] ?? null;
      const others = IDS.filter((j) => j !== id && body(j).length > 40 && h.includes(body(j)));
      const defs = (h.match(/w\.rosesTx=function/g) || []).length;
      const size = w ? gz(w.css + w.js) : null;
      const nominalOk = !!w && w.ms <= TOTAL;
      const htmlOk = nominalOk && save.status === 200 && stored === id && served.ok && seasonOf(h) === season && !!w && keys.join() === k && named.join() === k && styleText === w.css && h.includes(w.js) && defs === 1 && others.length === 0;
      check(`html-${k}`, htmlOk, `${k} chosen through the Style route (${save.status}; venues.style.${TXKEY[season]} = ${stored}); the page regenerated after ${served.ms} ms for the ${seasonOf(h)} scene and carries exactly one transition: data-tx ${keys.join(', ') || 'none'}, the script names ${named.join(', ') || 'none'}, ${defs} rosesTx definition; its style and its script equal what the admin's scene API renders for ${k} (${styleText === w?.css} / ${!!w && h.includes(w.js)}); the code of another concept in the page: ${others.join(', ') || 'none'}`);
      check(`size-${k}`, size !== null && size <= BUDGET, `${k}: its style and script ${size} B gzipped (${w ? w.css.length + w.js.length : 0} B raw; ≤ ${BUDGET})`);
      const en = await smooth('en');
      const okProps = (en.anims?.props || []).every((p) => ['transform', 'opacity', 'scale', 'rotate', 'translate'].includes(p));
      check(`smooth-${k}`, en.done && en.medianFps >= 50 && en.longestTaskMs <= 50 && en.errors.length === 0, `${k}, iPhone 13 viewport, CPU 4×, English tap: ${en.frames} frames from the tap to the overlay gone (${en.offMs} ms), median interval ${en.medianGapMs} ms = ${en.medianFps} fps (≥ 50), worst gap ${en.worstGapMs} ms; ${en.longTasks} long tasks, the longest ${en.longestTaskMs} ms (≤ 50); page errors ${en.errors.length}`);
      const cut = en.anims ? en.anims.lastEnd - en.offMs : null; // > 0: the overlay went before the last animation ended (one frame, 17 ms, is the clocks' granularity)
      check(`motion-${k}`, en.done && !!en.anims && en.anims.count > 0 && okProps && cut !== null && cut <= 17, `${k}: ${en.anims?.count} animations on ${(en.anims?.props || []).join(', ')} (transform, opacity and the individual transform properties only: ${okProps}); the last ends ${en.anims?.lastEnd} ms after the tap and the overlay goes at ${en.offMs} ms, when it has finished (nothing cut: ${cut !== null && cut <= 17}; the two clocks read ${en.anims ? Math.round(en.anims.clockOffset) : '—'} ms apart, so within one frame counts)`);
      const fa = await smooth('fa');
      check(`language-first-${k}`, fa.done && fa.first?.lang === 'fa' && fa.first?.dir === 'rtl' && fa.first.advanced <= 34, `${k}, Persian tap: at the first frame after the tap (${Math.round(fa.first?.t ?? -1)} ms) the page is already Persian (lang ${fa.first?.lang}, dir ${fa.first?.dir}) and the transition has moved ${Math.round(fa.first?.advanced ?? -1)} ms of its time (≤ 34: nothing revealed in the other language)`);
      const sc = await usable('scroll'), tp = await usable('tap');
      const unthrottled = Math.max(sc.offMs, tp.offMs);
      check(`timing-${k}`, en.done && en.offMs <= TOTAL && unthrottled <= TOTAL && !!sc.scroll && sc.scroll.t <= USABLE && sc.y > 0 && !!tp.itemClick && tp.itemClick.t <= USABLE && tp.sheet !== null && tp.sheet <= USABLE && tp.sheetOpen && sc.errors.length + tp.errors.length === 0,
        `${k}: the overlay gone ${en.offMs} ms after the tap at CPU 4× and ${sc.offMs} / ${tp.offMs} ms unthrottled (≤ ${TOTAL}); a touch scroll started right after the tap moved the page from ${sc.scroll?.t ?? '—'} ms (≤ ${USABLE}; scrolled to ${sc.y} px during the transition); on another load a tap on the first item landed ${tp.itemClick?.t ?? '—'} ms after the language tap and opened its popup at ${tp.sheet ?? '—'} ms (≤ ${USABLE}; open ${tp.sheetOpen})`);
      const rm = await reduced();
      check(`reduced-${k}`, rm.faded && rm.ms >= 120 && rm.ms <= 230 && rm.anims?.count === 1 && rm.anims.props.join() === 'opacity' && !rm.anims.built && rm.welcome === 'off', `${k} with reduced motion: the 150 ms fade (an opacity between 0 and 1 seen: ${rm.faded}; gone after ${rm.ms} ms, 120–230), ${rm.anims?.count} animation on ${rm.anims?.targets.join(', ')} (${rm.anims?.props.join(', ')}), nothing of the concept built: ${!rm.anims?.built}`);
      // WebKit: the same version, functionally (fps for information), and compared with Chromium
      const WP = await three(wkPlay), WS = await three(() => usable('scroll', 'webkit')), WT = await three(() => usable('tap', 'webkit')), WR = await three(() => reduced('webkit'));
      const mOff = M3(WP, (r) => (r.done ? r.offMs : null)), mCut = M3(WP, (r) => (r.done && r.anims ? r.anims.lastEnd - r.offMs : null)), mSOff = M3(WS, (r) => r.offMs), mScroll = M3(WS, (r) => r.scroll?.t), mTOff = M3(WT, (r) => r.offMs), mItem = M3(WT, (r) => r.itemClick?.t), mSheet = M3(WT, (r) => r.sheet), mFade = M3(WR, (r) => r.ms);
      mCut.out = []; // a difference of two times, not a time: no outlier rule
      const wProps = [...new Set(WP.flatMap((r) => r.anims?.props || []))], wPropsOk = wProps.every((x) => OK_PROPS.includes(x)), wCount = WP.map((r) => r.anims?.count ?? null), wFps = WP.map((r) => r.medianFps ?? null), wGap = WP.map((r) => r.worstGapMs ?? null);
      const wPlays = WP.every((r) => r.done && r.key === k && !!r.anims && r.anims.count > 0) && wPropsOk && Number.isFinite(mCut.m) && mCut.m <= 17;
      check(`webkit-plays-${k}`, wPlays, `WebKit, iPhone 13 device, English tap, 3 runs: ${k} plays in each (the page names ${WP.map((r) => r.key).join(' / ')}), ${wCount.join(' / ')} animations on ${wProps.join(', ')} (transform, opacity and the individual transform properties only: ${wPropsOk}); the last animation's end minus the overlay's going, ${ms3(mCut)} (≤ 17: nothing cut); for information, unthrottled: median fps ${wFps.join(' / ')}, worst gap ${wGap.join(' / ')} ms`);
      const wTiming = WS.every((r) => !!r.scroll && r.y > 0) && WT.every((r) => !!r.itemClick && r.sheetOpen) && mOff.m <= TOTAL && mSOff.m <= TOTAL && mTOff.m <= TOTAL && mScroll.m <= USABLE && mItem.m <= USABLE && mSheet.m <= USABLE;
      check(`webkit-timing-${k}`, wTiming, `WebKit, ${k}, 3 runs each, judged on the median: the overlay gone ${ms3(mOff)} after the tap (≤ ${TOTAL}; on the scroll loads ${ms3(mSOff)}, on the tap loads ${ms3(mTOff)}); a mouse wheel right after the tap (mobile emulation off for those loads) moved the page from ${ms3(mScroll)} (≤ ${USABLE}; scrolled during the transition in every run: ${WS.every((r) => !!r.scroll && r.y > 0)}, to ${WS.map((r) => r.y).join(' / ')} px); a touch tap on the first item landed ${ms3(mItem)} after the language tap and opened its popup at ${ms3(mSheet)} (≤ ${USABLE}; open in every run: ${WT.every((r) => r.sheetOpen)})`);
      const wReduced = WR.every((r) => r.faded && r.anims?.count === 1 && r.anims.props.join() === 'opacity' && !r.anims.built && r.welcome === 'off') && mFade.m >= 120 && mFade.m <= 230;
      check(`webkit-reduced-${k}`, wReduced, `WebKit, ${k} with reduced motion, 3 runs: the 150 ms fade gone ${ms3(mFade)} (120–230); in every run an opacity between 0 and 1 seen (${WR.map((r) => r.faded).join(' / ')}), one animation on the overlay's opacity (${WR.map((r) => `${r.anims?.count} on ${r.anims?.props.join(', ')}`).join(' / ')}), nothing of the concept built (${WR.every((r) => !r.anims?.built)})`);
      const wErrors = [...WP, ...WS, ...WT, ...WR].flatMap((r) => r.errors);
      check(`webkit-errors-${k}`, wErrors.length === 0, `WebKit, ${k}: console and page errors on its 12 loads (3 each: play, scroll, tap, reduced motion): ${wErrors.length ? wErrors.join(' | ') : 'none'}`);
      const outliers = [['play', mOff], ['scroll load', mSOff], ['scroll', mScroll], ['tap load', mTOff], ['item tap', mItem], ['popup', mSheet], ['fade', mFade]].filter(([, x]) => x.out.length).map(([n, x]) => `${n} ${x.out.join('/')} ms (median ${x.m})`);
      // Compared with Chromium: the same animations (count and properties), the same outcome of each functional check, and gone-after
      // with the same interaction unthrottled within 100 ms (Chromium's CPU 4× play is not comparable: WebKit is not throttled).
      const cPlays = en.done && !!en.anims && en.anims.count > 0 && okProps && cut !== null && cut <= 17;
      const cTiming = en.done && en.offMs <= TOTAL && unthrottled <= TOTAL && !!sc.scroll && sc.scroll.t <= USABLE && sc.y > 0 && !!tp.itemClick && tp.itemClick.t <= USABLE && tp.sheet !== null && tp.sheet <= USABLE && tp.sheetOpen;
      const cReduced = rm.faded && rm.ms >= 120 && rm.ms <= 230 && rm.anims?.count === 1 && rm.anims.props.join() === 'opacity' && !rm.anims.built && rm.welcome === 'off';
      const wUnthrottled = Math.max(mSOff.m, mTOff.m), same = (a, b) => [...a].sort().join() === [...b].sort().join();
      const differs = [
        wCount.some((x) => x !== en.anims?.count) && `animations ${en.anims?.count} in Chromium, ${wCount.join(' / ')} in WebKit`,
        !same(en.anims?.props || [], wProps) && `animated properties ${(en.anims?.props || []).join('/')} in Chromium, ${wProps.join('/')} in WebKit`,
        cPlays !== wPlays && `plays: Chromium ${cPlays ? 'pass' : 'fail'}, WebKit ${wPlays ? 'pass' : 'fail'}`,
        cTiming !== wTiming && `timing: Chromium ${cTiming ? 'pass' : 'fail'}, WebKit ${wTiming ? 'pass' : 'fail'}`,
        cReduced !== wReduced && `reduced motion: Chromium ${cReduced ? 'pass' : 'fail'}, WebKit ${wReduced ? 'pass' : 'fail'}`,
        !(Math.abs(wUnthrottled - unthrottled) <= 100) && `gone after ${unthrottled} ms in Chromium and ${Number.isFinite(wUnthrottled) ? wUnthrottled : '—'} ms in WebKit (scroll and tap loads, unthrottled; WebKit's medians)`,
      ].filter(Boolean);
      let rec = null; { rec = await record(id, season); check(`recording-${k}`, rec.size > 10000, `${path.relative(process.cwd(), rec.file)} (${(rec.size / 1024).toFixed(0)} KB; gitignored, on disk only)`); }
      rows.push({ id, season, key: k, name: w?.name, level: w?.level, nominalMs: w?.ms ?? null, text: w?.text ?? null, sizeGz: size, en: { offMs: en.offMs, medianFps: en.medianFps, worstGapMs: en.worstGapMs, longestTaskMs: en.longestTaskMs, animations: en.anims?.count, lastEnd: en.anims?.lastEnd }, fa: { done: fa.done, offMs: fa.offMs, medianFps: fa.medianFps, worstGapMs: fa.worstGapMs, longestTaskMs: fa.longestTaskMs, langAtFirstFrame: fa.first?.lang }, unthrottledOffMs: unthrottled, scrollMs: sc.scroll?.t ?? null, tapMs: tp.itemClick?.t ?? null, sheetMs: tp.sheet, reducedMs: rm.ms, recording: rec && path.basename(rec.file),
        webkit: { plays: wPlays, timing: wTiming, reduced: wReduced, errors: wErrors.length, off: j3(mOff), scrollOff: j3(mSOff), tapOff: j3(mTOff), scroll: j3(mScroll), item: j3(mItem), sheet: j3(mSheet), fade: j3(mFade), cut: j3(mCut), animations: wCount, props: wProps, fps: wFps, worstGapMs: wGap, outliers, differs } });
      measure(`${k}: ${en.offMs} ms at CPU 4× (${unthrottled} ms unthrottled), median ${en.medianFps} fps, longest task ${en.longestTaskMs} ms; Persian tap ${fa.medianFps} fps, longest task ${fa.longestTaskMs} ms; scroll at ${sc.scroll?.t} ms, item tap at ${tp.itemClick?.t} ms; reduced motion ${rm.ms} ms; ${size} B gzipped; WebKit (median of 3; runs): gone after ${mOff.m} ms (${mOff.v.join('/')}), ${wCount.join('/')} animations, ${wFps.join('/')} fps (information), scroll at ${mScroll.m} ms (${mScroll.v.join('/')}), item tap at ${mItem.m} ms (${mItem.v.join('/')}), reduced motion ${mFade.m} ms (${mFade.v.join('/')}), ${wErrors.length} errors, ${outliers.length ? `outliers: ${outliers.join('; ')}, ` : ''}${differs.length ? `differs from Chromium: ${differs.join('; ')}` : 'as Chromium'}`);
    }
    // unchanged: Kebab Land as the previous commit served it; the venues on the default template with the same scripts and stylesheet
    // (the fixture holds fall and winter; every season's scene of theirs is checked byte for byte by the season drill)
    for (const v of venues.filter((x) => x !== 'senso' && (season === 'fall' || season === 'winter'))) {
      const r = await api('/api/admin/style', { action: 'update', venue: v, patch: {} }); // a no-op save regenerates the page for this server's season
      const got = await waitPage(v, (h) => seasonOf(h) === season);
      const b = behaviourOf(got.html), css = await stylesheetHashes(base, b.stylesheets);
      const ref = fixture.venues['kebab-land'][season];
      const diffs = v === 'kebab-land' ? compareBehaviour(ref, b, css) : compareBehaviour({ ...ref, overlay: null }, b, css);
      check(`unchanged-${v}-${season}`, r.status === 200 && got.ok && diffs.length === 0 && !/welcome-tx|rosesTx/.test(got.html), `${v} ${season} (regenerated by a no-op Style save, ${r.status}): ${v === 'kebab-land' ? 'head script, tap script, the whole overlay (logo as a placeholder) and the public stylesheet' : 'head script, tap script and the public stylesheet'} byte for byte as the previous commit (${fixture.capturedFrom.commit}) served Kebab Land: ${diffs.length ? diffs.join('; ') : 'identical'}; no transition code in its page: ${!/welcome-tx|rosesTx/.test(got.html)}`);
    }
  }
  // The Persian tap (the PM, 2026-10-11): a real check over the 40 Persian taps measured above (CPU 4×, from the tap to the overlay gone),
  // listed in reports/checks/known-misses.json as "Persian tap, Senso" until the relayout task is ≤ 50 ms; measured and printed every run.
  {
    const taps = rows.map((r) => ({ key: r.key, done: !!r.fa.done, ms: r.fa.longestTaskMs })), over = taps.filter((x) => !x.done || x.ms > 50);
    check('persian-tap-senso', taps.length === IDS.length * 4 && over.length === 0, `Senso, iPhone 13 viewport, CPU 4×, the فارسی tap of every concept in every season (${taps.length} of ${IDS.length * 4} taps measured): no long task over 50 ms from the tap to the overlay gone; over 50 ms: ${over.length}${over.length ? ` (${over.map((x) => `${x.key} ${x.done ? `${x.ms} ms` : 'not measured'}`).join(', ')})` : ''}; the longest task per tap: ${taps.map((x) => `${x.key} ${x.done ? x.ms : '—'}`).join(', ')} ms`);
    const wkRows = rows.filter((r) => r.webkit);
    measure(`WebKit (3 runs per time, the median): ${wkRows.length} versions, ${wkRows.filter((r) => r.webkit.plays && r.webkit.timing && r.webkit.reduced && !r.webkit.errors).length} passing every functional check; ${wkRows.filter((r) => r.webkit.differs.length).length} behaving differently from Chromium${wkRows.some((r) => r.webkit.differs.length) ? ` (${wkRows.filter((r) => r.webkit.differs.length).map((r) => r.key).join(', ')})` : ''}; ${wkRows.reduce((n, r) => n + r.webkit.outliers.length, 0)} outlier run(s)${wkRows.some((r) => r.webkit.outliers.length) ? ` (${wkRows.filter((r) => r.webkit.outliers.length).map((r) => `${r.key}: ${r.webkit.outliers.join('; ')}`).join(' · ')})` : ''}`);
    measure(`Persian tap, Senso (CPU 4×): ${over.length} of ${taps.length} taps with a long task over 50 ms, the longest ${Math.max(0, ...taps.map((x) => x.ms || 0))} ms`);
  }
  // Day one (Kian's ruling of 2026-10-11: every season starts on the concept chosen before, so customers see no change until a pick):
  // Senso's style put back to the single form of 2026-10-10 ({ transition: X }, no per-season key; the Style route's restore), a page of
  // each season rendered; then X saved for each of the four seasons, each season's page rendered again: byte for byte the same.
  const regen = async (season, at = null) => { await stop(); await start(season, at); await signIn(); await api('/api/admin/style', { action: 'update', venue: 'senso', patch: {} }); };
  {
    const X = IDS.includes(original.transition) ? original.transition : 'T6';
    const single = Object.fromEntries(Object.entries(original).filter(([key]) => !Object.values(TXKEY).includes(key))); single.transition = X;
    const rs = await api('/api/admin/style', { action: 'restore', venue: 'senso', style: single });
    const before = (await db.query(`select style from venues where id = 'senso'`)).rows[0]?.style ?? {};
    const A = {}, B = {};
    for (const season of ALL4) { await regen(season); A[season] = await waitPage('senso', (h) => seasonOf(h) === season && h.includes(`data-tx="${X}-${season}"`)); }
    const rp = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: Object.fromEntries(ALL4.map((x) => [TXKEY[x], X])) });
    const after = (await db.query(`select style from venues where id = 'senso'`)).rows[0]?.style ?? {};
    for (const season of ALL4) { await regen(season); B[season] = await waitPage('senso', (h) => seasonOf(h) === season && h.includes(`data-tx="${X}-${season}"`)); }
    for (const season of ALL4) {
      const same = A[season].ok && B[season].ok && A[season].html === B[season].html;
      check(`day-one-${season}`, rs.status === 200 && rp.status === 200 && before.transition === X && ALL4.every((x) => before[TXKEY[x]] === undefined) && ALL4.every((x) => after[TXKEY[x]] === X) && same, `Senso ${season}, day one: with the single choice of 2026-10-10 (restore ${rs.status}: venues.style.transition = ${before.transition}, no per-season key) the page ships ${X}-${season}; with ${X} saved for each season (${rp.status}: ${ALL4.map((x) => `${TXKEY[x]} ${after[TXKEY[x]]}`).join(', ')}) it is byte for byte the same page: ${same} (${A[season].html.length} / ${B[season].html.length} B)`);
    }
  }
  // Per-season choices: four different concepts, one per season; a render at each Toronto season boundary instant ships exactly that
  // season's choice and nothing else (one data-tx, one rosesTx definition, its key named once, its style and script equal to what the admin's
  // scene API renders for it, no other season's choice in the page).
  {
    const r = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: Object.fromEntries(ALL4.map((x) => [TXKEY[x], CHOICE[x]])) });
    const wantB = {}; for (const x of ALL4) wantB[x] = (await api(`/api/admin/welcome-scene?venue=senso&season=${x}&transition=${CHOICE[x]}`)).json?.tx ?? null;
    for (const B0 of BOUNDARIES) {
      await regen(null, B0.at);
      const got = await waitPage('senso', (h) => seasonOf(h) === B0.want);
      const h = got.html, k2 = `${CHOICE[B0.want]}-${B0.want}`, w0 = wantB[B0.want];
      const keys = all(h, /data-tx="([^"]+)"/g), named = all(h, /rosesTxKey='([^']+)'/g), defs = (h.match(/w\.rosesTx=function/g) || []).length;
      const styleText = (h.match(/<style id="welcome-tx" data-tx="[^"]*">([\s\S]*?)<\/style>/) || [])[1] ?? null;
      const others = ALL4.filter((x) => x !== B0.want && (h.includes(`${CHOICE[x]}-${x}`) || (wantB[x] && h.includes(wantB[x].js))));
      const ok = r.status === 200 && got.ok && seasonOf(h) === B0.want && keys.join() === k2 && named.join() === k2 && defs === 1 && !!w0 && styleText === w0.css && h.includes(w0.js) && others.length === 0;
      boundaries.push({ at: B0.at, label: B0.label, want: B0.want, season: seasonOf(h), ships: keys.join(', ') || 'none', ok });
      check(`season-choice-${B0.id}`, ok, `${B0.label} (server clock ${B0.at}), choices ${ALL4.map((x) => `${x} ${CHOICE[x]}`).join(', ')}: the page renders ${seasonOf(h)} (want ${B0.want}) and ships exactly ${keys.join(', ') || 'no transition'} (named ${named.join(', ') || 'nowhere'}, ${defs} rosesTx definition; its style and script equal what the admin's scene API renders for ${k2}: ${!!w0 && styleText === w0.css} / ${!!w0 && h.includes(w0.js)}); another season's choice in the page: ${others.join(', ') || 'none'}`);
    }
  }

  // ---- the admin preview: a row per season (laptop: Fall chosen, Winter's Play twice, Spring chosen, the bar's Summer); the phone's Summer row
  await stop(); await start('fall'); await signIn();
  // the copy's cache still holds the summer page rendered just above: a no-op save makes the fall page current before the admin plays it
  await api('/api/admin/style', { action: 'update', venue: 'senso', patch: {} }); await waitPage('senso', (h) => seasonOf(h) === 'fall');
  const [cname, cvalue] = cookie.split('=');
  // The preview's play, watched frame by frame from the admin page (its requestAnimationFrame: the frame's paint rhythm, the two share a
  // thread): the frame on screen (its slot), its welcome state, the concept named in it, whether the card's entrance is still running,
  // the outline of the preview's own on the overlay, and whether the preview is playing. A play must look as on the public page (Kian,
  // 2026-10-10: the preview showed the transitions with a jump): no swap of the frame between the welcome screen and the menu, the card
  // settled when it is tapped and seen settled for a beat (≥ 480 ms), none of the preview's outline on it while it plays, the frames
  // as smooth (median interval ≤ 20 ms) and the tap to the menu within the public page's 900 ms.
  const LOGGER = () => { const L = window.__pl = []; window.__plStop = false; const t0 = performance.now(); const tick = () => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument, W = f && f.contentWindow, w = d && d.getElementById('welcome'); if (w) { const c = w.querySelector('.welcome-card'); const run = c ? c.getAnimations({ subtree: true }).filter((a) => a instanceof W.CSSAnimation && a.playState === 'running').length : 0; L.push({ t: Math.round(performance.now() - t0), slot: f.dataset.previewSlot, welcome: d.documentElement.dataset.welcome, key: w.rosesTxKey ?? null, playing: d.documentElement.classList.contains('roses-play'), settled: run === 0, outline: W.getComputedStyle(w).outlineStyle }); } if (!window.__plStop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
  const watchPlay = async (p, action) => {
    await p.evaluate(LOGGER); await action();
    const t = Date.now(); let L = [];
    while (Date.now() - t < 9000) { L = await p.evaluate(() => window.__pl); const di = L.findIndex((x) => x.welcome === 'done'); if (di >= 0 && L.slice(di).some((x) => x.welcome === 'off')) break; await sleep(60); }
    await p.evaluate(() => { window.__plStop = true; });
    const di = L.findIndex((x) => x.welcome === 'done'), oi = L.findIndex((x, i) => i > di && x.welcome === 'off'), si = L.findIndex((x) => x.playing && x.welcome === 'show');
    if (di < 0 || oi < di || si < 0) return { played: false, key: null, samples: L.length };
    let from = si; for (let i = di - 1; i >= si; i--) if (!L[i].settled) { from = i + 1; break; }
    const seg = L.slice(di, oi + 1), gaps = seg.slice(1).map((x, i) => x.t - seg[i].t).sort((a, b) => a - b);
    const r = { played: true, key: L[di].key, doneAt: L[di].t, offAt: L[oi].t, tapToOff: L[oi].t - L[di].t, slots: [...new Set(L.slice(si, oi + 1).map((x) => x.slot))], settledAtTap: L[di - 1]?.settled === true, beat: L[di].t - L[from].t, outline: [...new Set(L.filter((x) => x.playing).map((x) => x.outline))], medianGap: gaps[Math.floor(gaps.length / 2)], worstGap: gaps.at(-1) };
    r.ok = r.slots.length === 1 && r.settledAtTap && r.beat >= 480 && r.outline.join() === 'none' && r.tapToOff <= TOTAL && r.medianGap <= 20;
    return r;
  };
  const playText = (x) => x.played ? `${x.key}: tapped at ${x.doneAt} ms after the click, after the card had been settled for ${x.beat} ms (≥ 480; settled at the tap: ${x.settledAtTap}), the menu ${x.tapToOff} ms after the tap (≤ ${TOTAL}); the frame on screen throughout (${x.slots.length === 1 ? 'no swap' : `swapped: slots ${x.slots.join(', ')}`}), the preview's outline while playing: ${x.outline.join('/')}; frames ${x.medianGap} ms median, ${x.worstGap} ms worst` : `not played (${x.samples} samples)`;
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addCookies([{ name: cname, value: cvalue, url: base }]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await open(p, `${base}/admin/senso?tab=style`); await p.waitForSelector('[data-style-group="welcome"] > button');
    await p.click('[data-style-group="welcome"] > button'); await p.waitForSelector('[data-transition-select="fall"]'); await p.waitForSelector('iframe[data-preview-frame]'); await sleep(600);
    const stored = async (season, want) => { const t = Date.now(); let v = null; while (Date.now() - t < 4000) { v = (await db.query(`select style->>$1 as t from venues where id = 'senso'`, [TXKEY[season]])).rows[0]?.t; if (v === want) break; await sleep(100); } return v; };
    const a = await watchPlay(p, () => p.selectOption('[data-transition-select="fall"]', 'T6'));
    const savedFall = await stored('fall', 'T6');
    const screen = await p.getAttribute('[data-style-bar] [data-preview-screen][aria-pressed="true"]', 'data-preview-screen');
    const b = await watchPlay(p, () => p.click('[data-transition-play="winter"]'));
    const barSeason = await p.getAttribute('[data-style-bar] [data-preview-season][aria-pressed="true"]', 'data-preview-season');
    const c = await watchPlay(p, () => p.click('[data-transition-play="winter"]'));
    const d = await watchPlay(p, () => p.selectOption('[data-transition-select="spring"]', 'T9'));
    const savedSpring = await stored('spring', 'T9');
    await p.click('[data-style-bar] [data-preview-season="summer"]');
    let summerKey = null; { const t = Date.now(); while (Date.now() - t < 5000) { summerKey = await p.evaluate(() => { const f = document.querySelector('iframe[data-preview-frame]'); const w = f && f.contentDocument && f.contentDocument.getElementById('welcome'); return (w && w.dataset.season === 'summer' && w.rosesTxKey) || null; }); if (summerKey) break; await sleep(100); } }
    await p.screenshot({ path: path.join(out, `admin-play-laptop.${jpeg ? 'jpg' : 'png'}`), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) });
    const want = { b: `${CHOICE.winter}-winter`, s: `${CHOICE.summer}-summer` };
    check('admin-play-laptop', a.played && a.key === 'T6-fall' && savedFall === 'T6' && screen === 'menu' && b.played && b.key === want.b && barSeason === 'winter' && c.played && c.key === want.b && d.played && d.key === 'T9-spring' && savedSpring === 'T9' && summerKey === want.s && errors.length === 0, `laptop, Style tab → Welcome → Transition, a row per season: Fall row T6 chosen → saved (venues.style.transitionFall ${savedFall}) and played in the preview (${a.key}), the bar's screen then ${screen}; the Winter row's Play → the preview switched to winter (the bar: ${barSeason}) and played that season's choice (${b.key}, want ${want.b}); Play again → ${c.key}; Spring row T9 chosen → saved (transitionSpring ${savedSpring}) and played as ${d.key}; the bar's Summer → the frame carries summer's choice (${summerKey}, want ${want.s}); page errors ${errors.length}`);
    check('admin-play-like-public-laptop', a.ok && b.ok && c.ok && d.ok, `laptop, each play as on the public page: Fall chosen: ${playText(a)}; Winter's Play: ${playText(b)}; Play again: ${playText(c)}; Spring chosen: ${playText(d)}`);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext(DEVICE); await ctx.addCookies([{ name: cname, value: cvalue, url: base }]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await open(p, `${base}/admin/senso?tab=style`); await p.waitForSelector('[data-style-sheet] [data-style-group="welcome"] > button');
    const g = p.locator('[data-style-sheet] [data-style-group="welcome"] > button'); await g.scrollIntoViewIfNeeded(); await g.click();
    await p.waitForSelector('[data-style-sheet] [data-transition-select="summer"]'); await sleep(600);
    const sel = p.locator('[data-style-sheet] [data-transition-select="summer"]'); await sel.scrollIntoViewIfNeeded();
    const a = await watchPlay(p, () => sel.selectOption('T7'));
    const play = p.locator('[data-style-sheet] [data-transition-play="summer"]'); await play.scrollIntoViewIfNeeded();
    const b = await watchPlay(p, () => play.tap());
    await p.screenshot({ path: path.join(out, `admin-play-phone.${jpeg ? 'jpg' : 'png'}`), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) });
    check('admin-play-phone', a.played && a.key === 'T7-summer' && b.played && b.key === 'T7-summer' && errors.length === 0, `iPhone 13 viewport, the Style tab's bottom sheet → Welcome → the Summer row: T7 chosen → the preview above the sheet switched to summer and played ${a.key}; the row's Play tapped → played again (${b.key}); page errors ${errors.length}`);
    check('admin-play-like-public-phone', a.ok && b.ok, `iPhone 13 viewport, each play as on the public page: chosen: ${playText(a)}; Play: ${playText(b)}`);
    await ctx.close();
  }
} catch (e) {
  check('drill', false, `stopped: ${e.stack || e.message}`);
} finally {
  // Senso's style as it was before the drill (one restore record)
  try {
    if (!server) { await start('fall'); }
    await signIn();
    if (original) { const r = await api('/api/admin/style', { action: 'restore', venue: 'senso', style: original }); const st = (await db.query(`select style from venues where id = 'senso'`)).rows[0]?.style ?? {}; const back = st.transition ?? null, per = ALL4.map((x) => st[TXKEY[x]] ?? null); check('restored', r.status === 200 && back === (original.transition ?? null) && ALL4.every((x, i) => per[i] === (original[TXKEY[x]] ?? null)) && JSON.stringify(st.colors ?? {}) === JSON.stringify(original.colors ?? {}), `Senso's style put back as it was (restore ${r.status}): transition ${back ?? '(unset)'}, per season ${per.map((x) => x ?? '(unset)').join(' / ')}, colours as before: ${JSON.stringify(st.colors ?? {}) === JSON.stringify(original.colors ?? {})}`); }
  } catch (e) { check('restored', false, `could not put Senso's style back: ${e.message}`); }
  await stop(); await browser.close(); if (wk) await wk.close(); await db.end(); fs.closeSync(serverLog);
  fs.rmSync(copy, { recursive: true, force: true });
}

const pass = results.every((r) => r.ok);
const table = ['| Concept | Level | Season | Time (nominal) | Gone after (CPU 4× / unthrottled) | Median fps (4×) | Longest task (4×) | Scroll / tap after | Reduced motion | Gzipped | Persian tap: fps, longest task |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} ${r.name} | ${r.level} | ${r.season} | ${r.nominalMs} ms | ${r.en.offMs} / ${r.unthrottledOffMs} ms | ${r.en.medianFps} | ${r.en.longestTaskMs} ms | ${r.scrollMs} / ${r.tapMs} ms | ${r.reducedMs} ms | ${r.sizeGz} B | ${r.fa.medianFps}, ${r.fa.longestTaskMs} ms |`)];
const r3 = (x) => (x ? `${x.median ?? '—'} (${x.runs.map((v) => v ?? '—').join('/')})` : '—');
const wkTable = ['| Concept | Season | Plays | Gone after, ms: median (3 runs) | Scroll / item tap / popup, ms: medians | Reduced-motion fade, ms: median (3 runs) | Errors | Animations (WebKit runs / Chromium) | fps (runs; information) | Outliers | As Chromium? |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.filter((r) => r.webkit).map((r) => `| ${r.id} ${r.name} | ${r.season} | ${r.webkit.plays ? 'yes' : '**no**'} | ${r3(r.webkit.off)} | ${r.webkit.scroll.median ?? '—'} / ${r.webkit.item.median ?? '—'} / ${r.webkit.sheet.median ?? '—'} | ${r3(r.webkit.fade)} | ${r.webkit.errors} | ${r.webkit.animations.join('/')} / ${r.en.animations} | ${r.webkit.fps.join('/')} | ${r.webkit.outliers.length ? r.webkit.outliers.join('; ') : '—'} | ${r.webkit.differs.length ? `**differs**: ${r.webkit.differs.join('; ')}` : 'yes'} |`)];
const wkDiffers = rows.filter((r) => r.webkit?.differs.length), wkOut = rows.filter((r) => r.webkit?.outliers.length);
fs.writeFileSync(path.join(out, 'transition-drill.json'), JSON.stringify({ base, dist, copy, at: new Date().toISOString(), pass, rows, boundaries, results, measures, transcript }, null, 2));
fs.writeFileSync(path.join(out, 'transition-drill.txt'), [`Transition drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', ...table, '', `WebKit (the PM, 2026-10-11; functional checks, every time measured 3 times and judged on the median, fps for information only; ${wkDiffers.length ? `${wkDiffers.length} version(s) behave differently from Chromium: ${wkDiffers.map((r) => `${r.key}: ${r.webkit.differs.join('; ')}`).join(' · ')}` : 'every version behaves as in Chromium'}; outlier runs (over 2× the median, counted): ${wkOut.length ? wkOut.map((r) => `${r.key}: ${r.webkit.outliers.join('; ')}`).join(' · ') : 'none'}):`, '', ...wkTable, '', 'Per-season choices at the Toronto season boundaries (four different concepts: ' + ALL4.map((x) => `${x} ${CHOICE[x]}`).join(', ') + '):', '', '| Instant | Server clock | Season rendered | Ships | Result |', '|---|---|---|---|---|', ...boundaries.map((b0) => `| ${b0.label} | ${b0.at} | ${b0.season} (want ${b0.want}) | ${b0.ships} | ${b0.ok ? 'PASS' : '**FAIL**'} |`), '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`TRANSITION DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
