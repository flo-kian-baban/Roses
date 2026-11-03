#!/usr/bin/env node
// The venues' link-preview images and square icons (pre-go-live audit, Part B #4; the PM's fix batch A2, 2026-11-03: "make the two
// preview images and square icons now; the tags wait for the final domain"). Drawn from the logos in public/brand/ on each venue's own
// background (Senso's cream, Kebab Land's dark tile: the colours of Part B's proposals), with "Menu · منو" and one line; no food photos
// (the owner's written permission for photos is still pending). Writes into public/brand/:
//   <venue>-share.png   1200 × 630, for og:image once the domain exists (not linked from any page yet)
//   <venue>-icon.png    192 × 192, the tab icon (rel=icon)
//   <venue>-touch.png   180 × 180, the home-screen icon (rel=apple-touch-icon; iOS rounds its corners itself)
// Run again when the client's vector logos arrive (go-live list):  node tools/brand/share-images.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const VENUES = {
  senso: { bg: '#fbf6ee', fg: '#1d1d1f', sub: '#6b6b6b', line: 'Persian breakfast, coffee, desserts · Yonge St, Richmond Hill' },
  'kebab-land': { bg: '#141414', fg: '#ffffff', sub: '#c9c9c9', line: 'Persian grill and full bar · Yonge St, Richmond Hill' },
};
const dir = path.resolve('public/brand');
const browser = await chromium.launch();
for (const [v, c] of Object.entries(VENUES)) {
  const logo = `data:image/png;base64,${(await fs.readFile(path.join(dir, `${v}-logo.png`))).toString('base64')}`;
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:${c.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,Helvetica,Arial,sans-serif;color:${c.fg}"><img src="${logo}" style="height:220px"><div style="margin-top:44px;font-size:52px;font-weight:700;letter-spacing:-0.5px">Menu · منو</div><div style="margin-top:14px;font-size:30px;color:${c.sub}">${c.line}</div></body></html>`);
  await page.waitForTimeout(200); await page.screenshot({ path: path.join(dir, `${v}-share.png`) });
  for (const [name, size] of [['icon', 192], ['touch', 180]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;background:${c.bg};display:grid;place-items:center"><img src="${logo}" style="max-width:${Math.round(size * 0.8)}px;max-height:${Math.round(size * 0.62)}px"></body></html>`);
    await page.waitForTimeout(150); await page.screenshot({ path: path.join(dir, `${v}-${name}.png`) });
  }
  await page.close();
  console.log(`${v}: ${v}-share.png (1200 × 630), ${v}-icon.png (192 × 192), ${v}-touch.png (180 × 180)`);
}
await browser.close();
