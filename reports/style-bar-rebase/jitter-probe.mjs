#!/usr/bin/env node
// A probe for the two renderings some phone Style screens show from one run to the next (text lines that sit on a half CSS pixel drawn
// one device pixel apart): the same screen loaded N times, shot plainly and after a forced fresh paint, the hashes printed.
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node reports/style-bar-rebase/jitter-probe.mjs --base http://127.0.0.1:<port>
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { scratchTarget } from '../../scripts/scratch-target.mjs';
const { args } = await scratchTarget('reports/style-bar-rebase/jitter-probe.mjs', { options: { base: 'server' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const base = args.base, pin = process.env.DRILL_ADMIN_PIN, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const h = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 8);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
const page = await ctx.newPage();
await page.goto(`${base}/admin/senso`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForSelector('[data-item]');
const opts = { animations: 'disabled', caret: 'hide', style: '[data-preview-area] iframe, .iphone-time { visibility: hidden !important; }' };
for (let i = 0; i < 6; i++) {
  await page.goto(`${base}/admin/senso?tab=style`); await page.waitForSelector('[data-style-group="tabs"]');
  await page.waitForLoadState('networkidle').catch(() => {}); await sleep(700);
  const plain = h(await page.screenshot(opts));
  const again = h(await page.screenshot(opts));
  // a forced fresh paint: the sheet's body taken out of the page and put back (its scroll position kept)
  await page.evaluate(() => { const b = document.querySelector('[data-style-sheet-body]'); if (!b) return; const at = b.scrollTop; b.style.display = 'none'; void b.offsetHeight; b.style.display = ''; b.scrollTop = at; });
  await sleep(300);
  const fresh = h(await page.screenshot(opts));
  const info = await page.evaluate(() => { const s = document.querySelector('[data-style-sheet]'), b = document.querySelector('[data-style-sheet-body]'), p = b?.querySelector('p'); return { sheetTop: s?.getBoundingClientRect().top, bodyTop: b?.getBoundingClientRect().top, pTop: p?.getBoundingClientRect().top, scrollTop: b?.scrollTop, dpr: devicePixelRatio, vv: visualViewport?.scale }; });
  console.log(`load ${i + 1}: plain ${plain}, again ${again}, after a fresh paint ${fresh}; ${JSON.stringify(info)}`);
}
await browser.close();
