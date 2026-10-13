#!/usr/bin/env node
// Probe P2 for the admin audit (report only): in WebKit with the iPhone 13 profile (Playwright's WebKit build on macOS, not a real
// iPhone), does tapping Done save a description that is still being typed? A description box saves only when it loses focus
// (ItemPanel.tsx → TextField multiline, onBlur). Same check in Chromium for comparison. Item: "Hot chocolate" (Hot Beverage).
//   DATABASE_URL=…/roses_audit node probe-webkit-done.mjs --sp <scratch dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
import pg from '/Users/kianbaban/Roses/node_modules/pg/lib/index.js';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const SP = args.sp;
const base = `http://127.0.0.1:${fs.readFileSync(path.join(SP, 'port'), 'utf8').trim()}`;
const cred = Object.fromEntries(fs.readFileSync(path.join(SP, 'admin.env'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const u = new URL(process.env.DATABASE_URL || 'postgres://x/none');
if (u.pathname !== '/roses_audit') { console.error('refusing: DATABASE_URL must name roses_audit'); process.exit(2); }
const db = new pg.Client({ connectionString: u.toString(), application_name: 'roses-audit:probe' }); await db.connect();
const item = (await db.query(`select i.id from items i join item_sections x on x.item_id=i.id join sections s on s.id=x.section_id where i.venue_id='senso' and i.name->>'en'='Hot chocolate' and s.name->>'en'='Hot Beverage'`)).rows[0].id;
const out = [];
for (const [engine, bt] of [['webkit', webkit], ['chromium', chromium]]) {
  const text = `Probe ${engine}: rich cocoa with steamed milk.`;
  const browser = await bt.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`${base}/admin/senso`);
  await page.fill('input[name=pin]', cred.AUDIT_ADMIN_PIN); await page.click('button[type=submit]');
  await page.waitForURL(`${base}/admin/senso`); await page.waitForSelector('[data-item]');
  await page.fill('input[aria-label="Search items"]', 'Hot chocolate');
  await page.locator(`[data-item="${item}"] button[aria-label^="Edit"]`).first().tap();
  const d = page.locator('[role=dialog][aria-label^="Edit "]'); await d.waitFor();
  await d.locator('button:has-text("More")').tap();
  const ta = d.locator('textarea[aria-label="Description"]'); await ta.scrollIntoViewIfNeeded(); await ta.tap();
  await ta.fill(text);
  const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await d.locator('button:has-text("Done")').tap();
  await page.waitForTimeout(2500);
  const saved = (await db.query('select description from items where id=$1', [item])).rows[0].description.en;
  const r = { engine, typedInto: focusBefore, tappedDone: true, savedAfter2500ms: saved === text, stored: saved };
  out.push(r); console.log(`PROBE: p2-done-saves-description | ${engine} (iPhone 13 profile) | typed "${text}" into ${focusBefore}, tapped Done | saved ${r.savedAfter2500ms ? 'yes' : 'no'} (stored: ${JSON.stringify(saved)})`);
  await browser.close();
}
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'probe-webkit-done.json'), JSON.stringify({ at: new Date().toISOString(), item: 'Hot chocolate', results: out }, null, 2));
await db.end();
