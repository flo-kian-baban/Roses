// Drills and hand-test scripts refuse to start unless their target is a scratch server (the PM, 2026-11-06). Written after a hand run of
// the lockout drill was given --base (it takes --base4, --base6 and --proxyBase), fell back to its default, port 3000 (Kian's review
// server on the working database), and counted two failed sign-ins there. Nothing is assumed any more: a script names every option it
// takes; an unknown, missing or empty option, a database or an uploads folder that is not a scratch one, or a server that is not a scratch
// server stops it with one message (exit 2) before it sends anything. No .env.local is read: what a script uses comes from its command
// line and its environment. scripts/scratch-guard-selftest.mjs (suite step scratch-guard) proves all of this.
//
// A scratch server: on this machine (127.0.0.1, localhost or ::1), not port 3000, started with the suite's own flag ROSES_CHECK_SUITE=1,
// so GET /api/scratch (src/pages/api/scratch.ts; every other server answers 404) names the database it uses and its uploads folder; that
// database is not the working one (roses, or the one a .env.local names) and, for a script that uses a database, is the script's own; that
// folder is not the working uploads (<main checkout>/uploads). The probe is the only request a script sends before its target is proven.
//
//   const { args, flags, pos } = await scratchTarget('layout-drill', {
//     options: { base: 'server', out: 'path', jpeg: 'flag', mode: ['fast', 'full'] }, // server, port, path, value, list, number, flag,
//     optional: ['venues'],                 // or a list of the allowed values; every option not listed here must be given (a flag never)
//     positional: [['url', 'server']],      // each one required, unless its third element is 'optional'
//     db: true,                             // DATABASE_URL in the environment names a scratch database
//     uploads: true,                        // UPLOAD_DIR in the environment, not the working uploads (a script that starts its own server)
//     env: ['DRILL_ADMIN_PIN'],             // other variables that must be set
//     servers: (args) => [...],             // servers the script reaches by an address it builds itself (each one probed)
//   });
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const REVIEW_PORT = '3000'; // Kian's review server (CLAUDE.md): never a target

