#!/usr/bin/env node
// Evidence for a venue page on a running local server (default http://localhost:3000):
// the first HTML response carries the welcome screen and its head decision script (Kian, 2026-10-09, replacing the logo intro); on
// a first visit the welcome screen is up at first paint with the greeting in both languages and no language pre-highlighted, a tap
// on English opens the menu within 300 ms and stores only the language; it shows again on a reload with the last language
// pre-highlighted; with reduced motion it is shown still (no animation running) and the page behind is visible at once; with
// JavaScript off there is no overlay and the menu shows directly; category tabs follow taps and the scroll, top of the page after
// a reload (Kian, 2026-10-08); full-page iPhone screenshots in English and Persian; DOM summary. Raw outputs go to reports/<dir>/.
// The finer welcome checks (clock and date boundaries, the scene, the kill switch, budgets, recordings) are in scripts/welcome-drill.mjs.
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

// 1. first HTML response (no JavaScript): the welcome overlay, rendered for one season (the PM, 2026-10-09: #welcome[data-season]), and its head decision script must be in it; nothing about it is stored
const html = await (await fetch(url)).text();
await fs.writeFile(path.join(out, `${venue}-first-response.html`), html);
log.checks.welcomeInFirstHtml = { present: /id="welcome"/.test(html), headScript: /dataset\.welcome='show'/.test(html) && /getHours\(\)/.test(html), seasonRendered: /id="welcome"[^>]*data-season="(fall|winter|spring|summer)"/.test(html), noStoredFlag: !/roses-welcome/.test(html), bytes: html.length };
// What the overlay shows, read inside the page (the welcome drill has the full probe; this one follows the first visit and the reload).
const probe = () => { const h = document.documentElement, w = document.getElementById('welcome'); const cs = w ? getComputedStyle(w) : null; const g = h.dataset.greet || null; const slot = g && w ? w.querySelector(`.g[data-g="${g}"]`) : null; const op = (e) => (e ? Number(getComputedStyle(e).opacity) : null); const shown = (e) => !!e && e.getClientRects().length > 0; return { t: Math.round(performance.now()), welcome: h.dataset.welcome || null, display: cs ? cs.display : 'absent', styled: !!cs && cs.position === 'fixed', opacity: cs ? cs.opacity : null, greet: g, season: w ? w.dataset.season || null : null, saved: h.dataset.langSaved || null, lang: h.dataset.lang, en: slot ? op(slot.querySelector('[lang=en]')) : null, fa: slot ? op(slot.querySelector('[lang=fa]')) : null, enShown: slot ? shown(slot.querySelector('[lang=en]')) : false, faShown: slot ? shown(slot.querySelector('[lang=fa]')) : false, logo: op(w && w.querySelector('.welcome-card img, .welcome-name')), buttons: w ? [...w.querySelectorAll('button[data-lang]')].map((b) => ({ lang: b.dataset.lang, pressed: b.getAttribute('aria-pressed'), opacity: Number(getComputedStyle(b).opacity) })) : [], particles: w ? w.querySelectorAll('.scene .p').length : 0, running: w ? w.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0, storedKeys: (() => { try { return Object.keys(localStorage).filter((k) => k.startsWith('roses-')); } catch { return []; } })(), page: { header: op(document.querySelector('main > header')), tabs: op(document.querySelector('main #tabs')), h2: op(document.querySelector('main section:first-of-type h2')), row1: op(document.querySelector('main section:first-of-type li.item')) }, inert: (() => { const m = document.querySelector('main'); return m ? m.inert : null; })() }; };
// The tap, timed inside the page from the click to the overlay gone (display none, visibility hidden or opacity 0).
const tapLang = (lang) => new Promise((res) => { const w = document.getElementById('welcome'), b = w.querySelector(`button[data-lang="${lang}"]`); const start = performance.now(); b.click(); const tick = () => { const cs = getComputedStyle(w); const t = performance.now() - start; const gone = cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0; if (gone || t > 3000) res({ ms: Math.round(t), gone, welcome: document.documentElement.dataset.welcome, lang: document.documentElement.dataset.lang, rowVisible: !!document.querySelector('main li.item') && document.querySelector('main li.item').getClientRects().length > 0 }); else requestAnimationFrame(tick); }; tick(); });
const waitOff = (page) => page.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 5000 }).then(() => true).catch(() => false);
const waitShow = (page) => page.waitForFunction(() => document.documentElement.dataset.welcome === 'show', null, { timeout: 5000 }).then(() => true).catch(() => false);

const browser = await chromium.launch();

