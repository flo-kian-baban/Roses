#!/usr/bin/env node
// One-command acceptance suite. Never touches the working database: it copies it (pg_dump → scratch database),
// applies pending migrations to the copy, points the build, the servers and every drill at the copy (and their uploads
// at the run folder), and drops the copy at the end. Isolation is proven, not counted (PM, 2026-10-08): (a) every server
// and drill process names itself to Postgres and logs the database it connected to, and pg_stat_activity is sampled
// throughout the run: any suite process on the working database fails the run; (b) the working database holds no row
// written by a suite account (the temporary check admin, the drill PINs, drill items or sections). Kian using the app
// during a run cannot break either check. Builds into .next-check (the running server and .next are untouched),
// starts two servers on free ports (the second with TRUST_PROXY=1 for the venue-cap test), creates a temporary admin account in the
// copy, runs every check, and writes reports/checks/<date-time>/report.md next to the raw evidence. Exit code 1 when
// any check fails; a failed run's folder is kept (its report carries a one-line cause), never deleted.
//   npm run check
// 2026-10-08: the colour-literal scan (0 in the public sources) and the Style tab drill (scripts/style-drill.mjs) joined the suite.
// 2026-10-09: the welcome screen replaced the logo intro: the page checks follow it instead (first visit, reload with the last language
// pre-highlighted, reduced motion still, JavaScript off) and the welcome drill (scripts/welcome-drill.mjs) covers the boundaries, the
// scene, the tap, the kill switch and the budgets; Lighthouse also requires TBT ≤ 50 ms. The PM's correction of the same day: Lighthouse's
// LCP now measures the welcome screen (its logo is the largest paint), so the after-tap drill (scripts/after-tap-drill.mjs) measures the
// (2026-10-09, later: the season drill (scripts/season-drill.mjs) proves the render-time season and the hourly regeneration on a copy of the build.)
// menu after the language tap under throttled mobile conditions, with a 2.5 s target reported as measured.
// 2026-10-09, later: the preview control bar (scripts/preview-drill.mjs: the task target on the iPhone 13 viewport with its tap count, every
// switch within 300 ms, the screen per tab and kept through a save) and, in the Style drill, groups → screens, Compare, What changed with
// the per-colour reset through the guard, Discard this session's changes with Undo, position kept through a save, the phone's bottom sheet.
// The PM's review of 2026-10-09: (1) known misses: reports/checks/known-misses.json lists checks known to miss their target, each with its
// cause and what clears it; a listed check is still measured and printed, marked KNOWN MISS; the run fails only on a failure that is not
// listed; a listed check that passes is reported as NOW PASSING. The file decides PASS, so the suite refuses to start while it has
// uncommitted changes, like the code. (2) Ports: picked free at start (none fixed), recorded in report.md; before any check uses a server
// the suite proves the port's listener is the process it spawned (lsof), and it only ever stops the servers it started.
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
fs.mkdirSync(path.join(out, 'editor'), { recursive: true }); fs.mkdirSync(path.join(out, 'style'), { recursive: true }); fs.mkdirSync(path.join(out, 'preview'), { recursive: true }); fs.mkdirSync(path.join(out, 'welcome'), { recursive: true }); fs.mkdirSync(path.join(out, 'season'), { recursive: true }); fs.mkdirSync(path.join(out, 'after-tap'), { recursive: true });
const DIST = '.next-check';
// Free ports, picked at start (the PM, 2026-10-09; 3100 had been taken by another project's server): the system hands out a free port for
// each of the suite's three servers, and each is checked free on 127.0.0.1 and ::1 (the lockout drill reaches the server over IPv6).
const portFree = (port, host = '127.0.0.1') => new Promise((res) => { const s = net.createServer(); s.once('error', (e) => res(e.code !== 'EADDRINUSE')); s.listen(port, host, () => s.close(() => res(true))); });
async function freePort(avoid) {
  for (let i = 0; i < 50; i++) {
    const p = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
    if (!avoid.includes(p) && (await portFree(p, '127.0.0.1')) && (await portFree(p, '::1'))) return p;
  }
  throw new Error('no free port found');
}
const PORT = await freePort([]), PROXY_PORT = await freePort([PORT]), SEASON_PORT = await freePort([PORT, PROXY_PORT]);
const base = `http://127.0.0.1:${PORT}`;
// Known misses (the PM, 2026-10-09).
const KNOWN_FILE = 'reports/checks/known-misses.json';
let known;
try {
  known = JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')).misses;
  const bad = known.filter((k) => !k.id || !k.title || !k.step || !Array.isArray(k.checks) || !k.checks.length || !k.cause || !k.clears);
  if (bad.length) throw new Error(`entries without id, title, step, checks, cause or clears: ${bad.map((k) => k.id || '?').join(', ')}`);
} catch (e) { console.error(`${KNOWN_FILE}: ${e.message}`); process.exit(2); }
const started = Date.now();
const results = [];
const servers = [];
const SERVER_APPS = { [PORT]: `roses-check:server-${PORT}`, [PROXY_PORT]: `roses-check:server-${PROXY_PORT}` };
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const rel = (p) => path.relative(out, p) || '.';

