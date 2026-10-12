// The season drill's sequence, repeated (any season: NOW is the server's instant, WANT the season it renders): a fresh server, the page
// regenerated, one cold load, the warm-up (the page once, every uploaded photo once), then the measured load's first sample: is every
// animation's clock running, and if not, how many frames until it is. Server: a copy of the suite's build, its own port.
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net';
const cwd = process.env.CWD, copy = path.join(cwd, '.next-fixture'), N = Number(process.env.N || 10), out = process.env.OUT;
if (fs.existsSync(copy)) fs.rmSync(copy, { recursive: true, force: true });
execFileSync('cp', ['-Rc', path.join(cwd, process.env.DIST), copy]);
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const age = () => { const t = new Date(Date.now() - 3601e3); for (const f of walk(path.join(copy, 'server')).filter((f) => /\/senso\.(html|json|meta)$/.test(f))) { if (f.endsWith('.meta')) { const m = JSON.parse(fs.readFileSync(f, 'utf8')); if (m.routeCacheLastModified != null) { m.routeCacheLastModified = t.getTime(); fs.writeFileSync(f, JSON.stringify(m)); } } fs.utimesSync(f, t, t); } };
const FIRST = () => new Promise((res) => { const tick = () => { const w = document.getElementById('welcome'); if (w && w.querySelector('button[data-lang]')) { const s = w.querySelector('.scene'); const anims = s ? s.getAnimations({ subtree: true }) : [];
  const notRunning = anims.filter((a) => !(a.currentTime > 0)).length, r = { t: Math.round(performance.now()), animations: anims.length, notRunning, frames: 0 };
  if (!notRunning) return res(r);
  const wait = () => { r.frames++; if (s.getAnimations({ subtree: true }).every((a) => a.currentTime > 0) || r.frames > 60) res(r); else requestAnimationFrame(wait); }; requestAnimationFrame(wait);
} else requestAnimationFrame(tick); }; tick(); });
const browser = await chromium.launch();
const log = fs.openSync(path.join(out, 'loop-server.log'), 'a');
const rows = [];
for (let i = 0; i < N; i++) {
  const port = await new Promise((r) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  age();
  const srv = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd, env: { ...process.env, NEXT_DIST_DIR: '.next-fixture', ROSES_NOW: process.env.NOW, ROSES_CHECK_SUITE: '1', ROSES_APP_NAME: 'roses-probe:server' }, stdio: ['ignore', log, log] });
  const base = `http://127.0.0.1:${port}`;
  for (let k = 0; k < 300; k++) { try { const r = await fetch(`${base}/admin`, { method: 'HEAD', redirect: 'manual' }); if (r.status < 500) break; } catch {} await sleep(100); }
  let html = ''; for (let k = 0; k < 100; k++) { html = await (await fetch(`${base}/senso`)).text(); if (html.includes(`data-season="${process.env.WANT}"`)) break; await sleep(150); }
  const c1 = await browser.newContext(DEVICE); const p1 = await c1.newPage(); await p1.goto(`${base}/senso`, { waitUntil: 'commit' }); const cold = await p1.evaluate(FIRST); await p1.waitForLoadState('load', { timeout: 8000 }).catch(() => {}); await c1.close();
  for (const u of [...new Set(html.match(/\/uploads\/[^"'\s)]+/g) || [])]) await fetch(`${base}${u}`).then((r) => r.arrayBuffer()).catch(() => {});
  const c2 = await browser.newContext(DEVICE); const p2 = await c2.newPage(); await p2.goto(`${base}/senso`, { waitUntil: 'commit' }); const warm = await p2.evaluate(FIRST); await c2.close();
  srv.kill('SIGTERM'); await new Promise((r) => { srv.once('exit', r); setTimeout(r, 3000); });
  rows.push({ cold, warm }); console.log(i, JSON.stringify({ cold, warm }));
}
await browser.close();
fs.writeFileSync(path.join(out, 'loop.json'), JSON.stringify(rows, null, 1));
const w = rows.map((r) => r.warm), c = rows.map((r) => r.cold);
console.log(`warm (measured) loads ${w.length}: clock not running at the first sample in ${w.filter((x) => x.notRunning).length} (every animation in each: ${w.filter((x) => x.notRunning && x.notRunning === x.animations).length}), frames until running ${[...new Set(w.filter((x) => x.notRunning).map((x) => x.frames))].join('/') || '—'}; cold loads: ${c.filter((x) => x.notRunning).length} of ${c.length}, frames ${[...new Set(c.filter((x) => x.notRunning).map((x) => x.frames))].join('/') || '—'}`);
