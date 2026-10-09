// Stills of the gallery for the reply and the README: the two full-scene demos 1.5 s after load (iPhone 13 frame), and the
// fall and winter card grids at a laptop width. Usage: node reports/welcome/gallery/shots.mjs [out dir]. Small JPEGs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1160, height: 900 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, '..', 'gallery.html'));
await page.waitForTimeout(1500);
for (const season of ['fall', 'winter']) {
  const frame = page.locator(`#demo-${season} .frame`);
  await frame.screenshot({ path: path.join(out, `gallery-${season}-demo.jpg`), type: 'jpeg', quality: 80 });
  await page.locator(`#demo-${season} [data-still]`).check();
  await page.waitForTimeout(200);
  await frame.screenshot({ path: path.join(out, `gallery-${season}-still.jpg`), type: 'jpeg', quality: 80 });
  await page.locator(`#demo-${season} [data-still]`).uncheck();
}
for (const [season, sel] of [['fall', '#fall'], ['winter', '#winter']]) {
  const grid = page.locator(`${sel} + .grid`);
  await grid.screenshot({ path: path.join(out, `gallery-${season}-cards.jpg`), type: 'jpeg', quality: 60 });
}
await browser.close();
console.log('stills written to', out);
