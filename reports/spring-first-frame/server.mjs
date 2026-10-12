// Start a probe server on a copy of a build at a forged instant and regenerate /senso for it. Prints the port.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net';
const cwd = process.env.CWD, dist = process.env.DIST, copy = process.env.COPY, now = process.env.NOW;
if (fs.existsSync(path.join(cwd, copy))) fs.rmSync(path.join(cwd, copy), { recursive: true, force: true });
execFileSync('cp', ['-Rc', path.join(cwd, dist), path.join(cwd, copy)]);
const port = await new Promise((r) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const log = fs.openSync(process.env.LOG, 'a');
const srv = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd, env: { ...process.env, NEXT_DIST_DIR: copy, ROSES_NOW: now, ROSES_CHECK_SUITE: '1', ROSES_APP_NAME: 'roses-probe:server' }, stdio: ['ignore', log, log], detached: true });
srv.unref();
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 300; i++) { try { const r = await fetch(`${base}/admin`, { method: 'HEAD', redirect: 'manual' }); if (r.status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
const t = new Date(Date.now() - 3601e3);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(path.join(cwd, copy, 'server')).filter((f) => /\/(senso|kebab-land)\.(html|json|meta)$/.test(f))) { if (f.endsWith('.meta')) { const m = JSON.parse(fs.readFileSync(f, 'utf8')); if (m.routeCacheLastModified != null) { m.routeCacheLastModified = t.getTime(); fs.writeFileSync(f, JSON.stringify(m)); } } fs.utimesSync(f, t, t); }
let season = null;
for (let i = 0; i < 100; i++) { const h = await (await fetch(`${base}/senso`)).text(); season = (h.match(/<div id="welcome"[^>]*data-season="([a-z]+)"/) || [])[1]; if (season && h.includes(`data-season="${process.env.WANT}"`)) break; await new Promise((r) => setTimeout(r, 150)); }
console.log(JSON.stringify({ port, pid: srv.pid, season }));
process.exit(0);
