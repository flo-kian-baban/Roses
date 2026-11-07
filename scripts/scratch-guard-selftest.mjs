#!/usr/bin/env node
// Proves the PM's rule of 2026-11-06: drills and hand-test scripts refuse to start unless their target is a scratch server; wrong or
// missing options abort with a message; nothing falls back to port 3000 or the working database. No real server and no database is
// used: every script runs under scripts/scratch-guard-tripwire.mjs, which writes down and refuses every connection and child process.
//   static     every script under scripts/ and reports/ that reaches a server or a database (fetch, page.goto, a browser, pg, docker …)
//              starts with the guard (scripts/scratch-target.mjs; scripts/backup-drill.sh has its own in bash), or is one of the tools
//              named below that work on the working data or the outside world on purpose; no guarded script reads .env.local
//   no-options each guarded script started with no options, once in an empty environment and once with the working settings exported
//              (DATABASE_URL on the working database, UPLOAD_DIR on the working uploads, PORT 3000, an admin's variables): exit 2, a
//              message saying what to give, and nothing sent (the tripwire's log empty)
//   refusals   on the lockout and layout drills: a wrong option (--base given to the lockout drill, the mistake of 2026-11-06), port 3000,
//              an address off this machine, a DATABASE_URL naming the working database, and a fake server standing in for the target:
//              answering the probe with 404 (as Kian's review server and production do), on the working database, on another scratch
//              database than the drill's, on the working uploads; each: exit 2, a message, and nothing sent but the one probe
//   control    a fake scratch server on the drill's own database lets the drill through (it then tries its database, which the tripwire
//              writes down and refuses), so an empty log above means the guard stopped the script, not that the tripwire missed it
//   node scripts/scratch-guard-selftest.mjs --out <folder>
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WORKING } from './scratch-target.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
if (argv.length !== 2 || argv[0] !== '--out') { console.error('usage: node scripts/scratch-guard-selftest.mjs --out <folder>'); process.exit(2); }
const out = path.resolve(argv[1]); fs.mkdirSync(out, { recursive: true });
const TRIPWIRE = path.join(ROOT, 'scripts', 'scratch-guard-tripwire.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scratch-guard-'));
const results = [], lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(`${ok ? 'PASS' : 'FAIL'} ${step}: ${text}`); };

