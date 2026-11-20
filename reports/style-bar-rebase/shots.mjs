#!/usr/bin/env node
// The style-bar rebase (the PM, 2026-11-19: "Kian approved its look as he saw it on 4928. If the rebase changes any screen, stop and
// send those screens."): one script shoots every admin screen of one server, so three builds on one scratch copy can be compared
// pixel by pixel (scripts/style-identity.mjs compare):
//   A  style-bar as Kian saw it on port 4928: its own build of 2026-11-16, served as built (never built again);
//   B  main after the merges of 2026-11-19 (the Next.js upgrade, "Goes well with");
//   C  style-bar rebased onto that main.
// What must hold: C against B differs only on the Style tab (what style-bar changes), and there C against A does not differ at all.
// The screens: every screen of the admin's list (scripts/layout-rules.mjs adminScreens), then the Style tab's own states: each of the four
// dropdowns open, the tab scrolled (the row stuck under the tab row), the Item popup group open, the Layout group, and on a phone the
// sheet down, at half and full. Nothing is saved: no control that saves is tapped (the script counts the scratch copy's change records
// before and after and stops if they differ). A screen a build does not have (the dropdowns on B, "Goes well with" on A) is listed as not reached.
// On a laptop (1440 × 900), the iPhone 13 viewport (390 × 664) and a 360 px phone (360 × 780), device pixel ratio 2 on the phones.
// Made the same on every run: reduced motion, no caret, animations ended; the customers' page inside the preview is not drawn (it is
// not the admin's, and its welcome scene is drawn afresh on every load; the public pages are compared byte for byte instead: README),
// nor is the clock of the laptop's iPhone frame; linked photos on outside hosts are not fetched (uploaded ones are); lazy photos are
// loaded before a whole-page shot.
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node reports/style-bar-rebase/shots.mjs --base http://127.0.0.1:<scratch server port> --out <folder> [--only style]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from '../../scripts/load-env.mjs';
import { scratchTarget } from '../../scripts/scratch-target.mjs';
import { adminScreens } from '../../scripts/layout-rules.mjs';

