// A/B of the PM's proposed fix on spring: A = the page as served; B = the same page with every particle's frame-0 transform written
// inline at its mid-flight position (the fall's translate computed from its own delay and duration) right after the engine builds the
// scene. Both delivered the same way (route.fulfill of the same body, or through the server for A). Per load: the drill's first sample
// (clock running for every animation?), how many frames until every clock runs, and where the particles are drawn at that sample.
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const base = `http://127.0.0.1:${process.env.PORT}`, N = Number(process.env.N || 20), out = process.env.OUT;
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const html = await (await fetch(`${base}/senso`)).text();
if (!html.includes('data-engine="bloom"')) throw new Error('not the spring page');
const INLINE = "s.innerHTML=h;[].forEach.call(s.querySelectorAll('.p'),function(p){var st=getComputedStyle(p),d=parseFloat(st.getPropertyValue('--d')),l=-parseFloat(st.getPropertyValue('--l')),q=(l%d)/d,y=p.querySelector('.y');y.style.transform='translate3d(calc(var(--dr) * '+q.toFixed(4)+'), calc(var(--s) * -1.3 + (100vh + var(--s) * 1.7) * '+q.toFixed(4)+'), 0)'})})();";
const bodyB = html.replace("s.innerHTML=h})();", INLINE);
if (bodyB === html) throw new Error('engine end not found');
const FIRST = () => new Promise((res) => { let rafs = 0; const tick = () => { const w = document.getElementById('welcome'); if (w && w.querySelector('button[data-lang]')) { const s = w.querySelector('.scene'); const anims = s ? s.getAnimations({ subtree: true }) : [];
  const notRunning = anims.filter((a) => !(a.currentTime > 0)).length;
  const drawnStart = anims.filter((a) => !(a.effect.getComputedTiming().progress > 0)).length;
  const tops = [...s.querySelectorAll('.p > .y')].map((y) => Math.round(y.getBoundingClientRect().top));
  const inline = [...s.querySelectorAll('.p > .y')].filter((y) => y.style.transform).length;
  const r = { t: Math.round(performance.now()), rafs, animations: anims.length, notRunning, drawnStart, inView: tops.filter((y) => y > -10 && y < innerHeight).length, inline, framesUntilRunning: 0 };
  if (!notRunning) return res(r);
  let f = 0; const wait = () => { f++; if (s.getAnimations({ subtree: true }).every((a) => a.currentTime > 0) || f > 30) { r.framesUntilRunning = f; res(r); } else requestAnimationFrame(wait); }; requestAnimationFrame(wait);
} else { rafs++; requestAnimationFrame(tick); } }; tick(); });
const browser = await chromium.launch();
const rows = { A_server: [], A_fulfill: [], B_fulfill: [] };
for (let i = 0; i < N; i++) for (const k of Object.keys(rows)) {
  const ctx = await browser.newContext(DEVICE); const page = await ctx.newPage();
  if (k !== 'A_server') await page.route(`${base}/senso`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: k === 'B_fulfill' ? bodyB : html }));
  await page.goto(`${base}/senso`, { waitUntil: 'commit' });
  rows[k].push(await page.evaluate(FIRST));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/ab.json`, JSON.stringify(rows, null, 1));
for (const [k, r] of Object.entries(rows)) {
  const race = r.filter((x) => x.notRunning > 0);
  console.log(`${k.padEnd(10)} loads ${r.length}: clock not running at the first sample in ${race.length} (all animations: ${race.filter((x) => x.notRunning === x.animations).length}); frames until every clock ran ${[...new Set(race.map((x) => x.framesUntilRunning))].sort().join('/') || '—'}; drawn at a cycle start ${r.reduce((n, x) => n + x.drawnStart, 0)} animations in all; particles in view at the sample ${Math.min(...r.map((x) => x.inView))}-${Math.max(...r.map((x) => x.inView))} of 20; inline transforms ${[...new Set(r.map((x) => x.inline))].join('/')}; first sample ${Math.min(...r.map((x) => x.t))}-${Math.max(...r.map((x) => x.t))} ms`);
}
