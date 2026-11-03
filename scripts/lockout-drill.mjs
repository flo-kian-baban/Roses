#!/usr/bin/env node
// Lockout evidence (T6 a, b). Part 1 on the main server with the default limits: five wrong PINs from one
// client address lock that venue for that address while the other loopback address still logs in. Part 2 on a
// second server started with TRUST_PROXY=1 so the drill can present 10 synthetic addresses: 50 failures within the
// hour write an admin_alerts row and lock nothing for the venue (the PM's ruling of 2026-11-03, S1-14), and pause admin PINs across the
// venues ([Q3]) until an admin unlocks them. Also (pre-go-live audit, 2026-11-03): the address behind the proxy read one hop from the right
// of X-Forwarded-For (S1-09), an IPv6 address counted per /64, the lock's end said in Toronto time (S1-18). Addresses are masked in the saved log.
//   node scripts/lockout-drill.mjs --base4 http://127.0.0.1:3000 --base6 http://[::1]:3000 --proxyBase http://127.0.0.1:3001 --out reports/checkpoint-b
import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base4 = args.base4 || 'http://127.0.0.1:3000', base6 = args.base6 || 'http://[::1]:3000', proxyBase = args.proxyBase || 'http://127.0.0.1:3001';
const out = path.resolve(args.out || 'reports/checkpoint-b');
const email = process.env.DRILL_ADMIN_EMAIL, password = process.env.DRILL_ADMIN_PASSWORD;
if (!email || !password) { console.error('DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD missing'); process.exit(2); }
const lines = [];
const mask = (s) => String(s).replaceAll('127.0.0.1', '<addr-A>').replaceAll('::1', '<addr-B>').replaceAll(email, '<admin email>');
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(' ')}`; lines.push(mask(l)); console.log(mask(l)); };
const db = await connectDb('lockout-drill', (t) => log(t));

async function post(base, p, body, headers = {}) {
  const res = await fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(body).toString() });
  return { status: res.status, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie') };
}
// the answer's code and parameters (pre-go-live audit S2-18: the page has the wording)
const msg = (loc) => { try { const q = new URL(loc, 'http://x').searchParams; return [q.get('error') || '(none)', q.get('at') && `at=${q.get('at')}`, q.get('left') && `left=${q.get('left')}`, q.get('paused') && 'paused'].filter(Boolean).join(' '); } catch { return loc; } };
const at = (loc) => { try { return new URL(loc, 'http://x').searchParams.get('at'); } catch { return null; } };
const toronto = (d) => new Date(d).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' });

// admin cookie, used to create and revoke the drill PINs
const adminLogin = await post(base4, '/api/admin/login', { mode: 'admin', email, password });
const cookie = (adminLogin.setCookie || '').split(';')[0];
if (!cookie.startsWith('roses_session=') || adminLogin.location !== '/admin') { console.error('admin login failed', adminLogin); process.exit(1); }
log('admin signed in (cookie received); creating drill PINs');
async function makePin(name, venues) {
  const res = await fetch(base4 + '/api/admin/pin', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ _action: 'create', name, role: 'staff', venue_ids: venues.join(','), _back: '/admin/team' }).toString() });
  const html = await res.text(); const pin = html.match(/class="pin">(\d{6})</)?.[1]; if (!pin) throw new Error('PIN not shown');
  const id = (await db.query('select id from pins where name = $1 order by created_at desc limit 1', [name])).rows[0].id;
  return { pin, id };
}
const good = await makePin('Lockout drill (valid PIN)', ['senso', 'kebab-land']);
const toRevoke = await makePin('Lockout drill (to be revoked)', ['senso']);
await db.query(`delete from login_failures where key like 'senso:%' or key = 'venue:senso' or key like 'kebab-land:%' or key = 'venue:kebab-land'`);
log('login_failures cleared for both venues before the drill');

// Part 1: default limits, venue senso, address A (IPv4 loopback) vs address B (IPv6 loopback)
log('--- Part 1: 5 wrong PINs from address A on venue senso (defaults: 5 failures → 15-minute lock for venue + address)');
for (let i = 1; i <= 5; i++) { const r = await post(base4, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: '000000' }); log(`A wrong PIN #${i}: ${r.status} → ${msg(r.location)}`); }
const lockedA = await post(base4, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: good.pin });
log(`A correct PIN while locked: ${lockedA.status} → ${msg(lockedA.location)} (cookie set: ${!!lockedA.setCookie})`);
const okB = await post(base6, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: good.pin });
log(`B correct PIN, same venue, other address: ${okB.status} → ${okB.location} (cookie set: ${!!okB.setCookie})`);
const okAother = await post(base4, '/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: good.pin });
log(`A correct PIN on the other venue (lock is per venue + address): ${okAother.status} → ${okAother.location} (cookie set: ${!!okAother.setCookie})`);
const rows1 = await db.query(`select key, failures, locked_until, round(extract(epoch from (locked_until - now()))/60) as minutes_left from login_failures where key like 'senso:%' or key = 'venue:senso' order by key`);
for (const r of rows1.rows) log(`login_failures: key=${r.key} failures=${r.failures} locked_until=${r.locked_until ? r.locked_until.toISOString() : 'null'} minutes_left=${r.minutes_left}`);
const lockRow = rows1.rows.find((r) => r.key.startsWith('senso:') && r.locked_until);
const torontoOk = !!lockRow && at(lockedA.location) === toronto(lockRow.locked_until);
log(`the lock's end as the sign-in page is told it: ${at(lockedA.location)}; the lock row's end in Toronto time: ${lockRow ? toronto(lockRow.locked_until) : 'none'} (S1-18: the server's own zone before, UTC on Vercel)`);
const pass1 = lockedA.status === 303 && /^locked/.test(msg(lockedA.location)) && !lockedA.setCookie && okB.location === '/admin/senso' && !!okB.setCookie && okAother.location === '/admin/kebab-land' && torontoOk;
log(`Part 1 ${pass1 ? 'PASS' : 'FAIL'}`);

// Revoked PIN (T6 b)
await fetch(base4 + '/api/admin/pin', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ _action: 'revoke', id: toRevoke.id, _back: '/admin/team' }).toString() });
const beforeRevokeOk = await post(base6, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: good.pin });
const revoked = await post(base6, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: toRevoke.pin });
log(`--- revoked PIN from address B: ${revoked.status} → ${msg(revoked.location)} (cookie set: ${!!revoked.setCookie}); the valid PIN from B just before: ${beforeRevokeOk.location}`);
const pass2 = !revoked.setCookie && /^wrong-pin/.test(msg(revoked.location)) && beforeRevokeOk.location === '/admin/senso';
log(`Revoked PIN ${pass2 ? 'PASS' : 'FAIL'}`);

