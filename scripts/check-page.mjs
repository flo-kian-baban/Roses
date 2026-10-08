#!/usr/bin/env node
// Evidence for a venue page on a running local server (default http://localhost:3000):
// first HTML response contains the intro, intro gone within 1.5 s, played again on a repeat visit (Kian,
// 2026-10-07: every refresh, nothing stored) and skipped under reduced motion; category tabs follow taps and the scroll (Kian, 2026-10-08);
// full-page iPhone screenshots in English and Persian; DOM summary. Raw outputs go to reports/<dir>/.
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

// Category tabs (Kian, 2026-10-08): the active tab names the section under the bar. A tap on every tab (then three long jumps) must
// end with that tab active, its section's top at the bar's bottom edge (within 1 px; or as far as the page scrolls for a short last
// section), no other tab lit on the way and the tab visible in the strip; stepping through the page (60 px, down then up) the active
// tab must always be the section under the bar (the last one at the end of a page that has scrolled). Raw samples go to the checks JSON.
async function checkTabs(page) {
  await page.evaluate(() => { window.scrollTo(0, 0); window.__lit = []; const mo = new MutationObserver(() => { const a = document.querySelector('#tabs a.active'); const id = a ? a.dataset.tab : null; if (window.__lit.at(-1) !== id) window.__lit.push(id); }); document.querySelectorAll('#tabs a[data-tab]').forEach((a) => mo.observe(a, { attributes: true, attributeFilter: ['class'] })); });
  const state = () => page.evaluate(() => { const bar = document.getElementById('tabs').getBoundingClientRect(); const secs = [...document.querySelectorAll('main section[id]')].map((s) => ({ id: s.id, top: s.getBoundingClientRect().top })); const maxY = document.documentElement.scrollHeight - innerHeight; const atBottom = scrollY > 0 && scrollY >= maxY - 1; let under = secs[0]?.id ?? null; for (const s of secs) if (s.top <= bar.bottom + 1) under = s.id; if (atBottom && secs.length) under = secs.at(-1).id; const active = document.querySelector('#tabs a.active')?.dataset.tab ?? null; const a = active ? document.querySelector(`#tabs a[data-tab="${active}"]`) : null; const ul = document.querySelector('#tabs ul').getBoundingClientRect(); const ar = a ? a.getBoundingClientRect() : null; return { y: Math.round(scrollY), atBottom, barHeight: Math.round(bar.height * 10) / 10, barBottom: bar.bottom, active, under, tabVisible: ar ? ar.left >= ul.left - 1 && ar.right <= ul.right + 1 : null, secs }; });
  const settle = async () => { let last = -1, since = Date.now(); const t0 = Date.now(); while (Date.now() - t0 < 4000) { const y = await page.evaluate(() => scrollY); if (y !== last) { last = y; since = Date.now(); } else if (Date.now() - since > 300) break; await page.waitForTimeout(50); } return Date.now() - t0; };
  const first = await state();
  const ids = first.secs.map((s) => s.id);
  const taps = [];
  for (const id of [...ids, ids[0], ids.at(-1), ids[1] ?? ids[0]]) {
    await page.evaluate(() => { window.__lit = []; });
    await page.evaluate((id) => document.querySelector(`#tabs a[data-tab="${id}"]`).click(), id);
    const ms = await settle();
    const s = await state();
    const lit = await page.evaluate(() => window.__lit);
    const top = s.secs.find((x) => x.id === id).top - s.barBottom;
    taps.push({ id, active: s.active, atBar: Math.abs(top) <= 1 || (s.atBottom && top > 0), topMinusBar: Math.round(top * 10) / 10, othersLit: lit.filter((l) => l !== id), tabVisible: s.tabVisible, settleMs: ms });
  }
  const scroll = {};
  for (const dir of ['down', 'up']) {
    if (dir === 'down') { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250); }
    const mism = []; let n = 0;
    for (; n < 800; n++) {
      await page.evaluate((d) => window.scrollBy(0, d === 'down' ? 60 : -60), dir);
      await page.waitForTimeout(60);
      const s = await state();
      if (s.active !== s.under) mism.push({ y: s.y, active: s.active, under: s.under });
      if (dir === 'down' ? (s.atBottom || s.y === 0 && n > 0) : s.y === 0) break; // a page too short to scroll ends the pass at once
    }
    scroll[dir] = { samples: n + 1, mismatches: mism.length, first: mism.slice(0, 5) };
    if (dir === 'down') scroll.lastTabActiveAtBottom = (await state()).active === ids.at(-1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const summary = { count: taps.length, onTappedTab: taps.filter((t) => t.active === t.id).length, atBar: taps.filter((t) => t.atBar).length, othersLit: taps.reduce((n, t) => n + t.othersLit.length, 0), tabVisible: taps.filter((t) => t.tabVisible).length, maxSettleMs: Math.max(...taps.map((t) => t.settleMs)) };
  const ok = summary.onTappedTab === taps.length && summary.atBar === taps.length && summary.othersLit === 0 && summary.tabVisible === taps.length && scroll.down.mismatches === 0 && scroll.up.mismatches === 0 && scroll.lastTabActiveAtBottom;
  return { barHeight: first.barHeight, sections: ids.length, summary, scroll, ok, taps };
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
    const s = await page.evaluate(() => { const el = document.getElementById('intro'); const cs = el ? getComputedStyle(el) : null; const op = (q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).opacity) : null; }; const rows = [...document.querySelectorAll('main section:first-of-type li.item')].slice(0, 8); const last = rows[rows.length - 1]; return { t: Math.round(performance.now()), intro: document.documentElement.dataset.intro || null, display: cs ? cs.display : 'absent', visibility: cs ? cs.visibility : 'absent', opacity: cs ? cs.opacity : 'absent', page: { header: op('main > header'), tabs: op('main #tabs'), h2: op('main section:first-of-type h2'), row1: op('main section:first-of-type li.item:nth-child(1)'), lastRow: last ? Number(getComputedStyle(last).opacity) : null, rowsAnimated: rows.length } }; });
    samples.push(s);
    if (s.intro === 'done' && s.page.lastRow === 1 && i > 2) break;
    await page.waitForTimeout(50);
  }
  const firstVisible = samples.find((s) => s.display !== 'none' && s.display !== 'absent');
  const gone = samples.find((s) => s.intro === 'done');
  // the page entrance: each part is invisible while the logo settles, then fully visible; the rows arrive after the heading
  const hidden = (k) => samples.some((s) => s.page[k] === 0), shown = (k) => samples.find((s) => s.page[k] === 1)?.t ?? null;
  const rowsAnimated = samples.at(-1).page.rowsAnimated; // the first section's rows that slide in (up to 8; the last of them is sampled)
  const entrance = { headerShownAtMs: shown('header'), tabsShownAtMs: shown('tabs'), h2ShownAtMs: shown('h2'), row1ShownAtMs: shown('row1'), lastRowShownAtMs: shown('lastRow'), rowsAnimated, wereHidden: ['header', 'tabs', 'h2', 'row1', 'lastRow'].every(hidden) };
  entrance.ok = entrance.wereHidden && entrance.headerShownAtMs != null && entrance.lastRowShownAtMs != null && entrance.lastRowShownAtMs > entrance.h2ShownAtMs && (rowsAnimated < 2 || entrance.lastRowShownAtMs > entrance.row1ShownAtMs) && entrance.lastRowShownAtMs <= 2200;
  log.checks.firstVisit = { introVisibleAtMs: firstVisible?.t ?? null, introDoneAtMs: gone?.t ?? null, goneWithin1500ms: !!gone && gone.t <= 1500, entrance, samples };
  await page.waitForLoadState('networkidle').catch(() => {});
  log.checks.images = await loadAllImages(page);
  await page.screenshot(shotOpts(path.join(out, `${venue}-en.png`)));
  log.checks.tabs = await checkTabs(page);
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

