#!/usr/bin/env node
// One-command acceptance suite. Never touches the working database: it copies it (pg_dump → scratch database),
// applies pending migrations to the copy, points the build, the servers and every drill at the copy (and their uploads
// at the run folder), and drops the copy at the end. Isolation is proven, not counted (PM, 2026-10-08): (a) every server
// and drill process names itself to Postgres and logs the database it connected to, and pg_stat_activity is sampled
// throughout the run: any suite process on the working database fails the run; (b) the working database holds no row
// written by a suite account (the temporary check admin, the drill PINs, drill items or sections). Kian using the app
// during a run cannot break either check. Builds into .next-check (the running server and .next are untouched),
// starts two servers (3100; 3101 with TRUST_PROXY=1 for the venue-cap test), creates a temporary admin account in the
// copy, runs every check, and writes reports/checks/<date-time>/report.md next to the raw evidence. Exit code 1 when
// any check fails; a failed run's folder is kept (its report carries a one-line cause), never deleted.
//   npm run check
// 2026-10-08: the colour-literal scan (0 in the public sources) and the Style tab drill (scripts/style-drill.mjs) joined the suite.
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
fs.mkdirSync(path.join(out, 'editor'), { recursive: true }); fs.mkdirSync(path.join(out, 'style'), { recursive: true });
const DIST = '.next-check', PORT = 3100, PROXY_PORT = 3101;
const base = `http://127.0.0.1:${PORT}`;
const started = Date.now();
const results = [];
const servers = [];
const SERVER_APPS = { [3100]: 'roses-check:server-3100', [3101]: 'roses-check:server-3101' };
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
  const p = spawn('npx', ['next', 'start', '-p', String(port)], { env: { ...process.env, ...scratchEnvRef, NEXT_DIST_DIR: DIST, ROSES_APP_NAME: SERVER_APPS[port], ...env }, stdio: ['ignore', fd, fd] });
  servers.push(p); return p;
}
// preconditions
// Evidence only from committed code (PM, 2026-10-08): the suite refuses to start when the working tree has uncommitted
// changes outside reports/checks, so every report names the exact commit it tested. Flow: commit the code, run the suite, commit the report.
{
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const outside = status.filter((l) => { const p = l.slice(3).split(' -> ').pop(); return !p.startsWith('reports/checks/'); });
  if (outside.length) {
    console.error('npm run check runs on committed code only (PM, 2026-10-08). Uncommitted changes outside reports/checks:');
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
for (const p of [PORT, PROXY_PORT]) if (!(await portFree(p))) { console.error(`port ${p} is in use; stop whatever listens there`); process.exit(2); }
if (!process.env.CHROME_PATH) { const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (!fs.existsSync(mac) && !spawnSync('which', ['google-chrome']).stdout?.length) process.env.CHROME_PATH = chromium.executablePath(); }

// temporary admin account for the drills (removed at the end; never written to any file)
const adminEmail = `check-suite-${randomBytes(4).toString('hex')}@localhost`, adminPassword = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const adminHash = `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(adminPassword.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
const adminPin = String(100000 + Math.floor(Math.random() * 900000));
const pinSalt = randomBytes(16);
const adminPinHash = ['$scrypt$N=16384,r=8,p=1', pinSalt.toString('base64'), scryptSync(adminPin, pinSalt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')].join('$');
const SUITE_ADMIN_NAME = 'Check suite', DRILL_PIN_NAMES = ['Drill staff', 'Drill owner', 'Lockout drill (valid PIN)', 'Lockout drill (to be revoked)'];
const DRILL_ROW_NAMES = ['Drill editor item', 'Drill section', 'Drill section item 1', 'Drill section item 2', 'Drill venue', 'Drill default venue'];
let newVenueId = null;
scratchEnvRef = scratchEnv;
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
let adminId = null;
const drillEnv = { DRILL_ADMIN_EMAIL: adminEmail, DRILL_ADMIN_PASSWORD: adminPassword, DRILL_ADMIN_PIN: adminPin };

try {
  await step(`migrations on the scratch copy (${scratchName})`, async () => { const r = await run('node', ['scripts/db-migrate.mjs'], { env: { ROSES_APP_NAME: 'roses-check:migrate' }, logFile: 'migrate.log' }); return { pass: r.status === 0, evidence: ['migrate.log'], note: (r.stdout.match(/\d+ migration\(s\) applied, \d+ already present/) || [`exit ${r.status}`])[0] }; });
  if (!results.at(-1).pass) throw new Error('migrations failed; stopping');
  adminId = (await db.query('insert into admins (email, password_hash, pin_hash, name) values ($1,$2,$3,$4) returning id', [adminEmail, adminHash, adminPinHash, SUITE_ADMIN_NAME])).rows[0].id;
  await step('production build (.next-check)', async () => { const r = await run('npx', ['next', 'build'], { env: { NEXT_DIST_DIR: DIST, ROSES_APP_NAME: 'roses-check:build' }, logFile: 'build.log' }); return { pass: r.status === 0, evidence: ['build.log'], note: r.status === 0 ? 'next build ok' : `exit ${r.status}` }; });
  if (!results.at(-1).pass) throw new Error('build failed; stopping');
  await step('colour literals in the public templates, the menu kit and the public stylesheet (Kian, 2026-10-08: 0 outside src/venues/tokens.ts)', async () => {
    const r = await run('node', ['scripts/check-colour-literals.mjs', '--json', path.join(out, 'colour-literals.json')], { logFile: 'colour-literals.txt' });
    const j = fs.existsSync(path.join(out, 'colour-literals.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'colour-literals.json'), 'utf8')) : null;
    return { pass: r.status === 0 && j?.count === 0, evidence: ['colour-literals.txt', 'colour-literals.json'], note: j ? `${j.count} colour literal(s) in ${j.files.length} public files; ${j.tokensFileHexLiterals} hex values live in the token defaults file` : `exit ${r.status}` };
  });

  await step(`servers on ${PORT} and ${PROXY_PORT} (TRUST_PROXY=1)`, async () => {
    startServer(PORT, {}, 'server-3100.log'); startServer(PROXY_PORT, { TRUST_PROXY: '1' }, 'server-3101.log');
    const ok = (await waitHttp(`${base}/senso`)) && (await waitHttp(`http://127.0.0.1:${PROXY_PORT}/senso`));
    return { pass: ok, evidence: ['server-3100.log', 'server-3101.log'], note: ok ? 'both answer 200 on /senso' : 'a server did not come up' };
  });
  if (!results.at(-1).pass) throw new Error('servers failed; stopping');

  // Temporary venue on the default template (PM, 2026-10-08): created through the API in the scratch copy, checked like the two brand pages, removed at the end.
  const nvout = path.join(out, 'new-venue'); fs.mkdirSync(nvout, { recursive: true });
  await step('temporary venue on the default template (created through the admin API: logo upload, tagline, location, 2 sections, 4 items)', async () => {
    const r = await run('node', ['scripts/new-venue-drill.mjs', '--base', base, '--out', nvout], { env: drillEnv, logFile: 'new-venue/new-venue-drill.log' });
    newVenueId = (r.stdout.match(/^NEW VENUE (\S+)$/m) || [])[1] || null;
    const j = fs.existsSync(path.join(nvout, 'new-venue.json')) ? JSON.parse(fs.readFileSync(path.join(nvout, 'new-venue.json'), 'utf8')) : null;
    return { pass: r.status === 0 && !!newVenueId, evidence: ['new-venue/new-venue.json', 'new-venue/new-venue-drill.txt'], note: j ? `/${j.id}: ${j.sections} sections, ${j.items} shown items, logo ${j.logo.url.replace(/^\/uploads\//, 'uploads/')}, GET → ${j.status}` : `exit ${r.status}` };
  });
  const pageVenues = ['senso', 'kebab-land', ...(newVenueId ? [newVenueId] : [])];
  const label = (v) => (v === newVenueId ? `${v} (temporary venue, default template)` : v);

  for (const venue of pageVenues) {
    const vout = path.join(out, venue); fs.mkdirSync(vout, { recursive: true });
    await step(`public page checks: ${label(venue)} (intro, repeat visit, reduced motion, Persian toggle, images, category tabs)`, async () => {
      const r = await run('node', ['scripts/check-page.mjs', venue, '--base', base, '--out', vout, '--jpeg'], { logFile: `${venue}/check-page.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, `${venue}-checks.json`), 'utf8')).checks;
      return { pass: r.status === 0, evidence: [`${venue}/${venue}-checks.json`, `${venue}/${venue}-en.jpg`, `${venue}/${venue}-fa.jpg`, `${venue}/check-page.log`], note: `toggle dir=${j.persianToggle.dir}, Persian headings ${j.persianToggle.visibleFaHeadings}; intro gone at ${j.firstVisit.introDoneAtMs} ms, page slides in behind it (heading shown at ${j.firstVisit.entrance.h2ShownAtMs} ms, last of its ${j.firstVisit.entrance.rowsAnimated} sliding rows at ${j.firstVisit.entrance.lastRowShownAtMs} ms; all at once under reduced motion: ${j.reducedMotion.pageVisibleAtOnce}), plays again on reload (gone at ${j.repeatVisit.introDoneAtMs} ms, stored keys ${JSON.stringify(j.repeatVisit.storedKeys)}); images ${j.images.loaded}/${j.images.total}; tabs: ${j.tabs.summary.onTappedTab}/${j.tabs.summary.count} taps end on their tab at the bar with ${j.tabs.summary.othersLit} other tabs lit on the way, ${j.tabs.scroll.down.mismatches + j.tabs.scroll.up.mismatches}/${j.tabs.scroll.down.samples + j.tabs.scroll.up.samples} scroll steps off, last tab at the bottom ${j.tabs.scroll.lastTabActiveAtBottom}, direct link ${j.tabs.directLink.ok}` };
    });
  }
  await step(`brand words in the built pages${newVenueId ? ' and the temporary venue\'s page' : ''}`, async () => {
    const files = [`${DIST}/server/pages/senso.html`, `${DIST}/server/pages/kebab-land.html`];
    if (newVenueId && fs.existsSync(path.join(out, newVenueId, `${newVenueId}-first-response.html`))) files.push(path.join(out, newVenueId, `${newVenueId}-first-response.html`)); // the dynamic page as served (check-page saved it)
    const r = await run('node', ['scripts/check-brand-words.mjs', ...files], { logFile: 'brand-words.txt' });
    return { pass: r.status === 0 && files.length === (newVenueId ? 3 : 2), evidence: ['brand-words.txt'], note: r.status === 0 ? `no "Mealsy" or "Flo" in visible text or metadata (${files.length} pages)` : 'see brand-words.txt' };
  });
  if (newVenueId) await step(`no runtime JavaScript: ${label(newVenueId)}`, async () => {
    const f = path.join(out, newVenueId, `${newVenueId}-first-response.html`);
    if (!fs.existsSync(f)) return { pass: false, note: 'no saved first response' };
    const html = fs.readFileSync(f, 'utf8');
    const tags = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
    const external = tags.filter((t) => /\bsrc=/.test(t)).length, chunks = (html.match(/\/_next\/static\/chunks\/[^"'\s>]+\.js\b/g) || []).length, preloads = (html.match(/<link[^>]+rel="(?:modulepreload|preload)"[^>]+as="script"/g) || []).length; // the stylesheet lives under /_next/static/chunks too and is allowed
    const ok = external === 0 && chunks === 0 && preloads === 0 && tags.length === 4 && html.includes('default-price');
    fs.writeFileSync(path.join(out, newVenueId, 'no-runtime-js.json'), JSON.stringify({ file: path.basename(f), scriptTags: tags, external, nextChunkReferences: chunks, scriptPreloads: preloads, defaultTemplate: html.includes('default-price'), pass: ok }, null, 2));
    return { pass: ok, evidence: [`${newVenueId}/no-runtime-js.json`], note: `${tags.length} inline script tags (head decision, intro, language toggle, menu), ${external} external, ${chunks} JavaScript chunk references, ${preloads} script preloads; default template: ${html.includes('default-price')}` };
  });
  for (const venue of ['senso', 'kebab-land']) {
    await step(`photo links: ${venue}`, async () => {
      const vout = path.join(out, venue);
      const r = await run('node', ['scripts/check-photo-links.mjs', venue, '--out', vout, '--base', base], { logFile: `${venue}/photo-links.log` });
      const j = JSON.parse(fs.readFileSync(path.join(vout, 'photo-links.json'), 'utf8'));
      const rows = j.results || j.targets || j;
      const bad = (Array.isArray(rows) ? rows : []).filter((x) => ![200, 206].includes(x.status));
      return { pass: r.status === 0 && bad.length === 0, evidence: [`${venue}/photo-links.md`, `${venue}/photo-links.json`], note: `${Array.isArray(rows) ? rows.length : '?'} URLs, ${bad.length} not 200/206` };
    });
  }
  for (const venue of pageVenues) {
    await step(`Lighthouse mobile ×3: ${label(venue)}`, async () => {
      const vout = path.join(out, venue);
      const r = await run('node', ['scripts/check-lighthouse.mjs', `${base}/${venue}`, '--runs', '3', '--out', vout], { logFile: `${venue}/lighthouse.log` });
      const s = JSON.parse(fs.readFileSync(path.join(vout, 'lighthouse-summary.json'), 'utf8'));
      const worst = Math.max(...s.runs.map((x) => x.lcpMs));
      return { pass: r.status === 0 && s.runs.length === 3 && worst <= 2500, evidence: [`${venue}/lighthouse-summary.json`, `${venue}/lighthouse.log`], note: `LCP ${s.runs.map((x) => x.lcpMs).join(' / ')} ms, performance ${s.runs.map((x) => x.performance).join(' / ')} (target ≤ 2500, local estimate)` };
    });
  }
  await step('admin drill (sign-ins, cookie, Team PINs, listing rule in the UI, API and database, sections, notes permissions, Style route 403 for staff, Style and Details for the owner with Undo, + Add venue, revoked PIN)', async () => {
    const r = await run('node', ['scripts/admin-drill.mjs', '--base', base, '--out', path.join(out, 'admin'), '--jpeg'], { env: drillEnv, logFile: 'admin/admin-drill.log' });
    const m = (r.stdout.match(/ADMIN DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || []);
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, evidence: ['admin/admin-drill.txt', 'admin/admin-drill.json', 'admin/*.jpg'], note: `${m[0] || `exit ${r.status}`}; ${measures.join('; ')}` };
  });
  await step('lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN', async () => {
    const r = await run('node', ['scripts/lockout-drill.mjs', '--base4', base, '--base6', `http://[::1]:${PORT}`, '--proxyBase', `http://127.0.0.1:${PROXY_PORT}`, '--out', out], { env: drillEnv, logFile: 'lockout-drill.log' });
    return { pass: r.status === 0, evidence: ['lockout-drill.txt'], note: (r.stdout.match(/LOCKOUT DRILL (PASS|FAIL)/) || [])[0] || `exit ${r.status}` };
  });
  await step('revalidation: a price changed in the editor reaches the public page within 10 s, then Undo', async () => {
    const r = await run('node', ['scripts/revalidation-drill.mjs', '--base', base, '--venue', 'senso', '--item', 'Turkish Coffee', '--out', out], { env: drillEnv, logFile: 'revalidation-drill.log' });
    const m = r.stdout.match(/visible on the public page (\d+) ms after Save/); const u = r.stdout.match(/shows \$[\d.]+ again (\d+) ms after the tap/);
    return { pass: r.status === 0, evidence: ['revalidation-log.txt'], note: m ? `${m[1]} ms after Enter${u ? `; Undo back on the page ${u[1]} ms after the tap` : ''}` : `exit ${r.status}` };
  });
  await step('page editor drill (task targets with tap counts, preview ≤ 1 s, reorder on the public page, Undo on the public page, change record, no preview script, drag-and-drop of items and sections, tap-to-edit in the preview, photo upload, section delete with move or delete and Undo, items in no section in the Needs-attention bar)', async () => {
    const r = await run('node', ['scripts/editor-drill.mjs', '--base', base, '--out', path.join(out, 'editor'), '--dist', DIST, '--jpeg'], { env: drillEnv, logFile: 'editor/editor-drill.log' });
    const m = (r.stdout.match(/EDITOR DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, evidence: ['editor/editor-drill.txt', 'editor/editor-drill.json', 'editor/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  });
  await step('Style tab drill (day-one defaults = the pre-token look, task target with tap count, preview ≤ 1 s, Undo, linked colours, Reset group, readability guard in the UI and on the route with the known pairs, one-tap fix, preview ↔ controls, Reset all with confirmation, Persian view)', async () => {
    const r = await run('node', ['scripts/style-drill.mjs', '--base', base, '--out', path.join(out, 'style'), '--jpeg'], { env: drillEnv, logFile: 'style/style-drill.log' });
    const m = (r.stdout.match(/STYLE DRILL (PASS|FAIL) \((\d+)\/(\d+)\)/) || [])[0];
    const measures = [...r.stdout.matchAll(/^MEASURE: (.*)$/gm)].map((x) => x[1]);
    return { pass: r.status === 0, evidence: ['style/style-drill.txt', 'style/style-drill.json', 'style/day-one-senso.json', 'style/day-one-kebab-land.json', 'style/guard-route.json', 'style/*.jpg'], note: `${m || `exit ${r.status}`}; ${measures.join('; ')}` };
  });
  await step('backup and restore drill (pg_dump, scratch restore, equal counts, item recovered)', async () => {
    const r = await run('bash', ['scripts/backup-drill.sh', path.join(out, 'backup-drill.txt')], { logFile: 'backup-drill.log' }); // drills the scratch copy (ROSES_DB), dump into the run folder
    const t = fs.existsSync(path.join(out, 'backup-drill.txt')) ? fs.readFileSync(path.join(out, 'backup-drill.txt'), 'utf8') : '';
    const equal = (t.match(/ equal$/gm) || []).length, different = (t.match(/DIFFERENT/g) || []).length, recovered = /after recovery: items with that id = 1, placements = 1/.test(t);
    return { pass: r.status === 0 && different === 0 && recovered, evidence: ['backup-drill.txt'], note: `${equal} table comparisons equal, ${different} different; item recovered: ${recovered}` };
  });
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
  });
  if (newVenueId) await step(`temporary venue removed from the scratch copy (${newVenueId})`, async () => {
    const r = await run('node', ['scripts/new-venue-drill.mjs', '--remove', newVenueId, '--out', nvout], { logFile: 'new-venue/new-venue-remove.log' });
    const m = r.stdout.match(/^REMOVED (\S+) left (\d+)$/m);
    const page = await fetch(`${base}/${newVenueId}`, { cache: 'no-store' }).then((x) => x.status).catch(() => 0);
    return { pass: r.status === 0 && !!m && m[2] === '0', evidence: ['new-venue/new-venue-drill.txt'], note: m ? `rows left ${m[2]}; its page still answers ${page} from the cache until the next save or build (the scratch copy is dropped anyway)` : `exit ${r.status}` };
  });
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
  for (const [name, file] of [['new-venue', 'new-venue/new-venue-drill.log'], ['new-venue (remove)', 'new-venue/new-venue-remove.log'], ['admin-drill', 'admin/admin-drill.log'], ['lockout-drill', 'lockout-drill.log'], ['revalidation-drill', 'revalidation-drill.log'], ['editor-drill', 'editor/editor-drill.log'], ['style-drill', 'style/style-drill.log'], ['photo-links senso', 'senso/photo-links.log'], ['photo-links kebab-land', 'kebab-land/photo-links.log']]) {
    if (!fs.existsSync(path.join(out, file))) continue;
    processes.push({ process: `roses-check:${name}`, source: file, databases: [...new Set([...read(file).matchAll(/connected to database "([^"]+)"/g)].map((m) => m[1]))] });
  }
  if (fs.existsSync(path.join(out, 'backup-drill.txt'))) processes.push({ process: 'backup-drill.sh', source: 'backup-drill.txt', databases: [...new Set([...read('backup-drill.txt').matchAll(/— database (\S+)/g)].map((m) => m[1]))] });
  if (fs.existsSync(path.join(out, 'uploads-clean.txt'))) processes.push({ process: 'roses-uploads-clean', source: 'uploads-clean.txt', databases: [...new Set([...read('uploads-clean.txt').matchAll(/^database "([^"]+)"/gm)].map((m) => m[1]))] });
  processes.push({ process: 'roses-check:migrate', source: 'migrate.log (DATABASE_URL)', databases: [scratchName] }, { process: 'roses-check:build', source: 'build.log (DATABASE_URL)', databases: [scratchName] });
  const samples = [...seen.entries()].map(([k, n]) => ({ connection: k, samples: n })).sort((a, b) => a.connection.localeCompare(b.connection));
  const wrongProcess = processes.filter((p) => p.databases.length === 0 || p.databases.some((d) => d !== scratchName));
  const wrongSample = samples.filter((x) => !x.connection.endsWith(`→ ${scratchName}`) && !x.connection.startsWith('roses-check:suite-readonly →'));
  const mustSee = ['roses-check:server-3100', 'roses-check:server-3101', 'roses-check:admin-drill', 'roses-check:editor-drill', 'roses-check:style-drill', 'roses-check:lockout-drill', 'roses-check:revalidation-drill'];
  const unseen = mustSee.filter((a) => !samples.some((x) => x.connection.startsWith(`${a} →`)));
  const passA = wrongProcess.length === 0 && wrongSample.length === 0 && processes.length >= 8 && unseen.length === 0;
  fs.writeFileSync(path.join(out, 'isolation.json'), JSON.stringify({ scratch: scratchName, working: workName, processes, pgStatActivitySamples: samples, pass: passA }, null, 2));
  results.push({ name: `isolation (a): every server and drill process connected to the scratch database ${scratchName} (own log line per process + pg_stat_activity sampled every 400 ms)`, pass: passA, ms: 0, evidence: ['isolation.json', 'server-3100.log', 'server-3101.log', '*/…-drill.log'], note: passA ? `${processes.length} processes, every one on the scratch copy by its own log; pg_stat_activity: ${samples.length} distinct connections seen over ${samples.reduce((n, x) => n + x.samples, 0)} samples (servers and drills included), none on ${workName}` : `WRONG: ${wrongProcess.map((p) => `${p.process} → ${p.databases.join(',') || 'no log line'}`).join('; ')} ${wrongSample.map((x) => x.connection).join('; ')} ${unseen.length ? `never sampled: ${unseen.join(', ')}` : ''}` });
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
  results.push({ name: `isolation (b): the working database ${workName} holds no row written by a suite account (admins, PINs, revisions, drill items/sections/venues, lockout-drill failure rows)`, pass: passB, ms: 0, evidence: ['working-db-suite-rows.json'], note: b?.error ? `error: ${b.error}` : Object.entries(b).map(([k, v]) => `${k} ${v}`).join(', ') });
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

const pass = results.length > 0 && results.every((r) => r.pass);
const lines = [
  `# Check suite — ${stamp.replace('T', ' ').replace(/-(\d\d)-(\d\d)Z$/, ':$1:$2Z')}`, '',
  `Commit ${commit} (the exact commit tested: the working tree had no uncommitted change outside reports/checks when the run started) · Node ${process.version} · Next ${JSON.parse(fs.readFileSync('node_modules/next/package.json', 'utf8')).version} · build dir ${DIST} · servers ${PORT} and ${PROXY_PORT} · database: scratch copy ${scratchName} of ${workName}, dropped at the end · total ${((Date.now() - started) / 1000).toFixed(0)} s`, '',
  `**${pass ? 'PASS' : 'FAIL'}** — ${results.filter((r) => r.pass).length} of ${results.length} checks passed.`, '',
  ...(pass ? [] : [`Cause: ${(() => { const f = results.find((r) => !r.pass); return `${f.name} — ${(f.note || '').replace(/\s+/g, ' ').slice(0, 300)}`; })()}`, '', 'This failed run is kept on purpose (PM, 2026-10-08): the folder is never deleted, even when a re-run passes.', '']),
  '| Check | Result | Time | Evidence | Notes |', '| --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)} s | ${r.evidence.map((e) => `\`${e}\``).join(', ')} | ${r.note.replace(/\|/g, '\\|')} |`), '',
  'Every path is relative to this folder. Screenshots, full Lighthouse JSON, the first HTML responses, uploads and the dumps stay on the machine that ran the suite (gitignored); report.md, summary.json, the check JSON files and the text logs are committed. Every server and drill ran against the scratch copy of the working database (isolation.json lists the database each process connected to, from its own log and from pg_stat_activity), which was dropped afterwards; the working database itself was only read (the dump, then the search for suite-account rows in working-db-suite-rows.json). Lighthouse numbers are local estimates.', '',
];
fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n'));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ stamp, commit, pass, results }, null, 2));
console.log('\n' + lines.slice(4).join('\n'));
console.log(`\nreport: ${path.relative(process.cwd(), path.join(out, 'report.md'))}`);
console.log(`CHECK SUITE ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
