#!/usr/bin/env node
// The menu after the language tap, under throttled mobile conditions (the PM's correction of 2026-10-09: the welcome screen covers
// the menu, so Lighthouse's LCP measures the welcome logo; what the customer waits for is the menu after the tap). Chromium on the
// iPhone 13 viewport with CDP throttling as DevTools applies Lighthouse's Slow 4G profile (562.5 ms request latency, 1.47 Mbps down,
// 0.675 Mbps up) and a 4× CPU slowdown. Each run loads the page and taps English the moment the welcome entrance has settled (the earliest
// moment a person taps: about 1.3 s after first paint, long before the window's load event, which under this throttling comes
// 20–40 s in, once the lazy photos near the viewport are down), then measures from the tap: the overlay gone with the first
// section's heading and first row in view (the menu visible), the first row's photo(s) complete (the eager ones), the first
// section's photos in view complete (decoded), and every photo of the first section complete; the same moments from navigation
// start, for context, with first paint and the resources down at the tap. Runs: senso with its first section as a List, senso with "Senso Signature"
// as a Grid, kebab-land as it is; two repeats each. The drill puts the section into the layout a run assumes (through the section API,
// as the owner) and restores the original at the end. The eager rule is checked on the served HTML (the first row's photos only:
// one in a List, the two cards of a Grid's first row; every other photo lazy). Photo sizes: a HEAD request per photo of the first
// section (Content-Length, Content-Type) and the natural dimensions the page decoded against the rendered ones.
// Target ≤ 2500 ms from the tap for the menu and for the photos in view, on the worse of the two repeats; a miss is reported as a
// miss and fails the step (the PM: never change the design to pass).
//   DRILL_ADMIN_PIN=… node scripts/after-tap-drill.mjs --base http://127.0.0.1:3100 --out reports/checks/<stamp>/after-tap
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/after-tap');
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const TARGET = 2500, REPEATS = 2;
// Lighthouse's Slow 4G as DevTools applies it (lighthouse-core/config/constants: requestLatencyMs 150 × 3.75, download 1.6 Mbps × 0.9, upload 750 Kbps × 0.9), CPU 4×.
const THROTTLE = { latencyMs: 562.5, downloadBytesPerS: Math.round(1.6 * 1024 * 0.9 * 1024 / 8), uploadBytesPerS: Math.round(750 * 0.9 * 1024 / 8), cpu: 4 };
const transcript = []; const results = []; const measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('after-tap-drill', (t) => log('db', t));
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t, html }; await sleep(120); } return { ok: false, ms: Date.now() - t, html }; }
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
const s1 = (n) => (n == null ? '—' : `${(n / 1000).toFixed(1)} s`);
const kb = (n) => (n == null ? '?' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);
// The first section as served: its id, its layout and its photos, from the public HTML (the first <section> of <main>).
function firstSectionOf(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  const sec = (main.match(/<section[^>]*id="[^"]*"[\s\S]*?<\/section>/) || [''])[0];
  const id = (sec.match(/data-id="([^"]+)"/) || [])[1] || null;
  const layout = (sec.match(/<ul class="[^"]*"[^>]*data-layout="(list|grid)"/) || [])[1] || null;
  const imgs = [...sec.matchAll(/<img ([^>]*)>/g)].map((m) => m[1]).filter((a) => /class="[^"]*(?:h-24 w-24|aspect-square)/.test(a)).map((a) => ({ src: (a.match(/src="([^"]+)"/) || [])[1], loading: (a.match(/loading="([^"]+)"/) || [])[1] || null, fetchPriority: (a.match(/fetchpriority="([^"]+)"/i) || [])[1] || null }));
  const eagerOnPage = (main.match(/<img [^>]*loading="eager"/g) || []).length;
  return { id, layout, imgs, eagerOnPage };
}
const sectionLayoutOf = (html, id) => ((html.match(new RegExp(`<section[^>]*data-id="${id}"[\\s\\S]*?<ul class="[^"]*"[^>]*data-layout="(list|grid)"`)) || [])[1] || null);

// In the page: the tap, then the wait, timed from the tap and from navigation start.
const MEASURE = (cap) => new Promise((res) => {
  const w = document.getElementById('welcome'); const sec = document.querySelector('main section[id]'); const h2 = sec && sec.querySelector('h2'); const row = sec && sec.querySelector('li.item');
  const imgs = sec ? [...sec.querySelectorAll('li.item img')] : [];
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const done = (i) => i.complete && i.naturalWidth > 0;
  const tapAt = performance.now();
  w.querySelector('button[data-lang="en"]').click();
  const eagerImgs = imgs.filter((i) => i.loading === 'eager');
  const resAtTap = performance.getEntriesByType('resource'); const imgsAtTap = resAtTap.filter((e) => e.initiatorType === 'img').length;
  const paint = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
  const nav = performance.getEntriesByType('navigation')[0];
  let menuAt = null, viewImgs = null, viewAt = null, allAt = null, eagerAt = null;
  const finish = () => res({ tapAtMs: Math.round(tapAt), firstPaintMs: paint ? Math.round(paint.startTime) : null, domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, loadEventMs: nav && nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null, resourcesAtTap: resAtTap.length, imageResourcesAtTap: imgsAtTap,
    menuVisibleMs: menuAt == null ? null : Math.round(menuAt), eagerPhotos: eagerImgs.length, eagerPhotosMs: eagerAt == null ? null : Math.round(eagerAt), photosInView: viewImgs ? viewImgs.length : null, photosInViewMs: viewAt == null ? null : Math.round(viewAt), photosAll: imgs.length, photosAllMs: allAt == null ? null : Math.round(allAt),
    photos: imgs.map((i) => { const src = i.currentSrc || i.src; const e = performance.getEntriesByName(src)[0]; const r = i.getBoundingClientRect(); return { src, loading: i.loading, fetchPriority: i.getAttribute('fetchpriority'), inView: viewImgs ? viewImgs.includes(i) : null, complete: done(i), natural: `${i.naturalWidth}×${i.naturalHeight}`, rendered: `${Math.round(r.width)}×${Math.round(r.height)}`, responseEndMs: e ? Math.round(e.responseEnd) : null }; }), section: sec ? sec.id : null });
  const tick = () => {
    const t = performance.now() - tapAt; const cs = getComputedStyle(w);
    const gone = cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0;
    if (menuAt === null && gone && h2 && inView(h2) && (!row || inView(row))) { menuAt = t; viewImgs = imgs.filter(inView); }
    if (eagerAt === null && eagerImgs.length && eagerImgs.every(done)) eagerAt = t;
    if (menuAt !== null && viewAt === null && viewImgs.every(done)) viewAt = t;
    if (allAt === null && imgs.length && imgs.every(done)) allAt = t;
    if ((menuAt !== null && viewAt !== null && (allAt !== null || !imgs.length)) || t > cap) finish(); else requestAnimationFrame(tick);
  };
  tick();
});

async function runOnce(venue) {
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: THROTTLE.latencyMs, downloadThroughput: THROTTLE.downloadBytesPerS, uploadThroughput: THROTTLE.uploadBytesPerS });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpu });
  await page.goto(`${base}/${venue}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const settled = await page.waitForFunction(() => { const b = document.querySelector('#welcome button[data-lang="fa"]'); return !!b && Number(getComputedStyle(b).opacity) === 1; }, null, { timeout: 45000 }).then(() => true).catch(() => false);
  const r = settled ? await page.evaluate(MEASURE, 25000) : null;
  await ctx.close();
  return { settled, errors, ...(r || {}) };
}

// the owner's cookie, the section that becomes a Grid, its layout as found
const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie.startsWith('roses_session=')) { console.error('PIN sign-in failed'); process.exit(1); }
const sec = (await db.query(`select id, layout, name->>'en' as name from sections where venue_id = 'senso' and listed and name->>'en' = 'Senso Signature'`)).rows[0]
  ?? (await db.query(`select s.id, s.layout, s.name->>'en' as name from sections s where s.venue_id = 'senso' and s.listed and exists (select 1 from item_sections x join items i on i.id = x.item_id where x.section_id = s.id and i.listed) order by s.position limit 1`)).rows[0];
const originalLayout = sec.layout;
log('setup', `senso section "${sec.name}" (${sec.id}) is a ${originalLayout} as found; the runs set it to List, then Grid, and put it back`);
async function setLayout(layout) {
  if (sectionLayoutOf(await publicHtml('senso'), sec.id) === layout) return { ok: true, ms: 0 };
  const r = await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout } }, cookie);
  if (r.status !== 200) return { ok: false, ms: 0, error: r.json?.error || r.status };
  return waitPublic('senso', (h) => sectionLayoutOf(h, sec.id) === layout);
}

const RUNS = [{ venue: 'senso', layout: 'list', label: 'senso (first section as a List)' }, { venue: 'senso', layout: 'grid', label: 'senso ("Senso Signature" as a Grid)' }, { venue: 'kebab-land', layout: null, label: 'kebab-land (as it is)' }];
const all = [];
for (const run of RUNS) {
  if (run.layout) { const s = await setLayout(run.layout); log('layout', `${run.venue}: ${sec.name} → ${run.layout}: ${s.ok ? `on the public page after ${s.ms} ms` : `FAILED (${s.error})`}`); }
  const served = firstSectionOf(await publicHtml(run.venue));
  const repeats = [];
  for (let n = 1; n <= REPEATS; n++) { const r = await runOnce(run.venue); repeats.push(r); log(run.label, `repeat ${n}: first paint ${r.firstPaintMs} ms, DOMContentLoaded ${r.domContentLoadedMs} ms, the tap at ${r.tapAtMs} ms with ${r.imageResourcesAtTap} image(s) of ${r.resourcesAtTap} resources down, settled ${r.settled}; after the tap: menu visible ${r.menuVisibleMs} ms, the ${r.eagerPhotos} eager photo(s) ${r.eagerPhotosMs} ms, the ${r.photosInView} in view ${r.photosInViewMs} ms, all ${r.photosAll} ${r.photosAllMs} ms; page errors ${r.errors.length}`); }
  const worst = (k) => repeats.reduce((m, r) => (r[k] == null ? Infinity : Math.max(m, r[k])), 0);
  const ok = repeats.every((r) => r.settled && r.errors.length === 0) && worst('menuVisibleMs') <= TARGET && worst('photosInViewMs') <= TARGET;
  const fmt = (k) => repeats.map((r) => (r[k] == null ? 'not within 25 s' : `${r[k]} ms`)).join(' / ');
  const abs = (k) => repeats.map((r) => (r[k] == null || r.tapAtMs == null ? '—' : s1(r.tapAtMs + r[k]))).join(' / ');
  const inView = repeats[0].photosInView, total = repeats[0].photosAll;
  const text = `${run.label}, served as a ${served.layout} with ${served.imgs.length} photos (${served.imgs.filter((i) => i.loading === 'eager').length} eager, ${served.eagerOnPage} eager on the whole page): menu visible ${fmt('menuVisibleMs')} after the tap; the ${repeats[0].eagerPhotos} eager photo(s) of the first row loaded ${fmt('eagerPhotosMs')} after the tap; the ${inView} photo(s) in view loaded ${fmt('photosInViewMs')} after the tap (${abs('photosInViewMs')} after navigation); all ${total} first-section photos ${fmt('photosAllMs')} after the tap (${abs('photosAllMs')} after navigation); the tap at ${repeats.map((r) => s1(r.tapAtMs)).join(' / ')} after navigation (first paint ${repeats.map((r) => s1(r.firstPaintMs)).join(' / ')}, ${repeats.map((r) => r.imageResourcesAtTap).join(' / ')} image(s) already down at the tap)`;
  check(`after-tap-${run.venue}-${run.layout || served.layout}`, ok, `${ok ? 'within' : 'MISSES'} the ${TARGET} ms target: ${text}`);
  measure(`${run.label}: menu visible ${fmt('menuVisibleMs')}, first-row photo(s) ${fmt('eagerPhotosMs')}, the ${inView} photos in view ${fmt('photosInViewMs')}, all ${total} ${fmt('photosAllMs')} after the tap (target ≤ ${TARGET} ms for the menu and the photos in view)${ok ? '' : ' — MISS'}`);
  all.push({ ...run, served, repeats, ok });
}
// the eager rule on the served HTML: the first row's photos only
{
  const views = all.map((a) => ({ label: a.label, layout: a.served.layout, eager: a.served.imgs.filter((i) => i.loading === 'eager' && i.fetchPriority === 'high').length, lazy: a.served.imgs.filter((i) => i.loading === 'lazy').length, eagerOnPage: a.served.eagerOnPage, firstEager: a.served.imgs.slice(0, a.served.layout === 'grid' ? 2 : 1).every((i) => i.loading === 'eager'), restLazy: a.served.imgs.slice(a.served.layout === 'grid' ? 2 : 1).every((i) => i.loading === 'lazy') }));
  const ok = views.every((v) => v.firstEager && v.restLazy && v.eagerOnPage === v.eager && v.eager <= (v.layout === 'grid' ? 2 : 1));
  check('eager-rule', ok, `first row only, high fetch priority, everything else lazy: ${views.map((v) => `${v.label}: ${v.eager} eager of ${v.eager + v.lazy} (${v.eagerOnPage} eager on the whole page)`).join('; ')}`);
}
// photo bytes: a HEAD request per photo of each venue's first section
const sizes = [];
for (const venue of ['senso', 'kebab-land']) {
  const served = firstSectionOf(await publicHtml(venue));
  for (const img of served.imgs) {
    const url = img.src.startsWith('/') ? base + img.src : img.src;
    let bytes = null, type = null, status = null;
    try { const r = await fetch(url, { method: 'HEAD' }); status = r.status; bytes = Number(r.headers.get('content-length')) || null; type = r.headers.get('content-type'); } catch (e) { status = e.message; }
    const seen = all.flatMap((a) => a.repeats.flatMap((r) => (r.photos || []).map((p) => ({ ...p, layout: a.served.layout })))).filter((p) => p.src === url || p.src === img.src);
    sizes.push({ venue, src: img.src, status, bytes, type, natural: seen[0]?.natural ?? null, rendered: [...new Set(seen.map((p) => `${p.rendered} in a ${p.layout}`))].join(', ') || null });
  }
}
{
  const byVenue = (v) => sizes.filter((s) => s.venue === v);
  const ok = sizes.length > 0 && sizes.every((s) => s.status === 200 && s.bytes);
  const line = (v) => { const l = byVenue(v); const b = l.map((s) => s.bytes).filter(Boolean); return `${v}: ${l.length} photos, ${b.length ? `${kb(Math.min(...b))}–${kb(Math.max(...b))}, ${kb(b.reduce((x, y) => x + y, 0))} in all` : 'no sizes'}; natural ${[...new Set(l.map((s) => s.natural).filter(Boolean))].join(', ')} px, shown at ${[...new Set(l.map((s) => s.rendered).filter(Boolean))].join('; ')}`; };
  check('photo-sizes', ok, `first-section photos as linked from the venues' hosts (HEAD): ${['senso', 'kebab-land'].map(line).join('; ')}`);
  measure(`photo bytes: ${['senso', 'kebab-land'].map((v) => { const b = byVenue(v).map((s) => s.bytes).filter(Boolean); return `${v} ${byVenue(v).length} photos ${b.length ? `${kb(Math.min(...b))}–${kb(Math.max(...b))} (${kb(b.reduce((x, y) => x + y, 0))})` : '?'}`; }).join(', ')}`);
}
// the section back as found
{ const s = await setLayout(originalLayout); log('restore', `${sec.name} → ${originalLayout} again: ${s.ok ? 'done' : `FAILED (${s.error})`}`); check('restore-layout', s.ok, `"${sec.name}" is a ${originalLayout} again, as found`); }

await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'after-tap.json'), JSON.stringify({ base, at: new Date().toISOString(), throttle: THROTTLE, targetMs: TARGET, pass, results, measures, runs: all, sizes, transcript }, null, 2));
await fs.writeFile(path.join(out, 'after-tap.txt'), [`After-tap drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, `Throttling: Slow 4G as DevTools applies it (latency ${THROTTLE.latencyMs} ms, ${THROTTLE.downloadBytesPerS} B/s down, ${THROTTLE.uploadBytesPerS} B/s up), CPU ${THROTTLE.cpu}×; target ${TARGET} ms from the tap`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Photos of the first sections:', ...sizes.map((s) => `- ${s.venue}: ${s.src} → ${s.status} ${s.bytes ?? '?'} bytes ${s.type ?? ''} natural ${s.natural ?? '?'} rendered ${s.rendered ?? '?'}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n'));
console.log(`AFTER-TAP DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
