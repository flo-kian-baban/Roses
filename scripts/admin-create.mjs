#!/usr/bin/env node
// Creates or updates an admin account. Admins sign in with a PIN (Kian's decision of 2026-10-07); an email + password
// can be set as well. Only scrypt hashes are stored.
//   node scripts/admin-create.mjs --email <email> --name "<name>" --pin <digits>        PIN only (4 to 6 digits, not one digit repeated and not a
//                                                                                      straight run up or down: Kian, 2026-11-06)
//   node scripts/admin-create.mjs --email <email> --name "<name>" --password            asks for a password (or ADMIN_PASSWORD)
//   add --reset to change the PIN or password of an existing account
import { createInterface } from 'node:readline/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';
import { adminPinProblem } from './admin-pin-rule.mjs';

loadEnv();
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter((x) => x.length));
const usage = () => { console.error('usage: node scripts/admin-create.mjs --email <email> --name <name> (--pin <4-6 digits> | --password) [--reset]'); process.exit(2); };
if (!args.email || !args.name || (args.pin === undefined && args.password === undefined && !process.env.ADMIN_PASSWORD)) usage();
const hash = (secret) => { const salt = randomBytes(16); return `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(String(secret).normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`; };
let pinHash = null, passwordHash = null;
// Admin PINs (Kian, 2026-11-06, replacing the 6 to 12 digits of the PM's fix batch of 2026-11-03): 4 to 6 digits, like staff PINs, and
// not one digit repeated or a straight run up or down (scripts/admin-pin-rule.mjs), checked here, where an admin PIN is set (with or
// without --reset); refused before anything is read or written. A PIN set before is not checked again, and --reset without --pin keeps it.
if (args.pin !== undefined) { const pin = String(args.pin); const problem = adminPinProblem(pin); if (problem) { console.error(problem); process.exit(2); } pinHash = hash(pin); }
if (args.password !== undefined || process.env.ADMIN_PASSWORD) {
  let password = process.env.ADMIN_PASSWORD;
  if (!password) { const rl = createInterface({ input: process.stdin, output: process.stdout }); password = await rl.question('Password (min 10 characters): '); rl.close(); }
  if (!password || password.length < 10) { console.error('password too short'); process.exit(2); }
  passwordHash = hash(password);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: process.env.ROSES_APP_NAME || 'roses-admin-create' });
await client.connect();
console.log(`connected to database "${(await client.query('select current_database() as db')).rows[0].db}"`); // where the account is written (the admin drill checks it is its own)
const existing = (await client.query('select id from admins where lower(email) = lower($1)', [args.email])).rows[0];
if (existing && !args.reset) { console.error('admin exists; add --reset to change its PIN or password'); await client.end(); process.exit(1); }
if (existing) await client.query('update admins set name = $2, pin_hash = coalesce($3, pin_hash), password_hash = coalesce($4, password_hash) where id = $1', [existing.id, args.name, pinHash, passwordHash]);
else await client.query('insert into admins (email, password_hash, pin_hash, name) values ($1, $2, $3, $4)', [args.email, passwordHash, pinHash, args.name]);
console.log(`${existing ? 'updated' : 'created'} admin "${args.name}"${pinHash ? ' with a PIN' : ''}${passwordHash ? ' with a password' : ''}`);
await client.end();
