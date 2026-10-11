// Stills of the gallery for the reply and the README: the full-scene demos 1.5 s after load (iPhone 13 frame), and the card
// grids at a laptop width. Usage: node reports/welcome/gallery/shots.mjs [out dir] [seasons, default fall,winter,spring]
// (a season's demo is a new random draw on every run, so name only the seasons whose stills should change). Small JPEGs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, '..');
const seasons = (process.argv[3] || 'fall,winter,spring').split(',');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1160, height: 900 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, '..', 'gallery.html'));
await page.waitForTimeout(1500);
for (const season of seasons) {
  const frame = page.locator(`#demo-${season} .frame`);
  await frame.screenshot({ path: path.join(out, `gallery-${season}-demo.jpg`), type: 'jpeg', quality: 80 });
  await page.locator(`#demo-${season} [data-still]`).check();
  await page.waitForTimeout(200);
  await frame.screenshot({ path: path.join(out, `gallery-${season}-still.jpg`), type: 'jpeg', quality: 80 });
  await page.locator(`#demo-${season} [data-still]`).uncheck();
}
for (const season of seasons) {
  const grid = page.locator(`#${season} ~ .grid`).first();
  await grid.screenshot({ path: path.join(out, `gallery-${season}-cards.jpg`), type: 'jpeg', quality: 60 });
}
await browser.close();
console.log('stills written to', out);