// 2. first visit: the welcome screen up at first paint, no language pre-highlighted, the logo first and then the greeting in both
//    languages and the two buttons rising in (sampled every 20 ms); the menu laid out behind it; a tap on English opens the menu
//    within 300 ms and stores only the language; English and Persian screenshots
{
  const ctx = await browser.newContext(DEVICE);
  const page = await ctx.newPage();
  const fontRequests = [];
  page.on('request', (r) => { if (r.resourceType() === 'font') fontRequests.push(r.url()); });
  const samples = [];
  await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; i < 120; i++) {
    const s = await page.evaluate(probe);
    samples.push(s);
    if (s.welcome === 'show' && s.buttons.length === 2 && s.buttons.every((b) => b.opacity === 1) && s.en === 1 && s.fa === 1 && i > 2) break;
    await page.waitForTimeout(20);
  }
  // The page is sampled from the navigation's commit, when the HTML may still be streaming and the stylesheet still loading (the
  // browser paints nothing before it): the samples that count start with the first one in which the overlay exists in the DOM and
  // the stylesheet has applied (its position is fixed); from that moment it must be displayed (the head script ran before the body), so there is no flash.
  const live = samples.filter((s) => s.display !== 'absent' && s.styled);
  const first = live[0] ?? samples[0], last = samples.at(-1);
  const shownAt = (k) => live.find((s) => (k === 'buttons' ? s.buttons.length === 2 && s.buttons.every((b) => b.opacity === 1) : s[k] === 1))?.t ?? null;
  const entrance = { logoShownAtMs: shownAt('logo'), greetingEnAtMs: shownAt('en'), greetingFaAtMs: shownAt('fa'), buttonsAtMs: shownAt('buttons'), greetingWasHidden: live.some((s) => s.en === 0 || s.fa === 0), samplesBeforeStyledOverlay: samples.length - live.length, firstRawSample: samples[0] };
  const tap = await page.evaluate(tapLang, 'en'); const off = await waitOff(page); const after = await page.evaluate(probe);
  log.checks.firstVisit = {
    upAtFirstSampleMs: first.t, upAtFirstSample: first.welcome === 'show' && first.display === 'grid', greet: last.greet, season: last.season, bothLanguagesShown: last.enShown && last.faShown && last.en === 1 && last.fa === 1,
    noPreHighlight: last.saved === null && last.buttons.every((b) => b.pressed === null), particles: last.particles, animationsRunning: last.running, menuInertBehind: last.inert === true, entrance,
    tap: { ...tap, off, menuInertAfter: after.inert, storedKeys: after.storedKeys, displayAfter: after.display },
    samples,
  };
  const fv = log.checks.firstVisit;
  fv.ok = fv.upAtFirstSample && !!fv.greet && !!fv.season && fv.bothLanguagesShown && fv.noPreHighlight && fv.particles > 0 && fv.particles <= 20 && fv.animationsRunning > 0 && fv.menuInertBehind && entrance.greetingWasHidden && entrance.buttonsAtMs != null
    && tap.gone && tap.ms <= 300 && tap.lang === 'en' && tap.rowVisible && off && after.display === 'none' && after.inert === false && after.storedKeys.join() === 'roses-lang';
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
  // 2c. top after a reload (Kian, 2026-10-08): after a tap on the first tab and an 8 px scroll, a reload comes back at the top with no
  //     hash in the URL (Chrome re-anchored its restored position on the page entrance's first frame, 14 px lower on every reload;
  //     a tap used to leave #section in the URL, which a reload jumped to)
  await page.evaluate(() => { window.scrollTo(0, 0); const a = document.querySelector('#tabs a[data-tab]'); if (a) a.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollBy(0, 8));
  await page.waitForTimeout(300);
  const beforeReload = await page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  await page.reload({ waitUntil: 'load' });
  await waitShow(page); // the welcome screen is up again; the language saved by the toggle (Persian) is pre-highlighted and chosen here
  const reloadPressed = await page.evaluate(() => [...document.querySelectorAll('#welcome button[aria-pressed="true"]')].map((b) => b.dataset.lang));
  await page.evaluate(tapLang, 'fa'); await waitOff(page);
  await page.waitForTimeout(400);
  const afterReload = await page.evaluate(() => ({ y: Math.round(scrollY * 10) / 10, hash: location.hash, scrollRestoration: history.scrollRestoration }));
  log.checks.topAfterReload = { beforeReload, afterReload, welcomePreHighlighted: reloadPressed, ok: afterReload.y === 0 && afterReload.hash === '' && reloadPressed.join() === 'fa' };
  // 3. repeat visit in the same context (localStorage kept, language saved as Persian by the toggle): the welcome screen shows
  //    again at first paint, with Persian pre-highlighted, and nothing but the language in storage
  await page.goto(url, { waitUntil: 'commit' });
  const again = [];
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(probe);
    again.push(s);
    if (s.welcome === 'show' && s.buttons.length === 2 && s.buttons.every((b) => b.opacity === 1) && i > 2) break;
    await page.waitForTimeout(25);
  }
  const againLive = again.filter((s) => s.display !== 'absent' && s.styled);
  const againFirst = againLive[0] ?? again[0], againLast = again.at(-1);
  const stored = againLast.storedKeys;
  log.checks.repeatVisit = { upAtFirstSampleMs: againFirst.t, upAtFirstSample: againFirst.welcome === 'show' && againFirst.display === 'grid', saved: againLast.saved, lang: againLast.lang, pressed: againLast.buttons.filter((b) => b.pressed === 'true').map((b) => b.lang), storedKeys: stored, showsAgain: againFirst.welcome === 'show' && againFirst.display === 'grid' && againLast.saved === 'fa' && againLast.lang === 'fa' && againLast.buttons.filter((b) => b.pressed === 'true').map((b) => b.lang).join() === 'fa' && stored.join() === 'roses-lang', samples: again };
  await page.evaluate(tapLang, 'fa'); await waitOff(page);
  await ctx.close();
}

