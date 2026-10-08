#!/usr/bin/env node
// Evidence for a venue page on a running local server (default http://localhost:3000):
// first HTML response contains the intro, intro gone within 1.5 s, played again on a repeat visit (Kian,
// 2026-10-07: every refresh, nothing stored) and skipped under reduced motion; full-page iPhone screenshots in English and Persian; DOM summary. Raw outputs go to reports/<dir>/.
//   node scripts/check-page.mjs senso [--base http://localhost:3000] [--out reports/checkpoint-a]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const [venue, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/checkpoint-a');
const jpeg = process.argv.includes('--jpeg'); // smaller full-page screenshots for routine runs (the check suite)
const shotOpts = (file) => jpeg ? { path: file.replace(/\.png$/, '.jpg'), fullPage: true, type: 'jpeg', quality: 70 } : { path: file, fullPage: true };
await fs.mkdir(out, { recursive: true });
const url = `${base}/${venue}`;
const log = { url, at: new Date().toISOString(), checks: {} };
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };

// Scrolls through the whole page so lazy images start loading, then waits until every <img> is complete.
async function loadAllImages(page) {
  await page.evaluate(async () => { const step = Math.floor(window.innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  const deadline = Date.now() + 60000;
  let state;
  do {
    state = await page.evaluate(() => { const imgs = [...document.images]; return { total: imgs.length, complete: imgs.filter((i) => i.complete).length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, failed: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src) }; });
    if (state.complete === state.total) break;
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  await page.waitForTimeout(300);
  return state;
}

// 1. first HTML response (no JavaScript): the intro overlay and its decision script must be in it
const html = await (await fetch(url)).text();
await fs.writeFile(path.join(out, `${venue}-first-response.html`), html);
log.checks.introInFirstHtml = { present: /id="intro"/.test(html), headScript: /prefers-reduced-motion/.test(html), noStoredSkip: !/roses-intro-/.test(html), bytes: html.length };

const browser = await chromium.launch();

// 2. first visit: intro visible early, gone within 1.5 s, the page sliding in behind it (header, tabs, first heading, first rows
//    from opacity 0 to 1 while the overlay fades; Kian, 2026-10-07); English and Persian screenshots
{
  const ctx = await browser.newContext(DEVICE);
  const page = await ctx.newPage();
  const fontRequests = [];
  page.on('request', (r) => { if (r.resourceType() === 'font') fontRequests.push(r.url()); });
  const samples = [];
  await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => { const el = document.getElementById('intro'); const cs = el ? getComputedStyle(el) : null; const op = (q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).opacity) : null; }; return { t: Math.round(performance.now()), intro: document.documentElement.dataset.intro || null, display: cs ? cs.display : 'absent', visibility: cs ? cs.visibility : 'absent', opacity: cs ? cs.opacity : 'absent', page: { header: op('main > header'), tabs: op('main #tabs'), h2: op('main section:first-of-type h2'), row1: op('main section:first-of-type li.item:nth-child(1)'), row3: op('main section:first-of-type li.item:nth-child(3)') } }; });
    samples.push(s);
    if (s.intro === 'done' && s.page.row3 === 1 && i > 2) break;
    await page.waitForTimeout(50);
  }
  const firstVisible = samples.find((s) => s.display !== 'none' && s.display !== 'absent');
  const gone = samples.find((s) => s.intro === 'done');
  // the page entrance: each part is invisible while the logo settles, then fully visible; the rows arrive after the heading
  const hidden = (k) => samples.some((s) => s.page[k] === 0), shown = (k) => samples.find((s) => s.page[k] === 1)?.t ?? null;
  const entrance = { headerShownAtMs: shown('header'), tabsShownAtMs: shown('tabs'), h2ShownAtMs: shown('h2'), row1ShownAtMs: shown('row1'), row3ShownAtMs: shown('row3'), wereHidden: ['header', 'tabs', 'h2', 'row1', 'row3'].every(hidden) };
  entrance.ok = entrance.wereHidden && entrance.headerShownAtMs != null && entrance.row3ShownAtMs != null && entrance.row3ShownAtMs > entrance.h2ShownAtMs && entrance.row3ShownAtMs > entrance.row1ShownAtMs && entrance.row3ShownAtMs <= 2200;
  log.checks.firstVisit = { introVisibleAtMs: firstVisible?.t ?? null, introDoneAtMs: gone?.t ?? null, goneWithin1500ms: !!gone && gone.t <= 1500, entrance, samples };
  await page.waitForLoadState('networkidle').catch(() => {});
  log.checks.images = await loadAllImages(page);
  await page.screenshot(shotOpts(path.join(out, `${venue}-en.png`)));
  const dom = await page.evaluate(() => ({
    lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', title: document.title,
    sections: [...document.querySelectorAll('main section')].map((s) => ({ id: s.id, en: s.querySelector('h2 [lang=en]')?.textContent || s.querySelector('h2')?.textContent, fa: s.querySelector('h2 [lang=fa]')?.textContent || null, items: s.querySelectorAll('li').length })),
    items: document.querySelectorAll('main section li').length,
    pricesWithNonWesternDigits: [...document.querySelectorAll('main')].flatMap((m) => (m.innerText.match(/\$[^\s]*[۰-۹٠-٩]/g) || [])).length,
    photos: document.querySelectorAll('main img').length,
  }));
  log.checks.dom = dom;
  log.checks.fontRequests = { urls: [...new Set(fontRequests)], thirdParty: [...new Set(fontRequests)].filter((u) => !u.startsWith(base)) };
  await page.click('header button');
  await page.waitForTimeout(400);
  const fa = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, dataLang: document.documentElement.dataset.lang, visibleFaHeadings: [...document.querySelectorAll('main h2 [lang=fa]')].filter((e) => e.getClientRects().length).length, visibleEnHeadings: [...document.querySelectorAll('main h2 [lang=en]')].filter((e) => e.getClientRects().length).length }));
  log.checks.persianToggle = fa;
  log.checks.imagesFa = await loadAllImages(page);
  await page.screenshot(shotOpts(path.join(out, `${venue}-fa.png`)));
  // 3. repeat visit in the same context (localStorage kept, language saved as Persian): the intro must play again,
  //    visible at first and gone within 1.5 s, with nothing about it in storage
  await page.goto(url, { waitUntil: 'commit' });
  const again = [];
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => { const el = document.getElementById('intro'); return { t: Math.round(performance.now()), intro: document.documentElement.dataset.intro || null, display: el ? getComputedStyle(el).display : 'absent', storedKeys: Object.keys(localStorage).filter((k) => k.startsWith('roses-')), lang: document.documentElement.dataset.lang }; });
    again.push(s);
    if (s.intro === 'done' && i > 2) break;
    await page.waitForTimeout(50);
  }
  const againVisible = again.find((s) => s.display !== 'none' && s.display !== 'absent');
  const againGone = again.find((s) => s.intro === 'done');
  const stored = again.at(-1).storedKeys;
  log.checks.repeatVisit = { introVisibleAtMs: againVisible?.t ?? null, introDoneAtMs: againGone?.t ?? null, storedKeys: stored, lang: again.at(-1).lang, playsAgain: !!againVisible && !!againGone && againGone.t <= 1500 && !again.some((s) => s.intro === 'skip') && !stored.some((k) => k.startsWith('roses-intro')), samples: again };
  await ctx.close();
}

