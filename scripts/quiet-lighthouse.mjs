#!/usr/bin/env node
// Lighthouse on a quiet machine (the PM, 2026-11-19: Senso's load time "measured 3 times on a quiet machine" for its baseline).
// What is measured is what the suite's own step measures: Lighthouse mobile on a page of a running scratch server, three runs, by
// scripts/check-lighthouse.mjs. Around it, this script makes sure the machine is quiet and proves it:
//   - the page and each of its own uploaded photos are fetched once first (as the suite warms its fixture server);
//   - it waits until no process other than itself and the server has been above 50 % CPU for 30 s (the suite's pre-flight wait,
//     scripts/preflight.mjs: two clean readings 30 s apart);
//   - while the three runs go, it reads the load every 5 s: the busiest process that is neither its own (the runs, their browser) nor
//     the server. A set during which such a process was above 50 % CPU is not counted: it is printed, and the set is taken again, up to
//     --sets sets (6 if not given). The first quiet set is the one counted; its median is printed with what 10 % more comes to.
// Everything is written to --out: quiet-lighthouse.json (every set with its readings), quiet-lighthouse.txt (the transcript) and each
// set's lighthouse-summary.json.
//   node scripts/quiet-lighthouse.mjs http://127.0.0.1:<scratch server port>/senso --out <folder> [--sets 6]
// For the baseline of "Senso LCP with uploaded photos" the server is the performance fixture's (reports/senso-load-baseline/README.md
// has the commands that restore the fixture, build on it and start it).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratchTarget } from './scratch-target.mjs';
import { waitQuiet, LIMIT } from './preflight.mjs';

// The target is a scratch server, or the script stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args, pos: [url] } = await scratchTarget('scripts/quiet-lighthouse.mjs', { options: { out: 'path', sets: 'number' }, optional: ['sets'], positional: [['url', 'server']] });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(args.out), MAX = Number(args.sets || 6), target = new URL(url);
fs.mkdirSync(out, { recursive: true });
const transcript = [];
const log = (t) => { const l = `${new Date().toISOString()} ${t}`; transcript.push(l); console.log(l); };
const sh = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: 'utf8' }); return r.status === 0 ? r.stdout : ''; };
const serverPids = sh('lsof', ['-t', `-iTCP:${target.port}`, '-sTCP:LISTEN']).split('\n').map(Number).filter(Boolean);
if (!serverPids.length) { console.error(`quiet-lighthouse: nothing listens on port ${target.port}`); process.exit(2); }

