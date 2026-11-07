#!/usr/bin/env node
// Lighthouse mobile, N runs, against a running server. Local estimate only (not the hosted result).
//   node scripts/check-lighthouse.mjs http://127.0.0.1:<scratch server port>/senso [--runs 3] --out <folder>
import fs from 'node:fs/promises';
import path from 'node:path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { scratchTarget } from './scratch-target.mjs';

// The target is a scratch server, or the script stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args, pos: [url] } = await scratchTarget('scripts/check-lighthouse.mjs', { options: { runs: 'number', out: 'path' }, optional: ['runs'], positional: [['url', 'server']] });
const runs = Number(args.runs || 3);
const out = path.resolve(args.out);
await fs.mkdir(out, { recursive: true });
const rows = [];
// the images the run loaded (count and transferred KB), for the suite's content cost (2026-10-12)
const images = (a) => { const it = (a['network-requests']?.details?.items || []).filter((x) => x.resourceType === 'Image'); return { images: it.length, imageKB: Math.round(it.reduce((n, x) => n + (x.transferSize || 0), 0) / 1024) }; };
for (let n = 1; n <= runs; n++) {
  const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const result = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] });
    const lhr = result.lhr;
    const a = lhr.audits;
    const row = { run: n, formFactor: lhr.configSettings.formFactor, emulated: lhr.configSettings.screenEmulation?.mobile, performance: Math.round((lhr.categories.performance.score || 0) * 100), lcpMs: Math.round(a['largest-contentful-paint'].numericValue), fcpMs: Math.round(a['first-contentful-paint'].numericValue), tbtMs: Math.round(a['total-blocking-time'].numericValue), cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)), speedIndexMs: Math.round(a['speed-index'].numericValue), lcpElement: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120) || null, ...images(a) };
    rows.push(row);
    await fs.writeFile(path.join(out, `lighthouse-run-${n}.json`), result.report);
    console.log(JSON.stringify(row));
  } finally { await chrome.kill(); }
}
await fs.writeFile(path.join(out, 'lighthouse-summary.json'), JSON.stringify({ url, note: 'Local production build (next build && next start) on the developer machine. A local estimate, not the hosted result.', runs: rows }, null, 2));
const worst = Math.max(...rows.map((r) => r.lcpMs));
console.log(`worst LCP over ${runs} runs: ${worst} ms -> ${worst <= 2500 ? 'PASS' : 'FAIL'} (target 2500 ms, local estimate)`);