// 4. reduced motion, fresh context (no storage)
{
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => { const el = document.getElementById('intro'); const op = (q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).opacity) : null; }; return { intro: document.documentElement.dataset.intro || null, display: el ? getComputedStyle(el).display : 'absent', prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches, page: { header: op('main > header'), h2: op('main section:first-of-type h2'), row1: op('main section:first-of-type li.item:nth-child(1)'), row6: op('main section:first-of-type li.item:nth-child(6)') } }; });
  log.checks.reducedMotion = { ...r, skipped: r.display === 'none', pageVisibleAtOnce: Object.values(r.page).every((v) => v === 1) };
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, `${venue}-checks.json`), JSON.stringify(log, null, 2));
const c = log.checks;
console.log(JSON.stringify({ introInFirstHtml: c.introInFirstHtml, firstVisit: { introVisibleAtMs: c.firstVisit.introVisibleAtMs, introDoneAtMs: c.firstVisit.introDoneAtMs, goneWithin1500ms: c.firstVisit.goneWithin1500ms, entrance: c.firstVisit.entrance }, repeatVisit: { ...c.repeatVisit, samples: undefined }, reducedMotion: c.reducedMotion, persianToggle: c.persianToggle, dom: { ...c.dom, sections: c.dom.sections.length } }, null, 2));
const pass = c.introInFirstHtml.present && c.introInFirstHtml.noStoredSkip && c.firstVisit.goneWithin1500ms && c.firstVisit.entrance.ok && c.repeatVisit.playsAgain && c.reducedMotion.skipped && c.reducedMotion.pageVisibleAtOnce && c.persianToggle.dir === 'rtl' && c.fontRequests.thirdParty.length === 0 && c.images.loaded === c.images.total && c.imagesFa.loaded === c.imagesFa.total;
console.log('fonts requested:', JSON.stringify(c.fontRequests), '\nimages EN:', JSON.stringify(c.images), '\nimages FA:', JSON.stringify(c.imagesFa));
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
