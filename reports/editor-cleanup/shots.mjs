#!/usr/bin/env node
// Item editor clean-up (the PM, 2026-11-04): before/after screenshots of the item editor for Kian's ruling, and the overflow measurement
// the brief asks for (nothing clips, overflows or scrolls sideways at the laptop column width or at 360 px).
//   For four items (Pumpkin Soup: seasonal, allergens to confirm; Red Wine Sangria: Kebab Land, sizes; Latte: Senso, choice groups;
//   Baba Ghanoosh: no photo) it opens the editor as staff see it on opening (nothing else tapped) and takes, on a laptop (1440 × 900, the
//   editor as its 440 px column) and on a 390 px phone (the iPhone 13 viewport), the first screen and the whole editor (a viewport tall
//   enough for all of it). Then it measures every element of the editor at 440 px (laptop column), 390 px and 360 px: an element reaching
//   past the editor's edges, text cut short, a sideways scroll. The Menu list of one section is shot too (the reorder moved there).
// Screenshots go to reports/editor-cleanup/shots/ (gitignored, deleted after Kian's ruling); the numbers to overflow-<label>.json beside them.
// Needs a server on a scratch copy of the database and an admin PIN valid on any venue (a throwaway admin in that copy):
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node reports/editor-cleanup/shots.mjs --base http://127.0.0.1:<port> --label before|after
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from '../../scripts/load-env.mjs';
import { scratchTarget } from '../../scripts/scratch-target.mjs';

