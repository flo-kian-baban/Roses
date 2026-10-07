#!/usr/bin/env node
// Creates or updates an admin account (email + password) in the local database. The password is read from the
// ADMIN_PASSWORD environment variable or typed at the prompt; nothing is written to disk but the scrypt hash.
//   node scripts/admin-create.mjs --email owner@example.com --name "Owner"
//   node scripts/admin-create.mjs --email kian@example.com --name "Kian" --reset   (sets a new password)
import { createInterface } from 'node:readline/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
import { loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter((x) => x.length));
if (!args.email || !args.name) { console.error('usage: node scripts/admin-create.mjs --email <email> --name <name> [--reset]'); process.exit(2); }
let password = process.env.ADMIN_PASSWORD;
if (!password) { const rl = createInterface({ input: process.stdin, output: process.stdout }); password = await rl.question('Password (min 10 characters): '); rl.close(); }
if (!password || password.length < 10) { console.error('password too short'); process.exit(2); }
const salt = randomBytes(16);
const hash = `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${scryptSync(password.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const existing = (await client.query('select id from admins where lower(email) = lower($1)', [args.email])).rows[0];
if (existing && !args.reset) { console.error('admin exists; add --reset to set a new password'); await client.end(); process.exit(1); }
if (existing) await client.query('update admins set password_hash = $2, name = $3 where id = $1', [existing.id, hash, args.name]);
else await client.query('insert into admins (email, password_hash, name) values ($1, $2, $3)', [args.email, hash, args.name]);
console.log(`${existing ? 'updated' : 'created'} admin "${args.name}"`);
await client.end();
