#!/usr/bin/env node
// Admin-wide clean-up (the PM, 2026-11-06): before/after screenshots of every admin screen for Kian's ruling, and the layout measure on
// each (the rules of scripts/layout-drill.mjs: nothing past the screen's edges, cut by its box, cut short or scrolling sideways; the text
// sizes; the corner radii). On a laptop (1440 × 900) and a 390 px phone (the iPhone 13 viewport) the screen is shot (the first screen, and
// the whole page where it scrolls); at 360 px it is measured only. Screenshots and numbers go to reports/admin-cleanup/shots/ (gitignored,
// deleted after Kian's ruling), with index.html putting each before beside its after.
// Needs a server on a scratch copy of the database and of the uploads, and a throwaway admin there:
//   DATABASE_URL=… DRILL_ADMIN_PIN=… DRILL_ADMIN_EMAIL=… DRILL_ADMIN_PASSWORD=… node reports/admin-cleanup/shots.mjs --base http://127.0.0.1:<port> --label before|after
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from '../../scripts/load-env.mjs';
import { MEASURE, adminScreens } from '../../scripts/layout-rules.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const base = args.base, label = args.label || 'after', out = path.resolve(args.out || 'reports/admin-cleanup/shots');
const pin = process.env.DRILL_ADMIN_PIN;
if (!base || !pin) { console.error('usage: DRILL_ADMIN_PIN=… node reports/admin-cleanup/shots.mjs --base <url> --label before|after'); process.exit(2); }
await fs.mkdir(out, { recursive: true });
const db = await connectDb('admin-cleanup-shots');
// one section with items for the section screens, and an open alert for the alerts card (scratch copy only)
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = 'senso' and not seasonal and listed order by position offset 1 limit 1`)).rows[0];
await db.query(`delete from admin_alerts where message like 'Shots:%'`);
await db.query(`insert into admin_alerts (venue_id, kind, message) values ('senso', 'lockout-cap', 'Shots: 50 wrong PINs on this venue in the last hour')`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { SCREENS, signin, settle } = adminScreens({ base, pin, sec });
const VIEWS = [
  { id: 'laptop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, shoot: true },
  { id: '390', ctx: { ...devices['iPhone 13'], deviceScaleFactor: 2 }, shoot: true },
  { id: '360', ctx: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, shoot: false },
];
const browser = await chromium.launch();
const measured = [], shots = [];
for (const v of VIEWS) {
  const out1 = await browser.newContext(v.ctx), in1 = await browser.newContext(v.ctx);
  const signedOut = await out1.newPage(), signedIn = await in1.newPage(); await signin(signedIn);
  for (const [key, title, inside, setup, whole] of SCREENS) {
    const page = inside ? signedIn : signedOut;
    try { await setup(page); } catch (e) { console.log(`${label} ${v.id} ${key}: NOT REACHED (${e.message.split('\n')[0]})`); measured.push({ view: v.id, key, title, error: e.message.split('\n')[0] }); continue; }
    await settle(page);
    const m = await page.evaluate(MEASURE); measured.push({ view: v.id, key, title, ...m });
    console.log(`${label} ${v.id} ${key}: ${m.found.length ? `${m.found.length} problem(s): ${m.found.slice(0, 4).join('; ')}` : 'nothing cut, past the edges or sideways'}; sizes ${m.sizes.join(' ')}; radii ${m.radii.join(' ') || 'none'}`);
    if (v.shoot) {
      const f = path.join(out, `${label}-${key}-${v.id}.png`); await page.screenshot({ path: f }); shots.push(f);
      if (whole) { const g = path.join(out, `${label}-${key}-${v.id}-full.png`); await page.screenshot({ path: g, fullPage: true }); shots.push(g); }
    }
    await page.keyboard.press('Escape').catch(() => {}); await page.keyboard.press('Escape').catch(() => {});
  }
  await out1.close(); await in1.close();
}
await browser.close();
await db.query(`delete from admin_alerts where message like 'Shots:%'`); await db.end();
await fs.writeFile(path.join(out, `layout-${label}.json`), JSON.stringify({ base, label, at: new Date().toISOString(), screens: SCREENS.map(([key, title]) => ({ key, title })), measured }, null, 2));
// a page that puts each before beside its after (when both exist)
const have = async (f) => fs.access(path.join(out, f)).then(() => true, () => false);
if (await have('layout-before.json') && await have('layout-after.json')) {
  const lb = JSON.parse(await fs.readFile(path.join(out, 'layout-before.json'), 'utf8')), la = JSON.parse(await fs.readFile(path.join(out, 'layout-after.json'), 'utf8'));
  const bad = (l) => l.measured.filter((x) => x.found?.length).length;
  const parts = [];
  for (const [key, title, , , whole] of SCREENS) {
    parts.push(`<h2>${title}</h2>`);
    for (const v of ['laptop', '390']) for (const suffix of whole ? ['', '-full'] : ['']) {
      const b = `before-${key}-${v}${suffix}.png`, a = `after-${key}-${v}${suffix}.png`;
      parts.push(`<h3>${v === 'laptop' ? 'Laptop (1440 px)' : '390 px phone'}${suffix ? ', the whole page' : ''}</h3><div class="pair"><figure><figcaption>Before</figcaption>${await have(b) ? `<img src="${b}" alt="before">` : '<p>(not reached)</p>'}</figure><figure><figcaption>After</figcaption>${await have(a) ? `<img src="${a}" alt="after">` : '<p>(not reached)</p>'}</figure></div>`);
    }
  }
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin before and after</title><style>body{margin:0;padding:16px;font:15px/1.4 -apple-system,system-ui,sans-serif;background:#f5f5f7;color:#1d1d1f}h1{font-size:22px}h2{margin-top:40px;font-size:19px}h3{font-size:14px;color:#6e6e73;font-weight:500}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;display:block;border:1px solid #e5e5ea;border-radius:8px;background:#fff}</style></head><body><h1>Admin: before and after</h1><p>Every screen on a laptop (1440 px) and a 390 px phone. Layout measured at 1440, 390 and 360 px: before, ${bad(lb)} of ${lb.measured.length} screen views had something cut, past the edges or scrolling sideways; after, ${bad(la)} of ${la.measured.length}.</p>${parts.join('')}</body></html>`);
}
console.log(`${shots.length} screenshots in ${out}; ${measured.filter((x) => x.found?.length).length} of ${measured.length} screen views with layout problems; ${measured.filter((x) => x.error).length} not reached`);