// Part 2: 50 failures per hour on venue kebab-land from 10 synthetic addresses (server on proxyBase has TRUST_PROXY=1)
log(`--- Part 2: 50 wrong PINs on venue kebab-land from 10 addresses (5 each) via the TRUST_PROXY=1 server; cap = 50 per 60 minutes, an alert only since 2026-11-03`);
await db.query(`delete from login_failures where key = 'admin-pin'`);
let alertBefore = (await db.query(`select count(*)::int as n from admin_alerts where venue_id = 'kebab-land'`)).rows[0].n;
let last;
for (let a = 1; a <= 10; a++) for (let i = 1; i <= 5; i++) { last = await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: '000000' }, { 'x-forwarded-for': `203.0.113.${a}` }); }
log(`50th failure: ${last.status} → ${msg(last.location)}`);
const freshAddr = await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: good.pin }, { 'x-forwarded-for': '203.0.113.99' });
log(`correct staff PIN from an 11th address on kebab-land: ${freshAddr.status} → ${freshAddr.location} (cookie set: ${!!freshAddr.setCookie}; the cap locks nothing)`);
const freshSenso = await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: good.pin }, { 'x-forwarded-for': '203.0.113.99' });
log(`correct PIN from that address on senso: ${freshSenso.status} → ${freshSenso.location} (cookie set: ${!!freshSenso.setCookie})`);
const venueRow = (await db.query(`select key, failures, locked_until from login_failures where key = 'venue:kebab-land'`)).rows[0];
log(`login_failures: key=${venueRow?.key} failures=${venueRow?.failures} locked_until=${venueRow?.locked_until?.toISOString() ?? 'null'}`);
const alerts = (await db.query(`select id, venue_id, kind, message, created_at, seen_at from admin_alerts where venue_id = 'kebab-land' order by id desc limit 1`)).rows;
log(`admin_alerts rows for kebab-land: before ${alertBefore}, now ${alertBefore + (alerts.length && new Date(alerts[0].created_at) > new Date(Date.now() - 120000) ? 1 : 0)}; latest: ${alerts[0] ? JSON.stringify({ id: alerts[0].id, kind: alerts[0].kind, message: alerts[0].message, seen_at: alerts[0].seen_at }) : 'none'}`);
// the alert shows on the admin home
const home = await fetch(base4 + '/admin', { headers: { cookie } }); const homeHtml = await home.text();
const shown = homeHtml.includes('lockout-cap') && homeHtml.includes('Unlock PIN login');
log(`admin home shows the alert with an Unlock button: ${shown}`);
const pass3 = freshAddr.status === 303 && freshAddr.location === '/admin/kebab-land' && !!freshAddr.setCookie && !venueRow?.locked_until && freshSenso.location === '/admin/senso' && alerts.length > 0 && shown;
log(`Part 2 (S1-14: the venue cap is an alert only) ${pass3 ? 'PASS' : 'FAIL'}`);
// [Q3] those 50 wrong PINs were 50 tries at the admin PINs: admin PINs are paused on every venue (staff PINs are not), with an alert, until unlocked
const adminPin = process.env.DRILL_ADMIN_PIN;
const adminRow = (await db.query(`select failures, locked_until from login_failures where key = 'admin-pin'`)).rows[0];
const pausedTry = adminPin ? await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: adminPin }, { 'x-forwarded-for': '198.51.100.31' }) : null;
const staffWhilePaused = await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: good.pin }, { 'x-forwarded-for': '198.51.100.32' });
const pinAlert = (await db.query(`select kind, message from admin_alerts where kind = 'admin-pin-cap' order by id desc limit 1`)).rows[0];
const home2 = await (await fetch(base4 + '/admin', { headers: { cookie } })).text();
const unlockPins = await fetch(base4 + '/api/admin/alert', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ _action: 'unlock-admin-pins', _back: '/admin' }).toString() });
const afterUnlockPins = adminPin ? await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: adminPin }, { 'x-forwarded-for': '198.51.100.33' }) : null;
log(`admin PINs across venues: counter ${adminRow?.failures}, paused until ${adminRow?.locked_until ? toronto(adminRow.locked_until) : 'not paused'} (Toronto); the admin PIN on senso while paused → ${pausedTry?.status} ${msg(pausedTry?.location)} (cookie set: ${!!pausedTry?.setCookie}); a staff PIN meanwhile → ${staffWhilePaused.location}; alert "${pinAlert?.message}"; admin home offers Unlock admin PINs: ${home2.includes('Unlock admin PINs')}; after the unlock (${unlockPins.status}) the admin PIN → ${afterUnlockPins?.location}`);
const passQ3 = !!adminPin && adminRow?.failures >= 50 && !!adminRow?.locked_until && !pausedTry.setCookie && /paused/.test(msg(pausedTry.location)) && staffWhilePaused.location === '/admin/senso' && !!pinAlert && home2.includes('Unlock admin PINs') && afterUnlockPins?.location === '/admin/senso' && !!afterUnlockPins?.setCookie;
log(`Admin PINs counted across venues ([Q3]) ${passQ3 ? 'PASS' : 'FAIL'}`);
// S1-09: behind the proxy the address is one hop from the right of X-Forwarded-For (an entry the client wrote to its left is ignored), and an
// IPv6 address counts per /64
await db.query(`delete from login_failures where key like 'senso:%'`);
await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: '000001' }, { 'x-forwarded-for': '192.0.2.77, 203.0.113.150' });
await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: '000002' }, { 'x-forwarded-for': '2001:db8:1:2::10' });
await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: '000003' }, { 'x-forwarded-for': '2001:db8:1:2:ffff:0:0:20' });
const keys = (await db.query(`select key, failures from login_failures where key like 'senso:%' order by key`)).rows;
log(`login_failures after one spoofed-chain try and two IPv6 tries of one /64: ${keys.map((k) => `${k.key}=${k.failures}`).join(', ')}`);
const passHops = keys.some((k) => k.key === 'senso:203.0.113.150' && k.failures === 1) && !keys.some((k) => k.key.includes('192.0.2.77')) && keys.some((k) => k.key === 'senso:2001:db8:1:2::/64' && k.failures === 2);
log(`Client address (S1-09: hops from the right, IPv6 per /64) ${passHops ? 'PASS' : 'FAIL'}`);
await db.query(`delete from login_failures where key like 'senso:%' or key = 'admin-pin'`);

