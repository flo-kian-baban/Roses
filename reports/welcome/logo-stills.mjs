#!/usr/bin/env node
// Two stills of the welcome screen for Kian to pick the logo size (the PM, 2026-10-09: the logo size is a design decision, not a
// metric lever): the width built on 2026-10-09, min(70vw, 280px), and the previous one, min(60vw, 240px), rendered as the same page
// with that one rule overridden. iPhone 13 viewport, Chromium, the clock mocked to 2026-10-09 10:30 UTC (fall, "Good morning"),
// shot once the entrance has settled. Writes logo-70vw-<venue>.jpg and logo-60vw-<venue>.jpg next to this file.
//   node reports/welcome/logo-stills.mjs --base http://127.0.0.1:3002
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
for (const venue of ['senso', 'kebab-land']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium', timezoneId: 'UTC' }); const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(Date.UTC(2026, 9, 9, 10, 30)));
  await page.goto(`${base}/${venue}`, { waitUntil: 'load' });
  await page.waitForFunction(() => { const b = document.querySelector('#welcome button[data-lang="fa"]'); return !!b && Number(getComputedStyle(b).opacity) === 1; });
  const width = async () => page.evaluate(() => Math.round(document.querySelector('#welcome .welcome-card img').getBoundingClientRect().width));
  const w70 = await width();
  await page.screenshot({ path: path.join(out, `logo-70vw-${venue}.jpg`), type: 'jpeg', quality: 80 });
  await page.addStyleTag({ content: '.welcome-logo{width:min(60vw,240px)!important}.welcome-tile img{width:min(48vw,190px)!important}' });
  await page.waitForTimeout(100);
  const w60 = await width();
  await page.screenshot({ path: path.join(out, `logo-60vw-${venue}.jpg`), type: 'jpeg', quality: 80 });
  console.log(`${venue}: logo ${w70} px wide at min(70vw, 280px) → logo-70vw-${venue}.jpg; ${w60} px at min(60vw, 240px) → logo-60vw-${venue}.jpg`);
  await ctx.close();
}
await browser.close();