// Tools that work on the working data or the outside world on purpose, by name (not drills or hand tests).
const NOT_GUARDED = {
  'scripts/check.mjs': 'the check suite: copies the working database read only, proves it untouched, runs everything on its own copies',
  'scripts/setup.mjs': 'a fresh clone\'s setup: imports into the working database',
  'scripts/admin-create.mjs': 'creates or resets an admin (Kian\'s own PIN, go-live)',
  'scripts/db-migrate.mjs': 'applies migrations to the database it is given',
  'scripts/db-backup.sh': 'backs up the working database',
  'scripts/db-restore.sh': 'restores a backup',
  'scripts/uploads-clean.mjs': 'removes uploads no row references (go-live list)',
  'scripts/perf-fixture.mjs': 'freezes the performance fixture from the working database (read only) and verifies it',
  'scripts/network-watch.mjs': 'probes the three outside photo hosts for the suite',
  'scripts/preflight.mjs': 'reads the machine\'s load for the suite',
  'scripts/load-env.mjs': 'the library a drill opens its database with (after its guard)',
  'scripts/layout-rules.mjs': 'the library of the layout drill and the screenshots (nothing at the top level)',
  'scripts/scratch-target.mjs': 'the guard itself (its one probe)',
  'scripts/scratch-guard-selftest.mjs': 'this selftest (its own fake servers)',
  'scripts/scratch-guard-tripwire.mjs': 'the tripwire',
  'reports/welcome/gallery/shots.mjs': 'shoots a local file (gallery.html): no server, no database',
};
const MARK_JS = /\bfetch\(|\.goto\(|\.launch\(|\blaunch\(\{|connectDb\(|new pg\.(Client|Pool)|new (Client|Pool)\(|\blighthouse\(|\bspawn\(|execFileSync\(|createConnection\(|https?\.request\(/;
const MARK_SH = /\bdocker\b|\bpsql\b|\bpg_dump\b|\bpg_restore\b|\bcurl\b/;
const files = execFileSync('git', ['ls-files', 'scripts', 'reports'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /\.(mjs|sh)$/.test(f));
const reaching = [], guarded = [], notGuarded = [], unguarded = [], readsEnv = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const isGuarded = f.endsWith('.sh') ? /refused, nothing run/.test(src) : /scratch-target\.mjs/.test(src) && /scratchTarget\(/.test(src);
  if (isGuarded && f !== 'scripts/scratch-target.mjs') guarded.push(f);
  if (!(f.endsWith('.sh') ? MARK_SH : MARK_JS).test(src)) continue;
  reaching.push(f);
  if (NOT_GUARDED[f]) notGuarded.push(f); else if (!isGuarded) unguarded.push(f);
  if (isGuarded && /\bloadEnv\(/.test(src)) readsEnv.push(f);
}
check('static-guarded', unguarded.length === 0 && readsEnv.length === 0, `${reaching.length} scripts under scripts/ and reports/ reach a server, a browser or a database: ${reaching.length - notGuarded.length} start with the guard, ${notGuarded.length} are tools named by name (${notGuarded.join(', ')}); not guarded: ${unguarded.join(', ') || 'none'}; guarded but reading .env.local: ${readsEnv.join(', ') || 'none'}`);

let n = 0;
const run = (cmd, args, env) => new Promise((resolve) => {
  const file = path.join(tmp, `trip-${++n}.log`); fs.writeFileSync(file, '');
  const p = spawn(cmd, args, { cwd: ROOT, env: { PATH: env.PATH ?? process.env.PATH, HOME: process.env.HOME, ...env, TRIPWIRE_LOG: file } });
  let stdout = '', stderr = '';
  const timer = setTimeout(() => p.kill('SIGKILL'), 60_000);
  p.stdout.on('data', (d) => { stdout += d; }); p.stderr.on('data', (d) => { stderr += d; });
  p.on('close', (status) => { clearTimeout(timer); const trip = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); resolve({ status, stdout, stderr, trip }); });
});
const node = (script, args, env) => run(process.execPath, ['--import', TRIPWIRE, script, ...args], env);
// a shell script's commands that reach the database go through shims that write to the tripwire's log, before the real PATH
const shims = path.join(tmp, 'shims'); fs.mkdirSync(shims);
for (const c of ['docker', 'psql', 'pg_dump', 'pg_restore', 'createdb', 'dropdb', 'curl']) fs.writeFileSync(path.join(shims, c), `#!/bin/sh\nprintf '{"kind":"child","command":"%s"}\\n' "${c}" >> "$TRIPWIRE_LOG"\nexit 1\n`, { mode: 0o755 });
const bash = (script, args, env) => run('bash', [script, ...args], { ...env, PATH: `${shims}:/usr/bin:/bin` });
const said = (r) => (r.stderr.split('\n').find((l) => /refused/.test(l)) || r.stderr.split('\n')[0] || r.stdout.split('\n')[0] || '').slice(0, 220);

// The working settings someone may have exported in their shell (or a .env.local would give): every script must still refuse.
const WORKING_ENV = { DATABASE_URL: `postgres://roses@127.0.0.1:5433/${[...WORKING.dbs][0]}`, ROSES_DB: [...WORKING.dbs][0], UPLOAD_DIR: WORKING.uploads, PORT: '3000', CWD: WORKING.main,
  DRILL_ADMIN_PIN: '000000', DRILL_ADMIN_EMAIL: 'guard-selftest@example.invalid', DRILL_ADMIN_PASSWORD: 'not-a-password', BACKUP_DIR: tmp };
const noOptions = [];
for (const f of guarded) {
  for (const [label, env] of [['empty environment', {}], ['the working settings exported', WORKING_ENV]]) {
    const r = f.endsWith('.sh') ? await bash(f, [], env) : await node(f, [], env);
    noOptions.push({ script: f, env: label, status: r.status, message: said(r), sent: r.trip });
  }
}
const badNo = noOptions.filter((x) => x.status !== 2 || !/refused/.test(x.message) || x.sent.length);
check('no-options-sends-nothing', badNo.length === 0, `${guarded.length} guarded scripts, each started with no options in an empty environment and with the working settings exported (${noOptions.length} runs): ${noOptions.length - badNo.length} stopped with exit 2 and a message, with nothing sent (no connection, no child process)${badNo.length ? `; NOT: ${badNo.map((x) => `${x.script} (${x.env}: exit ${x.status}, sent ${x.sent.length}, "${x.message}")`).join('; ')}` : ''}`);

// A fake server standing in for a target: answers GET /api/scratch as told; counts what it is sent.
let answer = { status: 404 }, seen = [];
const fake = http.createServer((req, res) => { seen.push(`${req.method} ${req.url}`); res.writeHead(answer.status, { 'content-type': 'application/json' }); res.end(answer.body ? JSON.stringify(answer.body) : ''); });
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${fake.address().port}`, ALLOW = String(fake.address().port);
const SCRATCH_DB = 'roses_guard_selftest', SCRATCH_UPLOADS = path.join(tmp, 'uploads');
const drillEnv = { DATABASE_URL: `postgres://roses@127.0.0.1:5433/${SCRATCH_DB}`, DRILL_ADMIN_PIN: '000000', DRILL_ADMIN_EMAIL: 'guard-selftest@example.invalid', DRILL_ADMIN_PASSWORD: 'not-a-password', TRIPWIRE_ALLOW_PORT: ALLOW };
const outDir = path.join(tmp, 'out');
const cases = [
  ['wrong-option', 'the lockout drill given --base (it takes --base4, --base6, --proxyBase)', 'scripts/lockout-drill.mjs', ['--base', FAKE, '--out', outDir], {}, null, /unknown option --base/, 0],
  ['port-3000', 'the layout drill given port 3000', 'scripts/layout-drill.mjs', ['--base', 'http://127.0.0.1:3000', '--out', outDir], {}, null, /port 3000/, 0],
  ['off-machine', 'the layout drill given an address off this machine', 'scripts/layout-drill.mjs', ['--base', 'http://192.0.2.10:8080', '--out', outDir], {}, null, /not on this machine/, 0],
  ['working-db', 'the layout drill with DATABASE_URL on the working database', 'scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], { DATABASE_URL: WORKING_ENV.DATABASE_URL }, { status: 200, body: { scratch: true, database: SCRATCH_DB, uploads: SCRATCH_UPLOADS } }, /working database/, 0],
  ['probe-404', 'the layout drill at a server that answers the probe with 404 (Kian\'s review server, production)', 'scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], {}, { status: 404 }, /is not a scratch server/, 1],
  ['server-working-db', 'the layout drill at a scratch server on the working database', 'scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], {}, { status: 200, body: { scratch: true, database: [...WORKING.dbs][0], uploads: SCRATCH_UPLOADS } }, /uses the working database/, 1],
  ['server-other-db', 'the layout drill at a scratch server on another scratch database than its own', 'scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], {}, { status: 200, body: { scratch: true, database: 'roses_some_other_copy', uploads: SCRATCH_UPLOADS } }, /same scratch copy/, 1],
  ['server-working-uploads', 'the layout drill at a scratch server on the working uploads', 'scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], {}, { status: 200, body: { scratch: true, database: SCRATCH_DB, uploads: WORKING.uploads } }, /working uploads/, 1],
  ['backup-working-db', 'the backup drill with ROSES_DB on the working database', 'scripts/backup-drill.sh', [path.join(tmp, 'backup.txt')], { ROSES_DB: [...WORKING.dbs][0], BACKUP_DIR: tmp }, null, /working database/, 0],
];
for (const [id, title, script, args, env, ans, want, probes] of cases) {
  answer = ans || { status: 404 }; seen = [];
  const r = script.endsWith('.sh') ? await bash(script, args, { ...env }) : await node(script, args, { ...drillEnv, ...env });
  const allowed = r.trip.filter((t) => t.allowed), other = r.trip.filter((t) => !t.allowed);
  const ok = r.status === 2 && want.test(r.stderr) && other.length === 0 && allowed.length === probes && seen.length === probes && seen.every((s) => s === 'GET /api/scratch');
  check(`refuse-${id}`, ok, `${title}: exit ${r.status}, "${said(r)}"; sent: ${probes ? `${seen.length} request(s) to the stand-in (${seen.join(', ') || 'none'})` : `${r.trip.length} connection(s) or child process(es)`}${other.length ? `, and ${other.length} other: ${other.map((t) => t.kind === 'child' ? t.command : `${t.host}:${t.port}`).join(', ')}` : ''}`);
}
// The control: a scratch server on the drill's own database lets the drill through to its next step (its database, refused by the tripwire).
answer = { status: 200, body: { scratch: true, database: SCRATCH_DB, uploads: SCRATCH_UPLOADS } }; seen = [];
{
  const r = await node('scripts/layout-drill.mjs', ['--base', FAKE, '--out', outDir], drillEnv);
  const db = r.trip.filter((t) => !t.allowed && t.port === 5433);
  check('control-scratch-server-passes', r.status !== 2 && !/refused, nothing/.test(r.stderr) && seen.length === 1 && seen[0] === 'GET /api/scratch' && db.length >= 1,
    `the layout drill at a stand-in scratch server on its own database: the guard let it through (exit ${r.status}, not 2), after the one probe (${seen.join(', ')}) it went for its database (${db.length ? `127.0.0.1:${db[0].port}, written down and refused by the tripwire` : 'no attempt seen'}): the tripwire sees what a script sends`);
}
fake.close();
const pass = results.every((x) => x.ok);
fs.writeFileSync(path.join(out, 'scratch-guard.json'), JSON.stringify({ at: new Date().toISOString(), pass, results, guarded, notGuarded: Object.fromEntries(notGuarded.map((f) => [f, NOT_GUARDED[f]])), noOptions }, null, 1));
fs.writeFileSync(path.join(out, 'scratch-guard.txt'), [`Scratch guard selftest ${pass ? 'PASS' : 'FAIL'} (${results.filter((x) => x.ok).length}/${results.length} checks)`, '', ...lines, '',
  'No options (each guarded script, both environments): exit, message, what it sent', ...noOptions.map((x) => `  ${x.script} [${x.env}]: exit ${x.status}; ${x.sent.length} sent; ${x.message}`)].join('\n') + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`SCRATCH GUARD SELFTEST ${pass ? 'PASS' : 'FAIL'} (${results.filter((x) => x.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
