#!/usr/bin/env node
// Evidence for the per-venue sign-in links: /admin/<venue> shows the sign-in form with that venue preselected and
// no picker; /admin shows the picker; a wrong PIN typed on a bookmarked venue link counts against that venue + the
// client address. Screenshots and a log in reports/checkpoint-b/signin/. Addresses are masked in the log.
//   node scripts/signin-links-check.mjs --base http://127.0.0.1:3000 --out reports/checkpoint-b/signin
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { chromium, devices } from 'playwright';
import { loadEnv } from './load-env.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://127.0.0.1:3000';
const out = path.resolve(args.out || 'reports/checkpoint-b/signin');
await fs.mkdir(out, { recursive: true });
const lines = []; const results = [];
const mask = (s) => String(s).replaceAll('127.0.0.1', '<addr-A>').replaceAll('::1', '<addr-B>');
const log = (s) => { const l = mask(`${new Date().toISOString()} ${s}`); lines.push(l); console.log(l); };
const check = (ok, s) => { results.push(ok); log(`${ok ? 'PASS' : 'FAIL'}: ${s}`); };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
await db.query(`delete from login_failures where key like 'kebab-land:%' or key = 'venue:kebab-land' or key like 'senso:%' or key = 'venue:senso'`);
log('login_failures cleared for both venues');
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
const page = await ctx.newPage();
const formState = async () => page.evaluate(() => ({
  url: location.pathname + location.search, h1: document.querySelector('h1')?.textContent, hasPinInput: !!document.querySelector('form[action="/api/admin/login"] input[name=pin]'),
  hiddenVenue: document.querySelector('form[action="/api/admin/login"] input[type=hidden][name=venue]')?.value ?? null,
  radios: [...document.querySelectorAll('form[action="/api/admin/login"] input[type=radio][name=venue]')].map((r) => `${r.value}${r.checked ? ' (checked)' : ''}`),
  shell: !!document.querySelector('header nav'), error: document.querySelector('[role=alert]')?.textContent ?? null,
}));
for (const venue of ['senso', 'kebab-land']) {
  const resp = await page.goto(`${base}/admin/${venue}`); const s = await formState();
  await page.screenshot({ path: path.join(out, `signin-${venue}.png`), fullPage: true });
  check(resp.status() === 200 && s.hasPinInput && s.hiddenVenue === venue && s.radios.length === 0 && !s.shell, `GET /admin/${venue} without a session → ${resp.status()}, sign-in form with the venue preselected (hidden venue=${s.hiddenVenue}), picker radios: ${s.radios.length}, heading "${s.h1}", admin shell shown: ${s.shell}`);
}
{ const resp = await page.goto(`${base}/admin`); const s = await formState(); await page.screenshot({ path: path.join(out, 'signin-picker.png'), fullPage: true });
  check(resp.status() === 200 && s.hasPinInput && s.hiddenVenue === null && s.radios.length === 2, `GET /admin without a session → ${resp.status()}, venue picker with ${s.radios.length} radios [${s.radios.join(', ')}], no hidden venue`); }
{ const resp = await page.goto(`${base}/admin/login?mode=admin`); check(page.url() === `${base}/admin?mode=admin`, `old /admin/login?mode=admin → ${resp.status()} at ${page.url()}`); }
{ await page.goto(`${base}/admin/team`); check(page.url() === `${base}/admin`, `GET /admin/team without a session → redirected to ${page.url()} (the sign-in picker)`); }
// wrong PIN from the bookmarked Kebab Land link
await page.goto(`${base}/admin/kebab-land`);
await page.fill('input[name=pin]', '000000'); await page.click('button[type=submit]'); await page.waitForLoadState('domcontentloaded');
const after = await formState(); await page.screenshot({ path: path.join(out, 'signin-kebab-land-wrong-pin.png'), fullPage: true });
const rows = (await db.query(`select key, failures from login_failures where key like 'kebab-land:%' or key = 'venue:kebab-land' or key like 'senso:%' or key = 'venue:senso' order by key`)).rows;
check(after.url.startsWith('/admin/kebab-land?error=') && after.hiddenVenue === 'kebab-land' && /wrong PIN/.test(after.error || ''), `wrong PIN on the bookmarked /admin/kebab-land link → back on ${after.url}, venue still preselected (${after.hiddenVenue}), message "${after.error}"`);
check(rows.some((r) => /^kebab-land:/.test(r.key) && r.failures === 1) && rows.some((r) => r.key === 'venue:kebab-land' && r.failures === 1) && !rows.some((r) => /senso/.test(r.key)), `login_failures after it: ${rows.map((r) => `${r.key}=${r.failures}`).join(', ')} (counted against kebab-land + the client address, nothing against senso)`);
await db.query(`delete from login_failures where key like 'kebab-land:%' or key = 'venue:kebab-land'`);
log('login_failures rows from this check removed');
await browser.close(); await db.end();
const pass = results.every(Boolean);
log(`SIGN-IN LINKS CHECK ${pass ? 'PASS' : 'FAIL'} (${results.filter(Boolean).length}/${results.length})`);
await fs.writeFile(path.join(out, 'signin-links.txt'), lines.join('\n') + '\n');
process.exit(pass ? 0 : 1);
