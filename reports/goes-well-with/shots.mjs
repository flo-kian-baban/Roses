#!/usr/bin/env node
// "Goes well with" (Kian via the PM, 2026-11-18): before/after screenshots for Kian's ruling, at laptop width (1440 × 900) and at 390 px
// (the iPhone 13 viewport), for one Senso item and one Kebab Land item:
//   the item editor: before (no card); after, with 0 pairs and with 4 (the card below PRICE and the item's choices: the PM's ruling of
//     2026-11-19; on the laptop the fourth is added through the picker, so the preview beside the editor shows the item's popup with
//     the list, as after any such save); every editor shot is framed on the end of Price and the choices, so what follows it shows;
//   the picker (after only: there was none);
//   the public popup in English and in Persian, before and after: the first screen as a customer gets it, and the whole popup (the
//     block is its last group, below the item's own sizes and options: the PM's ruling of 2026-11-19).
// --only editor or --only popup shoots that part alone (the rulings' re-shoot of 2026-11-19: every after shot again, and the editor's
// before shots again with the new framing, on the upgraded main; the popup's before shots of 2026-11-18 stand, the customers' pages
// being byte for byte the same on both Next.js versions).
// The pairs are example data set in the scratch copy only, through the admin API; nothing here touches the working database.
// Screenshots go to reports/goes-well-with/shots/ (gitignored, deleted after Kian's ruling), with an index.html that puts each before
// beside its after once both labels have been shot.
// Needs a scratch server of each build on one scratch copy of the database (with migration 009) and an admin PIN valid on any venue:
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node reports/goes-well-with/shots.mjs --base http://127.0.0.1:<port> --label before|after --out reports/goes-well-with/shots [--only editor|popup]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from '../../scripts/load-env.mjs';
import { scratchTarget } from '../../scripts/scratch-target.mjs';

// The target is a scratch server, or the script stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('reports/goes-well-with/shots.mjs', { options: { base: 'server', label: ['before', 'after'], out: 'path', only: ['editor', 'popup'] }, optional: ['only'], db: true, env: ['DRILL_ADMIN_PIN'] });
const base = args.base, label = args.label, out = path.resolve(args.out), pin = process.env.DRILL_ADMIN_PIN, only = args.only ?? null;
await fs.mkdir(out, { recursive: true });
const db = await connectDb('goes-well-with-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = async (venue, name) => (await db.query(`select id from items where venue_id = $1 and name->>'en' = $2 order by listed desc, id limit 1`, [venue, name])).rows[0]?.id;
const CASES = [
  { key: 'senso-latte', venue: 'senso', name: 'Latte', what: 'Senso; a photo, a description and a choice group (syrup)', pairs: ['Almond Croissant', 'Pumpkin Cheesecake', 'Espresso', 'Everything Bagel With Cream Cheese'], note: 'four with photos; Espresso has two sizes' },
  { key: 'kebab-land-koobideh', venue: 'kebab-land', name: 'Roses Koobideh Kebab', what: 'Kebab Land; a photo and a description', pairs: ['Green Salad', 'Yogurt with Shallot Dip (Maast o Moosir)', 'Red Wine Sangria', 'Baklava'], note: 'one with a photo, two without, one long name; Red Wine Sangria has two sizes' },
];
for (const c of CASES) {
  c.id = await idOf(c.venue, c.name); c.pairIds = []; for (const n of c.pairs) c.pairIds.push(await idOf(c.venue, n));
  if (!c.id || c.pairIds.some((x) => !x)) { console.error(`shots: “${c.name}” or one of its example pairs is not on ${c.venue} in this copy`); process.exit(2); }
}
const VIEWS = [
  { id: 'laptop', title: 'laptop, 1440 × 900', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  { id: '390', title: '390 px phone (iPhone 13 viewport)', ctx: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', deviceScaleFactor: 2 } },
];
const browser = await chromium.launch();
const shots = [];
const shoot = async (target, name) => { const f = path.join(out, `${label}-${name}.png`); await target.screenshot({ path: f }); shots.push(path.basename(f)); console.log(`shot ${path.basename(f)}`); };
async function signin(page, venue) {
  await page.goto(`${base}/admin/${venue}`);
  if (await page.locator('input[name=pin]').count()) { await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); }
  await page.waitForSelector('[data-item]');
}
const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.evaluate(async () => { await Promise.all([...document.images].filter((i) => i.getBoundingClientRect().width > 0).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })))); await document.fonts.ready; }); await sleep(450); };
async function openEditor(page, c) {
  await signin(page, c.venue);
  await page.fill('input[aria-label="Search items"]', c.name);
  const b = page.locator(`[data-item="${c.id}"] button[aria-label^="Edit"]`).first(); await b.scrollIntoViewIfNeeded(); await b.click();
  await page.waitForSelector(`.item-panel[aria-label="Edit ${c.name}"]`); await settle(page);
}
// the editor framed the same way in every shot, before and after: the end of Price and the item's choices 200 px under the editor's
// top bar, so what follows it shows (after: the GOES WELL WITH card, then Appears in; before: Appears in)
const frameEditor = (page) => page.evaluate(() => { const s = document.querySelector('.item-panel [data-editor-scroll]'), end = document.querySelector('.item-panel [data-choices]') ?? document.querySelector('.item-panel [data-price-choices]'); if (s && end) s.scrollTop += end.getBoundingClientRect().bottom - s.getBoundingClientRect().top - 200; });
let cookie = null;
const api = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const setPairs = async (c, ids) => { const r = await api('/api/admin/item', { action: 'update', id: c.id, patch: { pairs: ids } }); if (r.status !== 200) throw new Error(`pairs of ${c.name}: ${r.status} ${JSON.stringify(r.json)}`); };

