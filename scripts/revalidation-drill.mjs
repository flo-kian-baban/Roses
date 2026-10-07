#!/usr/bin/env node
// Edit-to-public timing (Kian's condition on the public-page architecture): save a price in the admin and poll the
// public page until the new price shows; the log has a timestamp per poll. Then the price is restored from history.
//   DRILL_ADMIN_EMAIL=… DRILL_ADMIN_PASSWORD=… node scripts/revalidation-drill.mjs --base http://localhost:3000 --venue senso --item "Turkish Coffee" --out reports/checkpoint-b
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { chromium, devices } from 'playwright';
import { loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000', venue = args.venue || 'senso', itemName = args.item || 'Turkish Coffee';
const out = path.resolve(args.out || 'reports/checkpoint-b');
const email = process.env.DRILL_ADMIN_EMAIL, password = process.env.DRILL_ADMIN_PASSWORD;
const lines = []; const t0 = Date.now();
const log = (s) => { const l = `${new Date().toISOString()} +${String(Date.now() - t0).padStart(5)}ms ${s}`.replaceAll(email, '<admin email>'); lines.push(l); console.log(l); };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const item = (await db.query(`select id, price from items where venue_id = $1 and name->>'en' = $2 and listed`, [venue, itemName])).rows[0];
if (!item) throw new Error(`listed item "${itemName}" not found in ${venue}`);
const oldPrice = Number(item.price); const newPrice = Math.round((oldPrice + 1.5) * 100) / 100;
const fmt = (n) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const priceOnPage = async () => { const html = await (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text(); const m = html.match(new RegExp(`${esc(itemName)}</h3>\\s*<span[^>]*>(\\$[\\d.]+)</span>`)) || html.match(new RegExp(`${esc(itemName)}[\\s\\S]{0,400}?<span class="shrink-0 tabular-nums[^"]*">(\\$[\\d.]+)</span>`)); return m ? m[1] : null; };
log(`public page shows ${itemName} at ${await priceOnPage()} before the edit (database: ${fmt(oldPrice)})`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
const page = await ctx.newPage();
await page.goto(`${base}/admin/login?mode=admin`);
await page.fill('input[name=email]', email); await page.fill('input[name=password]', password); await page.click('button[type=submit]');
await page.waitForURL(`${base}/admin`);
log('admin signed in on the iPhone viewport');
await page.goto(`${base}/admin/${venue}/items/${item.id}`);
await page.fill('input[name=price]', String(newPrice));
const tSave = Date.now();
log(`tapping Save with price ${fmt(newPrice)} (was ${fmt(oldPrice)})`);
await Promise.all([page.waitForURL((u) => u.searchParams.get('saved') === '1'), page.click('form[action="/api/admin/item"] button[type=submit]:has-text("Save")')]);
log(`admin redirected back with saved=1 (${Date.now() - tSave} ms after the tap)`);
let shown = null, polls = 0;
while (Date.now() - tSave < 15000) { polls++; shown = await priceOnPage(); log(`poll ${polls}: public page shows ${shown}`); if (shown === fmt(newPrice)) break; await new Promise((r) => setTimeout(r, 400)); }
const dt = Date.now() - tSave;
log(`new price visible on the public page ${dt} ms after Save → ${dt <= 10000 && shown === fmt(newPrice) ? 'PASS (≤ 10 s)' : 'FAIL'}`);
// restore from history (one tap on the newest revision)
await page.goto(`${base}/admin/${venue}/items/${item.id}`);
const tRestore = Date.now();
await Promise.all([page.waitForURL((u) => u.searchParams.has('restored')), page.click('form[action="/api/admin/restore"] button[type=submit]')]);
let back = null; polls = 0;
while (Date.now() - tRestore < 15000) { polls++; back = await priceOnPage(); if (back === fmt(oldPrice)) break; await new Promise((r) => setTimeout(r, 400)); }
log(`restored from history; public page shows ${back} again ${Date.now() - tRestore} ms after the tap (${polls} polls)`);
const revs = (await db.query(`select action, before->>'price' as before_price, after->>'price' as after_price, by->>'name' as by from revisions where table_name='items' and row_id=$1 order by id desc limit 2`, [item.id])).rows;
log(`last two revision rows: ${JSON.stringify(revs)}`);
await browser.close(); await db.end();
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'revalidation-log.txt'), lines.join('\n') + '\n');
process.exit(dt <= 10000 && shown === fmt(newPrice) && back === fmt(oldPrice) ? 0 : 1);
