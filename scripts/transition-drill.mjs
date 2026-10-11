#!/usr/bin/env node
// The welcome screen's transitions into the menu (owner and manager via Kian, 2026-10-10; src/lib/transitions.ts, src/lib/welcome-transitions.ts),
// Senso, fall and winter, every concept T1–T10. Proven on a copy of the build with its own server, its clock fixed to a fall and then a
// winter instant (ROSES_NOW with the suite's flag ROSES_CHECK_SUITE=1, as in the season drill); each concept is chosen through the Style
// route as the owner would (the save regenerates the page) and stored in venues.style.transition (read back from the database):
//   served page: exactly one transition in the HTML, the chosen one for the page's season (its style and its script equal what the
//     admin's scene API renders for it, its key the only one named, no other concept's code), ≤ 3 KB gzipped (its style and script);
//     spring and summer pages carry none (the plain fade);
//   smoothness (Kian's ruling): iPhone 13 viewport, CDP CPU 4×, requestAnimationFrame from the tap to the overlay gone: median ≥ 50 fps
//     (the median frame interval), no long task > 50 ms, with an English tap (the page's own language on a first visit, so the tap changes
//     no layout); every animation of the transition on transform, opacity or an individual transform property, and ended before the
//     overlay goes (nothing cut); reported per concept as measured;
//   the same with a Persian tap, reported as measured (the tap then lays the whole menu out again in Persian, a cost of the language
//     switch that the 200 ms fade of 2026-10-09 has too); with it, the language is applied at the first frame after the tap, before the
//     transition has moved (no flash of the other language);
//   timing: total ≤ 900 ms (from the tap to the overlay gone, at CPU 4× and unthrottled); the menu scrollable and tappable within 300 ms
//     of the tap, measured with a real touch scroll right after the tap (the first scroll event and the page moved) and, on another load,
//     a real tap on the first item (its popup open), both during the transition;
//   reduced motion: a 150 ms fade for every concept (an opacity between 0 and 1 seen, gone in 120–230 ms, one animation: the overlay's
//     opacity; nothing of the concept built);
//   recordings (Playwright video, on disk only): all ten in fall on the iPhone 13 viewport;
//   unchanged: Kebab Land's welcome behaviour byte for byte as the previous commit served it (scripts/fixtures/welcome-behaviour.json:
//     head script, tap script, the whole overlay with the logo's <img> as a placeholder, the public stylesheet by hash) in fall and in
//     winter; every venue on the default template (--venues) with the same head and tap scripts and stylesheet;
//   the admin preview (Style tab → Welcome → Transition): on a laptop, a concept chosen is saved and played in the preview's frame by the
//     page's own code (the frame names the chosen concept and season, reaches "done" and ends on the menu, the bar's screen then Menu);
//     the bar's Winter, then Play: the winter version; Play again: played again; on the iPhone 13 viewport, the same choice and Play in the
//     Style tab's bottom sheet.
// At the end Senso's style is put back as it was (the Style route's restore). The drill's server is its own: the port must be free
// before it starts, and its listener must be the process it spawned (lsof).
//   DRILL_ADMIN_EMAIL=… DRILL_ADMIN_PIN=… node scripts/transition-drill.mjs --dist .next-check --copy .next-transition --port 3103 --out reports/checks/<stamp>/transition [--venues senso,kebab-land,<temp>] [--jpeg]
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
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
const SEASONS = { fall: '2026-10-15T12:00:00-04:00', winter: '2026-12-15T12:00:00-05:00', spring: '2027-04-15T12:00:00-04:00', summer: '2027-07-15T12:00:00-04:00' };
const IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];
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
async function start(season) {
  if (!(await portFree('127.0.0.1')) || !(await portFree('::1'))) throw new Error(`port ${port} is in use by a process this drill did not start; it is left alone`);
  server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env: { ...process.env, NEXT_DIST_DIR: copy, ROSES_NOW: SEASONS[season], ROSES_CHECK_SUITE: '1', ROSES_APP_NAME: 'roses-check:transition-server' }, stdio: ['ignore', serverLog, serverLog] });
  fs.writeSync(serverLog, `\n--- server started with ROSES_NOW=${SEASONS[season]} (${season}) and ROSES_CHECK_SUITE=1 at ${new Date().toISOString()}\n`);
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
const settled = (p) => p.waitForFunction(() => { const b = document.querySelector('#welcome button[data-lang="fa"]'); return !!b && Number(getComputedStyle(b).opacity) === 1; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
const offWait = (p) => p.waitForFunction(() => window.__tx && window.__tx.off !== null && performance.now() > window.__tx.off + 200, null, { timeout: 8000 }).then(() => true).catch(() => false);

let browser = await chromium.launch();
// Smoothness (and timing) at CPU 4× with a tap in `lang`.
async function smooth(lang) {
  const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await settled(p); await sleep(250);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await sleep(500);
  await p.evaluate(RECORDER); await sleep(60);
  await p.tap(`#welcome button[data-lang="${lang}"]`);
  const done = await offWait(p); const r = done ? await p.evaluate(RESULT) : null;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await ctx.close();
  return { ...r, done, errors };
}
// Usable within 300 ms: a real touch scroll right after the tap (the first scroll event and the page moved), or a real tap on the first item (its popup open).
async function usable(kind) {
  const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await settled(p); await sleep(250);
  await p.evaluate(RECORDER);
  const item = await p.evaluate(() => { const li = document.querySelector('main section li.item'); const r = li.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 60)), id: li.dataset.id }; });
  await p.evaluate(() => { const R = window.__tx; R.scroll = null; R.itemClick = null; R.sheet = null;
    addEventListener('scroll', () => { if (R.scroll === null && R.click !== null) R.scroll = { t: performance.now() - R.click, y: scrollY }; }, { passive: true });
    document.addEventListener('click', (e) => { if (R.itemClick === null && R.click !== null && e.target.closest && e.target.closest('main li.item')) R.itemClick = { t: performance.now() - R.click, id: e.target.closest('li.item').dataset.id }; }, true);
    const d = document.getElementById('sheet'); if (d) new MutationObserver(() => { if (d.open && R.sheet === null && R.click !== null) R.sheet = performance.now() - R.click; }).observe(d, { attributes: true, attributeFilter: ['open'] }); });
  const cdp = await ctx.newCDPSession(p);
  await p.tap('#welcome button[data-lang="en"]');
  if (kind === 'scroll') await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 520, xDistance: 0, yDistance: -260, speed: 2600, gestureSourceType: 'touch', preventFling: true });
  else await p.touchscreen.tap(item.x, item.y);
  await offWait(p); await sleep(150);
  const r = await p.evaluate(() => { const R = window.__tx; return { scroll: R.scroll && { t: Math.round(R.scroll.t), y: Math.round(R.scroll.y) }, y: Math.round(scrollY), itemClick: R.itemClick && { t: Math.round(R.itemClick.t), id: R.itemClick.id }, sheet: R.sheet === null ? null : Math.round(R.sheet), sheetOpen: !!document.getElementById('sheet')?.open, offMs: Math.round(R.off - R.click) }; });
  await ctx.close();
  return { ...r, item, errors };
}
// Reduced motion: the 150 ms fade.
async function reduced() {
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' }); const p = await ctx.newPage();
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.welcome === 'show'); await sleep(150);
  const r = await p.evaluate(() => new Promise((res) => { const w = document.getElementById('welcome'); let faded = false, anims = null; const s = performance.now(); w.querySelector('button[data-lang="en"]').click();
    requestAnimationFrame(() => { const a = document.getAnimations().filter((x) => !(x instanceof CSSAnimation) && !(x instanceof CSSTransition)); anims = { count: a.length, targets: a.map((x) => (x.effect.target.id || x.effect.target.className || x.effect.target.tagName)), props: [...new Set(a.flatMap((x) => x.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((q) => !['offset', 'computedOffset', 'easing', 'composite'].includes(q)))))], built: !!w.querySelector('.txb, .txl') }; });
    const tick = () => { const cs = getComputedStyle(w), t = performance.now() - s, o = Number(cs.opacity); if (o > 0 && o < 1) faded = true; if (cs.display === 'none' || t > 2000) res({ ms: Math.round(t), faded, anims, welcome: document.documentElement.dataset.welcome }); else requestAnimationFrame(tick); }; tick(); }));
  await ctx.close();
  return r;
}
async function record(id, season) {
  const ctx = await browser.newContext({ ...DEVICE, recordVideo: { dir: out, size: { width: 390, height: 664 } } }); const p = await ctx.newPage();
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await settled(p); await sleep(900);
  await p.tap('#welcome button[data-lang="en"]'); await sleep(1300);
  const video = p.video(); await ctx.close();
  const file = path.join(out, `transition-${id}-${season}.webm`); await video.saveAs(file); await video.delete().catch(() => {});
  return { file, size: (await fsp.stat(file)).size };
}

