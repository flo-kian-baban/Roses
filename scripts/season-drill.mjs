#!/usr/bin/env node
// Season at render time and hourly regeneration (the PM's build decision of 2026-10-09: each page ships only the current season's
// artwork, chosen when the page is rendered from the date in America/Toronto, and the public pages are regenerated hourly
// (revalidate 3600, time-based ISR), so the season flips within an hour of midnight on the 1st). Proven on a copy of the build
// with its own server (the suite's servers and their cache are never touched):
//   render tests with a fixed date: the server's clock is ROSES_NOW (the suite's hook, honoured only with the suite's own flag
//     ROSES_CHECK_SUITE=1; neither is ever set in production) at each boundary
//     instant in Toronto time, Aug 31 / Sep 1, Nov 30 / Dec 1, Feb 28 / Mar 1, May 31 / Jun 1 (23:30 and 00:30, an hour apart, plus
//     Aug 31 22:30 EDT, which is already Sep 1 in UTC: the page must still say summer);
//   the simulated hour: between two renders the cached page is aged by 3601 s (the build's seed under server/pages and the route-cache
//     entry under server/route-cache: file times and the routeCacheLastModified stamp in its .meta, which Next's cache reads on a fresh
//     server), the first request serves the previous render and starts the regeneration, the next one carries the new season; a
//     control ages it by 3000 s and must not regenerate; the interval comes from the prerender manifest (initialRevalidateSeconds);
//   Senso's artwork (Kian's picks): on the fall and winter servers, 20 particles of the picked designs at most 2 near, present and
//     mid-flight on the first sample (negative delays), transform and opacity only, no other season in the HTML; smoothness on the
//     iPhone 13 viewport with CPU throttled 4×: 5 s of requestAnimationFrame, median ≥ 50 fps and no long task > 50 ms, reported as
//     measured; randomness: two loads differ in designs and parameters; the reduced-motion still; recordings (webm, on disk only) and
//     stills; the inline welcome code gzipped per season;
//   Kebab Land and the default template: the served scene of every season and its symbols byte for byte as in the fixture captured
//     from the previous commit (scripts/fixtures/welcome-scenes.json), and the stylesheet's motion rules verbatim;
//   the guard (the PM, 2026-10-09): a server started with ROSES_NOW alone (no ROSES_CHECK_SUITE) renders the real current season in
//     Toronto, not the forged one, and logs that it ignored it; the same instant with the flag renders the forged season.
// The drill's server is its own: the port must be free before it starts, and its listener must be the process it spawned (lsof).
//   node scripts/season-drill.mjs --dist .next-check --copy .next-season --port 3102 --out reports/checks/<stamp>/season --venues senso,kebab-land[,<temp>] [--jpeg]
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { loadEnv } from './load-env.mjs';
import { compare, compareCss, extract } from './welcome-fixture.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const dist = args.dist || '.next-check', copy = args.copy || '.next-season', port = Number(args.port || 3102);
const out = path.resolve(args.out || 'reports/season'); fs.mkdirSync(out, { recursive: true });
const venues = (args.venues || 'senso,kebab-land').split(',').filter(Boolean);
const ART_VENUES = ['senso'];
const base = `http://127.0.0.1:${port}`;
const transcript = [], results = [], measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gz = (s) => zlib.gzipSync(Buffer.from(s)).length;
const ext = jpeg ? 'jpg' : 'png';
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/welcome-scenes.json', 'utf8'));