// ---- the admin
for (const v of only === 'popup' ? [] : VIEWS) {
  const ctx = await browser.newContext(v.ctx), page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`pageerror (${v.id}): ${e.message}`));
  await signin(page, CASES[0].venue);
  cookie = (await ctx.cookies()).filter((k) => k.name === 'roses_session').map((k) => `${k.name}=${k.value}`)[0];
  for (const c of CASES) {
    if (label === 'before') { await openEditor(page, c); await frameEditor(page); await sleep(300); await shoot(page, `${c.key}-${v.id}-editor`); continue; }
    await setPairs(c, []);
    await openEditor(page, c); await frameEditor(page); await sleep(300); await shoot(page, `${c.key}-${v.id}-editor-0`);
    await page.click('.item-panel [data-pairs-add]'); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"] [data-pair-pick]'); await settle(page);
    await shoot(page, `${c.key}-${v.id}-picker`);
    await page.locator('[role=dialog][aria-label^="Goes well with"] button[aria-label="Close"]').last().click(); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"]', { state: 'detached' });
    // three through the route, the fourth through the picker (the preview beside the editor then shows the popup with the list)
    await setPairs(c, c.pairIds.slice(0, 3));
    await openEditor(page, c);
    await page.locator('.item-panel [data-pairs-add]').scrollIntoViewIfNeeded(); await page.click('.item-panel [data-pairs-add]'); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"] [data-pair-pick]');
    await page.fill('[role=dialog][aria-label^="Goes well with"] input[type=search]', c.pairs[3]);
    await page.locator(`[data-pair-pick="${c.pairIds[3]}"]`).first().click(); await page.waitForSelector('[role=dialog][aria-label^="Goes well with"]', { state: 'detached' });
    await page.waitForSelector('.item-panel [data-pairs-full]');
    if (v.id === 'laptop') { await page.frameLocator('iframe[data-preview-frame]').locator('dialog#sheet[open] #sheet-content [data-pair]').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => console.log('the preview did not show the popup')); }
    await page.waitForSelector('.toast', { state: 'detached', timeout: 12000 }).catch(() => {}); // "Saved · Undo" gone
    await frameEditor(page); await settle(page); await shoot(page, `${c.key}-${v.id}-editor-4`);
  }
  await ctx.close();
}
// ---- the public page (after: with the four pairs saved above)
for (const v of only === 'editor' ? [] : VIEWS) {
  for (const c of CASES) for (const lang of ['en', 'fa']) {
    const ctx = await browser.newContext(v.ctx), page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`pageerror (${v.id} public): ${e.message}`));
    await page.goto(`${base}/${c.venue}`); await page.click(`#welcome button[data-lang="${lang}"]`);
    await page.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 6000 }).catch(() => {});
    const li = page.locator(`main li.item[data-id="${c.id}"]`).first(); await li.scrollIntoViewIfNeeded(); await sleep(300); await li.click();
    await page.waitForSelector('dialog#sheet[open] #sheet-content .sheet-title'); await settle(page);
    await shoot(page, `${c.key}-${v.id}-popup-${lang}-first`);
    // the whole popup: a screen tall enough for all of it (the popup takes at most 92 % of the screen's height, 90 % on a laptop)
    const need = await page.evaluate(() => document.getElementById('sheet').scrollHeight);
    const vp = page.viewportSize(); await page.setViewportSize({ width: vp.width, height: Math.ceil(need / 0.88) + 40 }); await settle(page);
    await shoot(page.locator('dialog#sheet'), `${c.key}-${v.id}-popup-${lang}-whole`);
    await ctx.close();
  }
}
await browser.close(); await db.end();