// 3b. a link straight to a section (#id, the third one) opens with that tab active (the same rule as above: the section under the bar,
//     the last one at the end of a page that has scrolled, as on a short page whose last section cannot reach the bar), fresh context
{
  const ctx = await browser.newContext(DEVICE);
  const page = await ctx.newPage();
  const target = log.checks.dom.sections[Math.min(2, log.checks.dom.sections.length - 1)]?.id ?? null;
  await page.goto(`${url}#${target}`, { waitUntil: 'load' });
  await waitShow(page); await page.evaluate(tapLang, 'en'); await waitOff(page); // the choice first; the script then scrolls to the anchor
  await page.waitForTimeout(600);
  const d = await page.evaluate(() => { const bar = document.getElementById('tabs').getBoundingClientRect(); const secs = [...document.querySelectorAll('main section[id]')]; let under = secs[0]?.id ?? null; for (const s of secs) if (s.getBoundingClientRect().top <= bar.bottom + 1) under = s.id; const atBottom = scrollY > 0 && scrollY >= document.documentElement.scrollHeight - innerHeight - 1; if (atBottom && secs.length) under = secs.at(-1).id; return { active: document.querySelector('#tabs a.active')?.dataset.tab ?? null, under, atBottom, y: Math.round(scrollY) }; });
  log.checks.tabs.directLink = { target, ...d, ok: !!target && d.active === target && d.under === target };
  log.checks.tabs.ok = log.checks.tabs.ok && log.checks.tabs.directLink.ok;
  await ctx.close();
}

// 4. reduced motion, fresh context (no storage): the welcome screen is shown but still (no animation running, the greeting and
//    buttons fully visible at once), the page behind it visible at once; a tap removes it without a fade
{
  const ctx = await browser.newContext({ ...DEVICE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(100);
  const r = await page.evaluate(probe);
  const prefersReduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tap = await page.evaluate(tapLang, 'en');
  log.checks.reducedMotion = { ...r, samples: undefined, prefersReduced, tap, shownStill: r.welcome === 'show' && r.display === 'grid' && r.running === 0 && r.en === 1 && r.fa === 1 && r.logo === 1 && r.buttons.every((b) => b.opacity === 1) && r.particles > 0, pageVisibleAtOnce: r.page.header === 1 && r.page.tabs === 1 && r.page.h2 === 1 && r.page.row1 === 1, instantOff: tap.gone && tap.ms <= 60 };
  await ctx.close();
}
// 5. JavaScript off, fresh context: no overlay, the menu shows directly
{
  const ctx = await browser.newContext({ ...DEVICE, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  let j;
  try { j = await page.evaluate(() => ({ welcome: document.documentElement.dataset.welcome || null, overlayInHtml: !!document.getElementById('welcome'), display: getComputedStyle(document.getElementById('welcome')).display, rowVisible: !!document.querySelector('main li.item') && document.querySelector('main li.item').getClientRects().length > 0 })); j.ok = j.welcome === null && j.overlayInHtml && j.display === 'none' && j.rowVisible; }
  catch (e) { const overlayVisible = await page.locator('#welcome').isVisible().catch(() => null), rowVisible = await page.locator('main li.item').first().isVisible().catch(() => null); j = { evaluateError: e.message, overlayVisible, rowVisible, ok: overlayVisible === false && rowVisible === true }; }
  log.checks.javascriptOff = j;
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, `${venue}-checks.json`), JSON.stringify(log, null, 2));
const c = log.checks;
console.log(JSON.stringify({ welcomeInFirstHtml: c.welcomeInFirstHtml, firstVisit: { ...c.firstVisit, samples: undefined }, repeatVisit: { ...c.repeatVisit, samples: undefined }, reducedMotion: c.reducedMotion, javascriptOff: c.javascriptOff, persianToggle: c.persianToggle, dom: { ...c.dom, sections: c.dom.sections.length } }, null, 2));
const pass = c.welcomeInFirstHtml.present && c.welcomeInFirstHtml.headScript && c.welcomeInFirstHtml.seasonRendered && c.welcomeInFirstHtml.noStoredFlag && c.firstVisit.ok && c.repeatVisit.showsAgain && c.reducedMotion.shownStill && c.reducedMotion.pageVisibleAtOnce && c.reducedMotion.instantOff && c.javascriptOff.ok && c.persianToggle.dir === 'rtl' && c.fontRequests.thirdParty.length === 0 && c.images.loaded === c.images.total && c.imagesFa.loaded === c.imagesFa.total && c.tabs.ok && c.topAfterReload.ok;
console.log('tabs:', JSON.stringify({ ...c.tabs, taps: undefined }), '\ntop after reload:', JSON.stringify(c.topAfterReload));
console.log('fonts requested:', JSON.stringify(c.fontRequests), '\nimages EN:', JSON.stringify(c.images), '\nimages FA:', JSON.stringify(c.imagesFa));
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
