#!/usr/bin/env node
// One-command acceptance suite. Never touches the working database: it copies it (pg_dump → scratch database),
// points the build, the servers and every drill at the copy, and drops the copy at the end; per-table counts and the
// newest revision id of the working database are compared before and after. Builds into .next-check (the running
// server and .next are untouched), starts two servers (3100; 3101 with TRUST_PROXY=1 for the venue-cap test),
// creates a temporary admin account in the copy, runs every check, and writes reports/checks/<date-time>/report.md
// next to the raw evidence. Exit code 1 when any check fails.
//   npm run check
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';
import { chromium } from 'playwright';
import { loadEnv } from './load-env.mjs';

loadEnv();
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
const out = path.resolve('reports/checks', stamp);
fs.mkdirSync(out, { recursive: true });
const DIST = '.next-check', PORT = 3100, PROXY_PORT = 3101;
const base = `http://127.0.0.1:${PORT}`;
const started = Date.now();
const results = [];
const servers = [];
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const rel = (p) => path.relative(out, p) || '.';

let scratchEnvRef = {};
function runSync(cmd, args, { env = {}, logFile } = {}) {
  const r = spawnSync(cmd, args, { env: { ...process.env, ...scratchEnvRef, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const text = `$ ${cmd} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}`;
  if (logFile) fs.writeFileSync(path.join(out, logFile), text);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
async function step(name, fn) {
  const t0 = Date.now(); log(`-- ${name}`);
  try { const r = (await fn()) || {}; results.push({ name, pass: r.pass !== false, ms: Date.now() - t0, evidence: r.evidence || [], note: r.note || '' }); }
  catch (e) { results.push({ name, pass: false, ms: Date.now() - t0, evidence: [], note: `error: ${e.message}` }); }
  const r = results[results.length - 1]; log(`   ${r.pass ? 'PASS' : 'FAIL'} (${(r.ms / 1000).toFixed(1)} s) ${r.note}`);
}
const portFree = (port) => new Promise((res) => { const s = net.createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => s.close(() => res(true))); });
async function waitHttp(url, ms = 90000) { const t = Date.now(); while (Date.now() - t < ms) { try { const r = await fetch(url); if (r.status === 200) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 500)); } return false; }
function startServer(port, env, logFile) {
  const fd = fs.openSync(path.join(out, logFile), 'w');
  const p = spawn('npx', ['next', 'start', '-p', String(port)], { env: { ...process.env, ...scratchEnvRef, NEXT_DIST_DIR: DIST, ...env }, stdio: ['ignore', fd, fd] });
  servers.push(p); return p;
}
// preconditions
if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) { console.error('DATABASE_URL / SESSION_SECRET missing: run npm run setup'); process.exit(2); }
const WORK_URL = process.env.DATABASE_URL;
const workName = new URL(WORK_URL).pathname.slice(1);
const scratchName = `${workName}_check_${stamp.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
const scratchUrl = (() => { const u = new URL(WORK_URL); u.pathname = `/${scratchName}`; return u.toString(); })();
const adminUrl = (() => { const u = new URL(WORK_URL); u.pathname = '/postgres'; return u.toString(); })();
const CONTAINER = process.env.ROSES_DB_CONTAINER || 'roses-db';
const work = new pg.Client({ connectionString: WORK_URL });
try { await work.connect(); } catch (e) { console.error(`database not reachable: ${e.message} (npm run db:up)`); process.exit(2); }
const TABLES = ['venues', 'sections', 'items', 'item_sections', 'revisions', 'admins', 'pins', 'login_failures', 'admin_alerts', 'schema_migrations'];
async function snapshot(client) {
  const counts = {};
  for (const t of TABLES) counts[t] = Number((await client.query(`select count(*) from ${t}`)).rows[0].count);
  const rev = (await client.query('select max(id) as id, max(at) as at from revisions')).rows[0];
  return { counts, newestRevisionId: rev.id == null ? null : Number(rev.id), newestRevisionAt: rev.at };
}
const before = await snapshot(work);
log(`working database ${workName}: ${TABLES.map((t) => `${t} ${before.counts[t]}`).join(', ')}; newest revision id ${before.newestRevisionId}`);
// scratch copy: pg_dump of the working database restored into a new database
const dumpFile = path.join(out, 'working-db-copy.dump');
{
  const pgAdmin = new pg.Client({ connectionString: adminUrl }); await pgAdmin.connect();
  await pgAdmin.query(`create database "${scratchName}"`); await pgAdmin.end();
  const d = spawnSync('bash', ['-c', `docker exec ${CONTAINER} pg_dump -U roses -d ${workName} --format=custom --no-owner --no-privileges > "${dumpFile}" && docker exec -i ${CONTAINER} pg_restore -U roses -d ${scratchName} --no-owner --no-privileges --exit-on-error < "${dumpFile}"`], { encoding: 'utf8' });
  if (d.status !== 0) { console.error(`scratch copy failed: ${d.stderr}`); process.exit(2); }
  log(`scratch database ${scratchName} created from a pg_dump of ${workName} (${fs.statSync(dumpFile).size} bytes)`);
}
const db = new pg.Client({ connectionString: scratchUrl }); await db.connect();
const scratchEnv = { DATABASE_URL: scratchUrl, ROSES_DB: scratchName, BACKUP_DIR: out };
if (!fs.existsSync(chromium.executablePath())) { console.error('Playwright Chromium missing: npx playwright install chromium'); process.exit(2); }
for (const p of [PORT, PROXY_PORT]) if (!(await portFree(p))) { console.error(`port ${p} is in use; stop whatever listens there`); process.exit(2); }
if (!process.env.CHROME_PATH) { const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (!fs.existsSync(mac) && !spawnSync('which', ['google-chrome']).stdout?.length) process.env.CHROME_PATH = chromium.executablePath(); }

// temporary admin account for the drills (removed at the end; never written to any file)
const adminEmail = `check-suite-${randomBytes(4).toString('hex')}@localhost`, adminPassword = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const adminHash = `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(adminPassword.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
const adminPin = String(100000 + Math.floor(Math.random() * 900000));
const pinSalt = randomBytes(16);
const adminPinHash = ['$scrypt$N=16384,r=8,p=1', pinSalt.toString('base64'), scryptSync(adminPin, pinSalt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')].join('$');
const adminId = (await db.query('insert into admins (email, password_hash, pin_hash, name) values ($1,$2,$3,$4) returning id', [adminEmail, adminHash, adminPinHash, 'Check suite'])).rows[0].id;
const drillEnv = { DRILL_ADMIN_EMAIL: adminEmail, DRILL_ADMIN_PASSWORD: adminPassword, DRILL_ADMIN_PIN: adminPin };
scratchEnvRef = scratchEnv;
const commit = runSync('git', ['rev-parse', '--short', 'HEAD']).stdout.trim();

try {
  await step('production build (.next-check)', () => { const r = runSync('npx', ['next', 'build'], { env: { NEXT_DIST_DIR: DIST }, logFile: 'build.log' }); return { pass: r.status === 0, evidence: ['build.log'], note: r.status === 0 ? 'next build ok' : `exit ${r.status}` }; });
  if (!results.at(-1).pass) throw new Error('build failed; stopping');

  await step(`servers on ${PORT} and ${PROXY_PORT} (TRUST_PROXY=1)`, async () => {
    startServer(PORT, {}, 'server-3100.log'); startServer(PROXY_PORT, { TRUST_PROXY: '1' }, 'server-3101.log');
    const ok = (await waitHttp(`${base}/senso`)) && (await waitHttp(`http://127.0.0.1:${PROXY_PORT}/senso`));
    return { pass: ok, evidence: ['server-3100.log', 'server-3101.log'], note: ok ? 'both answer 200 on /senso' : 'a server did not come up' };
  });
  if (!results.at(-1).pass) throw new Error('servers failed; stopping');

  for (const venue of ['senso', 'kebab-land']) {
    const vout = path.join(out, venue); fs.mkdirSync(vout, { recursive: true });
    await step(`public page checks: ${venue} (intro, repeat visit, reduced motion, Persian toggle, images)`, () => {
      const r = runSync('node', ['scripts/check-page.mjs', venue, '--base', base, '--out', vout, '--jpeg'], { logFile: `${venue}/check-page.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, `${venue}-checks.json`), 'utf8')).checks;
      return { pass: r.status === 0, evidence: [`${venue}/${venue}-checks.json`, `${venue}/${venue}-en.jpg`, `${venue}/${venue}-fa.jpg`, `${venue}/check-page.log`], note: `toggle dir=${j.persianToggle.dir}, Persian headings ${j.persianToggle.visibleFaHeadings}; intro gone at ${j.firstVisit.introDoneAtMs} ms; images ${j.images.loaded}/${j.images.total}` };
    });
  }
  await step('brand words in both built pages', () => {
    const r = runSync('node', ['scripts/check-brand-words.mjs', `${DIST}/server/pages/senso.html`, `${DIST}/server/pages/kebab-land.html`], { logFile: 'brand-words.txt' });
    return { pass: r.status === 0, evidence: ['brand-words.txt'], note: r.status === 0 ? 'no "Mealsy" or "Flo" in visible text or metadata' : 'see brand-words.txt' };
  });
  for (const venue of ['senso', 'kebab-land']) {
    await step(`photo links: ${venue}`, () => {
      const vout = path.join(out, venue);
      const r = runSync('node', ['scripts/check-photo-links.mjs', venue, '--out', vout], { logFile: `${venue}/photo-links.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, 'photo-links.json'), 'utf8'));
      const rows = j.results || j.targets || j;
      const bad = (Array.isArray(rows) ? rows : []).filter((x) => ![200, 206].includes(x.status));
      return { pass: r.status === 0 && bad.length === 0, evidence: [`${venue}/photo-links.md`, `${venue}/photo-links.json`], note: `${Array.isArray(rows) ? rows.length : '?'} URLs, ${bad.length} not 200/206` };
    });
  }
  for (const venue of ['senso', 'kebab-land']) {
    await step(`Lighthouse mobile ×3: ${venue}`, () => {
      const vout = path.join(out, venue);
      const r = runSync('node', ['scripts/check-lighthouse.mjs', `${base}/${venue}`, '--runs', '3', '--out', vout], { logFile: `${venue}/lighthouse.log` });
      const s = JSON.parse(fs.readFileSync(path.join(vout, 'lighthouse-summary.json'), 'utf8'));
      const worst = Math.max(...s.runs.map((x) => x.lcpMs));
      return { pass: r.status === 0 && s.runs.length === 3 && worst <= 2500, evidence: [`${venue}/lighthouse-summary.json`, `${venue}/lighthouse.log`], note: `LCP ${s.runs.map((x) => x.lcpMs).join(' / ')} ms, performance ${s.runs.map((x) => x.performance).join(' / ')} (target ≤ 2500, local estimate)` };
    });
  }
  await step('admin drill (sign-ins, cookie, PINs, listing rule, sections, notes, edits + restore, delete + restore, venue details)', () => {
    const r = runSync('node', ['scripts/admin-drill.mjs', '--base', base, '--out', path.join(out, 'admin'), '--jpeg'], { env: drillEnv, logFile: 'admin/admin-drill.log' });
    const m = (r.stdout.match(/ADMIN DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || []);
    return { pass: r.status === 0, evidence: ['admin/admin-drill.txt', 'admin/admin-drill.json', 'admin/*.jpg'], note: m[0] || `exit ${r.status}` };
  });
  await step('lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN', () => {
    const r = runSync('node', ['scripts/lockout-drill.mjs', '--base4', base, '--base6', `http://[::1]:${PORT}`, '--proxyBase', `http://127.0.0.1:${PROXY_PORT}`, '--out', out], { env: drillEnv, logFile: 'lockout-drill.log' });
    return { pass: r.status === 0, evidence: ['lockout-drill.txt'], note: (r.stdout.match(/LOCKOUT DRILL (PASS|FAIL)/) || [])[0] || `exit ${r.status}` };
  });
  await step('revalidation: admin save reaches the public page within 10 s', () => {
    const r = runSync('node', ['scripts/revalidation-drill.mjs', '--base', base, '--venue', 'senso', '--item', 'Turkish Coffee', '--out', out], { env: drillEnv, logFile: 'revalidation-drill.log' });
    const m = r.stdout.match(/visible on the public page (\d+) ms after Save/);
    return { pass: r.status === 0, evidence: ['revalidation-log.txt'], note: m ? `${m[1]} ms after Save` : `exit ${r.status}` };
  });
  await step('backup and restore drill (pg_dump, scratch restore, equal counts, item recovered)', () => {
    const r = runSync('bash', ['scripts/backup-drill.sh', path.join(out, 'backup-drill.txt')], { logFile: 'backup-drill.log' }); // drills the scratch copy (ROSES_DB), dump into the run folder
    const t = fs.existsSync(path.join(out, 'backup-drill.txt')) ? fs.readFileSync(path.join(out, 'backup-drill.txt'), 'utf8') : '';
    const equal = (t.match(/ equal$/gm) || []).length, different = (t.match(/DIFFERENT/g) || []).length, recovered = /after recovery: items with that id = 1, placements = 1/.test(t);
    return { pass: r.status === 0 && different === 0 && recovered, evidence: ['backup-drill.txt'], note: `${equal} table comparisons equal, ${different} different; item recovered: ${recovered}` };
  });
} catch (e) {
  log(`suite stopped: ${e.message}`);
} finally {
  for (const p of servers) { try { p.kill('SIGTERM'); } catch { /* gone */ } }
  await db.end().catch(() => {});
  // drop the scratch copy (and the backup drill's scratch, if a failure left it behind)
  try {
    const pgAdmin = new pg.Client({ connectionString: adminUrl }); await pgAdmin.connect();
    for (const name of [scratchName, `${scratchName}_restore_test`]) {
      await pgAdmin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [name]);
      await pgAdmin.query(`drop database if exists "${name}"`);
    }
    await pgAdmin.end();
    log(`scratch database ${scratchName} dropped`);
  } catch (e) { log(`could not drop the scratch database: ${e.message}`); }
  const after = await snapshot(work).catch((e) => ({ error: e.message }));
  await work.end().catch(() => {});
  const same = !after.error && JSON.stringify(after) === JSON.stringify(before);
  fs.writeFileSync(path.join(out, 'working-db-before-after.json'), JSON.stringify({ database: workName, before, after, identical: same }, null, 2));
  results.push({ name: `working database untouched (${workName}: per-table counts and newest revision id identical before and after)`, pass: same, ms: 0, evidence: ['working-db-before-after.json', 'working-db-copy.dump (gitignored)'], note: same ? `${TABLES.map((t) => `${t} ${before.counts[t]}`).join(', ')}; newest revision id ${before.newestRevisionId}` : `before ${JSON.stringify(before)} after ${JSON.stringify(after)}` });
  log(`   ${same ? 'PASS' : 'FAIL'} working database untouched`);
}

const pass = results.length > 0 && results.every((r) => r.pass);
const lines = [
  `# Check suite — ${stamp.replace('T', ' ').replace(/-(\d\d)-(\d\d)Z$/, ':$1:$2Z')}`, '',
  `Commit ${commit} · Node ${process.version} · Next ${JSON.parse(fs.readFileSync('node_modules/next/package.json', 'utf8')).version} · build dir ${DIST} · servers ${PORT} and ${PROXY_PORT} · database: scratch copy ${scratchName} of ${workName}, dropped at the end · total ${((Date.now() - started) / 1000).toFixed(0)} s`, '',
  `**${pass ? 'PASS' : 'FAIL'}** — ${results.filter((r) => r.pass).length} of ${results.length} checks passed.`, '',
  '| Check | Result | Time | Evidence | Notes |', '| --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)} s | ${r.evidence.map((e) => `\`${e}\``).join(', ')} | ${r.note.replace(/\|/g, '\\|')} |`), '',
  'Every path is relative to this folder. Screenshots, full Lighthouse JSON, the first HTML responses and the dumps stay on the machine that ran the suite (gitignored); report.md, summary.json, the check JSON files and the text logs are committed. Every drill ran against the scratch copy of the working database, which was dropped afterwards; the working database itself was only read (counts before and after, last row). Lighthouse numbers are local estimates.', '',
];
fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n'));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ stamp, commit, pass, results }, null, 2));
console.log('\n' + lines.slice(4).join('\n'));
console.log(`\nreport: ${path.relative(process.cwd(), path.join(out, 'report.md'))}`);
console.log(`CHECK SUITE ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
