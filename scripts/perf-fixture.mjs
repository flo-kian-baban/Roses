#!/usr/bin/env node
// The performance fixture (the PM, 2026-10-12): Lighthouse's regression checks run on frozen content, so a slower page means slower
// code, not more photos. A fixture is a pg_dump of the working database and a copy of the working uploads, taken once and stored under
// a fixed path outside git (perf-fixture/<id>/ in the main checkout, gitignored; every worktree reads the same one). The committed
// pointer scripts/fixtures/perf-fixture.json names it and records the sha256 of every file, so the suite proves it ran on exactly that
// content. The dump holds menu content only: the rows of admins, pins, login_failures, revisions and admin_alerts are left out (their
// tables stay, empty). A fixture is refreshed only by Kian's decision (`freeze` with a new id); the known miss on Senso's LCP is
// re-baselined on it then, and only then.
//   node scripts/perf-fixture.mjs freeze --id 2026-10-12     (reads DATABASE_URL and UPLOAD_DIR, else ./uploads; refuses an existing id)
//   node scripts/perf-fixture.mjs verify                     (exit 0 when the files match the pointer)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const POINTER = 'scripts/fixtures/perf-fixture.json';
const SKIP_DATA = ['admins', 'pins', 'login_failures', 'revisions', 'admin_alerts'];
// the main checkout: the fixture's fixed path is relative to it, whichever worktree runs
export function mainCheckout(cwd = process.cwd()) {
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git rev-parse failed: ${r.stderr.trim()}`);
  return path.dirname(r.stdout.trim());
}
export const fixtureDir = (pointer) => path.resolve(process.env.PERF_FIXTURE_DIR || path.join(mainCheckout(), pointer.dir));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => f.split(path.sep).join('/')).sort() : []);
// one hash over every upload (path and content), so the pointer stays short
const uploadsDigest = (dir) => { const files = listFiles(dir); const h = crypto.createHash('sha256'); let bytes = 0; for (const f of files) { h.update(`${f} ${sha(path.join(dir, f))}\n`); bytes += fs.statSync(path.join(dir, f)).size; } return { files: files.length, bytes, sha256: h.digest('hex') }; };

export function readPointer() { return JSON.parse(fs.readFileSync(POINTER, 'utf8')); }
// { ok, dir, problems[] }: the fixture's files exist and match the committed pointer byte for byte
export function verify(pointer = readPointer()) {
  const dir = fixtureDir(pointer), problems = [];
  const dump = path.join(dir, pointer.dump.file);
  if (!fs.existsSync(dump)) problems.push(`${dump} missing`);
  else { const s = sha(dump); if (s !== pointer.dump.sha256) problems.push(`${pointer.dump.file}: sha256 ${s.slice(0, 12)}…, the pointer says ${pointer.dump.sha256.slice(0, 12)}…`); }
  const u = uploadsDigest(path.join(dir, 'uploads'));
  if (u.files !== pointer.uploads.files || u.sha256 !== pointer.uploads.sha256) problems.push(`uploads/: ${u.files} files, sha256 ${u.sha256.slice(0, 12)}…; the pointer says ${pointer.uploads.files} files, ${pointer.uploads.sha256.slice(0, 12)}…`);
  return { ok: problems.length === 0, dir, problems };
}

async function freeze(id) {
  const { loadEnv, dbName } = await import('./load-env.mjs');
  loadEnv();
  if (!id || !/^[0-9a-z-]+$/.test(id)) throw new Error('--id <name> required (letters, digits, dashes), e.g. --id 2026-10-12');
  const rel = path.join('perf-fixture', id), dir = path.join(mainCheckout(), rel);
  if (fs.existsSync(dir)) throw new Error(`${dir} exists: a fixture is never overwritten (take a new id)`);
  const db = dbName(), container = process.env.ROSES_DB_CONTAINER || 'roses-db';
  const uploadsFrom = path.resolve(process.env.UPLOAD_DIR || path.join(mainCheckout(), 'uploads'));
  fs.mkdirSync(dir, { recursive: true });
  const dump = path.join(dir, 'db.dump');
  const d = spawnSync('bash', ['-c', `docker exec ${container} pg_dump -U roses -d ${db} --format=custom --no-owner --no-privileges ${SKIP_DATA.map((t) => `--exclude-table-data=${t}`).join(' ')} > "${dump}"`], { encoding: 'utf8' });
  if (d.status !== 0) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error(`pg_dump failed: ${d.stderr}`); }
  fs.cpSync(uploadsFrom, path.join(dir, 'uploads'), { recursive: true });
  // what the content is, per venue, for the reports (read from the database the dump was taken from)
  const pg = (await import('pg')).default;
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'roses-perf-fixture' }); await c.connect();
  const migration = (await c.query('select max(filename) as f from schema_migrations')).rows[0].f;
  const rows = (await c.query(`select venue_id, count(*)::int as items, count(*) filter (where listed)::int as shown, array_remove(array_agg(photo->>'key'), null) as keys, count(*) filter (where photo->>'url' is not null and photo->>'key' is null)::int as linked from items group by venue_id order by venue_id`)).rows;
  await c.end();
  const content = Object.fromEntries(rows.map((r) => [r.venue_id, { items: r.items, shown: r.shown, uploadedPhotos: r.keys.length, uploadedBytes: r.keys.reduce((n, k) => n + (fs.existsSync(path.join(dir, 'uploads', k)) ? fs.statSync(path.join(dir, 'uploads', k)).size : 0), 0), linkedPhotos: r.linked }]));
  const pointer = {
    about: 'The performance fixture (the PM, 2026-10-12): the content Lighthouse\'s regression checks run on. Stored outside git under `dir` in the main checkout (gitignored); scripts/perf-fixture.mjs verify checks every file against the hashes below, and the suite refuses to measure on anything else. Refreshed only by Kian\'s decision (a new id), and the known miss on Senso\'s LCP is re-baselined on it then.',
    id, dir: rel.split(path.sep).join('/'), frozen: new Date().toISOString(), from: { database: db, migration, uploads: uploadsFrom },
    dump: { file: 'db.dump', bytes: fs.statSync(dump).size, sha256: sha(dump), dataLeftOut: SKIP_DATA },
    uploads: uploadsDigest(path.join(dir, 'uploads')), content,
  };
  fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(pointer, null, 2) + '\n');
  fs.writeFileSync(POINTER, JSON.stringify(pointer, null, 2) + '\n');
  console.log(`fixture ${id} frozen in ${dir}: dump ${pointer.dump.bytes} B (${pointer.dump.sha256.slice(0, 12)}…, ${migration}), uploads ${pointer.uploads.files} files ${pointer.uploads.bytes} B; ${Object.entries(content).map(([v, x]) => `${v} ${x.items} items, ${x.uploadedPhotos} uploaded photos (${x.uploadedBytes} B), ${x.linkedPhotos} linked`).join('; ')}; pointer written to ${POINTER}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = Object.fromEntries(rest.map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
  try {
    if (cmd === 'freeze') await freeze(args.id);
    else if (cmd === 'verify') { const v = verify(); console.log(v.ok ? `fixture ${readPointer().id} in ${v.dir}: every file matches ${POINTER}` : `fixture NOT as committed: ${v.problems.join('; ')}`); process.exit(v.ok ? 0 : 1); }
    else { console.error('usage: node scripts/perf-fixture.mjs freeze --id <name> | verify'); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