// ---- the copy of the build and its server
if (fs.existsSync(copy)) fs.rmSync(copy, { recursive: true, force: true });
try { execFileSync('cp', ['-Rc', dist, copy]); } catch { fs.cpSync(dist, copy, { recursive: true }); }
log('copy', `${dist} → ${copy}`);
const manifest = JSON.parse(fs.readFileSync(path.join(copy, 'prerender-manifest.json'), 'utf8'));
// the two brand pages are in the manifest with their revalidate; a venue on the default template is the dynamic route, rendered on demand with the same revalidate from its getStaticProps (not listed per venue)
const interval = Object.fromEntries(venues.map((v) => [v, manifest.routes[`/${v}`]?.initialRevalidateSeconds ?? (manifest.dynamicRoutes?.['/[venue]'] ? 'dynamic route' : null)]));
const serverLog = fs.openSync(path.join(out, 'season-server.log'), 'a');
let server = null;
const portFree = (host) => new Promise((res) => { const s = net.createServer(); s.once('error', (e) => res(e.code !== 'EADDRINUSE')); s.listen(port, host, () => s.close(() => res(true))); });
const listeners = () => spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map(Number);
// flag false: ROSES_NOW alone, without the suite's flag (the guard check below)
async function start(now, { flag = true } = {}) {
  if (!(await portFree('127.0.0.1')) || !(await portFree('::1'))) throw new Error(`port ${port} is in use by a process this drill did not start; it is left alone`);
  server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env: { ...process.env, NEXT_DIST_DIR: copy, ROSES_NOW: now, ...(flag ? { ROSES_CHECK_SUITE: '1' } : { ROSES_CHECK_SUITE: '' }), ROSES_APP_NAME: 'roses-check:season-server' }, stdio: ['ignore', serverLog, serverLog] });
  fs.writeSync(serverLog, `\n--- server started with ROSES_NOW=${now}${flag ? ' and ROSES_CHECK_SUITE=1' : ' alone (ROSES_CHECK_SUITE not set)'} at ${new Date().toISOString()}\n`);
  const t = Date.now();
  // readiness is probed on the admin sign-in page, never on a public page (a probe there would read the cache and start the regeneration early)
  while (Date.now() - t < 30000) {
    try { const r = await fetch(`${base}/admin`, { method: 'HEAD', redirect: 'manual' }); if (r.status < 500) { const pids = listeners(); if (server.exitCode !== null || pids.length === 0 || pids.some((x) => x !== server.pid)) throw new Error(`port ${port}: listener ${pids.join(',') || 'none'} is not the drill's server (pid ${server.pid}, exit ${server.exitCode})`); return Date.now() - t; } }
    catch (e) { if (/not the drill's server/.test(e.message)) throw e; /* not yet */ }
    await sleep(150);
  }
  throw new Error('season server did not come up');
}
async function stop() { if (!server) return; server.kill('SIGTERM'); await new Promise((r) => { server.once('exit', r); setTimeout(r, 3000); }); server = null; }
// a fresh server at another instant: the cached pages aged by an hour and a second first, so its first request regenerates them
async function restart(now, opts) { await stop(); age(3601); return start(now, opts); }
// Where Next keeps a page: the build's seed (server/pages/<v>.html, .json, .meta) and, once read or regenerated, the route-cache entry
// (server/route-cache/PAGES/<hash>/$/<v>.html, .json, .meta, whose .meta stamps routeCacheLastModified; that stamp, else the file time, is
// the entry's age). The seed is also the pre-rendered page file.
const pageFile = (v, kind = 'html') => path.join(copy, 'server', 'pages', `${v}.${kind}`);
const routeDir = path.join(copy, 'server', 'route-cache', 'PAGES');
const cacheFiles = (v) => { const out = [pageFile(v, 'html'), pageFile(v, 'json'), pageFile(v, 'meta')]; if (fs.existsSync(routeDir)) for (const h of fs.readdirSync(routeDir)) for (const k of ['html', 'json', 'meta']) out.push(path.join(routeDir, h, '$', `${v}.${k}`)); return out.filter((f) => fs.existsSync(f)); };
const entry = (v) => cacheFiles(v).filter((f) => f.endsWith('.html')).map((f) => ({ file: path.relative(copy, f), mtime: fs.statSync(f).mtimeMs, stamp: (() => { try { return JSON.parse(fs.readFileSync(f.replace(/\.html$/, '.meta'), 'utf8')).routeCacheLastModified ?? null; } catch { return null; } })() }));
const stamp = (v) => JSON.stringify(entry(v));
function age(seconds) {
  const t = new Date(Date.now() - seconds * 1000);
  for (const v of venues) for (const f of cacheFiles(v)) {
    if (f.endsWith('.meta')) { const m = JSON.parse(fs.readFileSync(f, 'utf8')); if (m.routeCacheLastModified != null) { m.routeCacheLastModified = t.getTime(); fs.writeFileSync(f, JSON.stringify(m)); } }
    fs.utimesSync(f, t, t);
  }
}
const get = async (v) => { const r = await fetch(`${base}/${v}`, { cache: 'no-store' }); return { status: r.status, html: await r.text(), cacheControl: r.headers.get('cache-control') }; };
const seasonOf = (html) => (html.match(/<div id="welcome"[^>]*data-season="([a-z]+)"/) || [])[1] || null;
const probeHtml = (html) => { const { scenes, symbols } = extract(html); return { season: seasonOf(html), scenes: Object.keys(scenes), engine: Object.fromEntries(Object.entries(scenes).map(([k, v]) => [k, (v.attrs.match(/data-engine="([^"]+)"/) || [])[1] || null])), designs: Object.fromEntries(Object.entries(scenes).map(([k, v]) => [k, ((v.attrs.match(/data-designs="([^"]+)"/) || [])[1] || '').split(',').filter(Boolean)])), symbols: Object.keys(symbols) }; };
// after a request, wait for the regeneration to land: the served season changes or the page file is rewritten
async function waitFresh(v, want, ms = 15000) { const t = Date.now(); let last = null; while (Date.now() - t < ms) { const r = await get(v); last = r; if (seasonOf(r.html) === want) return { ok: true, ms: Date.now() - t, html: r.html }; await sleep(100); } return { ok: false, ms: Date.now() - t, html: last?.html ?? '' }; }

