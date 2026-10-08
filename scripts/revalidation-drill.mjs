#!/usr/bin/env node
// Edit-to-public timing (Kian's condition on the public-page architecture): change a price in place in the page editor
// on a phone viewport and poll the public page until the new price shows; the log has a timestamp per poll. Then Undo
// from the "Saved · Undo" toast, and poll until the old price is back.
//   DRILL_ADMIN_PIN=… node scripts/revalidation-drill.mjs --base http://localhost:3000 --venue senso --item "Turkish Coffee" --out reports/checkpoint-b
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000', venue = args.venue || 'senso', itemName = args.item || 'Turkish Coffee';
const out = path.resolve(args.out || 'reports/checkpoint-b');
const pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
const lines = []; const t0 = Date.now();
const log = (s) => { const l = `${new Date().toISOString()} +${String(Date.now() - t0).padStart(5)}ms ${s}`; lines.push(l); console.log(l); };
const db = await connectDb('revalidation-drill', log);
const item = (await db.query(`select id, price from items where venue_id = $1 and name->>'en' = $2 and listed`, [venue, itemName])).rows[0];
if (!item) throw new Error(`shown item "${itemName}" not found in ${venue}`);
const oldPrice = Number(item.price); const newPrice = Math.round((oldPrice + 1.5) * 100) / 100;
const fmt = (n) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
const priceOnPage = async () => { const html = await (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text(); const m = html.match(new RegExp(`data-id="${item.id}"[\\s\\S]{0,600}?<span class="shrink-0 tabular-nums[^"]*">(\\$[\\d.]+)</span>`)); return m ? m[1] : null; };
log(`public page shows ${itemName} at ${await priceOnPage()} before the edit (database: ${fmt(oldPrice)})`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
const page = await ctx.newPage();
await page.goto(`${base}/admin/${venue}`);
await page.fill('input[name=pin]', pin); await page.click('button[type=submit]');
await page.waitForURL(`${base}/admin/${venue}`); await page.waitForSelector('[data-item]');
log('admin signed in with the PIN on the iPhone viewport; page editor open');
await page.fill('input[aria-label="Search items"]', itemName);
await page.click(`[data-item="${item.id}"] [data-price]`);
await page.keyboard.type(String(newPrice));
const tSave = Date.now();
log(`Enter on the price field with ${fmt(newPrice)} (was ${fmt(oldPrice)})`);
await page.keyboard.press('Enter');
await page.waitForSelector('[role=status]:has-text("Saved")');
log(`"Saved · Undo" shown ${Date.now() - tSave} ms after Enter`);
let shown = null, polls = 0;
while (Date.now() - tSave < 15000) { polls++; shown = await priceOnPage(); log(`poll ${polls}: public page shows ${shown}`); if (shown === fmt(newPrice)) break; await new Promise((r) => setTimeout(r, 200)); }
const dt = Date.now() - tSave;
log(`new price visible on the public page ${dt} ms after Enter → ${dt <= 10000 && shown === fmt(newPrice) ? 'PASS (≤ 10 s)' : 'FAIL'}`);
// Undo from the toast
const tUndo = Date.now();
await page.click('[role=status] button:has-text("Undo")');
await page.waitForSelector('[role=status]:has-text("Undone")');
let back = null; polls = 0;
while (Date.now() - tUndo < 15000) { polls++; back = await priceOnPage(); if (back === fmt(oldPrice)) break; await new Promise((r) => setTimeout(r, 200)); }
log(`Undo tapped; public page shows ${back} again ${Date.now() - tUndo} ms after the tap (${polls} polls)`);
const revs = (await db.query(`select action, before->>'price' as before_price, after->>'price' as after_price, by->>'name' as by from revisions where table_name='items' and row_id=$1 order by id desc limit 2`, [item.id])).rows;
log(`last two change records: ${JSON.stringify(revs)}`);
await browser.close(); await db.end();
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'revalidation-log.txt'), lines.join('\n') + '\n');
console.log(`visible on the public page ${dt} ms after Save`);
process.exit(dt <= 10000 && shown === fmt(newPrice) && back === fmt(oldPrice) ? 0 : 1);
