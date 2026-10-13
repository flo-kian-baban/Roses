// Pre-flight of npm run check (the PM, 2026-10-11, after a run whose timings were invalidated by another project's server at ~590 % CPU):
// before anything is copied or built, read the machine's load. Standing rule since 2026-10-13 (Kian, after three check:full runs whose
// Persian-tap timing a busy dev server of another project spoiled): the suite waits, it does not fail: waitQuiet() re-reads every 30 s
// until no process the suite did not start has been above LIMIT (50) % CPU for 30 s (two readings 30 s apart, both clean), printing
// what it waits on each time; then the run goes on. (It stopped with exit 2 above 100 % before.)
//   readings(): the 1-minute (and 5, 15) load average, free and available memory, Docker's memory (the Docker VM's total, which bounds
//     every container, and the database container's own limit, 0 = none) and the top 5 processes by CPU, each with its listening ports.
//     CPU is `ps`'s %cpu, which macOS keeps as a decaying average over up to a minute, so a one-second spike does not stop a run and a
//     process that has been busy for a while does.
//   offenders(r, own): the processes above LIMIT % that are not the suite's own (the suite and its parent, the only ones running then).
//   waitQuiet({ own, log }): the wait above; answers the last readings and every reading that found a process to wait on.
//   sample(rootPid): one reading through the run (Kian, 2026-10-13, every 30 s): the top process by CPU (marked the suite's own when it
//     descends from rootPid) and the top one the suite did not start.
//   TIMING: the suite's steps whose results are timings (they are marked "under external load" in a run forced past the pre-flight).
// Never touches another process: it only reads.
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export const LIMIT = 50; // % CPU, a process the suite did not start (Kian, 2026-10-13: was 100, a stop; now a wait)
const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return r.status === 0 ? r.stdout : ''; };
const GB = (n) => (n == null ? '—' : `${(n / 1024 ** 3).toFixed(1)} GB`);
const ports = (pid) => [...new Set(sh('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN']).split('\n').slice(1).map((l) => l.trim().split(/\s+/)[8]).filter(Boolean))];

export function readings(container = 'roses-db') {
  const [load1, load5, load15] = os.loadavg();
  // available = free + inactive + speculative pages (vm_stat), what macOS can hand out without paging; os.freemem() is free pages only
  const vm = sh('vm_stat', []), page = Number((vm.match(/page size of (\d+) bytes/) || [])[1] || 4096), pages = (k) => Number((vm.match(new RegExp(`Pages ${k}:\\s+(\\d+)`)) || [])[1] || 0);
  const available = vm ? (pages('free') + pages('inactive') + pages('speculative')) * page : null;
  const dockerTotal = Number(sh('docker', ['info', '--format', '{{.MemTotal}}']).trim()) || null;
  const dbLimitRaw = sh('docker', ['inspect', container, '--format', '{{.HostConfig.Memory}}']).trim();
  const procs = sh('ps', ['-Ao', 'pid=,pcpu=,comm=', '-r']).split('\n').map((l) => l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, cpu, comm]) => ({ pid: Number(pid), cpu: Number(cpu), name: comm.split('/').pop(), command: comm }));
  const top = procs.slice(0, 5).map((p) => ({ ...p, ports: ports(p.pid) }));
  return { at: new Date().toISOString(), load1, load5, load15, cpus: os.cpus().length, free: os.freemem(), available, total: os.totalmem(), dockerTotal, container, dbLimit: dbLimitRaw === '' ? null : Number(dbLimitRaw), top, over: procs.filter((p) => p.cpu > LIMIT).map((p) => ({ ...p, ports: ports(p.pid) })) };
}
export const offenders = (r, own) => r.over.filter((p) => !own.includes(p.pid));
// The wait (Kian, 2026-10-13): every 30 s; clean twice in a row, 30 s apart, and it returns. --force skips it (see check.mjs).
export async function waitQuiet({ own, log, container = 'roses-db', every = 30_000 }) {
  const waited = []; let cleanAt = null; const t0 = Date.now();
  for (;;) {
    const r = readings(container), bad = offenders(r, own);
    if (bad.length) { waited.push({ at: r.at, on: bad.map((p) => ({ name: p.name, pid: p.pid, cpu: p.cpu, ports: p.ports, command: p.command })) }); cleanAt = null; log(`pre-flight: waiting (no process the suite did not start may be above ${LIMIT} % CPU for 30 s before the build): ${bad.map(describe).join('; ')}; reading again in ${every / 1000} s`); }
    else if (cleanAt === null) { cleanAt = Date.now(); log(`pre-flight: no process the suite did not start above ${LIMIT} % CPU; reading again in ${every / 1000} s to see it stays so`); }
    else return { readings: r, waited, waitedMs: Date.now() - t0 };
    await new Promise((res) => setTimeout(res, every));
  }
}
// One reading through the run: the top process by CPU (and whether the suite started it) and the top one it did not start.
export function sample(rootPid) {
  const rows = sh('ps', ['-Ao', 'pid=,ppid=,pcpu=,comm=', '-r']).split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, ppid, cpu, comm]) => ({ pid: Number(pid), ppid: Number(ppid), cpu: Number(cpu), name: comm.split('/').pop() }));
  const parent = new Map(rows.map((p) => [p.pid, p.ppid]));
  const mine = (pid) => { for (let p = pid, n = 0; p && n < 64; p = parent.get(p), n++) if (p === rootPid) return true; return false; };
  const top = rows[0] ? { ...rows[0], own: mine(rows[0].pid) } : null, foreign = rows.find((p) => !mine(p.pid)) ?? null;
  return { at: new Date().toISOString(), top, foreign: foreign ? { ...foreign, ports: foreign.cpu > LIMIT ? ports(foreign.pid) : [] } : null };
}
export const describe = (p) => `${p.name} (PID ${p.pid}${p.ports.length ? `, port ${p.ports.join(', ')}` : ', no listening port'}, ${p.cpu.toFixed(0)} % CPU)`;

