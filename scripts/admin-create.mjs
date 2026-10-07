#!/usr/bin/env node
// Creates or updates an admin account. Admins sign in with a PIN (Kian's decision of 2026-10-07); an email + password
// can be set as well. Only scrypt hashes are stored.
//   node scripts/admin-create.mjs --email <email> --name "<name>" --pin 123456          PIN only (4 to 6 digits)
//   node scripts/admin-create.mjs --email <email> --name "<name>" --password            asks for a password (or ADMIN_PASSWORD)
//   add --reset to change the PIN or password of an existing account
import { createInterface } from 'node:readline/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

loadEnv();
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter((x) => x.length));
const usage = () => { console.error('usage: node scripts/admin-create.mjs --email <email> --name <name> (--pin <4-6 digits> | --password) [--reset]'); process.exit(2); };
if (!args.email || !args.name || (args.pin === undefined && args.password === undefined && !process.env.ADMIN_PASSWORD)) usage();
const hash = (secret) => { const salt = randomBytes(16); return `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(String(secret).normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`; };
let pinHash = null, passwordHash = null;
if (args.pin !== undefined) { const pin = String(args.pin); if (!/^\d{4,6}$/.test(pin)) { console.error('the PIN must be 4 to 6 digits'); process.exit(2); } pinHash = hash(pin); }
if (args.password !== undefined || process.env.ADMIN_PASSWORD) {
  let password = process.env.ADMIN_PASSWORD;
  if (!password) { const rl = createInterface({ input: process.stdin, output: process.stdout }); password = await rl.question('Password (min 10 characters): '); rl.close(); }
  if (!password || password.length < 10) { console.error('password too short'); process.exit(2); }
  passwordHash = hash(password);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const existing = (await client.query('select id from admins where lower(email) = lower($1)', [args.email])).rows[0];
if (existing && !args.reset) { console.error('admin exists; add --reset to change its PIN or password'); await client.end(); process.exit(1); }
if (existing) await client.query('update admins set name = $2, pin_hash = coalesce($3, pin_hash), password_hash = coalesce($4, password_hash) where id = $1', [existing.id, args.name, pinHash, passwordHash]);
else await client.query('insert into admins (email, password_hash, pin_hash, name) values ($1, $2, $3, $4)', [args.email, passwordHash, pinHash, args.name]);
console.log(`${existing ? 'updated' : 'created'} admin "${args.name}"${pinHash ? ' with a PIN' : ''}${passwordHash ? ' with a password' : ''}`);
await client.end();