// 3b. a link straight to a section (#id, the third one) opens with that tab active (the same rule as above: the section under the bar,
//     the last one at the end of a page that has scrolled, as on a short page whose last section cannot reach the bar), fresh context
{
  const ctx = await browser.newContext(DEVICE);
  const page = await ctx.newPage();
  const target = log.checks.dom.sections[Math.min(2, log.checks.dom.sections.length - 1)]?.id ?? null;
  await page.goto(`${url}#${target}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const d = await page.evaluate(() => { const bar = document.getElementById('tabs').getBoundingClientRect(); const secs = [...document.querySelectorAll('main section[id]')]; let under = secs[0]?.id ?? null; for (const s of secs) if (s.getBoundingClientRect().top <= bar.bottom + 1) under = s.id; const atBottom = scrollY > 0 && scrollY >= document.documentElement.scrollHeight - innerHeight - 1; if (atBottom && secs.length) under = secs.at(-1).id; return { active: document.querySelector('#tabs a.active')?.dataset.tab ?? null, under, atBottom, y: Math.round(scrollY) }; });
  log.checks.tabs.directLink = { target, ...d, ok: !!target && d.active === target && d.under === target };
  log.checks.tabs.ok = log.checks.tabs.ok && log.checks.tabs.directLink.ok;
  await ctx.close();
}

// 4. reduced motion, fresh context (no storage)
{
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => { const el = document.getElementById('intro'); const op = (q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).opacity) : null; }; const rows = [...document.querySelectorAll('main section:first-of-type li.item')].slice(0, 8); return { intro: document.documentElement.dataset.intro || null, display: el ? getComputedStyle(el).display : 'absent', prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches, page: { header: op('main > header'), tabs: op('main #tabs'), h2: op('main section:first-of-type h2'), rows: rows.map((r) => Number(getComputedStyle(r).opacity)) } }; });
  log.checks.reducedMotion = { ...r, skipped: r.display === 'none', pageVisibleAtOnce: r.page.header === 1 && r.page.tabs === 1 && r.page.h2 === 1 && r.page.rows.length > 0 && r.page.rows.every((v) => v === 1) };
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, `${venue}-checks.json`), JSON.stringify(log, null, 2));
const c = log.checks;
console.log(JSON.stringify({ introInFirstHtml: c.introInFirstHtml, firstVisit: { introVisibleAtMs: c.firstVisit.introVisibleAtMs, introDoneAtMs: c.firstVisit.introDoneAtMs, goneWithin1500ms: c.firstVisit.goneWithin1500ms, entrance: c.firstVisit.entrance }, repeatVisit: { ...c.repeatVisit, samples: undefined }, reducedMotion: c.reducedMotion, persianToggle: c.persianToggle, dom: { ...c.dom, sections: c.dom.sections.length } }, null, 2));
const pass = c.introInFirstHtml.present && c.introInFirstHtml.noStoredSkip && c.firstVisit.goneWithin1500ms && c.firstVisit.entrance.ok && c.repeatVisit.playsAgain && c.reducedMotion.skipped && c.reducedMotion.pageVisibleAtOnce && c.persianToggle.dir === 'rtl' && c.fontRequests.thirdParty.length === 0 && c.images.loaded === c.images.total && c.imagesFa.loaded === c.imagesFa.total && c.tabs.ok;
console.log('tabs:', JSON.stringify({ ...c.tabs, taps: undefined }));
console.log('fonts requested:', JSON.stringify(c.fontRequests), '\nimages EN:', JSON.stringify(c.images), '\nimages FA:', JSON.stringify(c.imagesFa));
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