let scratchEnvRef = {};
// Child processes run asynchronously so the pg_stat_activity sampler below keeps observing while a drill runs.
function run(cmd, args, { env = {}, logFile } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...scratchEnvRef, ...env } });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => { stdout += d; }); p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (status) => {
      if (logFile) fs.writeFileSync(path.join(out, logFile), `$ ${cmd} ${args.join(' ')}\n${stdout}${stderr}`);
      resolve({ status, stdout, stderr });
    });
  });
}
// A step's outcome is PASS, FAIL or KNOWN MISS. A step that runs a drill hands over the drill's own checks ({ id, ok, text }, from its JSON,
// only when the drill finished); a failed step is a KNOWN MISS when every failing check of it is listed in known-misses.json for that step.
// A listed check that passes makes its entry NOW PASSING (reported, never hidden); a listed check the drill did not measure fails the step.
async function step(name, fn, id = null) {
  const t0 = Date.now(); log(`-- ${name}`);
  let r;
  try { r = (await fn()) || {}; } catch (e) { r = { pass: false, note: `error: ${e.message}` }; }
  const res = { id, name, pass: r.pass !== false, outcome: r.pass !== false ? 'PASS' : 'FAIL', ms: Date.now() - t0, evidence: r.evidence || [], note: r.note || '' };
  const listed = known.filter((k) => k.step === id);
  if (listed.length) {
    const checks = r.checks || null;
    for (const k of listed) {
      const got = k.checks.map((c) => { const x = checks?.find((y) => y.id === c); return x ? { id: c, ok: x.ok, text: x.text } : { id: c, ok: null, text: 'not measured' }; });
      k.run = { checks: got, status: got.some((c) => c.ok === null) ? 'NOT MEASURED' : got.every((c) => c.ok) ? 'NOW PASSING' : 'KNOWN MISS' };
    }
    const listedIds = new Set(listed.flatMap((k) => k.checks));
    res.unlisted = checks ? checks.filter((c) => !c.ok && !listedIds.has(c.id)).map((c) => c.id) : null;
    const notMeasured = listed.filter((k) => k.run.status === 'NOT MEASURED');
    if (notMeasured.length) { res.outcome = 'FAIL'; res.pass = false; res.note = `listed known miss not measured (${notMeasured.map((k) => `${k.id}: ${k.run.checks.filter((c) => c.ok === null).map((c) => c.id).join(', ')}`).join('; ')}); ${res.note}`; }
    else if (!res.pass && res.unlisted && res.unlisted.length === 0 && listed.some((k) => k.run.status === 'KNOWN MISS')) res.outcome = 'KNOWN MISS';
    else if (!res.pass && res.unlisted?.length) res.note = `failing and not listed as known misses: ${res.unlisted.join(', ')}; ${res.note}`;
  }
  results.push(res);
  log(`   ${res.outcome} (${(res.ms / 1000).toFixed(1)} s) ${res.note}`);
  for (const k of listed) log(`   known miss "${k.title}": ${k.run.status}`);
}
// a drill's own checks, from the JSON it writes at its end (null when it did not finish: then no failure of it can be a known miss)
const drillChecks = (file, finished) => { const f = path.join(out, file); if (!finished || !fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')).results.map((x) => ({ id: x.step, ok: x.ok, text: x.text })); } catch { return null; } };
// The suite's servers are its own: a port's listener must be the process it spawned (lsof), or nothing runs against it.
const listeners = (port) => spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map(Number);
async function waitHttp(url, ms = 90000) { const t = Date.now(); while (Date.now() - t < ms) { try { const r = await fetch(url); if (r.status === 200) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 500)); } return false; }
function startServer(port, env, logFile) {
  const fd = fs.openSync(path.join(out, logFile), 'w');
  const p = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { env: { ...process.env, ...scratchEnvRef, NEXT_DIST_DIR: DIST, ROSES_APP_NAME: SERVER_APPS[port], ...env }, stdio: ['ignore', fd, fd] }); // node itself (not npx), so the listener's pid is the spawned process's
  p.port = port; servers.push(p); return p;
}
// preconditions
// Evidence only from committed code (PM, 2026-10-08): the suite refuses to start when the working tree has uncommitted
// changes outside reports/checks, so every report names the exact commit it tested. Flow: commit the code, run the suite, commit the report.
{
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const outside = status.filter((l) => { const p = l.slice(3).split(' -> ').pop(); return !p.startsWith('reports/checks/') || p === 'reports/checks/known-misses.json'; }); // the known-miss list decides PASS: committed, like the code
  if (outside.length) {
    console.error('npm run check runs on committed code only (PM, 2026-10-08). Uncommitted changes outside reports/checks (reports/checks/known-misses.json included):');
    console.error(spawnSync('git', ['status', '--short'], { encoding: 'utf8' }).stdout.trimEnd());
    console.error('Commit (or stash) them, then run the suite again; commit the report afterwards.');
    process.exit(2);
  }
}
if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) { console.error('DATABASE_URL / SESSION_SECRET missing: run npm run setup'); process.exit(2); }
const WORK_URL = process.env.DATABASE_URL;
const workName = new URL(WORK_URL).pathname.slice(1);
const scratchName = `${workName}_check_${stamp.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
const scratchUrl = (() => { const u = new URL(WORK_URL); u.pathname = `/${scratchName}`; return u.toString(); })();
const adminUrl = (() => { const u = new URL(WORK_URL); u.pathname = '/postgres'; return u.toString(); })();
const CONTAINER = process.env.ROSES_DB_CONTAINER || 'roses-db';
const work = new pg.Client({ connectionString: WORK_URL, application_name: 'roses-check:suite-readonly' }); // reads only: the dump and check (b)
try { await work.connect(); } catch (e) { console.error(`database not reachable: ${e.message} (npm run db:up)`); process.exit(2); }
log(`working database ${workName} (read only from here: copied, then checked for suite-account rows at the end)`);
// scratch copy: pg_dump of the working database restored into a new database
const dumpFile = path.join(out, 'working-db-copy.dump');
{
  const pgAdmin = new pg.Client({ connectionString: adminUrl }); await pgAdmin.connect();
  await pgAdmin.query(`create database "${scratchName}"`); await pgAdmin.end();
  const d = spawnSync('bash', ['-c', `docker exec ${CONTAINER} pg_dump -U roses -d ${workName} --format=custom --no-owner --no-privileges > "${dumpFile}" && docker exec -i ${CONTAINER} pg_restore -U roses -d ${scratchName} --no-owner --no-privileges --exit-on-error < "${dumpFile}"`], { encoding: 'utf8' });
  if (d.status !== 0) { console.error(`scratch copy failed: ${d.stderr}`); process.exit(2); }
  log(`scratch database ${scratchName} created from a pg_dump of ${workName} (${fs.statSync(dumpFile).size} bytes)`);
}
const db = new pg.Client({ connectionString: scratchUrl, application_name: 'roses-check:suite' }); await db.connect();
const scratchEnv = { DATABASE_URL: scratchUrl, ROSES_DB: scratchName, BACKUP_DIR: out, UPLOAD_DIR: path.join(out, 'uploads') };
// Isolation (a), database side: who is connected where, sampled through the whole run (every suite process names itself roses-check:*).
const seen = new Map(); // "application → database" → count of samples
const sampler = setInterval(async () => {
  try { for (const r of (await db.query(`select application_name as app, datname as db from pg_stat_activity where application_name like 'roses-check:%'`)).rows) seen.set(`${r.app} → ${r.db}`, (seen.get(`${r.app} → ${r.db}`) || 0) + 1); } catch { /* between queries */ }
}, 400);
if (!fs.existsSync(chromium.executablePath())) { console.error('Playwright Chromium missing: npx playwright install chromium'); process.exit(2); }
log(`ports picked free at start: ${PORT} (server), ${PROXY_PORT} (server with TRUST_PROXY=1), ${SEASON_PORT} (the season drill's server)`);
if (!process.env.CHROME_PATH) { const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (!fs.existsSync(mac) && !spawnSync('which', ['google-chrome']).stdout?.length) process.env.CHROME_PATH = chromium.executablePath(); }

// temporary admin account for the drills (removed at the end; never written to any file)
const adminEmail = `check-suite-${randomBytes(4).toString('hex')}@localhost`, adminPassword = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const adminHash = `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(adminPassword.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
const adminPin = String(100000 + Math.floor(Math.random() * 900000));
const pinSalt = randomBytes(16);
const adminPinHash = ['$scrypt$N=16384,r=8,p=1', pinSalt.toString('base64'), scryptSync(adminPin, pinSalt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')].join('$');
const SUITE_ADMIN_NAME = 'Check suite', DRILL_PIN_NAMES = ['Drill staff', 'Drill owner', 'Lockout drill (valid PIN)', 'Lockout drill (to be revoked)'];
const DRILL_ROW_NAMES = ['Drill editor item', 'Drill preview item', 'Drill section', 'Drill section item 1', 'Drill section item 2', 'Drill venue', 'Drill default venue'];
let newVenueId = null;
scratchEnvRef = scratchEnv;
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
let adminId = null;
const drillEnv = { DRILL_ADMIN_EMAIL: adminEmail, DRILL_ADMIN_PASSWORD: adminPassword, DRILL_ADMIN_PIN: adminPin };

try {
  await step(`migrations on the scratch copy (${scratchName})`, async () => { const r = await run('node', ['scripts/db-migrate.mjs'], { env: { ROSES_APP_NAME: 'roses-check:migrate' }, logFile: 'migrate.log' }); return { pass: r.status === 0, evidence: ['migrate.log'], note: (r.stdout.match(/\d+ migration\(s\) applied, \d+ already present/) || [`exit ${r.status}`])[0] }; }, 'migrations');
  if (!results.at(-1).pass) throw new Error('migrations failed; stopping');
  adminId = (await db.query('insert into admins (email, password_hash, pin_hash, name) values ($1,$2,$3,$4) returning id', [adminEmail, adminHash, adminPinHash, SUITE_ADMIN_NAME])).rows[0].id;
  await step('production build (.next-check)', async () => { const r = await run('npx', ['next', 'build'], { env: { NEXT_DIST_DIR: DIST, ROSES_APP_NAME: 'roses-check:build' }, logFile: 'build.log' }); return { pass: r.status === 0, evidence: ['build.log'], note: r.status === 0 ? 'next build ok' : `exit ${r.status}` }; }, 'build');
  if (!results.at(-1).pass) throw new Error('build failed; stopping');
  await step('colour literals in the public templates, the menu kit and the public stylesheet (Kian, 2026-10-08: 0 outside src/venues/tokens.ts)', async () => {
    const r = await run('node', ['scripts/check-colour-literals.mjs', '--json', path.join(out, 'colour-literals.json')], { logFile: 'colour-literals.txt' });
    const j = fs.existsSync(path.join(out, 'colour-literals.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'colour-literals.json'), 'utf8')) : null;
    return { pass: r.status === 0 && j?.count === 0, evidence: ['colour-literals.txt', 'colour-literals.json'], note: j ? `${j.count} colour literal(s) in ${j.files.length} public files; ${j.tokensFileHexLiterals} hex values live in the token defaults file` : `exit ${r.status}` };
  }, 'colour-literals');

  await step(`servers on ${PORT} and ${PROXY_PORT} (TRUST_PROXY=1), ports picked free at start, each port's listener the process the suite spawned`, async () => {
    for (const p of [PORT, PROXY_PORT]) if (!(await portFree(p, '127.0.0.1')) || !(await portFree(p, '::1'))) return { pass: false, note: `port ${p} was taken after it was picked; whatever listens there is left alone` };
    const a = startServer(PORT, {}, `server-${PORT}.log`), b = startServer(PROXY_PORT, { TRUST_PROXY: '1' }, `server-${PROXY_PORT}.log`);
    const up = (await waitHttp(`${base}/senso`)) && (await waitHttp(`http://127.0.0.1:${PROXY_PORT}/senso`));
    const own = [a, b].map((p) => ({ port: p.port, pid: p.pid, alive: p.exitCode === null, listeners: listeners(p.port) }));
    const mine = own.every((o) => o.alive && o.listeners.length > 0 && o.listeners.every((x) => x === o.pid));
    fs.writeFileSync(path.join(out, 'ports.json'), JSON.stringify({ picked: { server: PORT, proxyServer: PROXY_PORT, seasonServer: SEASON_PORT }, servers: own, pass: up && mine }, null, 2));
    return { pass: up && mine, evidence: [`server-${PORT}.log`, `server-${PROXY_PORT}.log`, 'ports.json'], note: `${up ? 'both answer 200 on /senso' : 'a server did not come up'}; ${own.map((o) => `port ${o.port}: listener pid ${o.listeners.join(',') || 'none'}, spawned pid ${o.pid}${o.alive ? '' : ' (exited)'}`).join('; ')}${mine ? ': the suite\'s own processes' : ': NOT the suite\'s own process, so no check ran against it'}` };
  }, 'servers');
  if (!results.at(-1).pass) throw new Error('servers failed; stopping');

  // Temporary venue on the default template (PM, 2026-10-08): created through the API in the scratch copy, checked like the two brand pages, removed at the end.
  const nvout = path.join(out, 'new-venue'); fs.mkdirSync(nvout, { recursive: true });
  await step('temporary venue on the default template (created through the admin API: logo upload, tagline, location, 2 sections, 4 items)', async () => {
    const r = await run('node', ['scripts/new-venue-drill.mjs', '--base', base, '--out', nvout], { env: drillEnv, logFile: 'new-venue/new-venue-drill.log' });
    newVenueId = (r.stdout.match(/^NEW VENUE (\S+)$/m) || [])[1] || null;
    const j = fs.existsSync(path.join(nvout, 'new-venue.json')) ? JSON.parse(fs.readFileSync(path.join(nvout, 'new-venue.json'), 'utf8')) : null;
    return { pass: r.status === 0 && !!newVenueId, evidence: ['new-venue/new-venue.json', 'new-venue/new-venue-drill.txt'], note: j ? `/${j.id}: ${j.sections} sections, ${j.items} shown items, logo ${j.logo.url.replace(/^\/uploads\//, 'uploads/')}, GET → ${j.status}` : `exit ${r.status}` };
  }, 'temp-venue');
  const pageVenues = ['senso', 'kebab-land', ...(newVenueId ? [newVenueId] : [])];
  const label = (v) => (v === newVenueId ? `${v} (temporary venue, default template)` : v);

  for (const venue of pageVenues) {
    const vout = path.join(out, venue); fs.mkdirSync(vout, { recursive: true });
    await step(`public page checks: ${label(venue)} (welcome screen on the first visit and on a reload with the last language pre-highlighted, tap ≤ 300 ms, reduced motion still, JavaScript off, Persian toggle, images, category tabs, top after a reload)`, async () => {
      const r = await run('node', ['scripts/check-page.mjs', venue, '--base', base, '--out', vout, '--jpeg'], { logFile: `${venue}/check-page.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, `${venue}-checks.json`), 'utf8')).checks;
      const fv = j.firstVisit, rv = j.repeatVisit, rm = j.reducedMotion;
      return { pass: r.status === 0, evidence: [`${venue}/${venue}-checks.json`, `${venue}/${venue}-en.jpg`, `${venue}/${venue}-fa.jpg`, `${venue}/check-page.log`], note: `toggle dir=${j.persianToggle.dir}, Persian headings ${j.persianToggle.visibleFaHeadings}; welcome screen up at the first sample (${fv.upAtFirstSampleMs} ms, greeting "${fv.greet}" in both languages, ${fv.season} scene with ${fv.particles} particles, nothing pre-highlighted: ${fv.noPreHighlight}; logo at ${fv.entrance.logoShownAtMs} ms, greeting at ${fv.entrance.greetingEnAtMs} / ${fv.entrance.greetingFaAtMs} ms, buttons at ${fv.entrance.buttonsAtMs} ms), tap English → menu visible in ${fv.tap.ms} ms (stored ${JSON.stringify(fv.tap.storedKeys)}); shows again on reload with ${JSON.stringify(rv.pressed)} pre-highlighted (stored keys ${JSON.stringify(rv.storedKeys)}); reduced motion: shown still with ${rm.running} animations running, page visible at once ${rm.pageVisibleAtOnce}, off in ${rm.tap.ms} ms; JavaScript off: overlay display ${j.javascriptOff.display ?? j.javascriptOff.overlayVisible}, menu visible ${j.javascriptOff.rowVisible}; images ${j.images.loaded}/${j.images.total}; tabs: ${j.tabs.summary.onTappedTab}/${j.tabs.summary.count} taps end on their tab at the bar with ${j.tabs.summary.othersLit} other tabs lit on the way, ${j.tabs.scroll.down.mismatches + j.tabs.scroll.up.mismatches}/${j.tabs.scroll.down.samples + j.tabs.scroll.up.samples} scroll steps off, last tab at the bottom ${j.tabs.scroll.lastTabActiveAtBottom}, direct link ${j.tabs.directLink.ok}; after a reload: ${j.topAfterReload.afterReload.y} px from the top, hash "${j.topAfterReload.afterReload.hash}" (was ${j.topAfterReload.beforeReload.y} px, "${j.topAfterReload.beforeReload.hash}")` };
    }, `page-${venue === newVenueId ? 'temp-venue' : venue}`);
  }
  await step(`brand words in the built pages${newVenueId ? ' and the temporary venue\'s page' : ''}`, async () => {
    const files = [`${DIST}/server/pages/senso.html`, `${DIST}/server/pages/kebab-land.html`];
    if (newVenueId && fs.existsSync(path.join(out, newVenueId, `${newVenueId}-first-response.html`))) files.push(path.join(out, newVenueId, `${newVenueId}-first-response.html`)); // the dynamic page as served (check-page saved it)
    const r = await run('node', ['scripts/check-brand-words.mjs', ...files], { logFile: 'brand-words.txt' });
    return { pass: r.status === 0 && files.length === (newVenueId ? 3 : 2), evidence: ['brand-words.txt'], note: r.status === 0 ? `no "Mealsy" or "Flo" in visible text or metadata (${files.length} pages)` : 'see brand-words.txt' };
  }, 'brand-words');
  if (newVenueId) await step(`no runtime JavaScript: ${label(newVenueId)}`, async () => {
    const f = path.join(out, newVenueId, `${newVenueId}-first-response.html`);
    if (!fs.existsSync(f)) return { pass: false, note: 'no saved first response' };
    const html = fs.readFileSync(f, 'utf8');
    const tags = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
    const external = tags.filter((t) => /\bsrc=/.test(t)).length, chunks = (html.match(/\/_next\/static\/chunks\/[^"'\s>]+\.js\b/g) || []).length, preloads = (html.match(/<link[^>]+rel="(?:modulepreload|preload)"[^>]+as="script"/g) || []).length; // the stylesheet lives under /_next/static/chunks too and is allowed
    const ok = external === 0 && chunks === 0 && preloads === 0 && tags.length === 4 && html.includes('default-price');
    fs.writeFileSync(path.join(out, newVenueId, 'no-runtime-js.json'), JSON.stringify({ file: path.basename(f), scriptTags: tags, external, nextChunkReferences: chunks, scriptPreloads: preloads, defaultTemplate: html.includes('default-price'), pass: ok }, null, 2));
    return { pass: ok, evidence: [`${newVenueId}/no-runtime-js.json`], note: `${tags.length} inline script tags (head decision, welcome screen, language toggle, menu), ${external} external, ${chunks} JavaScript chunk references, ${preloads} script preloads; default template: ${html.includes('default-price')}` };
  }, 'no-runtime-js');
  for (const venue of ['senso', 'kebab-land']) {
    await step(`photo links: ${venue}`, async () => {
      const vout = path.join(out, venue);
      const r = await run('node', ['scripts/check-photo-links.mjs', venue, '--out', vout, '--base', base], { logFile: `${venue}/photo-links.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, 'photo-links.json'), 'utf8'));
      const rows = j.results || j.targets || j;
      const bad = (Array.isArray(rows) ? rows : []).filter((x) => ![200, 206].includes(x.status));
      return { pass: r.status === 0 && bad.length === 0, evidence: [`${venue}/photo-links.md`, `${venue}/photo-links.json`], note: `${Array.isArray(rows) ? rows.length : '?'} URLs, ${bad.length} not 200/206` };
    }, `photo-links-${venue}`);
  }
  // The welcome screen (Kian, 2026-10-09): the clock and date boundaries, the scene and its budget, the tap, the kill switch, recordings.
  await step('welcome screen drill (greeting boundaries with a mocked clock, the page\'s season scene ≤ 20 particles on transform and opacity, reduced motion still, tap → menu ≤ 300 ms with the language persisted and pre-highlighted, section anchor, keyboard and labels, JavaScript off, kill switch, default contrast, inline code ≤ 15 KB gzipped on senso with the picked artwork and ≤ 10 KB on kebab-land)', async () => {
    const r = await run('node', ['scripts/welcome-drill.mjs', '--base', base, '--out', path.join(out, 'welcome'), '--jpeg'], { env: drillEnv, logFile: 'welcome/welcome-drill.log' });
    const m = (r.stdout.match(/WELCOME DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('welcome/welcome-drill.json', !!(m && m.length)), evidence: ['welcome/welcome-drill.txt', 'welcome/welcome-drill.json', 'welcome/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'welcome');
  // Season at render time and hourly regeneration (the PM, 2026-10-09): on a copy of the build with its own server and a fixed clock.
  await step('season drill (current season only: render tests at the Toronto boundary instants Aug 31 / Sep 1, Nov 30 / Dec 1, Feb 28 / Mar 1, May 31 / Jun 1 on a copy of the build with a fixed server clock, two renders an hour apart with the cached page aged 3601 s and a control within the hour, revalidate 3600 in the manifest; senso\'s picked artwork: 20 particles at most 2 near present and mid-flight on the first sample, smoothness on the iPhone 13 viewport with CPU 4× (median ≥ 50 fps, no long task > 50 ms), two loads differ, reduced-motion still, inline size per season, recordings; kebab-land and the default template: the served scene of every season and its symbols byte for byte as in the fixture from the previous commit, the motion rules verbatim; one still per season per venue; the guard: a server started with ROSES_NOW alone renders the real current season, with the suite\'s flag ROSES_CHECK_SUITE=1 the forged one)', async () => {
    const r = await run('node', ['scripts/season-drill.mjs', '--dist', DIST, '--copy', '.next-season', '--port', String(SEASON_PORT), '--out', path.join(out, 'season'), '--venues', pageVenues.join(','), '--jpeg'], { logFile: 'season/season-drill.log' });
    const m = (r.stdout.match(/SEASON DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('season/season-drill.json', !!(m && m.length)), evidence: ['season/season-drill.txt', 'season/season-drill.json', 'season/season-server.log', 'season/*.jpg', 'season/senso-fall.webm and senso-winter.webm (on disk only)'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'season');
  // The menu after the tap (the PM, 2026-10-09): the overlay covers the menu, so Lighthouse's LCP measures the welcome screen; what the
  // customer waits for after the language tap is measured here, under throttled mobile conditions, and reported as measured.
  await step('menu after the language tap under throttled mobile conditions (Slow 4G as DevTools applies it, CPU 4×): the first section visible and, as a separate check, its photos in view loaded within 2.5 s of the tap, on senso with its first section as a List and as a Grid and on kebab-land; the eager rule (the first row only); first-section photo bytes', async () => {
    const r = await run('node', ['scripts/after-tap-drill.mjs', '--base', base, '--out', path.join(out, 'after-tap')], { env: drillEnv, logFile: 'after-tap/after-tap-drill.log' });
    const m = (r.stdout.match(/AFTER-TAP DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('after-tap/after-tap.json', !!(m && m.length)), evidence: ['after-tap/after-tap.txt', 'after-tap/after-tap.json'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'after-tap');
  for (const venue of pageVenues) {
    await step(`Lighthouse mobile ×3: ${label(venue)} (LCP ≤ 2.5 s, TBT ≤ 50 ms)`, async () => {
      const vout = path.join(out, venue);
      const r = await run('node', ['scripts/check-lighthouse.mjs', `${base}/${venue}`, '--runs', '3', '--out', vout], { logFile: `${venue}/lighthouse.log` });
      const s = JSON.parse(fs.readFileSync(path.join(vout, 'lighthouse-summary.json'), 'utf8'));
      const worst = Math.max(...s.runs.map((x) => x.lcpMs)), worstTbt = Math.max(...s.runs.map((x) => x.tbtMs));
      // Since the welcome screen (2026-10-09) the largest paint is its logo: Lighthouse measures the welcome screen, not the menu behind it.
      const els = [...new Set(s.runs.map((x) => ((x.lcpElement || '').match(/src="([^"]*)"/) || [])[1] || (x.lcpElement || '?').slice(0, 60)))];
      const logoLcp = els.every((e) => /logo/i.test(e));
      return { pass: r.status === 0 && s.runs.length === 3 && worst <= 2500 && worstTbt <= 50, evidence: [`${venue}/lighthouse-summary.json`, `${venue}/lighthouse.log`], note: `LCP ${s.runs.map((x) => x.lcpMs).join(' / ')} ms, TBT ${s.runs.map((x) => x.tbtMs).join(' / ')} ms, performance ${s.runs.map((x) => x.performance).join(' / ')} (targets LCP ≤ 2500, TBT ≤ 50; local estimates); LCP element ${els.join(' / ')}${logoLcp ? ': the welcome screen\'s logo, so this LCP measures the welcome screen, not the menu (the menu after the tap has its own step above)' : ': not the welcome logo'}` };
    }, `lighthouse-${venue === newVenueId ? 'temp-venue' : venue}`);
  }
  await step('admin drill (sign-ins, cookie, Team PINs, listing rule in the UI, API and database, sections, notes permissions, Style route and section layout 403 for staff, Style and Details for the owner with Undo, + Add venue, revoked PIN)', async () => {
    const r = await run('node', ['scripts/admin-drill.mjs', '--base', base, '--out', path.join(out, 'admin'), '--jpeg'], { env: drillEnv, logFile: 'admin/admin-drill.log' });
    const m = (r.stdout.match(/ADMIN DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || []);
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('admin/admin-drill.json', !!(m && m.length)), evidence: ['admin/admin-drill.txt', 'admin/admin-drill.json', 'admin/*.jpg'], note: `${m[0] || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'admin');
  await step('lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN', async () => {
    const r = await run('node', ['scripts/lockout-drill.mjs', '--base4', base, '--base6', `http://[::1]:${PORT}`, '--proxyBase', `http://127.0.0.1:${PROXY_PORT}`, '--out', out], { env: drillEnv, logFile: 'lockout-drill.log' });
    return { pass: r.status === 0, evidence: ['lockout-drill.txt'], note: (r.stdout.match(/LOCKOUT DRILL (PASS|FAIL)/) || [])[0] || `exit ${r.status}` };
  }, 'lockout');
  await step('revalidation: a price changed in the editor reaches the public page within 10 s, then Undo', async () => {
    const r = await run('node', ['scripts/revalidation-drill.mjs', '--base', base, '--venue', 'senso', '--item', 'Turkish Coffee', '--out', out], { env: drillEnv, logFile: 'revalidation-drill.log' });
    const m = r.stdout.match(/visible on the public page (\d+) ms after Save/); const u = r.stdout.match(/shows \$[\d.]+ again (\d+) ms after the tap/);
    return { pass: r.status === 0, evidence: ['revalidation-log.txt'], note: m ? `${m[1]} ms after Enter${u ? `; Undo back on the page ${u[1]} ms after the tap` : ''}` : `exit ${r.status}` };
  }, 'revalidation');
  await step('page editor drill (task targets with tap counts, preview ≤ 1 s, reorder on the public page, Undo on the public page, change record, no preview script, the preview never shows the welcome screen after a save, drag-and-drop of items and sections, tap-to-edit in the preview, photo upload, section delete with move or delete and Undo, items in no section in the Needs-attention bar)', async () => {
    const r = await run('node', ['scripts/editor-drill.mjs', '--base', base, '--out', path.join(out, 'editor'), '--dist', DIST, '--jpeg'], { env: drillEnv, logFile: 'editor/editor-drill.log' });
    const m = (r.stdout.match(/EDITOR DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('editor/editor-drill.json', !!(m && m.length)), evidence: ['editor/editor-drill.txt', 'editor/editor-drill.json', 'editor/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'editor');
  await step('preview control bar drill (from the Menu tab on the iPhone 13 viewport: the welcome screen in another season, in the evening, in Persian in ≤ 4 taps with the customers\' page byte-identical; every switch of the bar within 300 ms on the phone and the laptop, Replay; the screen per tab with the frame kept across tabs; the section list and the item popup open again after a save; a language tap on the previewed welcome screen; the customers\' HTML without preview markup)', async () => {
    const r = await run('node', ['scripts/preview-drill.mjs', '--base', base, '--out', path.join(out, 'preview'), '--jpeg'], { env: drillEnv, logFile: 'preview/preview-drill.log' });
    const m = (r.stdout.match(/PREVIEW DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('preview/preview-drill.json', !!(m && m.length)), evidence: ['preview/preview-drill.txt', 'preview/preview-drill.json', 'preview/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'preview');
  await step('Style tab drill (day-one defaults = the pre-token look, task target with tap count, the phone\'s bottom sheet with ≥ 45 % of the viewport left to the preview while a colour is edited and Compare held on touch, preview ≤ 1 s, Undo, linked colours, Reset group, readability guard in the UI and on the route with the known pairs, one-tap fix, every group switching the preview to its screen with its region outlined, preview ↔ controls with the controls as the master through a save, the Welcome group with the bar\'s season switch and a saved colour, Compare toggled on the laptop, What changed with the per-colour reset through the guard, section layout List/Grid on the public page and in the preview with Undo, position and screen kept through a colour save, Discard this session\'s changes restoring the opening snapshot with Undo, the snapshot kept for the whole visit (across tab switches; a reload, leaving the venue or a Discard start it again), the phone layout on the iPhone SE at Safari\'s visible height (≥ 45 % preview, controls at full size), Reset all with confirmation, Persian view)', async () => {
    const r = await run('node', ['scripts/style-drill.mjs', '--base', base, '--out', path.join(out, 'style'), '--jpeg'], { env: drillEnv, logFile: 'style/style-drill.log' });
    const m = (r.stdout.match(/STYLE DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, checks: drillChecks('style/style-drill.json', !!(m && m.length)), evidence: ['style/style-drill.txt', 'style/style-drill.json', 'style/day-one-senso.json', 'style/day-one-kebab-land.json', 'style/guard-route.json', 'style/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  }, 'style');
  await step('backup and restore drill (pg_dump, scratch restore, equal counts, item recovered)', async () => {
    const r = await run('bash', ['scripts/backup-drill.sh', path.join(out, 'backup-drill.txt')], { logFile: 'backup-drill.log' }); // drills the scratch copy (ROSES_DB), dump into the run folder
    const t = fs.existsSync(path.join(out, 'backup-drill.txt')) ? fs.readFileSync(path.join(out, 'backup-drill.txt'), 'utf8') : '';
    const equal = (t.match(/ equal$/gm) || []).length, different = (t.match(/DIFFERENT/g) || []).length, recovered = /after recovery: items with that id = 1, placements = 1/.test(t);
    return { pass: r.status === 0 && different === 0 && recovered, evidence: ['backup-drill.txt'], note: `${equal} table comparisons equal, ${different} different; item recovered: ${recovered}` };
  }, 'backup');
  await step('uploads:clean on the run\'s uploads (keeps the temporary venue\'s logo, removes the editor drill\'s orphan photo, prints each file)', async () => {
    const before = fs.existsSync(scratchEnv.UPLOAD_DIR) ? fs.readdirSync(scratchEnv.UPLOAD_DIR, { recursive: true }).filter((f) => /\.(jpg|png|webp|svg)$/.test(String(f))).map(String) : [];
    const r = await run('node', ['scripts/uploads-clean.mjs', '--min-age', '0'], { logFile: 'uploads-clean.txt' });
    const m = r.stdout.match(/SUMMARY referenced-kept (\d+), young-kept (\d+), left-alone (\d+), removed (\d+) \((\d+) bytes\); (\d+) keys? referenced/);
    const removed = [...r.stdout.matchAll(/^removed: (\S+)/gm)].map((x) => x[1]);
    const after = fs.existsSync(scratchEnv.UPLOAD_DIR) ? fs.readdirSync(scratchEnv.UPLOAD_DIR, { recursive: true }).filter((f) => /\.(jpg|png|webp|svg)$/.test(String(f))).map(String) : [];
    const logoKey = newVenueId && fs.existsSync(path.join(nvout, 'new-venue.json')) ? JSON.parse(fs.readFileSync(path.join(nvout, 'new-venue.json'), 'utf8')).logo.key : null;
    const logoKept = !!logoKey && after.includes(logoKey) && !removed.includes(logoKey);
    const orphanGone = removed.some((k) => /\/photo-/.test(k)) && removed.every((k) => !after.includes(k));
    const ok = r.status === 0 && !!m && Number(m[1]) >= 1 && logoKept && orphanGone && before.length - after.length === removed.length;
    return { pass: ok, evidence: ['uploads-clean.txt'], note: m ? `${before.length} files before, ${after.length} after; kept ${m[1]} referenced (the venue logo: ${logoKept}), removed ${m[4]} (${m[5]} bytes: ${removed.join(', ') || 'none'}); the scratch copy references ${m[6]} key(s)` : `exit ${r.status}` };
  }, 'uploads-clean');
  if (newVenueId) await step(`temporary venue removed from the scratch copy (${newVenueId})`, async () => {
    const r = await run('node', ['scripts/new-venue-drill.mjs', '--remove', newVenueId, '--out', nvout], { logFile: 'new-venue/new-venue-remove.log' });
    const m = r.stdout.match(/^REMOVED (\S+) left (\d+)$/m);
    const page = await fetch(`${base}/${newVenueId}`, { cache: 'no-store' }).then((x) => x.status).catch(() => 0);
    return { pass: r.status === 0 && !!m && m[2] === '0', evidence: ['new-venue/new-venue-drill.txt'], note: m ? `rows left ${m[2]}; its page still answers ${page} from the cache until the next save or build (the scratch copy is dropped anyway)` : `exit ${r.status}` };
  }, 'temp-venue-removed');
} catch (e) {
  log(`suite stopped: ${e.message}`);
} finally {
  clearInterval(sampler);
  for (const p of servers) { try { p.kill('SIGTERM'); } catch { /* gone */ } }
  await new Promise((r) => setTimeout(r, 600));
  // (a) which database did every process use? From each process's own log line and from pg_stat_activity samples.
  const processes = [];
  const read = (f) => (fs.existsSync(path.join(out, f)) ? fs.readFileSync(path.join(out, f), 'utf8') : '');
  for (const [port, app] of Object.entries(SERVER_APPS)) {
    const names = [...read(`server-${port}.log`).matchAll(/\[db\] connected to database "([^"]+)"/g)].map((m) => m[1]);
    processes.push({ process: app, source: `server-${port}.log`, databases: [...new Set(names)] });
  }
  for (const [name, file] of [['new-venue', 'new-venue/new-venue-drill.log'], ['new-venue (remove)', 'new-venue/new-venue-remove.log'], ['admin-drill', 'admin/admin-drill.log'], ['lockout-drill', 'lockout-drill.log'], ['revalidation-drill', 'revalidation-drill.log'], ['editor-drill', 'editor/editor-drill.log'], ['preview-drill', 'preview/preview-drill.log'], ['style-drill', 'style/style-drill.log'], ['welcome-drill', 'welcome/welcome-drill.log'], ['season-server', 'season/season-server.log'], ['after-tap-drill', 'after-tap/after-tap-drill.log'], ['photo-links senso', 'senso/photo-links.log'], ['photo-links kebab-land', 'kebab-land/photo-links.log']]) {
    if (!fs.existsSync(path.join(out, file))) continue;
    processes.push({ process: `roses-check:${name}`, source: file, databases: [...new Set([...read(file).matchAll(/connected to database "([^"]+)"/g)].map((m) => m[1]))] });
  }
  if (fs.existsSync(path.join(out, 'backup-drill.txt'))) processes.push({ process: 'backup-drill.sh', source: 'backup-drill.txt', databases: [...new Set([...read('backup-drill.txt').matchAll(/— database (\S+)/g)].map((m) => m[1]))] });
  if (fs.existsSync(path.join(out, 'uploads-clean.txt'))) processes.push({ process: 'roses-uploads-clean', source: 'uploads-clean.txt', databases: [...new Set([...read('uploads-clean.txt').matchAll(/^database "([^"]+)"/gm)].map((m) => m[1]))] });
  processes.push({ process: 'roses-check:migrate', source: 'migrate.log (DATABASE_URL)', databases: [scratchName] }, { process: 'roses-check:build', source: 'build.log (DATABASE_URL)', databases: [scratchName] });
  const samples = [...seen.entries()].map(([k, n]) => ({ connection: k, samples: n })).sort((a, b) => a.connection.localeCompare(b.connection));
  const wrongProcess = processes.filter((p) => p.databases.length === 0 || p.databases.some((d) => d !== scratchName));
  // Only a connection to the working database is a leak (PM, 2026-10-08). Connections of another session's run on its own
  // scratch copy (<work>_check_<stamp>) or of a hand-run drill on some other copy are listed for the record and do not fail
  // this run: on 2026-10-08 two sessions ran suites at once and the stricter rule failed a run whose every process was on its copy.
  const onWorking = (c) => c.endsWith(`→ ${workName}`);
  const wrongSample = samples.filter((x) => onWorking(x.connection) && !x.connection.startsWith('roses-check:suite-readonly →'));
  const otherRuns = samples.filter((x) => !onWorking(x.connection) && !x.connection.endsWith(`→ ${scratchName}`));
  const mustSee = [...Object.values(SERVER_APPS), 'roses-check:admin-drill', 'roses-check:editor-drill', 'roses-check:preview-drill', 'roses-check:style-drill', 'roses-check:welcome-drill', 'roses-check:season-server', 'roses-check:after-tap-drill', 'roses-check:lockout-drill', 'roses-check:revalidation-drill'];
  const unseen = mustSee.filter((a) => !samples.some((x) => x.connection.startsWith(`${a} →`)));
  const passA = wrongProcess.length === 0 && wrongSample.length === 0 && processes.length >= 8 && unseen.length === 0;
  fs.writeFileSync(path.join(out, 'isolation.json'), JSON.stringify({ scratch: scratchName, working: workName, processes, pgStatActivitySamples: samples, otherRunsSeen: otherRuns, pass: passA }, null, 2));
  results.push({ id: 'isolation-a', outcome: passA ? 'PASS' : 'FAIL', name: `isolation (a): every server and drill process connected to the scratch database ${scratchName} (own log line per process + pg_stat_activity sampled every 400 ms)`, pass: passA, ms: 0, evidence: ['isolation.json', `server-${PORT}.log`, `server-${PROXY_PORT}.log`, '*/…-drill.log'], note: passA ? `${processes.length} processes, every one on the scratch copy by its own log; pg_stat_activity: ${samples.length} distinct connections seen over ${samples.reduce((n, x) => n + x.samples, 0)} samples (servers and drills included), none on ${workName}${otherRuns.length ? `; ${otherRuns.length} connection(s) of other sessions' runs on their own copies seen and listed in isolation.json` : ''}` : `WRONG: ${wrongProcess.map((p) => `${p.process} → ${p.databases.join(',') || 'no log line'}`).join('; ')} ${wrongSample.map((x) => x.connection).join('; ')} ${unseen.length ? `never sampled: ${unseen.join(', ')}` : ''}` });
  log(`   ${passA ? 'PASS' : 'FAIL'} isolation (a)`);
  // (b) the working database holds no row written by a suite account.
  let b = null;
  try {
    const q = async (sql, params) => Number((await work.query(sql, params)).rows[0].n);
    b = {
      admins: await q(`select count(*) as n from admins where name = $1 or email like 'check-suite-%@localhost' or id = $2`, [SUITE_ADMIN_NAME, adminId]),
      pins: await q(`select count(*) as n from pins where name = any($1)`, [DRILL_PIN_NAMES]),
      revisionsBySuiteAccounts: await q(`select count(*) as n from revisions where by->>'name' = any($1) or by->>'id' = $2`, [[SUITE_ADMIN_NAME, ...DRILL_PIN_NAMES], adminId]),
      drillItemsOrSections: await q(`select (select count(*) from items where name->>'en' = any($1)) + (select count(*) from sections where name->>'en' = any($1)) + (select count(*) from venues where name->>'en' = any($1)) as n`, [DRILL_ROW_NAMES]),
      lockoutDrillFailureRows: await q(`select count(*) as n from login_failures where key like '%:203.0.113.%'`, []),
    };
  } catch (e) { b = { error: e.message }; }
  await db.end().catch(() => {});
  await work.end().catch(() => {});
  const passB = !!b && !b.error && Object.values(b).every((n) => n === 0);
  fs.writeFileSync(path.join(out, 'working-db-suite-rows.json'), JSON.stringify({ database: workName, checkedAt: new Date().toISOString(), suiteAccounts: { admin: SUITE_ADMIN_NAME, pins: DRILL_PIN_NAMES, rows: DRILL_ROW_NAMES }, counts: b, pass: passB }, null, 2));
  results.push({ id: 'isolation-b', outcome: passB ? 'PASS' : 'FAIL', name: `isolation (b): the working database ${workName} holds no row written by a suite account (admins, PINs, revisions, drill items/sections/venues, lockout-drill failure rows)`, pass: passB, ms: 0, evidence: ['working-db-suite-rows.json'], note: b?.error ? `error: ${b.error}` : Object.entries(b).map(([k, v]) => `${k} ${v}`).join(', ') });
  log(`   ${passB ? 'PASS' : 'FAIL'} isolation (b)`);
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
}

const outcome = (r) => r.outcome || (r.pass ? 'PASS' : 'FAIL');
const failed = results.filter((r) => outcome(r) === 'FAIL'), knownMissed = results.filter((r) => outcome(r) === 'KNOWN MISS');
const pass = results.length > 0 && failed.length === 0; // the run fails only on a failure that is not listed as a known miss
const nowPassing = known.filter((k) => k.run?.status === 'NOW PASSING');
const knownBlob = spawnSync('git', ['rev-parse', '--short', `HEAD:${KNOWN_FILE}`], { encoding: 'utf8' }).stdout.trim();
const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const knownStatus = (k) => !k.run ? '**NOT RUN** (the suite stopped before its step)' : k.run.status === 'KNOWN MISS' ? `**KNOWN MISS** (${k.run.checks.filter((c) => !c.ok).length} of ${k.run.checks.length} listed checks missed their target)` : k.run.status === 'NOW PASSING' ? '**NOW PASSING**: every listed check met its target in this run (reported; the entry stays until its clearing condition is met)' : `**${k.run.status}** (fails the run)`;
const lines = [
  `# Check suite — ${stamp.replace('T', ' ').replace(/-(\d\d)-(\d\d)Z$/, ':$1:$2Z')}`, '',
  `Commit ${commit} (the exact commit tested: the working tree had no uncommitted change outside reports/checks when the run started, ${KNOWN_FILE} included) · Node ${process.version} · Next ${JSON.parse(fs.readFileSync('node_modules/next/package.json', 'utf8')).version} · build dir ${DIST} · ports picked free at start: ${PORT} (server), ${PROXY_PORT} (server with TRUST_PROXY=1), ${SEASON_PORT} (the season drill's server); each listener was the process the suite spawned, and the suite stopped only the servers it started (ports.json) · database: scratch copy ${scratchName} of ${workName}, dropped at the end · total ${((Date.now() - started) / 1000).toFixed(0)} s`, '',
  `**${pass ? 'PASS' : 'FAIL'}** — ${results.filter((r) => outcome(r) === 'PASS').length} of ${results.length} checks passed${knownMissed.length ? `, ${knownMissed.length} KNOWN MISS (listed in \`${KNOWN_FILE}\`, still measured: see Known misses)` : ''}${failed.length ? `, ${failed.length} failed (not listed as known misses)` : ', no unlisted failure'}.${nowPassing.length ? ` Known miss now passing: ${nowPassing.map((k) => k.title).join(', ')} (see Known misses).` : ''}`, '',
  ...(pass ? [] : [`Cause: ${(() => { const f = failed[0]; return `${f.name} — ${(f.note || '').replace(/\s+/g, ' ').slice(0, 300)}`; })()}`, '', 'This failed run is kept on purpose (PM, 2026-10-08): the folder is never deleted, even when a re-run passes.', '']),
  '## Known misses', '',
  `Listed in \`${KNOWN_FILE}\` (committed; blob ${knownBlob || '?'} in ${commit}). A listed check is still measured and printed, here and as KNOWN MISS in the table; it does not fail the run. Any failure that is not listed fails it. A listed check that passes is reported here as NOW PASSING.`, '',
  ...(known.length ? ['| Known miss | This run | Measured | Cause | Clears when | Listed |', '| --- | --- | --- | --- | --- | --- |',
    ...known.map((k) => `| ${cell(k.title)} (\`${k.id}\`, step \`${k.step}\`) | ${knownStatus(k)} | ${k.run ? k.run.checks.map((c) => `${c.ok === null ? 'NOT MEASURED' : c.ok ? 'met' : 'MISSED'}: \`${c.id}\`: ${cell(c.text)}`).join('<br>') : '—'} | ${cell(k.cause)} | ${cell(k.clears)} | ${cell(k.listed)} |`)] : ['None listed.']), '',
  '## Checks', '',
  '| Check | Result | Time | Evidence | Notes |', '| --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${outcome(r)} | ${(r.ms / 1000).toFixed(1)} s | ${r.evidence.map((e) => `\`${e}\``).join(', ')} | ${r.note.replace(/\|/g, '\\|')} |`), '',
  'Every path is relative to this folder. Screenshots, full Lighthouse JSON, the first HTML responses, uploads and the dumps stay on the machine that ran the suite (gitignored); report.md, summary.json, the check JSON files and the text logs are committed. Every server and drill ran against the scratch copy of the working database (isolation.json lists the database each process connected to, from its own log and from pg_stat_activity), which was dropped afterwards; the working database itself was only read (the dump, then the search for suite-account rows in working-db-suite-rows.json). Lighthouse numbers are local estimates; since the welcome screen (2026-10-09) their LCP element is the welcome logo, so the Lighthouse LCP measures the welcome screen, not the menu behind it; the menu after the language tap is measured by the after-tap step under throttled mobile conditions.', '',
];
fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n'));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ stamp, commit, pass, ports: { server: PORT, proxyServer: PROXY_PORT, seasonServer: SEASON_PORT }, knownMisses: known.map((k) => ({ id: k.id, title: k.title, step: k.step, status: k.run?.status ?? 'NOT RUN', checks: k.run?.checks ?? [] })), results }, null, 2));
console.log('\n' + lines.slice(4).join('\n'));
console.log(`\nreport: ${path.relative(process.cwd(), path.join(out, 'report.md'))}`);
console.log(`CHECK SUITE ${pass ? 'PASS' : 'FAIL'}${knownMissed.length ? ` (${knownMissed.length} KNOWN MISS)` : ''}`);
process.exit(pass ? 0 : 1);
