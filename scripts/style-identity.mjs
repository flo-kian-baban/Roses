#!/usr/bin/env node
// Day-one visual identity of the colour tokens (Kian, 2026-10-08): screenshots of the public pages before and after the
// token system, compared pixel by pixel. No new dependency: the PNGs are decoded and compared on a canvas inside Playwright's
// Chromium, which also draws the diff image. Reduced motion is emulated so the intro is skipped and nothing animates.
//   node scripts/style-identity.mjs shoot --base http://127.0.0.1:3003 --out <dir> [--venues senso,kebab-land]
//   node scripts/style-identity.mjs compare --before <dir> --after <dir> --out <dir> [--tolerance 0]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const [mode, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const venues = (args.venues || 'senso,kebab-land').split(',');
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };

// Deterministic capture: every photo loaded (a lazy one that failed is asked for once more), the tab strip at its start
// (the page's own "scroll the active tab into view" would otherwise leave it mid-way), the page at the top.
async function loadAllImages(page) {
  await page.evaluate(async () => { const step = Math.floor(window.innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } window.scrollTo(0, 0); });
  const deadline = Date.now() + 90000;
  let state; let retried = false;
  do {
    state = await page.evaluate(() => { const imgs = [...document.images]; return { total: imgs.length, complete: imgs.filter((i) => i.complete).length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, failed: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src) }; });
    if (state.complete === state.total && state.loaded === state.total) break;
    if (state.complete === state.total && state.failed.length && !retried) { retried = true; await page.evaluate(() => { for (const i of document.images) if (i.complete && i.naturalWidth === 0) { const s = i.src; i.src = ''; i.src = s; } }); }
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  await page.evaluate(() => { const ul = document.querySelector('#tabs ul'); if (ul) ul.scrollLeft = 0; window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  return state;
}

if (mode === 'shoot') {
  const base = args.base || 'http://127.0.0.1:3002'; const out = path.resolve(args.out || 'reports/style-tokens/shots');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const manifest = { base, at: new Date().toISOString(), shots: [] };
  for (const venue of venues) {
    const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    await page.goto(`${base}/${venue}`, { waitUntil: 'networkidle' });
    await loadAllImages(page);
    const shot = async (name, opts = {}) => { const f = path.join(out, `${venue}-${name}.png`); await page.screenshot({ path: f, ...opts }); manifest.shots.push({ venue, name, file: path.basename(f) }); };
    await shot('en', { fullPage: true });
    await page.click('#lang-toggle'); await page.waitForTimeout(300); await loadAllImages(page);
    await shot('fa', { fullPage: true });
    await page.click('#lang-toggle'); await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
    await page.locator('li.item').first().click(); await page.waitForSelector('dialog#sheet[open]'); await page.waitForTimeout(400);
    await page.evaluate(async () => { const imgs = [...document.querySelectorAll('#sheet img')]; await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))); });
    await shot('sheet');
    await page.click('#sheet-close'); await page.waitForTimeout(300);
    await page.click('#tabs-list'); await page.waitForSelector('dialog#sections-dialog[open]'); await page.waitForTimeout(300);
    await shot('sections');
    await ctx.close();
  }
  await browser.close();
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${manifest.shots.length} screenshots in ${out}`);
  process.exit(0);
}

if (mode === 'compare') {
  const before = path.resolve(args.before), after = path.resolve(args.after), out = path.resolve(args.out || 'reports/style-tokens/diff');
  const tolerance = Number(args.tolerance || 0);
  await fs.mkdir(out, { recursive: true });
  const names = (await fs.readdir(before)).filter((f) => f.endsWith('.png')).sort();
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const results = [];
  for (const name of names) {
    const a = await fs.readFile(path.join(before, name)).catch(() => null), b = await fs.readFile(path.join(after, name)).catch(() => null);
    if (!a || !b) { results.push({ name, missing: !a ? 'before' : 'after' }); continue; }
    const r = await page.evaluate(async ([da, db, tol]) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const ia = await load(da), ib = await load(db);
      const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
      const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const A = cv(ia), B = cv(ib);
      const dc = document.createElement('canvas'); dc.width = w; dc.height = h; const dx = dc.getContext('2d'); dx.drawImage(ib, 0, 0); const D = dx.getImageData(0, 0, w, h);
      let diff = 0, maxDelta = 0; let minX = w, minY = h, maxX = -1, maxY = -1; const rows = new Map();
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        if (d > tol) { diff++; if (d > maxDelta) maxDelta = d; const p = i / 4, x = p % w, y = (p - x) / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; rows.set(y, (rows.get(y) || 0) + 1); D.data[i] = 255; D.data[i + 1] = 0; D.data[i + 2] = 0; D.data[i + 3] = 255; }
        else { const g = Math.round((D.data[i] + D.data[i + 1] + D.data[i + 2]) / 3); D.data[i] = D.data[i + 1] = D.data[i + 2] = 180 + Math.round(g * 0.3); }
      }
      dx.putImageData(D, 0, 0);
      // clusters: runs of consecutive rows that have differences
      const ys = [...rows.keys()].sort((p, q) => p - q); const clusters = []; let cur = null;
      for (const y of ys) { if (cur && y - cur.y2 <= 3) { cur.y2 = y; cur.pixels += rows.get(y); } else { cur = { y1: y, y2: y, pixels: rows.get(y) }; clusters.push(cur); } }
      return { width: w, height: h, sizeBefore: [ia.width, ia.height], sizeAfter: [ib.width, ib.height], diff, maxDelta, box: maxX < 0 ? null : [minX, minY, maxX, maxY], clusters: clusters.slice(0, 40), clusterCount: clusters.length, png: diff ? dc.toDataURL('image/png') : null };
    }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`, tolerance]);
    const total = r.width * r.height;
    const row = { name, width: r.width, height: r.height, sizeBefore: r.sizeBefore, sizeAfter: r.sizeAfter, sameSize: r.sizeBefore[0] === r.sizeAfter[0] && r.sizeBefore[1] === r.sizeAfter[1], diffPixels: r.diff, totalPixels: total, diffPercent: Math.round((r.diff / total) * 10000) / 100, maxDelta: r.maxDelta, box: r.box, clusters: r.clusters, clusterCount: r.clusterCount };
    if (r.png) { const f = `diff-${name}`; await fs.writeFile(path.join(out, f), Buffer.from(r.png.split(',')[1], 'base64')); row.diffImage = f; }
    results.push(row);
    console.log(`${name}: ${r.diff} of ${total} pixels differ (${row.diffPercent} %, max channel delta ${r.maxDelta}); size before ${r.sizeBefore.join('×')}, after ${r.sizeAfter.join('×')}${r.box ? `; box x ${r.box[0]}–${r.box[2]}, y ${r.box[1]}–${r.box[3]}, ${r.clusterCount} row cluster(s)` : ''}`);
  }
  await browser.close();
  const identical = results.filter((r) => !r.missing && r.diffPixels === 0 && r.sameSize).length;
  const md = [`# Day-one visual identity — ${new Date().toISOString()}`, '', `Before: \`${before}\`  ·  After: \`${after}\`  ·  tolerance ${tolerance} (max channel delta allowed per pixel)`, '', '| Screenshot | Size before → after | Differing pixels | Max delta | Where (x1,y1 – x2,y2) | Row clusters | Diff image |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...results.map((r) => r.missing ? `| ${r.name} | missing in ${r.missing} | | | | | |` : `| ${r.name} | ${r.sizeBefore.join('×')} → ${r.sizeAfter.join('×')} | ${r.diffPixels} of ${r.totalPixels} (${r.diffPercent} %) | ${r.maxDelta} | ${r.box ? `${r.box[0]},${r.box[1]} – ${r.box[2]},${r.box[3]}` : '—'} | ${r.clusterCount} | ${r.diffImage ? `\`${r.diffImage}\`` : '—'} |`),
    '', `${identical} of ${results.length} screenshots pixel-identical.`, ''];
  await fs.writeFile(path.join(out, 'identity.md'), md.join('\n'));
  await fs.writeFile(path.join(out, 'identity.json'), JSON.stringify({ before, after, tolerance, at: new Date().toISOString(), results, identical }, null, 2));
  console.log(`${identical} of ${results.length} identical; report ${path.join(out, 'identity.md')}`);
  process.exit(0);
}
console.error('usage: style-identity.mjs shoot|compare …'); process.exit(2);
