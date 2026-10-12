// The season drill's first-frame sample on spring, plus what the browser draws in that frame: each animation's effect timing and
// each particle's position, whether the sample ran before any rAF, and the first painted frames from a trace (screenshots).
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const base = `http://127.0.0.1:${process.env.PORT}`, out = process.env.OUT, N = Number(process.env.N || 10);
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
const FIRST = () => new Promise((res) => { let rafs = 0; const tick = () => { const w = document.getElementById('welcome'); if (w && w.querySelector('button[data-lang]')) { const s = w.querySelector('.scene'); const anims = s ? s.getAnimations({ subtree: true }) : [];
  const ys = s ? [...s.querySelectorAll('.p > .y')] : [];
  const tops = ys.map((y) => Math.round(y.getBoundingClientRect().top));
  const timing = anims.map((a) => { const c = a.effect.getComputedTiming(); return { name: a.animationName, ct: a.currentTime, pending: a.pending, active: c.activeTime == null ? null : Math.round(c.activeTime), progress: c.progress == null ? null : +c.progress.toFixed(3) }; });
  res({ t: Math.round(performance.now()), rafs, particles: s ? s.querySelectorAll('.p').length : 0, animations: anims.length, midFlight: anims.length > 0 && anims.every((a) => a.currentTime > 0), pending: anims.filter((a) => a.pending).length, minActive: Math.min(...timing.map((x) => x.active)), effectMid: timing.every((x) => x.active > 0), fallStart: timing.filter((x) => x.name === 'wa-fall' && !(x.progress > 0)).length, inView: tops.filter((y) => y > -10 && y < innerHeight).length, aboveTop: tops.filter((y) => y < -10).length, tops: tops.slice(0, 6) }); } else { rafs++; requestAnimationFrame(tick); } }; tick(); });
// warm-up as in the drill
{ const c = await browser.newContext(DEVICE); const p = await c.newPage(); await p.goto(`${base}/senso`); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {}); await c.close(); }
const rows = [];
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  const trace = i < 3;
  if (trace) await browser.startTracing(page, { path: `${out}/trace-${i}.json`, screenshots: true, categories: ['devtools.timeline', 'disabled-by-default-devtools.screenshot'] });
  await page.goto(`${base}/senso`, { waitUntil: 'commit' });
  const f = await page.evaluate(FIRST);
  await page.waitForTimeout(800);
  if (trace) await browser.stopTracing();
  rows.push(f); console.log(JSON.stringify(f));
  await ctx.close();
}
fs.writeFileSync(`${out}/first.json`, JSON.stringify(rows, null, 1));
console.log(`clock started (drill's midFlight) ${rows.filter((r) => r.midFlight).length}/${N}; effect mid-flight (activeTime > 0 for every animation) ${rows.filter((r) => r.effectMid).length}/${N}; sampled before any rAF ${rows.filter((r) => r.rafs === 0).length}/${N}`);
await browser.close();
