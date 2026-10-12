// Before/after evidence for the Persian-tap fix (the PM, 2026-10-12): the category tabs' scroll-follow on two builds of the same data.
// For each venue and language (chosen on the welcome screen, as a customer does), the page is scrolled to ten positions, evenly from the
// top to the bottom (the same pixels on both builds: those of the first build), and the active tab is read together with the section
// that is really under the tab bar (elementFromPoint just below the bar's bottom edge; at the bottom of the page the last section, the
// tabs' own rule). Then up to five tab taps (every third tab, from the top): does the tapped section's heading land at the bar (within
// 2 px, or the page at its bottom)? Chromium, iPhone 13 viewport.
//   node reports/persian-tap/scroll-follow.mjs --before http://127.0.0.1:A --after http://127.0.0.1:B --venues senso,kebab-land,<default> --out reports/persian-tap
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const venues = (args.venues || 'senso,kebab-land').split(','), out = path.resolve(args.out || 'reports/persian-tap'); fs.mkdirSync(out, { recursive: true });
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function openMenu(base, venue, lang) {
  const ctx = await browser.newContext(DEVICE); const p = await ctx.newPage();
  await p.goto(`${base}/${venue}`, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  if (await p.evaluate(() => document.documentElement.dataset.welcome === 'show')) {
    await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('#welcome button[data-lang="fa"]')).opacity) === 1, null, { timeout: 8000 });
    await p.tap(`#welcome button[data-lang="${lang}"]`);
    await p.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 5000 });
  }
  await sleep(700);
  return { ctx, p };
}
const settle = async (p) => { let last = -1; for (let i = 0; i < 40; i++) { const y = await p.evaluate(() => scrollY); if (y === last) break; last = y; await sleep(150); } await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const probe = (p) => p.evaluate(() => {
  const nav = document.getElementById('tabs'), b = nav ? nav.getBoundingClientRect().bottom : 0, secs = [...document.querySelectorAll('main section[id]')];
  const el = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight - 1, b + 2)), sec = el && el.closest('main section[id]');
  const bottom = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 1;
  let truth = bottom ? secs[secs.length - 1].id : sec ? sec.id : null;
  if (!truth) for (const s of secs) if (s.getBoundingClientRect().top <= b + 1) truth = s.id; // in a gap between sections: the one above it
  const a = document.querySelector('#tabs a.active');
  return { y: Math.round(scrollY), height: document.documentElement.scrollHeight, active: a ? a.getAttribute('data-tab') : null, truth, bottom };
});
async function run(base, venue, lang, positions) {
  const { ctx, p } = await openMenu(base, venue, lang);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const ys = positions || Array.from({ length: 10 }, (_, i) => Math.round((i / 9) * max));
  const samples = [];
  for (const y of ys) { await p.evaluate((y) => window.scrollTo(0, y), y); await settle(p); await sleep(60); samples.push({ want: y, ...(await probe(p)) }); }
  const ids = await p.evaluate(() => [...document.querySelectorAll('#tabs a[data-tab]')].map((a) => a.getAttribute('data-tab')));
  const taps = [];
  for (const id of ids.filter((_, i) => i % 3 === 0).slice(0, 5)) {
    await p.evaluate(() => window.scrollTo(0, 0)); await settle(p);
    await p.click(`#tabs a[data-tab="${id}"]`); await sleep(200); await settle(p); await sleep(250); await settle(p);
    taps.push(await p.evaluate((id) => { const nav = document.getElementById('tabs'), b = nav ? nav.getBoundingClientRect().bottom : 0, t = document.getElementById(id).getBoundingClientRect().top, a = document.querySelector('#tabs a.active'), bottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 1; return { id, off: Math.round(t - b), active: a ? a.getAttribute('data-tab') : null, bottom, lands: Math.abs(t - b) <= 2 || (bottom && t > b) }; }, id));
  }
  await ctx.close();
  return { ys, samples, taps };
}

const result = { at: new Date().toISOString(), before: args.before, after: args.after, rows: [] };
for (const venue of venues) for (const lang of ['en', 'fa']) {
  const B = await run(args.before, venue, lang, null), A = await run(args.after, venue, lang, B.ys);
  const ok = (s) => s.active === s.truth;
  const row = { venue, lang, before: B, after: A, beforeRight: B.samples.filter(ok).length, afterRight: A.samples.filter(ok).length, sameActive: B.samples.filter((s, i) => s.active === A.samples[i].active).length, tapsBefore: B.taps.filter((t) => t.lands && t.active === t.id).length, tapsAfter: A.taps.filter((t) => t.lands && t.active === t.id).length, taps: B.taps.length };
  result.rows.push(row);
  console.log(`${venue} ${lang}: active = section under the bar at ${row.beforeRight}/10 before, ${row.afterRight}/10 after; the same tab active at ${row.sameActive}/10; tab taps landing at the bar with their tab active ${row.tapsBefore}/${row.taps} before, ${row.tapsAfter}/${row.taps} after`);
}
fs.writeFileSync(path.join(out, 'scroll-follow.json'), JSON.stringify(result, null, 2));
const md = ['| Venue | Language | Active tab = section under the bar (before / after) | Same tab as before | Tab taps landing (before / after) | Positions (px) |', '|---|---|---|---|---|---|',
  ...result.rows.map((r) => `| ${r.venue} | ${r.lang} | ${r.beforeRight}/10 / ${r.afterRight}/10 | ${r.sameActive}/10 | ${r.tapsBefore}/${r.taps} / ${r.tapsAfter}/${r.taps} | ${r.before.ys.join(', ')} |`), '',
  ...result.rows.flatMap((r) => [`${r.venue} ${r.lang}, per position (want y → before: y, active / under the bar; after: y, active / under the bar):`, ...r.before.samples.map((s, i) => { const a = r.after.samples[i]; return `- ${s.want} → before ${s.y}, ${s.active} / ${s.truth}; after ${a.y}, ${a.active} / ${a.truth}${s.active === a.active ? '' : '  ← different tab'}`; }), `- tab taps (offset of the heading from the bar, px): before ${r.before.taps.map((t) => `${t.id} ${t.off}${t.bottom ? ' (bottom)' : ''}`).join(', ')}; after ${r.after.taps.map((t) => `${t.id} ${t.off}${t.bottom ? ' (bottom)' : ''}`).join(', ')}`, ''])];
fs.writeFileSync(path.join(out, 'scroll-follow.md'), md.join('\n'));
await browser.close();