// The target is a scratch server, or the script stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('reports/editor-cleanup/shots.mjs', { options: { base: 'server', label: ['before', 'after'], out: 'path', 'measure-only': 'flag' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const base = args.base, label = args.label;
const out = path.resolve(args.out);
const pin = process.env.DRILL_ADMIN_PIN;
await fs.mkdir(out, { recursive: true });
const db = await connectDb('editor-cleanup-shots');
const idOf = async (venue, name) => (await db.query(`select id from items where venue_id = $1 and name->>'en' = $2 order by listed desc limit 1`, [venue, name])).rows[0]?.id;
const CASES = [
  { key: 'pumpkin-soup', venue: 'senso', name: 'Pumpkin Soup', what: 'seasonal (fall), allergens to confirm' },
  { key: 'red-wine-sangria', venue: 'kebab-land', name: 'Red Wine Sangria', what: 'Kebab Land, two sizes' },
  { key: 'latte', venue: 'senso', name: 'Latte', what: 'Senso drink, choice groups (a second group "Milk" added in the scratch copy only)' },
  { key: 'baba-ghanoosh', venue: 'kebab-land', name: 'Baba Ghanoosh', what: 'no photo' },
];
for (const c of CASES) { c.id = await idOf(c.venue, c.name); if (!c.id) { console.error(`no item "${c.name}" on ${c.venue}`); process.exit(2); } }
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const signedIn = new Map(); // one signed-in context per viewport
async function signin(page, venue) {
  await page.goto(`${base}/admin/${venue}`);
  if (await page.locator('input[name=pin]').count()) { await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); }
  await page.waitForSelector('[data-item]');
}
async function openItem(page, c) {
  await signin(page, c.venue);
  await page.fill('input[aria-label="Search items"]', c.name);
  const b = page.locator(`[data-item="${c.id}"] button[aria-label^="Edit"]`).first(); await b.scrollIntoViewIfNeeded(); await b.click();
  await page.waitForSelector(`.item-panel[aria-label="Edit ${c.name}"]`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.item-panel img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))); await document.fonts.ready; });
  await sleep(450); // the column's slide-in
}
// The editor's scroll area: the element under the editor's top bar that scrolls.
const scrollerOf = (page) => page.evaluate(() => { const p = document.querySelector('.item-panel'); const s = [...p.querySelectorAll('*')].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > 0); return s ? { scroll: s.scrollHeight, client: s.clientHeight, top: Math.round(s.getBoundingClientRect().top) } : null; });
// Everything in the editor that reaches past its edges, text cut short, a sideways scroll.
const MEASURE = () => {
  const panel = document.querySelector('.item-panel'); const pr = panel.getBoundingClientRect();
  const desc = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}${el.textContent?.trim() ? ` "${el.textContent.trim().slice(0, 40)}"` : ''}`;
  const found = [];
  for (const s of [panel, ...panel.querySelectorAll('*')]) {
    const st = getComputedStyle(s);
    if (/(auto|scroll)/.test(st.overflowX) && s.scrollWidth > s.clientWidth + 1) found.push({ kind: 'sideways scroll', el: desc(s), scrollWidth: s.scrollWidth, clientWidth: s.clientWidth });
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) found.push({ kind: 'page wider than the screen', scrollWidth: document.documentElement.scrollWidth, innerWidth });
  const info = [];
  for (const el of panel.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none' || el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
    if (r.right > pr.right + 0.5 || r.left < pr.left - 0.5) found.push({ kind: 'past the editor\'s edge', el: desc(el), left: Math.round(r.left - pr.left), right: Math.round(r.right - pr.left), width: Math.round(pr.width) });
    // cut by a box around it that hides what spills over (left or right; scrolling up and down is the editor's own)
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowX === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) { found.push({ kind: 'cut by the box around it', el: desc(el), box: desc(a).slice(0, 60), left: Math.round(r.left - ar.left), right: Math.round(ar.right - r.right) }); break; }
      if (a === panel) break;
    }
    // text cut short: a box that hides what spills over (an ellipsis, a line clamp, a one-line text box) and holds more than it shows
    const hides = st.overflowX !== 'visible' || st.textOverflow === 'ellipsis' || +st.webkitLineClamp > 0;
    if (el.tagName === 'TEXTAREA' && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) found.push({ kind: 'text box shows part of its text', el: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    else if (el.tagName === 'INPUT') { if (el.type === 'text' && el.scrollWidth > el.clientWidth + 1) info.push({ kind: 'a one-line field holds more than it shows (scrolls inside as it is typed in)', el: desc(el) }); }
    else if (hides && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || (!/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1))) found.push({ kind: 'text cut short', el: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
  }
  return { width: Math.round(pr.width), found, info };
};
const shots = []; const overflow = [];
const measureOnly = process.argv.includes('--measure-only');
const VIEWS = [
  { id: 'laptop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, column: true, shoot: !measureOnly },
  { id: '390', ctx: { ...devices['iPhone 13'], deviceScaleFactor: 2 }, shoot: !measureOnly },
  { id: '360', ctx: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, shoot: false },
];
for (const v of VIEWS) {
  const ctx = await browser.newContext(v.ctx); const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`pageerror (${v.id}): ${e.message}`));
  for (const c of CASES) {
    await openItem(page, c);
    const m = await page.evaluate(MEASURE); overflow.push({ view: v.id, item: c.name, ...m });
    console.log(`${label} ${v.id} ${c.name}: editor ${m.width} px wide; ${m.found.length ? m.found.map((f) => `${f.kind}: ${f.el ?? ''}`).join('; ') : 'nothing past its edges, cut short or scrolling sideways'}`);
    if (v.shoot) {
      const first = path.join(out, `${label}-${c.key}-${v.id}-first.png`);
      if (v.column) await page.locator('.item-panel').screenshot({ path: first }); else await page.screenshot({ path: first });
      const s = await scrollerOf(page); const vp = page.viewportSize();
      const tall = Math.max(vp.height, Math.ceil(s.top + s.scroll + 8));
      await page.setViewportSize({ width: vp.width, height: tall }); await sleep(350);
      const full = path.join(out, `${label}-${c.key}-${v.id}-full.png`);
      if (v.column) await page.locator('.item-panel').screenshot({ path: full }); else await page.screenshot({ path: full });
      await page.setViewportSize(vp); await sleep(150);
      shots.push(first, full);
    }
  }
  if (v.id === '390' && !measureOnly) { // the Menu list of the item's section: reordering moved there (after); the plain list (before)
    await signin(page, 'senso');
    const sec = (await db.query(`select s.id, s.name->>'en' as name from sections s join item_sections x on x.section_id = s.id join items i on i.id = x.item_id where i.id = $1 and not s.seasonal`, [CASES[0].id])).rows[0];
    const reorder = page.locator(`button[aria-label="Section menu: ${sec.name}"]`);
    await reorder.scrollIntoViewIfNeeded(); await reorder.click();
    const item = page.getByRole('menuitem', { name: 'Reorder items' });
    if (await item.count()) { await item.click(); await page.waitForSelector(`[data-reorder="${sec.id}"]`); } else await page.keyboard.press('Escape');
    await page.evaluate((id) => { const el = document.getElementById(`sec-${id}`); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 176); }, sec.id); await sleep(400); // under the sticky top bar, tabs and search
    const f = path.join(out, `${label}-menu-list-390.png`); await page.screenshot({ path: f }); shots.push(f);
  }
  await ctx.close();
}
await browser.close(); await db.end();
await fs.writeFile(path.join(out, `overflow-${label}.json`), JSON.stringify({ base, label, at: new Date().toISOString(), cases: CASES.map(({ key, venue, name, what }) => ({ key, venue, name, what })), overflow }, null, 2));
// A page that puts each before beside its after, for Kian's ruling (local, in the same gitignored folder).
const have = async (f) => fs.access(path.join(out, f)).then(() => true, () => false);
if (await have('overflow-before.json') && await have('overflow-after.json')) {
  const ob = JSON.parse(await fs.readFile(path.join(out, 'overflow-before.json'), 'utf8')), oa = JSON.parse(await fs.readFile(path.join(out, 'overflow-after.json'), 'utf8'));
  const count = (o) => o.overflow.filter((x) => x.found.length).length;
  const pair = (b, a, title) => `<h3>${title}</h3><div class="pair"><figure><figcaption>Before</figcaption><img src="${b}" alt="before: ${title}"></figure><figure><figcaption>After</figcaption><img src="${a}" alt="after: ${title}"></figure></div>`;
  const parts = [];
  for (const c of CASES) {
    parts.push(`<h2>${c.name} <small>${c.what}</small></h2>`);
    for (const v of [['laptop', 'laptop, the editor as its 440 px column'], ['390', '390 px phone']]) for (const k of [['first', 'first screen'], ['full', 'whole editor']]) parts.push(pair(`before-${c.key}-${v[0]}-${k[0]}.png`, `after-${c.key}-${v[0]}-${k[0]}.png`, `${v[1]}, ${k[1]}`));
  }
  parts.push('<h2>Menu list <small>Reorder items in a section\'s menu (after); the plain list (before)</small></h2>', pair('before-menu-list-390.png', 'after-menu-list-390.png', '390 px phone'));
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Item editor before and after</title><style>body{margin:0;padding:16px;font:15px/1.4 -apple-system,system-ui,sans-serif;background:#f5f5f7;color:#1d1d1f}h1{font-size:22px}h2{margin-top:40px;font-size:19px}h2 small{font-weight:400;color:#6e6e73}h3{font-size:14px;color:#6e6e73;font-weight:500}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;max-width:440px;display:block;border:1px solid #e5e5ea;border-radius:8px;background:#fff}</style></head><body><h1>Item editor: before and after</h1><p>Opened as staff see it on opening, nothing else tapped. Overflow measured at 440 px (laptop column), 390 px and 360 px: before, ${count(ob)} of ${ob.overflow.length} views had text cut short; after, ${count(oa)} of ${oa.overflow.length}.</p>${parts.join('')}</body></html>`);
}
const bad = overflow.filter((o) => o.found.length);
console.log(`${shots.length} screenshots in ${out}; overflow: ${bad.length ? `${bad.length} of ${overflow.length} views with findings` : `none in ${overflow.length} views (4 items × laptop column, 390, 360)`}`);
