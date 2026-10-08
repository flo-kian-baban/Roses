#!/usr/bin/env node
// Temporary venue on the default template for the check suite (PM, 2026-10-08): created through the admin API in the
// scratch copy (a logo uploaded from public/brand, a tagline, one location, two sections, four priced items in both
// languages, two with linked photos), so the suite can run the page checks, Lighthouse, brand words and the
// no-runtime-JavaScript check on a page nobody designed by hand. --remove <id> deletes it again at the end of the run.
//   DRILL_ADMIN_EMAIL=… DRILL_ADMIN_PASSWORD=… node scripts/new-venue-drill.mjs --base http://127.0.0.1:3100 --out <dir>
//   node scripts/new-venue-drill.mjs --remove <id> --out <dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://127.0.0.1:3100';
const out = path.resolve(args.out || 'reports/checks/new-venue');
await fs.mkdir(out, { recursive: true });
const lines = [];
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; lines.push(l); console.log(l); };
const db = await connectDb('new-venue', log);
const NAME = { en: 'Drill default venue', fa: 'ونیو آزمایشی' };

if (args.remove) {
  const id = args.remove;
  const n = {};
  for (const [t, sql] of [['item_sections', 'delete from item_sections where item_id in (select id from items where venue_id = $1)'], ['items', 'delete from items where venue_id = $1'], ['sections', 'delete from sections where venue_id = $1'], ['revisions', 'delete from revisions where venue_id = $1'], ['venues', 'delete from venues where id = $1']]) n[t] = (await db.query(sql, [id])).rowCount;
  const left = (await db.query('select (select count(*) from venues where id = $1) + (select count(*) from items where venue_id = $1) + (select count(*) from sections where venue_id = $1) as n', [id])).rows[0].n;
  log(`removed temporary venue ${id}: ${Object.entries(n).map(([t, c]) => `${t} ${c}`).join(', ')}; rows left ${left}`);
  await db.end();
  await fs.appendFile(path.join(out, 'new-venue-drill.txt'), lines.join('\n') + '\n');
  console.log(`REMOVED ${id} left ${left}`);
  process.exit(Number(left) === 0 ? 0 : 1);
}

const email = process.env.DRILL_ADMIN_EMAIL, password = process.env.DRILL_ADMIN_PASSWORD;
if (!email || !password) { console.error('DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD missing'); process.exit(2); }
const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'admin', email, password }).toString() });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie.startsWith('roses_session=')) { console.error('admin login failed'); process.exit(1); }
log('admin signed in');
const api = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) throw new Error(`${p} ${JSON.stringify(body).slice(0, 80)} → ${r.status} ${j?.error}`); return j; };

const created = await api('/api/admin/venue', { action: 'create', name: NAME });
const id = created.venue;
log(`venue created: ${id} (default template)`);
const png = await fs.readFile('public/brand/senso-logo.png');
const up = await fetch(`${base}/api/admin/upload?venue=${id}&kind=logo`, { method: 'POST', headers: { 'content-type': 'image/png', cookie }, body: png });
const logo = await up.json();
if (!up.ok || !logo.ok) throw new Error(`logo upload → ${up.status} ${logo.error}`);
log(`logo uploaded: ${logo.url} (${logo.width} × ${logo.height}, ${logo.bytes} bytes)`);
await api('/api/admin/venue', { action: 'update', id, patch: { logo: { url: logo.url, key: logo.key, width: logo.width, height: logo.height }, tagline: { en: 'A temporary venue for the check suite', fa: 'ونیوی موقت برای آزمایش' }, locations: [{ label: { en: 'Dine-in', fa: 'سالن' }, address: 'Example street, Richmond Hill, ON', phone: null, hours: { en: '9 AM – 9 PM, every day', fa: 'هر روز 9 صبح تا 9 شب' } }] } });
log('tagline, logo and one location saved');
const first = (await db.query(`select id from sections where venue_id = $1 order by position limit 1`, [id])).rows[0].id;
await api('/api/admin/section', { action: 'update', id: first, patch: { name: { en: 'Breakfast', fa: 'صبحانه' } } });
const second = (await api('/api/admin/section', { action: 'create', venue: id, name: { en: 'Drinks', fa: 'نوشیدنی‌ها' } })).section.id;
const photos = (await db.query(`select photo->>'url' as url from items where venue_id = 'senso' and listed and photo->>'url' like 'http%' order by name->>'en' limit 2`)).rows.map((r) => r.url);
const items = [
  { s: first, name: { en: 'Omelette', fa: 'املت' }, price: 12.5, description: { en: 'Three eggs, tomato, herbs', fa: 'سه تخم‌مرغ، گوجه، سبزی' }, photo: photos[0] },
  { s: first, name: { en: 'Bread and feta', fa: 'نان و پنیر' }, price: 8, description: { en: 'Fresh bread, feta, walnuts', fa: 'نان تازه، پنیر، گردو' }, photo: photos[1] },
  { s: second, name: { en: 'Persian tea', fa: 'چای' }, price: 3.5, description: { en: null, fa: null }, photo: null },
  { s: second, name: { en: 'Fresh orange juice', fa: 'آب پرتقال تازه' }, price: 6, description: { en: 'Pressed to order', fa: 'تازه گرفته‌شده' }, photo: null },
];
for (const it of items) {
  const r = await api('/api/admin/item', { action: 'create', venue: id, section_id: it.s, name: it.name, price: it.price, photo: it.photo ? { url: it.photo } : null });
  await api('/api/admin/item', { action: 'update', id: r.item.id, patch: { description: it.description } });
}
const counts = (await db.query(`select (select count(*) from sections where venue_id = $1) as sections, (select count(*) from items where venue_id = $1 and listed) as items from venues where id = $1`, [id])).rows[0];
log(`${counts.sections} sections, ${counts.items} shown items (${photos.length} with linked photos)`);
const page = await fetch(`${base}/${id}`); const html = await page.text();
log(`GET /${id} → ${page.status}, ${html.length} bytes, default template: ${html.includes('default-price')}, name on the page: ${html.includes(NAME.en)}`);
await db.end();
await fs.writeFile(path.join(out, 'new-venue.json'), JSON.stringify({ id, name: NAME, logo: { url: logo.url, key: logo.key }, sections: Number(counts.sections), items: Number(counts.items), status: page.status }, null, 2));
await fs.writeFile(path.join(out, 'new-venue-drill.txt'), lines.join('\n') + '\n');
console.log(`NEW VENUE ${id}`);
process.exit(page.status === 200 && Number(counts.items) === 4 ? 0 : 1);
