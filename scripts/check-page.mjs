#!/usr/bin/env node
// Evidence for a venue page on a running local server (default http://localhost:3000):
// first HTML response contains the intro, intro gone within 1.5 s, skipped on a repeat visit and under
// reduced motion; full-page iPhone screenshots in English and Persian; DOM summary. Raw outputs go to reports/<dir>/.
//   node scripts/check-page.mjs senso [--base http://localhost:3000] [--out reports/checkpoint-a]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const [venue, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/checkpoint-a');
await fs.mkdir(out, { recursive: true });
const url = `${base}/${venue}`;
const log = { url, at: new Date().toISOString(), checks: {} };
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };

// 1. first HTML response (no JavaScript): the intro overlay and its decision script must be in it
const html = await (await fetch(url)).text();
await fs.writeFile(path.join(out, `${venue}-first-response.html`), html);
log.checks.introInFirstHtml = { present: /id="intro"/.test(html), headScript: /roses-intro-/.test(html), bytes: html.length };

const browser = await chromium.launch();

// 2. first visit: intro visible early, gone within 1.5 s; English and Persian screenshots
{
  const ctx = await browser.newContext(DEVICE);
  const page = await ctx.newPage();
  const samples = [];
  await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => { const el = document.getElementById('intro'); const cs = el ? getComputedStyle(el) : null; return { t: Math.round(performance.now()), intro: document.documentElement.dataset.intro || null, display: cs ? cs.display : 'absent', visibility: cs ? cs.visibility : 'absent', opacity: cs ? cs.opacity : 'absent' }; });
    samples.push(s);
    if (s.intro === 'done' && i > 2) break;
    await page.waitForTimeout(50);
  }
  const firstVisible = samples.find((s) => s.display !== 'none' && s.display !== 'absent');
  const gone = samples.find((s) => s.intro === 'done');
  log.checks.firstVisit = { introVisibleAtMs: firstVisible?.t ?? null, introDoneAtMs: gone?.t ?? null, goneWithin1500ms: !!gone && gone.t <= 1500, samples };
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${venue}-en.png`), fullPage: true });
  const dom = await page.evaluate(() => ({
    lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', title: document.title,
    sections: [...document.querySelectorAll('main section')].map((s) => ({ id: s.id, en: s.querySelector('h2 [lang=en]')?.textContent || s.querySelector('h2')?.textContent, fa: s.querySelector('h2 [lang=fa]')?.textContent || null, items: s.querySelectorAll('li').length })),
    items: document.querySelectorAll('main section li').length,
    pricesWithNonWesternDigits: [...document.querySelectorAll('main')].flatMap((m) => (m.innerText.match(/\$[^\s]*[۰-۹٠-٩]/g) || [])).length,
    photos: document.querySelectorAll('main img').length,
  }));
  log.checks.dom = dom;
  await page.click('header button');
  await page.waitForTimeout(400);
  const fa = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, dataLang: document.documentElement.dataset.lang, visibleFaHeadings: [...document.querySelectorAll('main h2 [lang=fa]')].filter((e) => e.getClientRects().length).length, visibleEnHeadings: [...document.querySelectorAll('main h2 [lang=en]')].filter((e) => e.getClientRects().length).length }));
  log.checks.persianToggle = fa;
  await page.screenshot({ path: path.join(out, `${venue}-fa.png`), fullPage: true });
  // 3. repeat visit in the same context (localStorage kept): the intro must be skipped before first paint
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const repeat = await page.evaluate(() => { const el = document.getElementById('intro'); return { intro: document.documentElement.dataset.intro || null, display: el ? getComputedStyle(el).display : 'absent', storage: localStorage.getItem('roses-intro-' + location.pathname.split('/')[1]), lang: document.documentElement.dataset.lang }; });
  log.checks.repeatVisit = { ...repeat, skipped: repeat.intro === 'skip' && repeat.display === 'none' };
  await ctx.close();
}

// 4. reduced motion, fresh context (no storage)
{
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => { const el = document.getElementById('intro'); return { intro: document.documentElement.dataset.intro || null, display: el ? getComputedStyle(el).display : 'absent', prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches }; });
  log.checks.reducedMotion = { ...r, skipped: r.display === 'none' };
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, `${venue}-checks.json`), JSON.stringify(log, null, 2));
const c = log.checks;
console.log(JSON.stringify({ introInFirstHtml: c.introInFirstHtml, firstVisit: { introVisibleAtMs: c.firstVisit.introVisibleAtMs, introDoneAtMs: c.firstVisit.introDoneAtMs, goneWithin1500ms: c.firstVisit.goneWithin1500ms }, repeatVisit: c.repeatVisit, reducedMotion: c.reducedMotion, persianToggle: c.persianToggle, dom: { ...c.dom, sections: c.dom.sections.length } }, null, 2));
const pass = c.introInFirstHtml.present && c.firstVisit.goneWithin1500ms && c.repeatVisit.skipped && c.reducedMotion.skipped && c.persianToggle.dir === 'rtl';
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
