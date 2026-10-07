#!/usr/bin/env node
// Local setup from a fresh clone, in one command: .env.local with a random session secret, Postgres in Docker,
// migrations, both venue imports from data/raw, production build. Safe to re-run (every step is idempotent).
//   npm run setup            then: npm run start
//   npm run setup -- --no-build
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

const noBuild = process.argv.includes('--no-build');
const say = (s) => console.log(`\n== ${s}`);
const run = (cmd, args, env = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } }); if (r.status !== 0) { console.error(`\n${cmd} ${args.join(' ')} failed (exit ${r.status})`); process.exit(r.status || 1); } };

say('1/5 .env.local');
if (!fs.existsSync('.env.local')) {
  const example = fs.readFileSync('.env.example', 'utf8');
  fs.writeFileSync('.env.local', example.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(48).toString('hex')}`));
  console.log('created .env.local from .env.example with a random SESSION_SECRET');
} else {
  let env = fs.readFileSync('.env.local', 'utf8');
  if (/^SESSION_SECRET=\s*$/m.test(env)) { env = env.replace(/^SESSION_SECRET=\s*$/m, `SESSION_SECRET=${randomBytes(48).toString('hex')}`); fs.writeFileSync('.env.local', env); console.log('.env.local kept; empty SESSION_SECRET filled'); }
  else console.log('.env.local kept');
}
loadEnv();

say('2/5 Postgres in Docker (docker compose up -d)');
const up = spawnSync('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
if (up.status !== 0) { console.error('docker compose failed: is Docker Desktop running?'); process.exit(1); }
process.stdout.write('waiting for the database ');
const deadline = Date.now() + 90000; let ready = false;
while (Date.now() < deadline) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
  try { await c.connect(); await c.query('select 1'); await c.end(); ready = true; break; } catch { process.stdout.write('.'); await new Promise((r) => setTimeout(r, 1000)); }
}
console.log(ready ? ' ready' : ' not reachable');
if (!ready) { console.error(`cannot reach ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//<user>@')} after 90 s`); process.exit(1); }

say('3/5 migrations');
run('node', ['scripts/db-migrate.mjs']);

say('4/5 imports (senso, kebab-land) from data/raw');
run('node', ['tools/import/run.mjs', 'senso', '--load']);
run('node', ['tools/import/run.mjs', 'kebab-land', '--load']);

if (noBuild) { say('5/5 build skipped (--no-build)'); }
else { say('5/5 production build'); run('npx', ['next', 'build']); }

console.log(`
Done. Next:
  npm run start                     public pages http://localhost:3000/senso and /kebab-land, admin http://localhost:3000/admin
                                    (the start command also prints a Network address for phones on the same Wi-Fi)
  npm run admin:create -- --email <email> --name "<name>"   create the main admin account (asks for a password)
`);
