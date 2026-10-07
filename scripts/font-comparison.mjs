#!/usr/bin/env node
// Renders the client's original fonts (loaded on their own origin, sensocafe.ca) next to our self-hosted
// look-alikes (injected as data: URLs from node_modules) in one document, same text and size.
//   node scripts/font-comparison.mjs [--out reports/checkpoint-a2/font-comparison.png]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const out = path.resolve(args.out || 'reports/checkpoint-a2/font-comparison.png');
await fs.mkdir(path.dirname(out), { recursive: true });
const b64 = async (p) => (await fs.readFile(p)).toString('base64');
const faces = [
  ['Tinos', 700, await b64('src/fonts/tinos-latin-700-normal.woff2')],
  ['Tinos', 400, await b64('src/fonts/tinos-latin-400-normal.woff2')],
  ['Montserrat', 400, await b64('src/fonts/montserrat-latin-400-normal.woff2')],
  ['Montserrat', 600, await b64('src/fonts/montserrat-latin-600-normal.woff2')],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.route('**/*', (route) => (route.request().resourceType() === 'script' ? route.abort() : route.continue()));
await page.goto('https://sensocafe.ca/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(({ faces }) => {
  const style = document.createElement('style');
  style.textContent = faces.map(([f, w, d]) => `@font-face{font-family:${f}Ours;font-weight:${w};src:url("data:font/woff2;base64,${d}") format("woff2")}`).join('\n');
  document.head.appendChild(style);
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:28px 32px;background:#FFF8EE;color:#111;font-family:monospace';
  const row = (label, family, weight, size, text) => `<div style="margin:0 0 18px"><div style="font:12px monospace;color:#777;margin-bottom:4px">${label}</div><div style="font-family:${family};font-weight:${weight};font-size:${size}px;line-height:1.25">${text}</div></div>`;
  const H = 'Senso Signature — Persian Breakfast — Tea & Herbal Tea 0123456789';
  const B = 'Two eggs with fresh crushed tomato served with bread, fresh herbs, cheese, tomato, cucumber. Omelette sauce includes onion. $20.99';
  document.body.innerHTML = `<div id="cmp" style="display:inline-block;min-width:1000px">
    <div style="font:bold 14px monospace;margin-bottom:14px">Headings, 32px</div>
    ${row('sensocafe.ca original: DUTCHI 700 (DUTCHB.ttf, loaded on the site\'s own origin)', 'DUTCHI', 700, 32, H)}
    ${row('ours: Tinos 700 (SIL OFL 1.1, self-hosted)', 'TinosOurs', 700, 32, H)}
    ${row('sensocafe.ca original: DUTCHI 400 (DUTCH-2.ttf)', 'DUTCHI', 400, 32, H)}
    ${row('ours: Tinos 400', 'TinosOurs', 400, 32, H)}
    <div style="font:bold 14px monospace;margin:26px 0 14px">Body text, 18px</div>
    ${row('sensocafe.ca original: Proxima Nova Regular (MARK-SIMONSON-PROXIMA-NOVA-REGULAR.ttf)', 'Proxima', 400, 18, B)}
    ${row('ours: Montserrat 400 (SIL OFL 1.1, self-hosted)', 'MontserratOurs', 400, 18, B)}
    ${row('sensocafe.ca original: Proxima Nova Bold', 'Proxima', 700, 18, B)}
    ${row('ours: Montserrat 600', 'MontserratOurs', 600, 18, B)}</div>`;
}, { faces });
await page.evaluate(async () => { for (const spec of ['700 32px TinosOurs', '400 32px TinosOurs', '400 18px MontserratOurs', '600 18px MontserratOurs', '700 32px DUTCHI', '400 32px DUTCHI', '400 18px Proxima', '700 18px Proxima']) { try { await document.fonts.load(spec); } catch {} } await document.fonts.ready; });
await page.waitForFunction(() => [...document.fonts].filter((f) => /DUTCHI|Proxima|ours/.test(f.family)).every((f) => f.status === 'loaded' || f.status === 'error'), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);
const status = await page.evaluate(() => [...document.fonts].filter((f) => /DUTCHI|Proxima|Ours/.test(f.family)).map((f) => `${f.family} ${f.weight} ${f.status}`));
// Proof that each row renders in its intended font: a monospace clone of the same text must differ in width.
const widths = await page.evaluate(() => [...document.querySelectorAll('#cmp [style*="font-family"]')].map((el) => { const clone = el.cloneNode(true); clone.style.fontFamily = 'monospace'; clone.style.position = 'absolute'; clone.style.visibility = 'hidden'; clone.style.whiteSpace = 'nowrap'; el.style.whiteSpace = 'nowrap'; document.body.appendChild(clone); const r = { family: getComputedStyle(el).fontFamily, width: Math.round(el.getBoundingClientRect().width), monoWidth: Math.round(clone.getBoundingClientRect().width) }; el.style.whiteSpace = ''; clone.remove(); return { ...r, appliedNonMono: r.width !== r.monoWidth }; }));
console.log('rows:', JSON.stringify(widths));
if (!widths.every((w) => w.appliedNonMono)) { console.error('FAIL: a row rendered in the monospace fallback'); process.exitCode = 1; }
await page.locator('#cmp').screenshot({ path: out });
await browser.close();
console.log('fonts:', JSON.stringify(status));
console.log('written', out);