// warmed as the suite warms its fixture server: the page, then each of its own uploaded photos, once
const html = await fetch(url).then((r) => r.text());
const ups = [...new Set(html.match(/(?<=["'(\s])\/uploads\/[^"'\s)]+/g) || [])];
for (const u of ups) await fetch(new URL(u, target.origin)).then((r) => r.arrayBuffer()).catch(() => {});
log(`${url}: the server is pid ${serverPids.join(', ')}; warmed, the page (${Buffer.byteLength(html)} B) and its ${ups.length} uploaded photo(s) fetched once`);

// One reading of the load: the busiest process that is neither this script's (itself, the runs, their browser) nor the server's.
function reading() {
  const rows = sh('ps', ['-Ao', 'pid=,ppid=,pcpu=,comm=', '-r']).split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, ppid, cpu, comm]) => ({ pid: Number(pid), ppid: Number(ppid), cpu: Number(cpu), name: comm.split('/').pop() }));
  const parent = new Map(rows.map((p) => [p.pid, p.ppid])), roots = new Set([process.pid, ...serverPids]);
  const mine = (pid) => { for (let p = pid, n = 0; p && n < 64; p = parent.get(p), n++) if (roots.has(p)) return true; return false; };
  const foreign = rows.find((p) => !mine(p.pid)) ?? null, own = rows.find((p) => mine(p.pid)) ?? null;
  return { at: new Date().toISOString(), foreign: foreign ? { name: foreign.name, pid: foreign.pid, cpu: foreign.cpu } : null, own: own ? { name: own.name, cpu: own.cpu } : null };
}

const sets = [];
for (let n = 1; n <= MAX; n++) {
  const w = await waitQuiet({ own: [process.pid, ...serverPids], log });
  log(`set ${n}: no other process above ${LIMIT} % CPU for 30 s (waited ${Math.round(w.waitedMs / 1000)} s; 1-minute load ${w.readings.load1.toFixed(1)}); three Lighthouse runs`);
  const readings = [reading()], timer = setInterval(() => readings.push(reading()), 5000), dir = path.join(out, `set-${n}`), t0 = Date.now();
  const code = await new Promise((res) => {
    const c = spawn(process.execPath, [path.join(ROOT, 'scripts/check-lighthouse.mjs'), url, '--runs', '3', '--out', dir], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; c.stderr.on('data', (d) => { err += d; });
    c.on('exit', (x) => { if (x !== 0) log(`check-lighthouse exit ${x}: ${err.slice(0, 300)}`); res(x); });
  });
  clearInterval(timer); readings.push(reading());
  let runs = [];
  try { runs = JSON.parse(fs.readFileSync(path.join(dir, 'lighthouse-summary.json'), 'utf8')).runs; } catch { /* no summary: the set is not counted */ }
  const lcp = runs.map((r) => r.lcpMs), median = lcp.length === 3 ? [...lcp].sort((a, b) => a - b)[1] : null;
  const over = readings.filter((r) => r.foreign && r.foreign.cpu > LIMIT).map((r) => `${r.at.slice(11, 19)}Z ${r.foreign.name} (PID ${r.foreign.pid}) ${r.foreign.cpu.toFixed(0)} %`);
  const busiest = Math.max(0, ...readings.map((r) => r.foreign?.cpu ?? 0)), quiet = code === 0 && lcp.length === 3 && over.length === 0;
  sets.push({ set: n, at: new Date(t0).toISOString(), seconds: Math.round((Date.now() - t0) / 1000), lcpMs: lcp, median, tbtMs: runs.map((r) => r.tbtMs), performance: runs.map((r) => r.performance), images: runs.map((r) => r.images), imageKB: runs.map((r) => r.imageKB),
    lcpElement: [...new Set(runs.map((r) => ((r.lcpElement || '').match(/src="([^"]*)"/) || [])[1] || (r.lcpElement || '?').slice(0, 60)))], waitedSeconds: Math.round(w.waitedMs / 1000), load1: Number(w.readings.load1.toFixed(2)),
    readings: readings.map((r) => ({ at: r.at, other: r.foreign ? `${r.foreign.name} ${r.foreign.cpu.toFixed(0)} %` : null, own: r.own ? `${r.own.name} ${r.own.cpu.toFixed(0)} %` : null })), busiestOtherCpu: busiest, over, quiet });
  log(`set ${n}: LCP ${lcp.join(' / ')} ms (median ${median}), TBT ${runs.map((r) => r.tbtMs).join(' / ')} ms; ${readings.length} load readings 5 s apart, the busiest other process at ${busiest.toFixed(0)} % CPU; ${quiet ? 'QUIET: counted' : `NOT QUIET, not counted: ${over.join('; ') || `check-lighthouse exit ${code}`}`}`);
  if (quiet) break;
}
const counted = sets.find((s) => s.quiet) ?? null;
log(counted ? `COUNTED: set ${counted.set}, LCP ${counted.lcpMs.join(' / ')} ms, median ${counted.median} ms; 10 % more: ${Math.round(counted.median * 1.1)} ms` : `no quiet set in ${sets.length} set(s): nothing counted`);
fs.writeFileSync(path.join(out, 'quiet-lighthouse.json'), JSON.stringify({ at: new Date().toISOString(), url, node: process.version, next: JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/next/package.json'), 'utf8')).version, limit: `${LIMIT} % CPU`, warmed: { pageBytes: Buffer.byteLength(html), uploads: ups.length }, sets, counted }, null, 2));
fs.writeFileSync(path.join(out, 'quiet-lighthouse.txt'), transcript.join('\n') + '\n');
process.exit(counted ? 0 : 1);
