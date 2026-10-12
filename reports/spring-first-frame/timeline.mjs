// Frame by frame from the start of the document (an init script logs every requestAnimationFrame callback): is the scene there, how many
// of its animations are pending / have a running clock, is the card there. Then the drill's own first sample. The drill's sequence: a fresh
// server at the season's instant, the page regenerated, a cold load, the warm-up, the measured load.
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
const LOGGER = () => { window.__F = []; const tick = () => { const w = document.getElementById('welcome'), s = w && w.querySelector('.scene'); const a = s ? s.getAnimations({ subtree: true }) : [];
  window.__F.push({ t: Math.round(performance.now()), scene: !!s, particles: s ? s.querySelectorAll('.p').length : 0, anims: a.length, pending: a.filter((x) => x.pending).length, running: a.filter((x) => x.currentTime > 0).length, card: !!(w && w.querySelector('button[data-lang]')) });
  if (window.__F.length < 12) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
const FIRST = () => new Promise((res) => { const tick = () => { const w = document.getElementById('welcome'); if (w && w.querySelector('button[data-lang]')) { const s = w.querySelector('.scene'); const anims = s ? s.getAnimations({ subtree: true }) : []; res({ t: Math.round(performance.now()), notRunning: anims.filter((a) => !(a.currentTime > 0)).length, anims: anims.length }); } else requestAnimationFrame(tick); }; tick(); });
const browser = await chromium.launch();
const log = fs.openSync(path.join(out, 'timeline-server.log'), 'a');
const rows = [];
for (let i = 0; i < N; i++) {
  const port = await new Promise((r) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  age();
  const srv = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd, env: { ...process.env, NEXT_DIST_DIR: '.next-fixture', ROSES_NOW: process.env.NOW, ROSES_CHECK_SUITE: '1', ROSES_APP_NAME: 'roses-probe:server' }, stdio: ['ignore', log, log] });
  const base = `http://127.0.0.1:${port}`;
  for (let k = 0; k < 300; k++) { try { const r = await fetch(`${base}/admin`, { method: 'HEAD', redirect: 'manual' }); if (r.status < 500) break; } catch {} await sleep(100); }
  let html = ''; for (let k = 0; k < 100; k++) { html = await (await fetch(`${base}/senso`)).text(); if (html.includes(`data-season="${process.env.WANT}"`)) break; await sleep(150); }
  const c1 = await browser.newContext(DEVICE); const p1 = await c1.newPage(); await p1.goto(`${base}/senso`); await p1.waitForLoadState('load', { timeout: 8000 }).catch(() => {}); await c1.close();
  for (const u of [...new Set(html.match(/\/uploads\/[^"'\s)]+/g) || [])]) await fetch(`${base}${u}`).then((r) => r.arrayBuffer()).catch(() => {});
  const c2 = await browser.newContext(DEVICE); await c2.addInitScript(LOGGER); const p2 = await c2.newPage(); await p2.goto(`${base}/senso`, { waitUntil: 'commit' }); const first = await p2.evaluate(FIRST); await sleep(500); const frames = await p2.evaluate(() => window.__F); await c2.close();
  srv.kill('SIGTERM'); await new Promise((r) => { srv.once('exit', r); setTimeout(r, 3000); });
  rows.push({ first, frames });
  const sceneAt = frames.findIndex((f) => f.particles === 20), cardAt = frames.findIndex((f) => f.card), runAt = frames.findIndex((f) => f.anims > 0 && f.running === f.anims);
  console.log(`${i} first sample ${first.t} ms: ${first.notRunning}/${first.anims} not running | rAF #: scene first in #${sceneAt} (${frames[sceneAt]?.t} ms, ${frames[sceneAt]?.pending} pending), card first in #${cardAt} (${frames[cardAt]?.t} ms), every clock running from #${runAt} | ${frames.slice(0, 6).map((f) => `${f.t}:${f.particles}p/${f.pending}pend/${f.running}run${f.card ? '/card' : ''}`).join(' ')}`);
}
await browser.close();
fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(rows, null, 1));
