// Pre-flight of npm run check (the PM, 2026-10-11, after a run whose timings were invalidated by another project's server at ~590 % CPU):
// before anything is copied or built, read the machine's load and stop when a process the suite did not start is above 100 % CPU.
//   readings(): the 1-minute (and 5, 15) load average, free and available memory, Docker's memory (the Docker VM's total, which bounds
//     every container, and the database container's own limit, 0 = none) and the top 5 processes by CPU, each with its listening ports.
//     CPU is `ps`'s %cpu, which macOS keeps as a decaying average over up to a minute, so a one-second spike does not stop a run and a
//     process that has been busy for a while does.
//   offenders(r, own): the processes above LIMIT % that are not the suite's own (the suite and npm, the only ones running at this point).
//   TIMING: the suite's steps whose results are timings (they are marked "under external load" in a run forced past the pre-flight).
// Never touches another process: it only reads.
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export const LIMIT = 100;
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
export const describe = (p) => `${p.name} (PID ${p.pid}${p.ports.length ? `, port ${p.ports.join(', ')}` : ', no listening port'}, ${p.cpu.toFixed(0)} % CPU)`;

// The suite's timing steps, by the start of their names (results that are times: taps, frames, LCP, regeneration, preview delays).
export const TIMING = /^(public page checks|welcome screen drill|season drill|transition drill|menu after the language tap|Lighthouse|revalidation|page editor drill|preview control bar drill|Style tab drill)/;

// report.md's Pre-flight section.
export function markdown(r, bad, forced) {
  const verdict = !bad.length ? `**Passed**: no process the suite did not start was above ${LIMIT} % CPU.`
    : `**Forced past a stop** (\`npm run check -- --force\`): ${bad.map(describe).join('; ')} was above ${LIMIT} % CPU. Every timing check in this report ran **under external load** and is marked so in the table.`;
  return ['## Pre-flight', '', verdict, '',
    `Read at ${r.at}, before the scratch copy and the build: load average ${r.load1.toFixed(2)} (1 min), ${r.load5.toFixed(2)} (5 min), ${r.load15.toFixed(2)} (15 min) on ${r.cpus} CPUs · memory free ${GB(r.free)}, available ${GB(r.available)} (free + inactive + speculative pages) of ${GB(r.total)} · Docker: ${GB(r.dockerTotal)} for its VM (every container's ceiling), the database container \`${r.container}\` ${r.dbLimit === null ? 'not found' : r.dbLimit === 0 ? 'with no limit of its own' : `limited to ${GB(r.dbLimit)}`}.`, '',
    'Top 5 processes by CPU (`ps` %cpu, a decaying average over up to a minute):', '',
    '| Process | PID | CPU | Listening ports |', '| --- | --- | --- | --- |',
    ...r.top.map((p) => `| ${p.name.replace(/\|/g, '\\|')} | ${p.pid} | ${p.cpu.toFixed(1)} % | ${p.ports.join(', ') || '—'} |`), ''];
}
