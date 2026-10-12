// Before/after evidence for the Persian-tap fix (the PM, 2026-10-12): Kebab Land and the default template must look the same. For each
// venue and language (chosen on the welcome screen), viewport screenshots of two builds of the same data at the top and at ten scroll
// positions, evenly from the top to the bottom (the same pixels on both), compared pixel by pixel in the browser (canvas). Photos from
// other hosts are blocked on both builds (they load at their own pace and would differ for nothing); uploaded photos load. Chromium,
// iPhone 13 viewport. Each position is reached as a customer scrolls: down from the previous one at most 80 % of a screen at a time,
// a few frames each (lists are laid out as they come near, as they are for a customer). A difference is listed with its count of
// pixels and its box, and both screenshots are saved. --control: the first build against itself (the noise floor of the method).
//   node reports/persian-tap/visual-diff.mjs --before http://127.0.0.1:A --after http://127.0.0.1:B --venues kebab-land,<default> --out reports/persian-tap
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--control').map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
args.control = process.argv.includes('--control');
const venues = (args.venues || 'kebab-land').split(','), out = path.resolve(args.out || 'reports/persian-tap'); fs.mkdirSync(path.join(out, 'diff'), { recursive: true });
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const cmp = await browser.newPage();
async function shots(base, venue, lang, ys) {
  const ctx = await browser.newContext(DEVICE);
  await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return r.request().resourceType() === 'image' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost' ? r.abort() : r.continue(); });
  const p = await ctx.newPage();
  await p.goto(`${base}/${venue}`, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  if (await p.evaluate(() => document.documentElement.dataset.welcome === 'show')) {
    await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('#welcome button[data-lang="fa"]')).opacity) === 1, null, { timeout: 8000 });
    await p.tap(`#welcome button[data-lang="${lang}"]`);
    await p.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 5000 });
  }
  await sleep(800);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  ys = ys || [0, ...Array.from({ length: 10 }, (_, i) => Math.round((i / 9) * max))];
  const pics = [];
  for (const y of ys) { await p.evaluate(async (y) => { const step = innerHeight * 0.8; const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); let at = scrollY; if (y < at) { window.scrollTo(0, y); await f(); } while (Math.abs(y - scrollY) > 1 && at !== y) { at = y > scrollY ? Math.min(y, scrollY + step) : y; window.scrollTo(0, at); await f(); } }, y); await sleep(500); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); pics.push(await p.screenshot()); }
  await ctx.close();
  return { ys, pics };
}
const diff = (a, b) => cmp.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  if (A.width !== B.width || A.height !== B.height) return { pixels: -1, box: null, size: [A.width, A.height, B.width, B.height] };
  const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d');
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) { n++; const p = i / 4, x = p % c.width, y = (p / c.width) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { pixels: n, box: n ? [x0, y0, x1, y1] : null };
}, [a.toString('base64'), b.toString('base64')]);

const rows = [];
for (const venue of venues) for (const lang of ['en', 'fa']) {
  const B = await shots(args.before, venue, lang, null), A = await shots(args.control ? args.before : args.after, venue, lang, B.ys);
  const per = [];
  for (let i = 0; i < B.ys.length; i++) {
    const d = await diff(B.pics[i], A.pics[i]);
    if (d.pixels && !args.control) { fs.writeFileSync(path.join(out, 'diff', `${venue}-${lang}-${i}-before.png`), B.pics[i]); fs.writeFileSync(path.join(out, 'diff', `${venue}-${lang}-${i}-after.png`), A.pics[i]); }
    per.push({ y: B.ys[i], ...d });
  }
  const differing = per.filter((d) => d.pixels !== 0);
  rows.push({ venue, lang, shots: per.length, differing: differing.length, per });
  console.log(`${venue} ${lang}: ${per.length} screenshots compared, ${differing.length} with any differing pixel${differing.length ? `: ${differing.map((d) => `y ${d.y}: ${d.pixels} px in [${d.box}]`).join('; ')}` : ''}`);
}
fs.writeFileSync(path.join(out, args.control ? 'visual-diff-control.json' : 'visual-diff.json'), JSON.stringify({ at: new Date().toISOString(), before: args.before, after: args.control ? args.before : args.after, control: args.control, rows }, null, 2));
await browser.close();