const browser = await chromium.launch();
const shot = async (page, name) => { const f = `${name}.${ext}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 80 } : {}) }); log('shot', f); return f; };

// ---- the boundary instants (Toronto): pairs an hour apart around each 1st, plus the UTC trap
const INSTANTS = [
  { at: '2026-08-31T22:30:00-04:00', label: 'Aug 31 22:30 EDT (already Sep 1 in UTC)', want: 'summer' },
  { at: '2026-08-31T23:30:00-04:00', label: 'Aug 31 23:30 EDT', want: 'summer' },
  { at: '2026-09-01T00:30:00-04:00', label: 'Sep 1 00:30 EDT', want: 'fall' },
  { at: '2026-11-30T23:30:00-05:00', label: 'Nov 30 23:30 EST', want: 'fall' },
  { at: '2026-12-01T00:30:00-05:00', label: 'Dec 1 00:30 EST', want: 'winter' },
  { at: '2027-02-28T23:30:00-05:00', label: 'Feb 28 23:30 EST', want: 'winter' },
  { at: '2027-03-01T00:30:00-05:00', label: 'Mar 1 00:30 EST', want: 'spring' },
  { at: '2027-05-31T23:30:00-04:00', label: 'May 31 23:30 EDT', want: 'spring' },
  { at: '2027-06-01T00:30:00-04:00', label: 'Jun 1 00:30 EDT', want: 'summer' },
];
const renders = []; // one row per instant and venue
let previousSeason = {}; // what the cache held before each instant
for (const v of venues) { const f = cacheFiles(v).find((x) => x.endsWith('.html')); previousSeason[v] = f ? seasonOf(fs.readFileSync(f, 'utf8')) : null; } // a venue on the default template has no build seed, only its route-cache entry
log('build', `the build's own render: ${venues.map((v) => `${v} ${previousSeason[v]}`).join(', ')}; configured interval ${JSON.stringify(interval)} s`);
check('revalidate-config', venues.every((v) => interval[v] === 3600 || interval[v] === 'dynamic route') && venues.some((v) => interval[v] === 3600), `prerender manifest: initialRevalidateSeconds ${venues.map((v) => `${v} ${interval[v]}`).join(', ')} (wanted 3600 on every listed public page; a venue on the default template is the dynamic route with the same revalidate, proven by its renders below)`);

const artPages = {}; // html per venue per season, for the artwork checks below
for (const inst of INSTANTS) {
  const up = await restart(inst.at);
  for (const v of venues) {
    const before = stamp(v), first = await get(v);
    const firstSeason = seasonOf(first.html);
    const fresh = await waitFresh(v, inst.want);
    let after = stamp(v); { const t = Date.now(); while (after === before && Date.now() - t < 3000) { await sleep(100); after = stamp(v); } } // the regeneration writes its entry just after the fresh response can be served
    const row = { instant: inst.at, label: inst.label, venue: v, want: inst.want, firstResponse: firstSeason, stale: firstSeason === previousSeason[v], fresh: seasonOf(fresh.html), freshAfterMs: fresh.ms, regenerated: after !== before, entry: entry(v), serverUpMs: up, cacheControl: first.cacheControl };
    renders.push(row);
    previousSeason[v] = seasonOf(fresh.html) ?? previousSeason[v];
    if (fresh.ok) { artPages[v] = artPages[v] || {}; artPages[v][inst.want] = fresh.html; }
    log('render', `${inst.label} ${v}: first response ${firstSeason} (the previous render: ${row.stale}), fresh ${row.fresh} after ${fresh.ms} ms, cache entry rewritten ${row.regenerated} (${row.entry.map((e) => `${e.file} stamp ${e.stamp ?? 'none'}`).join(', ')})`);
  }
}
const rows = renders.filter((r) => r.venue === venues[0]);
check('season-boundaries', renders.every((r) => r.fresh === r.want && r.regenerated), `rendered with a fixed clock (America/Toronto): ${rows.map((r) => `${r.label} → ${r.fresh}${r.fresh === r.want ? '' : ` (wanted ${r.want})`}`).join('; ')}; the same on ${venues.slice(1).join(', ') || 'no other venue'}: ${renders.filter((r) => r.venue !== venues[0]).every((r) => r.fresh === r.want)}`);
// the simulated hour: every pair 23:30 → 00:30 regenerated once the cache was 3601 s old; the first request served the previous render
const pairs = [[1, 2], [3, 4], [5, 6], [7, 8]].map(([a, b]) => ({ from: rows[a], to: rows[b] }));
check('hourly-regeneration', pairs.every((p) => p.to.stale && p.to.regenerated && p.to.fresh === p.to.want && p.from.fresh === p.from.want), `two renders an hour apart (the cached page aged 3601 s between them, the entry rewritten each time): ${pairs.map((p) => `${p.from.label} ${p.from.fresh} → ${p.to.label}: first request still ${p.to.firstResponse}, regenerated to ${p.to.fresh} after ${p.to.freshAfterMs} ms, entry rewritten ${p.to.regenerated}`).join('; ')}; Cache-Control ${rows[2].cacheControl}`);
measure(`regeneration interval: ${interval.senso} s configured (revalidate; the same in getStaticProps of every public page); an hour later the next request serves the previous render and the fresh season lands after ${pairs.map((p) => p.to.freshAfterMs).join(' / ')} ms`);
// control: within the hour nothing is regenerated (the server at the last instant, cache aged 3000 s)
{
  age(3000);
  const v = venues[0], before = stamp(v); await get(v); await sleep(2500); await get(v); await sleep(500);
  const after = stamp(v);
  check('within-the-hour', after === before, `${v}: the cached page aged 3000 s, two requests 2.5 s apart → cache entry unchanged (${after === before})`);
}

// ---- Senso's artwork on the fall and winter renders; the old scenes on the other venues, compared with the fixture
const SEASON_INSTANT = { fall: INSTANTS[2].at, winter: INSTANTS[4].at, spring: INSTANTS[6].at, summer: INSTANTS[8].at };
const cssText = fs.readFileSync('src/styles/public.css', 'utf8');
const cssCmp = compareCss(cssText);
check('motion-rules-unchanged', cssCmp.ok, `the stylesheet keeps the previous motion rules verbatim (${cssCmp.ok ? 'all' : `missing: ${cssCmp.missing.join(' | ')}`})`);
for (const v of venues.filter((x) => !ART_VENUES.includes(x))) {
  const per = [];
  for (const season of ['fall', 'winter', 'spring', 'summer']) { const html = artPages[v]?.[season]; if (!html) { per.push({ season, ok: false, diffs: ['no render'] }); continue; } const c = compare(fixture, html, season); per.push({ season, ...c }); }
  check(`unchanged-${v}`, per.every((p) => p.ok), `${v}: the served scene of every season and its symbols byte for byte as in the fixture from ${fixture.capturedFrom.commit} (${per.map((p) => `${p.season} ${p.ok ? `same, ${p.particles} particles, symbols ${p.symbols.join('+')}` : p.diffs.join('; ')}`).join('; ')})`);
}
const PROBE = () => {
  const w = document.getElementById('welcome'), s = w && w.querySelector('.scene');
  const ps = s ? [...s.querySelectorAll('.p')] : [];
  const anims = s ? s.getAnimations({ subtree: true }) : [];
  const props = [...new Set(anims.flatMap((a) => (a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))) : [])))];
  return { season: w ? w.dataset.season : null, engine: s ? s.dataset.engine : null, designs: s ? s.dataset.designs : null, particles: ps.length, near: ps.filter((p) => p.classList.contains('near')).length, still: s ? s.classList.contains('still') : null, styles: ps.map((p) => p.getAttribute('style')), used: [...new Set(ps.map((p) => (p.querySelector('use') || {}).getAttribute ? p.querySelector('use').getAttribute('href') : ''))], running: anims.filter((a) => a.playState === 'running').length, midFlight: anims.length > 0 && anims.every((a) => a.currentTime > 0), props, inView: ps.filter((p) => { const r = p.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).length };
};
for (const v of venues.filter((x) => ART_VENUES.includes(x))) {
  for (const season of ['fall', 'winter']) {
    await restart(SEASON_INSTANT[season]);
    const html = (await waitFresh(v, season)).html;
    const ph = probeHtml(html);
    const overlay = html.slice(html.indexOf('<div id="welcome"'), html.indexOf('<main'));
    const head = (html.match(/<script[^>]*>\(function\(\)\{var h=document\.documentElement,l=null;[\s\S]*?<\/script>/) || [''])[0];
    const inlineGz = gz(overlay + head);
    measure(`${v} ${season}: inline welcome code with the picked artwork ${(inlineGz / 1024).toFixed(1)} KB gzipped (${((overlay.length + head.length) / 1024).toFixed(1)} KB raw), symbols ${ph.symbols.filter((s) => /^[FW]\d+$/.test(s)).join(', ')}`);
    // first sample after navigation: the scene already full and every animation mid-flight; two loads differ
    const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/${v}`, { waitUntil: 'commit' });
    const first = await page.evaluate(() => new Promise((res) => { const tick = () => { const w = document.getElementById('welcome'); if (w && w.querySelector('button[data-lang]')) { const s = w.querySelector('.scene'); const anims = s ? s.getAnimations({ subtree: true }) : []; res({ t: Math.round(performance.now()), particles: s ? s.querySelectorAll('.p').length : 0, animations: anims.length, midFlight: anims.length > 0 && anims.every((a) => a.currentTime > 0), minCurrent: Math.round(Math.min(...anims.map((a) => a.currentTime))) }); } else requestAnimationFrame(tick); }; tick(); }));
    await sleep(600);
    const a = await page.evaluate(PROBE);
    const onlyTO = a.props.every((x) => x === 'transform' || x === 'opacity');
    const picked = ph.designs[season] || [];
    check(`artwork-${v}-${season}`, ph.scenes.join() === season && ph.engine[season] === (season === 'fall' ? 'leaves' : 'snow') && a.particles === 20 && a.near <= 2 && a.used.every((u) => picked.includes(u.slice(1))) && first.particles === 20 && first.midFlight && a.running > 0 && onlyTO && errors.length === 0, `${v} ${season} (server clock ${SEASON_INSTANT[season]}): the HTML carries the ${ph.scenes.join('+')} scene only (engine ${ph.engine[season]}, designs ${picked.join(', ')}); on the first frame that shows the card (${first.t} ms after navigation; the engine runs before the card is parsed) the scene already holds ${first.particles} particles with every one of its ${first.animations} animations mid-flight (${first.midFlight}; the earliest ${first.minCurrent} ms into its cycle); ${a.particles} particles (${a.near} near), designs used ${a.used.join(', ')}, ${a.running} animations on ${a.props.join(', ') || 'nothing'} (transform and opacity only: ${onlyTO}); page errors ${errors.length}`);
    const page2 = await ctx.newPage(); await page2.goto(`${base}/${v}`, { waitUntil: 'load' }); await sleep(300);
    const b = await page2.evaluate(PROBE);
    const sameStyles = a.styles.filter((s, i) => s === b.styles[i]).length;
    check(`randomness-${v}-${season}`, a.styles.length === 20 && b.styles.length === 20 && sameStyles === 0 && JSON.stringify(a.styles) !== JSON.stringify(b.styles), `${v} ${season}: two loads → ${sameStyles} of 20 particles with the same parameters (designs ${a.used.join('+')} then ${b.used.join('+')}); first load's first particle: ${a.styles[0]}`);
    await page2.close();
    // smoothness: CPU throttled 4×, 5 s of requestAnimationFrame after the entrance, long tasks observed
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await sleep(800);
    const sm = await page.evaluate(() => new Promise((res) => { const frames = []; const longTasks = []; let po = null; try { po = new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(Math.round(e.duration)))); po.observe({ type: 'longtask', buffered: false }); } catch { /* unsupported */ } const start = performance.now(); const tick = (t) => { frames.push(t); if (t - start < 5000) requestAnimationFrame(tick); else { if (po) po.disconnect(); const perSec = []; for (let s = 0; s < 5; s++) perSec.push(frames.filter((f) => f - start >= s * 1000 && f - start < (s + 1) * 1000).length); const sorted = [...perSec].sort((x, y) => x - y); const gaps = frames.slice(1).map((f, i) => f - frames[i]); res({ frames: frames.length, perSec, median: sorted[2], longest: longTasks.length ? Math.max(...longTasks) : 0, longTasks: longTasks.length, worstGapMs: Math.round(Math.max(...gaps)) }); } }; requestAnimationFrame(tick); }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    check(`smoothness-${v}-${season}`, sm.median >= 50 && sm.longest <= 50, `${v} ${season}, iPhone 13 viewport, CPU 4×: ${sm.frames} frames in 5 s (${sm.perSec.join(' / ')} per second), median ${sm.median} fps (target ≥ 50); ${sm.longTasks} long tasks, the longest ${sm.longest} ms (target ≤ 50); worst gap between frames ${sm.worstGapMs} ms`);
    measure(`${v} ${season} smoothness (CPU 4×): median ${sm.median} fps, longest task ${sm.longest} ms`);
    await shot(page, `${v}-${season}`);
    await ctx.close();
    // reduced motion: the still composition
    const rctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' }); const rp = await rctx.newPage();
    await rp.goto(`${base}/${v}`, { waitUntil: 'load' }); await sleep(200);
    const r = await rp.evaluate(PROBE);
    await shot(rp, `${v}-${season}-reduced-motion`);
    check(`still-${v}-${season}`, r.still === true && r.running === 0 && r.inView >= 6 && r.particles <= 20, `${v} ${season} with reduced motion: the still composition (${r.particles} designs resting, ${r.inView} in view, ${r.running} animations running)`);
    await rctx.close();
    // recording (on disk only)
    const vctx = await browser.newContext({ ...DEVICE, recordVideo: { dir: out, size: { width: 390, height: 844 } } }); const vp = await vctx.newPage();
    await vp.goto(`${base}/${v}`, { waitUntil: 'load' }); await sleep(4000); await vp.tap('#welcome button[data-lang="en"]'); await sleep(800);
    const video = vp.video(); await vctx.close();
    const file = path.join(out, `${v}-${season}.webm`); await video.saveAs(file); await video.delete().catch(() => {});
    const size = (await fsp.stat(file)).size;
    check(`recording-${v}-${season}`, size > 10000, `${path.relative(process.cwd(), file)} (${(size / 1024).toFixed(0)} KB; gitignored, on disk only)`);
  }
}
// stills of the old scenes on the other venues (spring and summer servers; fall and winter from the pages above)
for (const season of ['fall', 'winter', 'spring', 'summer']) {
  await restart(SEASON_INSTANT[season]);
  for (const v of venues) { await waitFresh(v, season); const c = await browser.newContext(DEVICE); const p = await c.newPage(); await p.goto(`${base}/${v}`, { waitUntil: 'load' }); await sleep(1300); await shot(p, `${v}-${season}`); await c.close(); }
}
// ---- the guard (the PM, 2026-10-09): ROSES_NOW is honoured only together with the suite's flag ROSES_CHECK_SUITE=1. A server started with
// ROSES_NOW alone must render the real current season (America/Toronto, from the machine's clock), and say in its log that it ignored it;
// the same instant with the flag renders the forged season (the control). The forged season differs from the real one and from what the
// cache holds, so a stale page, an honoured ROSES_NOW and the real clock all give different answers; the cache entry must be rewritten.
{
  const torontoMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', month: 'numeric' }).format(new Date())) - 1;
  const real = torontoMonth >= 8 && torontoMonth <= 10 ? 'fall' : torontoMonth === 11 || torontoMonth <= 1 ? 'winter' : torontoMonth <= 4 ? 'spring' : 'summer';
  // what the server would serve before regenerating: its route-cache entry once there is one, else the build's seed
  const cached = Object.fromEntries(venues.map((v) => { const f = cacheFiles(v).filter((x) => x.endsWith('.html')).sort((a, b) => Number(b.includes('route-cache')) - Number(a.includes('route-cache')))[0]; return [v, seasonOf(fs.readFileSync(f, 'utf8'))]; }));
  const forged = ['winter', 'spring', 'summer', 'fall'].find((x) => x !== real && venues.every((v) => cached[v] !== x));
  const logBefore = fs.statSync(path.join(out, 'season-server.log')).size;
  await restart(SEASON_INSTANT[forged], { flag: false });
  const alone = [];
  for (const v of venues) {
    const before = stamp(v); const first = await get(v);
    let after = stamp(v); { const t = Date.now(); while (after === before && Date.now() - t < 15000) { await sleep(100); after = stamp(v); } }
    await sleep(200); const fresh = await get(v);
    alone.push({ venue: v, cached: cached[v], firstResponse: seasonOf(first.html), regenerated: after !== before, rendered: seasonOf(fresh.html) });
  }
  await sleep(300);
  const logText = fs.readFileSync(path.join(out, 'season-server.log'), 'utf8').slice(logBefore);
  const ignoredLogged = /ROSES_NOW is set without ROSES_CHECK_SUITE=1: ignored/.test(logText);
  await restart(SEASON_INSTANT[forged], { flag: true });
  const withFlag = [];
  for (const v of venues) { await get(v); const f = await waitFresh(v, forged); withFlag.push({ venue: v, rendered: seasonOf(f.html), ms: f.ms }); }
  const ok = !!forged && alone.every((a) => a.regenerated && a.rendered === real) && ignoredLogged && withFlag.every((w) => w.rendered === forged);
  check('roses-now-guard', ok, `ROSES_NOW=${SEASON_INSTANT[forged]} (${forged} in Toronto) alone, without ROSES_CHECK_SUITE: ${alone.map((a) => `${a.venue}: the first request served the previous render (${a.firstResponse}; cache entry ${a.cached}), regenerated ${a.regenerated} → rendered ${a.rendered}`).join('; ')}; the real season in Toronto today is ${real}; the server logged that it ignored ROSES_NOW: ${ignoredLogged}; control, the same instant with ROSES_CHECK_SUITE=1: ${withFlag.map((w) => `${w.venue} → ${w.rendered}`).join('; ')}`);
  measure(`ROSES_NOW guard: a server started with ROSES_NOW alone (set to ${forged}) rendered ${[...new Set(alone.map((a) => a.rendered))].join('/')} on ${alone.length} venues, the real season in Toronto (${real}); with the suite's flag the same instant rendered ${[...new Set(withFlag.map((w) => w.rendered))].join('/')}`);
}
await stop();
await browser.close();
fs.closeSync(serverLog);
fs.rmSync(copy, { recursive: true, force: true });
const pass = results.every((r) => r.ok);
fs.writeFileSync(path.join(out, 'season-drill.json'), JSON.stringify({ base, dist, copy, at: new Date().toISOString(), pass, interval, renders, results, measures, transcript }, null, 2));
fs.writeFileSync(path.join(out, 'season-drill.txt'), [`Season drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', 'Renders (fixed clock, America/Toronto):', ...renders.map((r) => `- ${r.label} ${r.venue}: first response ${r.firstResponse} (previous render ${r.stale}), fresh ${r.fresh} after ${r.freshAfterMs} ms, file rewritten ${r.regenerated}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`SEASON DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
