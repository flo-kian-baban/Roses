// Before/after evidence for the Persian-tap fix: the longest task after a tap on فارسی on the welcome screen, Chromium on the iPhone 13
// viewport at CPU 4× (as the transition drill measures it), on two builds of the same data, taps interleaved (before, after, before, …)
// so a change in the machine's load hits both alike. The window is 3 s from the tap: past the transition into the menu (≤ 880 ms) and
// the lists laid out again in Persian one per frame a second after the switch. A long task is one over 50 ms (the browser's own
// definition); 0 means none.
//   node reports/persian-tap/persian-tap.mjs --before http://127.0.0.1:A --after http://127.0.0.1:B --venues senso,kebab-land --taps 12 --out reports/persian-tap
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const venues = (args.venues || 'senso,kebab-land').split(','), taps = Number(args.taps || 12), windowMs = Number(args.window || 3000);
const out = path.resolve(args.out || 'reports/persian-tap');
const browser = await chromium.launch();
async function tap(base, venue) {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage();
  await p.goto(`${base}/${venue}`, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('#welcome button[data-lang="fa"]')).opacity) === 1, null, { timeout: 8000 });
  await p.waitForTimeout(250);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__L = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__L.push(Math.round(e.duration)))).observe({ type: 'longtask' }); });
  await p.waitForTimeout(60); await p.tap('#welcome button[data-lang="fa"]'); await p.waitForTimeout(windowMs);
  const r = await p.evaluate(() => ({ L: window.__L, lang: document.documentElement.lang }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await ctx.close();
  if (r.lang !== 'fa') throw new Error(`the page is not in Persian after the tap (${r.lang})`);
  return r.L.length ? Math.max(...r.L) : 0;
}
const lines = [], json = [];
for (const venue of venues) {
  const res = { before: [], after: [] };
  for (let i = 0; i < taps; i++) for (const k of ['before', 'after']) res[k].push(await tap(args[k], venue));
  for (const k of ['before', 'after']) {
    const line = `${k.toUpperCase().padEnd(6)} ${venue.padEnd(10)} longest task per Persian tap at CPU 4x over ${windowMs} ms (ms; 0 = none over 50): ${res[k].join(' ')} | over 50: ${res[k].filter((x) => x > 50).length} / ${taps}`;
    lines.push(line); console.log(line);
  }
  json.push({ venue, ...res });
}
await browser.close();
fs.writeFileSync(path.join(out, 'persian-tap-by-hand.txt'), [`${new Date().toISOString()}; before ${args.before}, after ${args.after}`, ...lines, ''].join('\n'));
fs.writeFileSync(path.join(out, 'persian-tap.json'), JSON.stringify({ at: new Date().toISOString(), before: args.before, after: args.after, windowMs, taps, results: json }, null, 1));