// The suite's timing steps, by the start of their names (results that are times: taps, frames, LCP, regeneration, preview delays).
export const TIMING = /^(public page checks|welcome screen drill|season drill|transition drill|menu after the language tap|Lighthouse|revalidation|page editor drill|preview control bar drill|Style tab drill)/;

// report.md's Pre-flight section.
export function markdown(r, bad, forced, wait = null) {
  const waitedLine = wait && wait.waited.length ? ` It waited ${Math.round(wait.waitedMs / 1000)} s, reading every 30 s, on: ${wait.waited.map((w) => `${w.at.slice(11, 19)}Z ${w.on.map((p) => `${p.name} (PID ${p.pid}${p.ports.length ? `, port ${p.ports.join(', ')}` : ''}, ${p.cpu.toFixed(0)} %)`).join(', ')}`).join('; ')}.` : wait ? ` Nothing to wait on (two readings 30 s apart, ${Math.round(wait.waitedMs / 1000)} s).` : '';
  const verdict = !bad.length ? `**Passed**: no process the suite did not start was above ${LIMIT} % CPU for 30 s before the build (the wait, Kian 2026-10-13).${waitedLine}`
    : `**Forced past the wait** (\`npm run check -- --force\`): ${bad.map(describe).join('; ')} was above ${LIMIT} % CPU. Every timing check in this report ran **under external load** and is marked so in the table.`;
  return ['## Pre-flight', '', verdict, '',
    `Read at ${r.at}, before the scratch copy and the build: load average ${r.load1.toFixed(2)} (1 min), ${r.load5.toFixed(2)} (5 min), ${r.load15.toFixed(2)} (15 min) on ${r.cpus} CPUs · memory free ${GB(r.free)}, available ${GB(r.available)} (free + inactive + speculative pages) of ${GB(r.total)} · Docker: ${GB(r.dockerTotal)} for its VM (every container's ceiling), the database container \`${r.container}\` ${r.dbLimit === null ? 'not found' : r.dbLimit === 0 ? 'with no limit of its own' : `limited to ${GB(r.dbLimit)}`}.`, '',
    'Top 5 processes by CPU (`ps` %cpu, a decaying average over up to a minute):', '',
    '| Process | PID | CPU | Listening ports |', '| --- | --- | --- | --- |',
    ...r.top.map((p) => `| ${p.name.replace(/\|/g, '\\|')} | ${p.pid} | ${p.cpu.toFixed(1)} % | ${p.ports.join(', ') || '—'} |`), ''];
}
