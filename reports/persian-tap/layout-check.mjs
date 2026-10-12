// Before/after evidence for the Persian-tap fix (2026-10-12, after the first suite run): the page's layout in numbers, which the
// screenshots cannot show (Chromium's scroll anchoring keeps what is on screen in place when a box above it changes height, so a
// screenshot matches while the page under it has moved). The first version of the fix made each contained Grid list 24 px taller
// (Senso's page up to 72 px; the Style drill's position check) and left the lists in the old language's height after a switch (a tab
// tap on a fresh page in Persian landed up to 238 px off; 9328 px in WebKit). For each venue, language (chosen on the welcome screen,
// as a customer does) and browser (Chromium and WebKit, iPhone 13 viewport), on two builds of the same data:
//   1. a fresh page, the language tapped, 3 s later: the page's height and the top of every section (page coordinates);
//   2. the same after scrolling down to the bottom and back to the top as a customer does (80 % of a screen at a time);
//   3. fresh pages, a tab tapped 100 ms and 3 s after the language (the last section, then the first; a middle one): the distance
//      of the section's top from the tab bar's bottom once the scroll has stopped.
// Before and after must give the same numbers (0.5 px for heights and tops, 1 px for a tap).
//   node reports/persian-tap/layout-check.mjs --before http://127.0.0.1:A --after http://127.0.0.1:B --venues senso,kebab-land,<default> --out reports/persian-tap
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const venues = (args.venues || 'senso,kebab-land').split(',');
const out = path.resolve(args.out || 'reports/persian-tap');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEVICE = { chromium: devices['iPhone 13'], webkit: { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, hasTouch: true, isMobile: false } };

async function fresh(browser, bn, base, venue, lang) {
  const ctx = await browser.newContext(DEVICE[bn]); const p = await ctx.newPage();
  await p.goto(`${base}/${venue}`, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  await p.waitForSelector(`#welcome button[data-lang="${lang}"]`); await sleep(400);
  await p.click(`#welcome button[data-lang="${lang}"]`);
  return { ctx, p };
}
const geometry = (p) => p.evaluate(() => ({ height: document.documentElement.scrollHeight, tops: [...document.querySelectorAll('main section[id]')].map((s) => ({ id: s.id, top: +(s.getBoundingClientRect().top + scrollY).toFixed(2) })) }));
async function stopped(p) { let last = -1; for (let i = 0; i < 60; i++) { await sleep(150); const y = await p.evaluate(() => scrollY); if (y === last) return; last = y; } }

async function measure(browser, bn, base, venue, lang) {
  const r = {};
  { const { ctx, p } = await fresh(browser, bn, base, venue, lang); await sleep(3000); r.afterTap = await geometry(p);
    const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); const step = Math.round(DEVICE[bn].viewport.height * 0.8);
    for (let y = 0; y <= max + step; y += step) { await p.evaluate((y) => scrollTo(0, y), y); await sleep(60); }
    for (let y = max; y >= -step; y -= step) { await p.evaluate((y) => scrollTo(0, Math.max(0, y)), y); await sleep(60); }
    await sleep(500); r.afterWalk = await geometry(p); await ctx.close(); }
  r.taps = [];
  for (const delay of [100, 3000]) {
    const ids = r.afterTap.tops.map((t) => t.id);
    for (const seq of [[ids[ids.length - 1], ids[0]], [ids[Math.floor(ids.length / 2)]]]) {
      const { ctx, p } = await fresh(browser, bn, base, venue, lang); await sleep(delay);
      for (const id of seq) {
        await p.evaluate((id) => document.querySelector(`#tabs a[href="#${CSS.escape(id)}"]`).click(), id); await stopped(p); await sleep(200);
        const off = await p.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top - document.getElementById('tabs').getBoundingClientRect().bottom), id);
        r.taps.push({ delay, id, off });
      }
      await ctx.close();
    }
  }
  return r;
}

const rows = [], lines = [];
for (const [bn, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await bt.launch();
  for (const venue of venues) for (const lang of ['en', 'fa']) {
    const before = await measure(browser, bn, args.before, venue, lang), after = await measure(browser, bn, args.after, venue, lang);
    const cmp = (a, b) => ({ height: +(b.height - a.height).toFixed(2), tops: a.tops.map((t, i) => ({ id: t.id, d: +(b.tops[i].top - t.top).toFixed(2) })).filter((x) => Math.abs(x.d) > 0.5) });
    const tapDiff = before.taps.map((t, i) => ({ delay: t.delay, id: t.id, before: t.off, after: after.taps[i].off })).filter((x) => Math.abs(x.after - x.before) > 1);
    const c1 = cmp(before.afterTap, after.afterTap), c2 = cmp(before.afterWalk, after.afterWalk);
    const same = Math.abs(c1.height) <= 0.5 && !c1.tops.length && Math.abs(c2.height) <= 0.5 && !c2.tops.length && !tapDiff.length;
    rows.push({ browser: bn, venue, lang, same, before, after, differences: { afterTap: c1, afterWalk: c2, taps: tapDiff } });
    const line = `${bn} ${venue} ${lang}: page ${before.afterTap.height} / ${after.afterTap.height} px 3 s after the tap, ${before.afterWalk.height} / ${after.afterWalk.height} px after a walk down and up; sections at a different top: ${c1.tops.length + c2.tops.length}; tab taps (100 ms and 3 s after the language) off the bar by ${before.taps.map((t) => t.off).join(' ')} / ${after.taps.map((t) => t.off).join(' ')} px; ${same ? 'SAME' : 'DIFFERENT'}`;
    lines.push(line); console.log(line);
  }
  await browser.close();
}
fs.writeFileSync(path.join(out, 'layout-check.json'), JSON.stringify({ at: new Date().toISOString(), before: args.before, after: args.after, rows }, null, 1));
fs.writeFileSync(path.join(out, 'layout-check.md'), ['# Layout in numbers, before / after', '', `${new Date().toISOString()}; before ${args.before}, after ${args.after}; each line: before / after.`, '', ...lines.map((l) => `- ${l}`), '', `${rows.filter((r) => r.same).length} of ${rows.length} the same.`, ''].join('\n'));