// ---- the drill
const rows = [];
let original = null;
try {
  for (const season of ['fall', 'winter']) {
    await stop(); const up = await start(season); await signIn();
    log('server', `${season} server up after ${up} ms (ROSES_NOW ${SEASONS[season]})`);
    if (!original) { const g = await api('/api/admin/style?venue=senso'); original = g.json?.style ?? {}; log('style', `Senso's style before the drill: transition ${original.transition ?? '(unset: T1)'}`); }
    // what the admin's scene API renders for each concept in this season (the code the page must carry when it is chosen)
    const want = {};
    for (const id of IDS) { const r = await api(`/api/admin/welcome-scene?venue=senso&season=${season}&transition=${id}`); want[id] = r.json?.tx ?? null; }
    const jsAll = IDS.map((id) => want[id]?.js ?? '');
    let pre = 0; while (jsAll.every((j) => j[pre] === jsAll[0][pre]) && pre < jsAll[0].length) pre++;
    let suf = 0; while (jsAll.every((j) => j[j.length - 1 - suf] === jsAll[0][jsAll[0].length - 1 - suf]) && suf < jsAll[0].length - pre) suf++;
    const body = (id) => { const j = want[id]?.js ?? ''; return j.slice(pre, j.length - suf).replace(/T\d+-(fall|winter)/g, ''); };
    for (const id of IDS) {
      const k = `${id}-${season}`, w = want[id];
      const save = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { transition: id } });
      const stored = (await db.query(`select style->>'transition' as t from venues where id = 'senso'`)).rows[0]?.t;
      const served = await waitPage('senso', (h) => h.includes(`data-tx="${k}"`));
      const h = served.html;
      const keys = all(h, /data-tx="([^"]+)"/g), named = all(h, /rosesTxKey='([^']+)'/g);
      const styleText = (h.match(/<style id="welcome-tx" data-tx="[^"]*">([\s\S]*?)<\/style>/) || [])[1] ?? null;
      const others = IDS.filter((j) => j !== id && body(j).length > 40 && h.includes(body(j)));
      const defs = (h.match(/w\.rosesTx=function/g) || []).length;
      const size = w ? gz(w.css + w.js) : null;
      const nominalOk = !!w && w.ms <= TOTAL;
      const htmlOk = nominalOk && save.status === 200 && stored === id && served.ok && seasonOf(h) === season && !!w && keys.join() === k && named.join() === k && styleText === w.css && h.includes(w.js) && defs === 1 && others.length === 0;
      check(`html-${k}`, htmlOk, `${k} chosen through the Style route (${save.status}; venues.style.transition = ${stored}); the page regenerated after ${served.ms} ms for the ${seasonOf(h)} scene and carries exactly one transition: data-tx ${keys.join(', ') || 'none'}, the script names ${named.join(', ') || 'none'}, ${defs} rosesTx definition; its style and its script equal what the admin's scene API renders for ${k} (${styleText === w?.css} / ${!!w && h.includes(w.js)}); the code of another concept in the page: ${others.join(', ') || 'none'}`);
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
      let rec = null; if (season === 'fall') { rec = await record(id, season); check(`recording-${k}`, rec.size > 10000, `${path.relative(process.cwd(), rec.file)} (${(rec.size / 1024).toFixed(0)} KB; gitignored, on disk only)`); }
      rows.push({ id, season, key: k, name: w?.name, level: w?.level, nominalMs: w?.ms ?? null, text: w?.text ?? null, sizeGz: size, en: { offMs: en.offMs, medianFps: en.medianFps, worstGapMs: en.worstGapMs, longestTaskMs: en.longestTaskMs, animations: en.anims?.count, lastEnd: en.anims?.lastEnd }, fa: { offMs: fa.offMs, medianFps: fa.medianFps, worstGapMs: fa.worstGapMs, longestTaskMs: fa.longestTaskMs, langAtFirstFrame: fa.first?.lang }, unthrottledOffMs: unthrottled, scrollMs: sc.scroll?.t ?? null, tapMs: tp.itemClick?.t ?? null, sheetMs: tp.sheet, reducedMs: rm.ms, recording: rec && path.basename(rec.file) });
      measure(`${k}: ${en.offMs} ms at CPU 4× (${unthrottled} ms unthrottled), median ${en.medianFps} fps, longest task ${en.longestTaskMs} ms; Persian tap ${fa.medianFps} fps, longest task ${fa.longestTaskMs} ms; scroll at ${sc.scroll?.t} ms, item tap at ${tp.itemClick?.t} ms; reduced motion ${rm.ms} ms; ${size} B gzipped`);
    }
    // unchanged: Kebab Land as the previous commit served it; the venues on the default template with the same scripts and stylesheet
    for (const v of venues.filter((x) => x !== 'senso')) {
      const r = await api('/api/admin/style', { action: 'update', venue: v, patch: {} }); // a no-op save regenerates the page for this server's season
      const got = await waitPage(v, (h) => seasonOf(h) === season);
      const b = behaviourOf(got.html), css = await stylesheetHashes(base, b.stylesheets);
      const ref = fixture.venues['kebab-land'][season];
      const diffs = v === 'kebab-land' ? compareBehaviour(ref, b, css) : compareBehaviour({ ...ref, overlay: null }, b, css);
      check(`unchanged-${v}-${season}`, r.status === 200 && got.ok && diffs.length === 0 && !/welcome-tx|rosesTx/.test(got.html), `${v} ${season} (regenerated by a no-op Style save, ${r.status}): ${v === 'kebab-land' ? 'head script, tap script, the whole overlay (logo as a placeholder) and the public stylesheet' : 'head script, tap script and the public stylesheet'} byte for byte as the previous commit (${fixture.capturedFrom.commit}) served Kebab Land: ${diffs.length ? diffs.join('; ') : 'identical'}; no transition code in its page: ${!/welcome-tx|rosesTx/.test(got.html)}`);
    }
  }
  // spring and summer: no transition is built, the page keeps the plain fade
  for (const season of ['spring', 'summer']) {
    await stop(); await start(season); await signIn();
    await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { transition: 'T5' } });
    const got = await waitPage('senso', (h) => seasonOf(h) === season);
    check(`none-${season}`, got.ok && !/id="welcome-tx"/.test(got.html) && !/w\.rosesTx=function/.test(got.html) && /if\(w\.rosesTx\)w\.rosesTx\(off,reduced\);else/.test(got.html), `Senso ${season} with T5 chosen: no transition in the page (no #welcome-tx, no rosesTx definition); the tap keeps the plain 200 ms fade of 2026-10-09 (its fallback in the tap script: ${/if\(w\.rosesTx\)w\.rosesTx\(off,reduced\);else/.test(got.html)})`);
  }

  // ---- the admin preview: choose and play (laptop), the bar's Winter and Play, Play again; the phone's bottom sheet
  await stop(); await start('fall'); await signIn();
  const [cname, cvalue] = cookie.split('=');
  const frameState = (p) => p.evaluate(() => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; const w = d && d.getElementById('welcome'); return d ? { welcome: d.documentElement.dataset.welcome, key: w ? w.rosesTxKey ?? null : null, season: w ? w.dataset.season : null, playing: d.documentElement.classList.contains('roses-play') } : null; });
  const watchPlay = async (p, action) => { const seen = []; const t = Date.now(); await action(); while (Date.now() - t < 8000) { const s = await frameState(p); seen.push({ ms: Date.now() - t, ...s }); if (s && s.welcome === 'off' && seen.some((x) => x.welcome === 'done')) break; await sleep(40); } const done = seen.find((x) => x.welcome === 'done'); const end = seen.at(-1); return { played: !!done && end?.welcome === 'off' && !end.playing, key: done?.key ?? null, doneAt: done?.ms ?? null, offAt: end?.welcome === 'off' ? end.ms : null }; };
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addCookies([{ name: cname, value: cvalue, url: base }]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${base}/admin/senso?tab=style`); await p.waitForSelector('[data-style-group="welcome"] > button');
    await p.click('[data-style-group="welcome"] > button'); await p.waitForSelector('[data-transition="T6"]'); await p.waitForSelector('iframe[data-preview-frame]'); await sleep(600);
    const a = await watchPlay(p, () => p.click('[data-transition="T6"]'));
    const savedAs = (await db.query(`select style->>'transition' as t from venues where id = 'senso'`)).rows[0]?.t;
    const screen = await p.getAttribute('[data-style-bar] [data-preview-screen][aria-pressed="true"]', 'data-preview-screen');
    await p.click('[data-style-bar] [data-preview-season="winter"]'); await sleep(700);
    const b = await watchPlay(p, () => p.click('[data-transition-play]'));
    const c = await watchPlay(p, () => p.click('[data-transition-play]'));
    await p.screenshot({ path: path.join(out, `admin-play-laptop.${jpeg ? 'jpg' : 'png'}`), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) });
    check('admin-play-laptop', a.played && a.key === 'T6-fall' && savedAs === 'T6' && screen === 'menu' && b.played && b.key === 'T6-winter' && c.played && c.key === 'T6-winter' && errors.length === 0, `laptop, Style tab → Welcome: T6 chosen → saved (venues.style.transition ${savedAs}) and played in the preview from the fresh page (${a.key}: "done" at ${a.doneAt} ms, the menu at ${a.offAt} ms after the click), the bar's screen then ${screen}; the bar's Winter, then Play → ${b.key} played (menu at ${b.offAt} ms); Play again → ${c.key} played again (menu at ${c.offAt} ms); page errors ${errors.length}`);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext(DEVICE); await ctx.addCookies([{ name: cname, value: cvalue, url: base }]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${base}/admin/senso?tab=style`); await p.waitForSelector('[data-style-sheet] [data-style-group="welcome"] > button');
    const g = p.locator('[data-style-sheet] [data-style-group="welcome"] > button'); await g.scrollIntoViewIfNeeded(); await g.click();
    await p.waitForSelector('[data-style-sheet] [data-transition="T3"]'); await sleep(600);
    const t3 = p.locator('[data-style-sheet] [data-transition="T3"]'); await t3.scrollIntoViewIfNeeded();
    const a = await watchPlay(p, () => t3.tap());
    const play = p.locator('[data-style-sheet] [data-transition-play]'); await play.scrollIntoViewIfNeeded();
    const b = await watchPlay(p, () => play.tap());
    await p.screenshot({ path: path.join(out, `admin-play-phone.${jpeg ? 'jpg' : 'png'}`), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) });
    check('admin-play-phone', a.played && a.key === 'T3-fall' && b.played && b.key === 'T3-fall' && errors.length === 0, `iPhone 13 viewport, the Style tab's bottom sheet → Welcome: T3 tapped → played in the preview above the sheet (${a.key}, the menu at ${a.offAt} ms); Play tapped → played again (${b.key}, the menu at ${b.offAt} ms); page errors ${errors.length}`);
    await ctx.close();
  }
} catch (e) {
  check('drill', false, `stopped: ${e.stack || e.message}`);
} finally {
  // Senso's style as it was before the drill (one restore record)
  try {
    if (!server) { await start('fall'); }
    await signIn();
    if (original) { const r = await api('/api/admin/style', { action: 'restore', venue: 'senso', style: original }); const back = (await db.query(`select style->>'transition' as t from venues where id = 'senso'`)).rows[0]?.t ?? null; check('restored', r.status === 200 && back === (original.transition ?? null), `Senso's style put back as it was (restore ${r.status}): transition ${back ?? '(unset: T1)'}`); }
  } catch (e) { check('restored', false, `could not put Senso's style back: ${e.message}`); }
  await stop(); await browser.close(); await db.end(); fs.closeSync(serverLog);
  fs.rmSync(copy, { recursive: true, force: true });
}

const pass = results.every((r) => r.ok);
const table = ['| Concept | Level | Season | Time (nominal) | Gone after (CPU 4× / unthrottled) | Median fps (4×) | Longest task (4×) | Scroll / tap after | Reduced motion | Gzipped | Persian tap: fps, longest task |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} ${r.name} | ${r.level} | ${r.season} | ${r.nominalMs} ms | ${r.en.offMs} / ${r.unthrottledOffMs} ms | ${r.en.medianFps} | ${r.en.longestTaskMs} ms | ${r.scrollMs} / ${r.tapMs} ms | ${r.reducedMs} ms | ${r.sizeGz} B | ${r.fa.medianFps}, ${r.fa.longestTaskMs} ms |`)];
fs.writeFileSync(path.join(out, 'transition-drill.json'), JSON.stringify({ base, dist, copy, at: new Date().toISOString(), pass, rows, results, measures, transcript }, null, 2));
fs.writeFileSync(path.join(out, 'transition-drill.txt'), [`Transition drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', ...table, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`TRANSITION DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