// Unlock from the admin (the documented way out), then revoke the drill PINs
const unlock = await fetch(base4 + '/api/admin/alert', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ _action: 'unlock', venue: 'kebab-land', _back: '/admin' }).toString() });
log(`admin unlock of kebab-land: ${unlock.status} → ${unlock.headers.get('location')}`);
const afterUnlock = await post(proxyBase, '/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: good.pin }, { 'x-forwarded-for': '203.0.113.99' });
log(`correct PIN on kebab-land after unlock: ${afterUnlock.status} → ${afterUnlock.location}`);
await db.query(`delete from login_failures where key like 'senso:%' or key = 'venue:senso'`);
await fetch(base4 + '/api/admin/pin', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams({ _action: 'revoke', id: good.id, _back: '/admin/team' }).toString() });
log('drill PINs revoked; senso lock rows cleared so nobody stays locked out');
// pre-go-live audit (2026-11-02, S1-04): 20 wrong PINs sent at the same moment from one address: no more than the limit (5) are
// checked; the rest are refused before checking (before, every one of a burst was checked, so the lockout did not hold)
await db.query(`delete from login_failures where key like 'senso:%' or key = 'venue:senso'`);
const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => post(base4, '/api/admin/login', { mode: 'pin', venue: 'senso', pin: String(917300 + i) })));
// checked: "wrong-pin" (with the lock's end when that very try set it); refused before checking: "locked"
const burstChecked = burst.filter((r) => /^wrong-pin/.test(msg(r.location))).length, burstRefused = burst.filter((r) => /^locked/.test(msg(r.location))).length;
log(`--- 20 wrong PINs at once from address A on senso: ${burstChecked} checked, ${burstRefused} refused before checking, ${burst.filter((r) => r.setCookie).length} signed in`);
const pass4 = burstChecked <= 5 && burstChecked + burstRefused === 20 && !burst.some((r) => r.setCookie);
log(`Burst ${pass4 ? 'PASS' : 'FAIL'}`);
await db.query(`delete from login_failures where key like 'senso:%' or key = 'venue:senso'`);
// the alerts this drill raised are marked seen, so the later drills see the admin as people use it (two alert cards pushed the page editor's
// sections below the screen of the editor drill's laptop)
const seenNow = await db.query(`update admin_alerts set seen_at = now() where seen_at is null and kind in ('lockout-cap', 'admin-pin-cap') and created_at > now() - interval '30 minutes' returning id`);
log(`the drill's own alerts marked seen: ${seenNow.rowCount}`);
await db.end();
const pass = pass1 && pass2 && pass3 && pass4 && passQ3 && passHops && afterUnlock.location === '/admin/kebab-land';
log(`LOCKOUT DRILL ${pass ? 'PASS' : 'FAIL'}`);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'lockout-drill.txt'), lines.join('\n') + '\n');
process.exit(pass ? 0 : 1);