// ---- index.html, once both labels are in the folder
const have = async (f) => fs.access(path.join(out, f)).then(() => true, () => false);
if (await have(`before-${CASES[0].key}-laptop-editor.png`) && await have(`after-${CASES[0].key}-laptop-editor-4.png`)) {
  const fig = (file, cap) => `<figure><figcaption>${cap}</figcaption><a href="${file}"><img src="${file}" alt="${cap}" loading="lazy"></a></figure>`;
  const row = (title, figs, cls = '') => `<h4>${title}</h4><div class="row ${cls}">${figs.join('')}</div>`;
  const parts = [];
  for (const c of CASES) {
    parts.push(`<h2>${c.name} <small>${c.what}. Example pairs, in the scratch copy only: ${c.pairs.join(', ')} (${c.note}).</small></h2>`);
    for (const v of VIEWS) {
      parts.push(`<h3>${v.title}</h3>`);
      parts.push(row('Item editor', [fig(`before-${c.key}-${v.id}-editor.png`, 'Before'), fig(`after-${c.key}-${v.id}-editor-0.png`, 'After, 0 pairs'), fig(`after-${c.key}-${v.id}-editor-4.png`, v.id === 'laptop' ? 'After, 4 pairs (the fourth just added: the preview shows the popup)' : 'After, 4 pairs')], `v${v.id}`));
      parts.push(row('The picker (new)', [fig(`after-${c.key}-${v.id}-picker.png`, 'After')], `v${v.id}`));
      for (const [lang, name] of [['en', 'English'], ['fa', 'Persian']]) {
        parts.push(row(`Public popup, ${name}: the first screen`, [fig(`before-${c.key}-${v.id}-popup-${lang}-first.png`, 'Before'), fig(`after-${c.key}-${v.id}-popup-${lang}-first.png`, 'After')], `v${v.id}`));
        parts.push(row(`Public popup, ${name}: the whole popup`, [fig(`before-${c.key}-${v.id}-popup-${lang}-whole.png`, 'Before'), fig(`after-${c.key}-${v.id}-popup-${lang}-whole.png`, 'After')], `v${v.id} whole`));
      }
    }
  }
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goes well with: before and after</title><style>body{margin:0;padding:20px;font:15px/1.45 -apple-system,system-ui,sans-serif;background:#f5f5f7;color:#1d1d1f}h1{font-size:24px;margin:0 0 6px}h2{margin:44px 0 0;font-size:20px}h2 small{display:block;font-weight:400;font-size:14px;color:#6e6e73}h3{margin:28px 0 0;font-size:16px}h4{margin:18px 0 6px;font-size:13px;color:#6e6e73;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:start}.row.v390{grid-template-columns:repeat(3,minmax(0,300px))}.row.whole.vlaptop{grid-template-columns:repeat(2,minmax(0,420px))}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;display:block;border:1px solid #d2d2d7;border-radius:8px;background:#fff}p{max-width:70ch}</style></head><body><h1>Goes well with: before and after</h1><p>Before: main. After: branch <code>goes-well-with</code> with the rulings of 2026-11-19: the card below Price and the item’s choices, the block at the bottom of the popup, below the item’s own sizes and options. Shot again on 2026-11-19: every After, and the editor’s Before (framed like its After, on the end of Price and the choices, on main after the Next.js upgrade). The popup’s Before shots are those of 2026-11-18 (main at 41cc706; the customers’ pages are byte for byte the same after the upgrade). All builds on one scratch copy of the working database; the pairs are example data set in that copy only. Click an image for its full size. The whole-popup shots are taken on a screen tall enough to show all of the popup at once; the first-screen shots are what a customer gets on opening.</p>${parts.join('')}</body></html>`);
  console.log('index.html written');
}
console.log(`${shots.length} ${label} screenshots in ${out}`);