// The target is a scratch server, or the script stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('reports/style-bar-rebase/shots.mjs', { options: { base: 'server', out: 'path', only: 'list' }, optional: ['only'], db: true, env: ['DRILL_ADMIN_PIN'] });
const only = args.only ? String(args.only).split(',') : null; // --only style,details: the screens whose key starts with one of these (a control run of a few screens)
const base = args.base, out = path.resolve(args.out), pin = process.env.DRILL_ADMIN_PIN;
await fs.mkdir(out, { recursive: true });
const db = await connectDb('style-bar-rebase-shots');
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = 'senso' and not seasonal and listed order by position offset 1 limit 1`)).rows[0];
const records = async () => Number((await db.query('select count(*) from revisions')).rows[0].count);
const recordsBefore = await records();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { SCREENS, signin, settle } = adminScreens({ base, pin, sec });

const style = async (p) => { await p.goto(`${base}/admin/senso?tab=style`); await p.waitForSelector('[data-style-group="tabs"]'); };
const pick = (kind) => async (p) => { await style(p); const b = p.locator(`[data-preview-pick="${kind}"]`).first(); await b.scrollIntoViewIfNeeded({ timeout: 4000 }); await b.click({ timeout: 4000 }); await p.waitForSelector(`[data-preview-menu="${kind}"] [role=menuitemradio]`, { timeout: 4000 }); };
const group = (id) => async (p) => { await style(p); const b = p.locator(`[data-style-group="${id}"] > button`).first(); await b.scrollIntoViewIfNeeded({ timeout: 4000 }); await b.click({ timeout: 4000 }); await sleep(500); };
const sheetTo = (detent) => async (p) => {
  await style(p); await p.waitForSelector('[data-style-sheet]', { timeout: 4000 });
  for (let i = 0; i < 4 && (await p.getAttribute('[data-style-sheet]', 'data-style-sheet')) !== detent; i++) { await p.click('[data-style-sheet-handle]', { position: { x: 20, y: 10 } }); await sleep(450); }
  if ((await p.getAttribute('[data-style-sheet]', 'data-style-sheet')) !== detent) throw new Error(`the sheet did not reach ${detent}`);
};
// [key, title, signed in?, setup, whole page too?, views]
const EXTRA = [
  ['style-pick-screen', 'Style: the Screen dropdown open', true, pick('screen')],
  ['style-pick-lang', 'Style: the Language dropdown open', true, pick('lang')],
  ['style-pick-season', 'Style: the Season dropdown open', true, pick('season')],
  ['style-pick-slot', 'Style: the Time of day dropdown open', true, pick('slot')],
  ['style-scrolled', 'Style: scrolled, the controls stuck under the tab row', true, async (p) => { await style(p); await p.evaluate(() => scrollTo(0, 700)); await sleep(300); }, false, ['laptop']],
  ['style-group-popup', 'Style: Item popup group open', true, group('sheet')],
  // the Layout group is always open: scrolled to, nothing in it tapped (every control in it saves)
  ['style-group-layout', 'Style: the Layout group', true, async (p) => { await style(p); await p.locator('[data-style-group="layout"]').first().evaluate((el) => el.scrollIntoView({ block: 'start' })); await sleep(500); }],
  ['style-sheet-collapsed', 'Style on a phone: the sheet down', true, sheetTo('collapsed'), false, ['390', '360']],
  ['style-sheet-half', 'Style on a phone: the sheet at half', true, sheetTo('half'), false, ['390', '360']],
  ['style-sheet-full', 'Style on a phone: the sheet full', true, sheetTo('full'), false, ['390', '360']],
];
const VIEWS = [
  { id: 'laptop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { id: '390', ctx: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', deviceScaleFactor: 2 } },
  { id: '360', ctx: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
];
const OUTSIDE = /^https?:\/\/(?!127\.0\.0\.1|localhost)/; // linked photos on the menus' own hosts: not fetched, so a slow host cannot change a shot
const quiet = async (page) => {
  await settle(page);
  await page.waitForFunction(() => !/updating/.test(document.querySelector('[data-preview-status]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  // the photos on screen loaded (a lazy photo further down has not been asked for yet and is not waited for)
  await page.waitForFunction(() => [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await sleep(250);
};
const lazy = async (page) => { // every lazy photo of the page loaded before a whole-page shot, then back where the page was
  await page.evaluate(async () => { const at = scrollY, step = Math.floor(innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, at); });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
};
const browser = await chromium.launch();
const manifest = { base, at: new Date().toISOString(), shots: [], notReached: [] };
for (const v of VIEWS) {
  const mk = async () => { const c = await browser.newContext({ ...v.ctx, reducedMotion: 'reduce' }); await c.route(OUTSIDE, (r) => r.abort()); return c; };
  const out1 = await mk(), in1 = await mk();
  const signedOut = await out1.newPage(), signedIn = await in1.newPage(); await signin(signedIn);
  signedOut.setDefaultTimeout(8000); signedIn.setDefaultTimeout(8000); // a screen this build does not have is given up on after 8 s
  if (v.id === 'laptop') for (const venue of ['senso', 'kebab-land']) { // the customers' pages regenerated from the scratch copy as it is now (a build serves its build-time pages for an hour)
    const r = await signedIn.evaluate(async (venue) => { const x = await fetch('/api/admin/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venue }) }); return { status: x.status, body: await x.text() }; }, venue);
    console.log(`publish ${venue}: ${r.status} ${r.body.slice(0, 80)}`);
  }
  for (const [key, title, inside, setup, whole, views] of [...SCREENS, ...EXTRA]) {
    if (views && !views.includes(v.id)) continue;
    if (only && !only.some((k) => key.startsWith(k))) continue;
    const page = inside ? signedIn : signedOut;
    try { await setup(page); } catch (e) { manifest.notReached.push({ view: v.id, key, title, why: e.message.split('\n')[0].slice(0, 160) }); console.log(`${v.id} ${key}: NOT REACHED (${e.message.split('\n')[0].slice(0, 120)})`); await page.keyboard.press('Escape').catch(() => {}); continue; }
    await quiet(page);
    // A fresh paint of the phone's Style sheet before the shot: from one load to the next, headless Chromium draws the sheet's text lines
    // that sit on a half CSS pixel in one of two ways, one device pixel apart, on one and the same build (jitter-probe.mjs: 4 of 6 loads
    // one way, 2 the other, the geometry identical); taken out of the page and put back, the body is always drawn the same way.
    await page.evaluate(() => { const b = document.querySelector('[data-style-sheet-body]'); if (!b) return; const at = b.scrollTop; b.style.display = 'none'; void b.offsetHeight; b.style.display = ''; b.scrollTop = at; });
    await sleep(300);
    // Left out of every shot, by not drawing them (no mask: on a phone a mask over the preview's area would also cover the Style sheet that
    // lies over it, and on the scaled iPhone frame a mask's edge falls between pixels): the customers' page frames and the frame's clock.
    const opts = { animations: 'disabled', caret: 'hide', style: '[data-preview-area] iframe, .iphone-time { visibility: hidden !important; }' };
    const f = `${key}-${v.id}.png`; await page.screenshot({ path: path.join(out, f), ...opts }); manifest.shots.push({ view: v.id, key, title, file: f });
    if (whole) { await lazy(page); const g = `${key}-${v.id}-full.png`; await page.screenshot({ path: path.join(out, g), fullPage: true, ...opts }); manifest.shots.push({ view: v.id, key, title: `${title} (whole page)`, file: g }); }
    await page.keyboard.press('Escape').catch(() => {}); // a dropdown or sheet left open is closed before the next screen
  }
  await out1.close(); await in1.close();
}
await browser.close();
// the public pages as this server serves them (for the byte comparison between B and C): asked twice, so a page older than its hour is the regenerated one
const pages = {};
for (const venue of ['senso', 'kebab-land']) {
  await fetch(`${base}/${venue}`, { cache: 'no-store' }).then((r) => r.text()); await sleep(1500);
  const html = await fetch(`${base}/${venue}`, { cache: 'no-store' }).then((r) => r.text());
  await fs.writeFile(path.join(out, `public-${venue}.html`), html); pages[venue] = Buffer.byteLength(html);
}
manifest.publicPages = pages;
const recordsAfter = await records(); await db.end();
manifest.changeRecords = { before: recordsBefore, after: recordsAfter };
if (recordsAfter !== recordsBefore) { console.error(`the scratch copy has ${recordsAfter - recordsBefore} new change record(s): something was saved, so these shots are not a comparison`); await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2)); process.exit(1); }
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${manifest.shots.length} screenshots in ${out}; ${manifest.notReached.length} screen view(s) not reached; public pages ${JSON.stringify(pages)}`);
