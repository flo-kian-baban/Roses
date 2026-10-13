#!/usr/bin/env node
// Stills of the rebuilt item editor (Kian, 2026-10-13), for the reply; the images stay on disk (shots/ is gitignored). Runs only against
// the scratch copy roses_audit after audit-drill-editor.mjs --ui after (Latte then has its "syrup" group and the copied "Milk" group);
// no item of the menu has sizes and two choice groups, so Latte is given two sizes here, in the scratch copy only.
//   DATABASE_URL=…/roses_audit node editor-stills.mjs --sp <scratch dir with port, admin.env> --out <folder>
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import pg from '/Users/kianbaban/Roses/node_modules/pg/lib/index.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const SP = args.sp, OUT = path.join(path.resolve(args.out || '.'), 'shots'); fs.mkdirSync(OUT, { recursive: true });
const base = `http://127.0.0.1:${fs.readFileSync(path.join(SP, 'port'), 'utf8').trim()}`;
const cred = Object.fromEntries(fs.readFileSync(path.join(SP, 'admin.env'), 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
if ((await db.query('select current_database() d')).rows[0].d !== 'roses_audit') { console.error('refusing: not roses_audit'); process.exit(2); }
const idOf = async (n) => (await db.query(`select id from items where venue_id='senso' and name->>'en'=$1 order by listed desc limit 1`, [n])).rows[0].id;
const browser = await chromium.launch();
async function session(device) {
  const ctx = await browser.newContext(device); const page = await ctx.newPage();
  await page.goto(`${base}/admin/senso`); await page.fill('input[name=pin]', cred.AUDIT_ADMIN_PIN); await page.click('button[type=submit]'); await page.waitForSelector('[data-item]');
  return { ctx, page, cookie: (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0] };
}
async function open(page, name) {
  await page.goto(`${base}/admin/senso`); await page.waitForSelector('[data-item]');
  await page.fill('input[aria-label="Search items"]', name);
  await page.locator(`[data-item="${await idOf(name)}"] button[aria-label^="Edit"]`).first().click();
  await page.waitForSelector(`[role=dialog][aria-label="Edit ${name}"]`);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))); await page.waitForTimeout(300);
}
const openGroups = async (page) => { for (const g of ['allergens', 'other']) { const b = page.locator(`[data-group="${g}"][aria-expanded="false"]`); if (await b.count()) await b.click(); } await page.waitForTimeout(400); await page.evaluate(() => document.querySelector('.item-panel .overflow-y-auto')?.scrollTo(0, 0)); };
const shots = [];
const shot = async (page, f, what) => { await page.screenshot({ path: path.join(OUT, f) }); shots.push(`${f}: ${what}`); console.log(f, '-', what); };

const phone = await session(devices['iPhone 13']);
const latte = await idOf('Latte');
const la = (await db.query('select price, variants, add_ons from items where id=$1', [latte])).rows[0];
if (!la.variants.length) {
  const r = await fetch(`${base}/api/admin/item`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: phone.cookie }, body: JSON.stringify({ action: 'update', id: latte, patch: { price: null, variants: [{ label: { en: 'Small', fa: 'کوچک' }, price: 6.99 }, { label: { en: 'Large', fa: 'بزرگ' }, price: 7.99 }] } }) });
  console.log('Latte given two sizes in the scratch copy:', r.status);
}
const groups = [...new Set((await db.query('select add_ons from items where id=$1', [latte])).rows[0].add_ons.map((a) => a.group?.en))];
console.log('Latte choice groups:', groups);
await open(phone.page, 'Pumpkin Soup');
await shot(phone.page, 'phone-first-screen.png', 'iPhone 13 (390 × 664), Pumpkin Soup as it opens: status, item, price, where & when (Appetizer · Fall Menu), the two closed groups');
await open(phone.page, 'Latte');
await shot(phone.page, 'phone-sizes-two-groups.png', `iPhone 13, Latte with two sizes and two choice groups (${groups.join(', ')}), as it opens`);
await phone.ctx.close();
const tall = await session({ ...devices['iPhone 13'], viewport: { width: 390, height: 2400 } });
await open(tall.page, 'Latte'); await openGroups(tall.page);
await shot(tall.page, 'phone-sizes-two-groups-whole.png', 'the same editor whole (a 390 px wide window 2400 px tall), Allergens & diet and Other open');
await open(tall.page, 'Pumpkin Soup'); await openGroups(tall.page);
await shot(tall.page, 'phone-whole.png', 'Pumpkin Soup whole, both groups open');
await tall.ctx.close();
const laptop = await session({ viewport: { width: 1440, height: 900 } });
await open(laptop.page, 'Latte');
await shot(laptop.page, 'laptop.png', 'laptop (1440 × 900): the menu, the editor column (Latte, two sizes, two choice groups), the preview');
await laptop.ctx.close();
await browser.close(); await db.end();
fs.writeFileSync(path.join(OUT, 'README.txt'), shots.join('\n') + '\n');