// The main checkout (a worktree's .git is a file naming <main>/.git/worktrees/<name>); read from disk, no git process.
export function mainCheckout(root = ROOT) {
  try {
    const g = path.join(root, '.git'), st = fs.statSync(g);
    if (st.isDirectory()) return root;
    const m = fs.readFileSync(g, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (m) return path.resolve(root, m[1].trim(), '..', '..', '..');
  } catch { /* not a git checkout: the root itself */ }
  return root;
}
const dbOf = (url) => { try { return decodeURIComponent(new URL(url).pathname.slice(1)); } catch { return ''; } };
const envLocalDb = (dir) => { try { const m = fs.readFileSync(path.join(dir, '.env.local'), 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/m); return m ? dbOf(m[1]) : ''; } catch { return ''; } };
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
export const WORKING = (() => {
  const main = mainCheckout();
  return { main, dbs: new Set(['roses', envLocalDb(main), envLocalDb(ROOT)].filter(Boolean)), uploads: real(path.join(main, 'uploads')) };
})();
const inside = (p, dir) => { const r = real(p); return r === dir || r.startsWith(dir + path.sep); };

function usage(script, spec) {
  const o = Object.entries(spec.options || {}).map(([n, k]) => {
    const v = k === 'flag' ? `--${n}` : `--${n} <${Array.isArray(k) ? k.join('|') : k === 'server' ? 'scratch server' : k}>`;
    return k === 'flag' || (spec.optional || []).includes(n) ? `[${v}]` : v;
  });
  const p = (spec.positional || []).map(([n, , o]) => (o === 'optional' ? `[<${n}>]` : `<${n}>`));
  const env = [...(spec.db ? ['DATABASE_URL (a scratch database)'] : []), ...(spec.uploads ? ['UPLOAD_DIR (a scratch copy of the uploads)'] : []), ...(spec.env || [])];
  return `usage: node ${script} ${[...p, ...o].join(' ')}${env.length ? `; in the environment: ${env.join(', ')}` : ''}`;
}
function refuse(script, spec, problems, sent = 'nothing sent') {
  console.error(`${script}: refused, ${sent}: ${problems.join('; ')}.\n${usage(script, spec)}\nA scratch server runs on this machine (never port 3000) with ROSES_CHECK_SUITE=1, on a scratch copy of the database and of the uploads.`);
  process.exit(2);
}
function checkServer(name, v, problems) {
  let u; try { u = new URL(v); } catch { problems.push(`${name} "${v}" is not an address`); return null; }
  if (!/^https?:$/.test(u.protocol)) { problems.push(`${name} "${v}" is not an http address`); return null; }
  if (!LOOPBACK.has(u.hostname)) { problems.push(`${name} "${v}" is not on this machine`); return null; }
  if (!u.port) { problems.push(`${name} "${v}" names no port`); return null; }
  if (u.port === REVIEW_PORT) { problems.push(`${name} "${v}" is port 3000, Kian's review server, never a target`); return null; }
  return u;
}

export async function scratchTarget(script, spec = {}) {
  const options = spec.options || {}, optional = new Set(spec.optional || []), positional = spec.positional || [];
  const argv = process.argv.slice(2), args = {}, flags = {}, pos = [], problems = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const name = a.slice(2), kind = options[name];
    if (kind === undefined) { problems.push(`unknown option ${a}`); continue; }
    if (kind === 'flag') { flags[name] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--') || v.trim() === '') { problems.push(`${a} needs a value`); continue; }
    if (name in args) problems.push(`${a} given twice`);
    args[name] = v; i++;
  }
  for (const [n, k] of Object.entries(options)) if (k !== 'flag' && !optional.has(n) && !(n in args)) problems.push(`missing --${n}`);
  positional.forEach(([n, , o], i) => { if (pos[i] === undefined && o !== 'optional') problems.push(`missing <${n}>`); });
  if (pos.length > positional.length) problems.push(`unexpected argument${pos.length - positional.length > 1 ? 's' : ''} ${pos.slice(positional.length).join(' ')}`);
  const servers = [];
  const kindCheck = (label, k, v) => {
    if (Array.isArray(k)) { if (!k.includes(v)) problems.push(`${label} "${v}" is not one of ${k.join(', ')}`); return; }
    if (k === 'server') { const u = checkServer(label, v, problems); if (u) servers.push(u.href); return; }
    if (k === 'port') { const n = Number(v); if (!Number.isInteger(n) || n < 1024 || n > 65535) problems.push(`${label} "${v}" is not a port`); else if (String(n) === REVIEW_PORT) problems.push(`${label} 3000 is Kian's review server's port`); return; }
    if (k === 'number') { if (!Number.isFinite(Number(v))) problems.push(`${label} "${v}" is not a number`); return; }
    if (k === 'list') { if (!v.split(',').filter(Boolean).length) problems.push(`${label} is empty`); }
  };
  for (const [n, v] of Object.entries(args)) kindCheck(`--${n}`, options[n], v);
  positional.forEach(([n, k], i) => { if (pos[i] !== undefined) kindCheck(`<${n}>`, k, pos[i]); });
  for (const e of spec.env || []) if (!process.env[e]) problems.push(`${e} is not set`);
  let database = null;
  if (spec.db) {
    const url = process.env.DATABASE_URL;
    if (!url) problems.push('DATABASE_URL is not set (no .env.local is read)');
    else {
      let u = null; try { u = new URL(url); } catch { problems.push('DATABASE_URL is not an address'); }
      if (u) {
        database = dbOf(url);
        if (!/^postgres(ql)?:$/.test(u.protocol)) problems.push('DATABASE_URL is not a postgres address');
        else if (!LOOPBACK.has(u.hostname)) problems.push('DATABASE_URL is not on this machine');
        else if (!database) problems.push('DATABASE_URL names no database');
        else if (WORKING.dbs.has(database)) problems.push(`DATABASE_URL names the working database "${database}"`);
      }
    }
  }
  if (spec.uploads) {
    const dir = process.env.UPLOAD_DIR;
    if (!dir) problems.push('UPLOAD_DIR is not set (a server started without it would use ./uploads)');
    else if (inside(dir, WORKING.uploads)) problems.push(`UPLOAD_DIR is the working uploads folder (${WORKING.uploads})`);
  }
  if (spec.check) problems.push(...(spec.check(args, flags, pos) || []));
  if (!problems.length && spec.servers) {
    let list = []; try { list = spec.servers(args, flags, pos); } catch (e) { problems.push(`the server's address could not be read (${e.message.split('\n')[0]})`); }
    for (const v of list) { const u = checkServer('the server', v, problems); if (u) servers.push(u.href); }
  }
  if (problems.length) refuse(script, spec, problems);
  for (const s of servers) {
    const probe = new URL('/api/scratch', s), said = [];
    let r = null, j = null;
    try { r = await fetch(probe, { redirect: 'manual', signal: AbortSignal.timeout(8000) }); } catch (e) { said.push(`${s} did not answer the scratch probe (${e.cause?.code || e.name})`); }
    if (r && r.status !== 200) said.push(`${s} is not a scratch server: GET /api/scratch answered ${r.status}`);
    if (r && r.status === 200) { try { j = await r.json(); } catch { said.push(`${s} answered the scratch probe with something else than JSON`); } }
    if (j && (j.scratch !== true || typeof j.database !== 'string')) said.push(`${s} answered the scratch probe without its database`);
    if (j && typeof j.database === 'string') {
      if (WORKING.dbs.has(j.database)) said.push(`${s} uses the working database "${j.database}"`);
      else if (spec.db && j.database !== database) said.push(`${s} uses the database "${j.database}" and this script "${database}" (DATABASE_URL): they must be the same scratch copy`);
      if (typeof j.uploads === 'string' && inside(j.uploads, WORKING.uploads)) said.push(`${s} uses the working uploads folder (${j.uploads})`);
    }
    if (said.length) refuse(script, spec, said, 'nothing sent but the probe');
  }
  return { args, flags, pos, database };
}
