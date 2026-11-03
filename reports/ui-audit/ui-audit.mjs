#!/usr/bin/env node
// Pre-go-live UI/UX audit (the PM's brief, 2026-11-02, Part B): report only; Kian rules on every change. Not a step of the
// check suite and not wired into it: an evidence script like reports/admin-audit/audit-drill.mjs.
// Walks the public pages of both venues in English and Persian on four phone viewports in Chromium and WebKit
// (welcome → language → browse → Fall Menu → item popup → close → an item with choices → section list → a section → footer
// with tap-to-call), measures tap targets, text contrast, horizontal overflow and RTL placement on the way, then focus order,
// reduced motion, Safari page zoom (the text-size control that reaches web pages on iOS), slow-network placeholders, photo
// hosts down, the 404 pages, the admin as staff on a phone, and the link-preview tags. Stills go to reports/ui-audit/shots/
// (gitignored: they show photos and phone numbers), numbers to reports/ui-audit/data/ (digits of phone numbers masked).
//   node reports/ui-audit/ui-audit.mjs --base http://127.0.0.1:<port> [--part public,focus,motion,zoom,slow,hosts,404,admin,share,sheets]
//     [--venues senso,kebab-land] [--langs en,fa] [--engines chromium,webkit] [--vps se,i13,max,and]
// Run it against a scratch copy only: the admin part signs in with AUDIT_STAFF_SENSO_PIN (a throwaway staff PIN of the copy)
// and adds, prices, hides and photographs a test item there.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base;
if (!base) { console.error('--base missing'); process.exit(2); }
const parts = new Set((args.part || 'public,focus,motion,zoom,slow,hosts,404,admin,share,sheets').split(','));
const ROOT = path.resolve('reports/ui-audit'); const SHOTS = path.join(ROOT, 'shots'); const DATA = path.join(ROOT, 'data');
await fs.mkdir(SHOTS, { recursive: true }); await fs.mkdir(DATA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (s) => String(s ?? '').replace(/\d/g, '#');
const strip = ({ defaultBrowserType, ...rest }) => rest; // eslint-disable-line no-unused-vars
const VP = {
  se: { label: 'iPhone SE, 375 × 548 (Safari visible area)', ctx: { viewport: { width: 375, height: 548 }, screen: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone SE (3rd gen)'].userAgent } },
  i13: { label: 'iPhone 13, 390 × 664', ctx: strip(devices['iPhone 13']) },
  max: { label: 'iPhone 17 Pro Max, 440 × 763', ctx: strip(devices['iPhone 17 Pro Max']) },
  and: { label: 'Galaxy S24 (Android), 360 × 780', ctx: strip(devices['Galaxy S24']) },
};
const COMMON = { locale: 'en-CA', timezoneId: 'America/Toronto' };
const pick = (list, key) => (args[key] ? list.filter((x) => args[key].split(',').includes(x)) : list);
const VENUES = pick(['senso', 'kebab-land'], 'venues'); const LANGS = pick(['en', 'fa'], 'langs');
const engines = Object.fromEntries(await Promise.all(pick(['chromium', 'webkit'], 'engines').map(async (e) => [e, await { chromium, webkit }[e].launch()])));
for (const k of Object.keys(VP)) if (args.vps && !args.vps.split(',').includes(k)) delete VP[k];
let extraChromium = null; const cr = async () => engines.chromium ?? (extraChromium ??= await chromium.launch());
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const save = (name, obj) => fs.writeFile(path.join(DATA, name), JSON.stringify(obj, null, 1));

// ---------- measurements run inside the page ----------
async function targets(page, scope = 'body') {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) || document.body; const groups = {};
    for (const el of root.querySelectorAll('a[href], button, [role=button], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('dialog:not([open])') || r.bottom < 0 || r.top > innerHeight) continue;
      if (el.closest('#welcome') && scope !== '#welcome') continue;
      const desc = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}${el.getAttribute('href')?.startsWith('tel:') ? '[tel]' : ''}`;
      const g = groups[desc] ??= { desc, n: 0, under44: 0, under24: 0, minW: 1e9, minH: 1e9, sample: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40).replace(/\d/g, '#') };
      g.n++; if (r.width < 44 || r.height < 44) g.under44++; if (r.width < 24 || r.height < 24) g.under24++;
      g.minW = Math.min(g.minW, Math.round(r.width)); g.minH = Math.min(g.minH, Math.round(r.height));
    }
    return Object.values(groups);
  }, scope);
}
async function contrast(page, scope = 'body') {
  return page.evaluate((scope) => {
    const parse = (c) => { const m = String(c).match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
    const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let bg = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg); return bg; };
    const root = document.querySelector(scope) || document.body; const fails = []; let checked = 0, skipped = 0;
    for (const el of root.querySelectorAll('*')) {
      if (!['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'A', 'BUTTON', 'LI', 'BDI', 'LABEL', 'DIV', 'STRONG', 'EM', 'SMALL'].includes(el.tagName)) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || cs.visibility === 'hidden' || el.closest('dialog:not([open])') || el.closest('.sr-only') || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (el.closest('#welcome') && scope !== '#welcome' && getComputedStyle(document.getElementById('welcome')).display === 'none') continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      const fg0 = parse(cs.color); const bg = bgOf(el);
      if (!fg0 || !bg) { skipped++; continue; }
      const fg = over({ ...fg0, a: fg0.a * op }, bg);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      checked++;
      if (ratio < (large ? 3 : 4.5)) fails.push({ text: el.textContent.trim().slice(0, 40).replace(/\d/g, '#'), ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, fg: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, size, opacity: Math.round(op * 100) / 100 });
    }
    return { checked, skipped, fails };
  }, scope);
}
const overflow = (page) => page.evaluate(() => ({ docWidth: document.documentElement.scrollWidth, viewport: innerWidth, over: document.documentElement.scrollWidth - innerWidth, clipped: [...document.querySelectorAll('main h2, main h3, .sheet-title, footer p')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length }));
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth }; }, sel);
const activeTab = (page) => page.evaluate(() => { const a = document.querySelector('#tabs a.tab.active'); if (!a) return null; const r = a.getBoundingClientRect(); return { tab: a.getAttribute('data-tab'), visible: r.left >= 0 && r.right <= innerWidth }; });
const welcomeGone = (page) => page.waitForFunction(() => { const w = document.getElementById('welcome'); return !w || w.hidden || getComputedStyle(w).display === 'none' || getComputedStyle(w).visibility === 'hidden'; }, null, { timeout: 4000 }).then(() => true).catch(() => false);
const imgState = (page) => page.evaluate(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }); return { inView: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length }; });
const richItem = (page) => page.evaluate(() => { const li = [...document.querySelectorAll('main li.item')].find((l) => l.querySelector('template.detail')?.content.querySelector('.sheet-group')); if (!li) return null; li.scrollIntoView({ block: 'center' }); return li.getAttribute('data-id'); });

// ---------- 1. the public walk ----------
async function walk(engine, vp, venue, lang) {
  const id = `${venue}-${lang}-${vp}-${engine}`;
  const ctx = await engines[engine].newContext({ ...VP[vp].ctx, ...COMMON });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  const res = { id, venue, lang, vp, engine, shots: [], checks: {} };
  const shot = async (n, name) => { const f = `${id}-${String(n).padStart(2, '0')}-${name}.jpg`; await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 72 }); res.shots.push(f); };
  try {
    await page.goto(`${base}/${venue}`, { waitUntil: 'load' });
    await page.waitForSelector('#welcome', { state: 'visible', timeout: 5000 }); await sleep(1700);
    await shot(1, 'welcome');
    res.checks.welcome = { targets: await targets(page, '#welcome'), contrast: await contrast(page, '#welcome .welcome-card') };
    await page.click(`#welcome button[data-lang="${lang}"]`); res.checks.welcomeGone = await welcomeGone(page); await sleep(400);
    await shot(2, 'menu-top');
    res.checks.top = { html: await page.evaluate(() => ({ dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction, lang: document.documentElement.lang })), overflow: await overflow(page), targets: await targets(page), contrast: await contrast(page), activeTab: await activeTab(page), rtl: { listButton: await rect(page, '#tabs-list'), langToggle: await rect(page, '#lang-toggle'), firstTab: await rect(page, '#tabs li:first-child a') } };
    await page.evaluate(() => window.scrollBy(0, innerHeight * 1.6)); await sleep(700);
    await shot(3, 'browse');
    res.checks.browse = { contrast: await contrast(page), activeTab: await activeTab(page), targets: await targets(page) };
    const seasonal = await page.$('main section.seasonal');
    if (seasonal) { await seasonal.evaluate((el) => el.scrollIntoView({ block: 'start' })); await sleep(700); await shot(4, 'fall-menu'); res.checks.fallMenu = { title: await seasonal.$eval('h2', (h) => h.textContent.trim()), items: await seasonal.$$eval('li.item', (l) => l.length), activeTab: await activeTab(page) }; }
    else res.checks.fallMenu = null;
    const first = page.locator('main section li.item').first(); await first.scrollIntoViewIfNeeded(); await first.click();
    await page.waitForSelector('#sheet[open]', { timeout: 4000 }); await sleep(800);
    await shot(5, 'popup');
    res.checks.popup = { targets: await targets(page, '#sheet'), contrast: await contrast(page, '#sheet'), close: await rect(page, '#sheet-close'), title: await rect(page, '#sheet .sheet-title') };
    await page.evaluate(() => { const s = document.querySelector('#sheet'); const sc = [s, ...s.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (sc) sc.scrollTop = sc.scrollHeight; });
    await sleep(400); await shot(6, 'popup-end');
    await page.click('#sheet-close'); await sleep(800);
    await shot(7, 'closed');
    res.checks.closed = { sheetOpen: await page.$eval('#sheet', (d) => d.open) };
    const rich = await richItem(page);
    if (rich) { await sleep(300); await page.click(`main li.item[data-id="${rich}"]`); await page.waitForSelector('#sheet[open]'); await sleep(800); await shot(8, 'popup-choices'); res.checks.choices = { contrast: await contrast(page, '#sheet'), targets: await targets(page, '#sheet') }; await page.keyboard.press('Escape'); await sleep(800); res.checks.escapeClosed = !(await page.$eval('#sheet', (d) => d.open)); }
    await page.click('#tabs-list'); await page.waitForSelector('#sections-dialog[open]', { timeout: 4000 }); await sleep(800);
    await shot(9, 'section-list');
    res.checks.list = { targets: await targets(page, '#sections-dialog'), close: await rect(page, '#list-close'), contrast: await contrast(page, '#sections-dialog') };
    const links = page.locator('#sections-dialog a'); const n = await links.count(); const k = Math.min(5, n - 1); const href = await links.nth(k).getAttribute('href');
    await links.nth(k).click(); await sleep(1600);
    await shot(10, 'after-jump');
    res.checks.jump = { href, of: n, activeTab: await activeTab(page), headingTop: await page.evaluate((h) => Math.round(document.querySelector(h)?.getBoundingClientRect().top ?? -1), href) };
    await page.evaluate(() => document.querySelector('footer').scrollIntoView({ block: 'end' })); await sleep(700);
    await shot(11, 'footer');
    res.checks.footer = { tel: await page.$$eval('footer a[href^="tel:"]', (as) => as.map((a) => { const r = a.getBoundingClientRect(); const d1 = a.getAttribute('href').replace(/\D/g, ''), d2 = a.textContent.replace(/\D/g, ''); return { hrefFormat: a.getAttribute('href').replace(/\d/g, '#'), textFormat: a.textContent.trim().replace(/\d/g, '#'), sameDigits: d1 === d2 || d1 === '1' + d2 || '1' + d1 === d2, w: Math.round(r.width), h: Math.round(r.height) }; })), contrast: await contrast(page, 'footer'), overflow: await overflow(page), bottomGap: await page.evaluate(() => Math.round(innerHeight - document.querySelector('footer').getBoundingClientRect().bottom)) };
  } catch (e) { res.error = e.message.split('\n')[0]; log('walk error', id, res.error); await shot(99, 'error').catch(() => {}); }
  res.errors = errors; await ctx.close(); return res;
}

// ---------- 2. focus order (keyboard; Chromium and WebKit, iPhone 13 viewport) ----------
async function focusOrder(engine, venue, lang) {
  const ctx = await engines[engine].newContext({ viewport: { width: 390, height: 664 }, ...COMMON }); const page = await ctx.newPage();
  const focused = () => page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { tag: 'body' }; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), id: e.id || undefined, cls: String(e.className || '').split(' ')[0] || undefined, text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28).replace(/\d/g, '#'), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none', inView: r.top >= -1 && r.bottom <= innerHeight + 1, where: e.closest('#welcome') ? 'welcome' : e.closest('dialog') ? 'dialog' : e.closest('header') ? 'header' : e.closest('nav') ? 'tabs' : e.closest('footer') ? 'footer' : e.closest('main') ? 'menu' : 'other' }; });
  const res = { venue, lang, engine };
  await page.goto(`${base}/${venue}`); await page.waitForSelector('#welcome', { state: 'visible' }); await sleep(1500);
  res.onLoad = await focused();
  res.welcome = []; for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); res.welcome.push(await focused()); }
  res.welcomeLeaks = res.welcome.filter((f) => f.where !== 'welcome' && f.tag !== 'body').length;
  await page.focus(`#welcome button[data-lang="${lang}"]`); await page.keyboard.press('Enter'); await welcomeGone(page); await sleep(500);
  res.afterChoice = await focused();
  res.menu = []; for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); res.menu.push(await focused()); }
  res.noRing = res.menu.filter((f) => f.tag !== 'body' && !f.ring).map((f) => `${f.tag}${f.id ? '#' + f.id : ''}.${f.cls ?? ''} “${f.text}”`);
  res.offscreen = res.menu.filter((f) => f.tag !== 'body' && !f.inView).length;
  const item = await page.$('main li.item'); await item.focus(); await page.keyboard.press('Enter'); await sleep(800);
  res.popupOpen = await page.$eval('#sheet', (d) => d.open); res.focusInPopup = await focused();
  await page.keyboard.press('Tab'); res.popupTab = await focused();
  await page.keyboard.press('Escape'); await sleep(800);
  res.popupClosed = !(await page.$eval('#sheet', (d) => d.open)); res.focusAfterClose = await focused();
  res.focusBackOnItem = await page.evaluate(() => document.activeElement?.matches?.('main li.item') ?? false);
  await page.focus('#tabs-list'); await page.keyboard.press('Enter'); await sleep(800);
  res.listOpen = await page.$eval('#sections-dialog', (d) => d.open); res.focusInList = await focused();
  await page.keyboard.press('Escape'); await sleep(800); res.focusAfterList = await focused();
  await ctx.close(); return res;
}

// ---------- 3. reduced motion (WebKit iPhone 13) ----------
async function reducedMotion(venue) {
  const ctx = await engines.webkit.newContext({ ...VP.i13.ctx, ...COMMON, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  const res = { venue }; const t0 = Date.now();
  await page.goto(`${base}/${venue}`); await page.waitForSelector('#welcome', { state: 'visible' }); await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, `motion-${venue}-1-welcome-300ms.jpg`), type: 'jpeg', quality: 72 });
  res.running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  await sleep(1500); await page.screenshot({ path: path.join(SHOTS, `motion-${venue}-2-welcome-1800ms.jpg`), type: 'jpeg', quality: 72 });
  const tTap = Date.now(); await page.click('#welcome button[data-lang="en"]'); res.goneOk = await welcomeGone(page); res.goneMs = Date.now() - tTap;
  await page.screenshot({ path: path.join(SHOTS, `motion-${venue}-3-menu.jpg`), type: 'jpeg', quality: 72 });
  await page.click('main li.item >> nth=0'); await sleep(120);
  res.popupAt120 = await rect(page, '#sheet .sheet-title');
  await page.screenshot({ path: path.join(SHOTS, `motion-${venue}-4-popup-120ms.jpg`), type: 'jpeg', quality: 72 });
  res.ms = Date.now() - t0; await ctx.close(); return res;
}

// ---------- 4. page zoom (Safari's aA / Android's page zoom reflow the layout: the CSS viewport shrinks) ----------
async function zoom(engine, venue, lang, pct) {
  const z = pct / 100; const w = Math.round(390 / z), h = Math.round(664 / z);
  const ctx = await engines[engine].newContext({ ...VP.i13.ctx, viewport: { width: w, height: h }, deviceScaleFactor: 3 * z, ...COMMON }); const page = await ctx.newPage();
  const id = `zoom${pct}-${venue}-${lang}-${engine}`; const res = { id, css: `${w} × ${h}` };
  await page.goto(`${base}/${venue}`); await page.waitForSelector('#welcome', { state: 'visible' }); await sleep(1700);
  await page.screenshot({ path: path.join(SHOTS, `${id}-1-welcome.jpg`), type: 'jpeg', quality: 72 });
  res.welcomeButtons = await page.$$eval('#welcome button', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom <= innerHeight && r.top >= 0 }; }));
  await page.click(`#welcome button[data-lang="${lang}"]`); await welcomeGone(page); await sleep(400);
  await page.screenshot({ path: path.join(SHOTS, `${id}-2-menu.jpg`), type: 'jpeg', quality: 72 });
  res.overflow = await overflow(page);
  await page.locator('main section li.item').first().click(); await page.waitForSelector('#sheet[open]'); await sleep(800);
  await page.screenshot({ path: path.join(SHOTS, `${id}-3-popup.jpg`), type: 'jpeg', quality: 72 });
  res.close = await rect(page, '#sheet-close');
  await ctx.close(); return res;
}

// ---------- 5. slow network (Chromium, Slow 4G as the suite applies it, CPU 4×) ----------
async function slow(venue) {
  const ctx = await engines.chromium.newContext({ ...VP.i13.ctx, ...COMMON }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: Math.round(1.6 * 1024 * 0.9 * 1024 / 8), uploadThroughput: Math.round(750 * 0.9 * 1024 / 8) });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const res = { venue, frames: [] }; const t0 = Date.now();
  const snap = async (name) => { const f = `slow-${venue}-${String(res.frames.length + 1).padStart(2, '0')}-${name}.jpg`; await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 72 }).catch(() => {}); res.frames.push({ f, ms: Date.now() - t0, img: await imgState(page).catch(() => null) }); };
  page.goto(`${base}/${venue}`).catch(() => {});
  await page.waitForSelector('#welcome', { timeout: 20000 }).catch(() => {}); await snap('first-markup');
  await page.waitForSelector('#welcome button', { state: 'visible', timeout: 20000 }).catch(() => {}); await sleep(600); await snap('buttons');
  const tTap = Date.now(); await page.click('#welcome button[data-lang="en"]').catch(() => {}); res.tapAt = tTap - t0;
  await sleep(300); await snap('tap+300ms'); await sleep(1200); await snap('tap+1.5s'); await sleep(2500); await snap('tap+4s');
  await page.evaluate(() => window.scrollBy(0, innerHeight * 2)); await sleep(300); await snap('scrolled+0.3s'); await sleep(2700); await snap('scrolled+3s');
  await ctx.close(); return res;
}

// ---------- 6. photo hosts down (the linked photos live on the venues' and the ordering service's hosts) ----------
async function hostsDown(venue) {
  const ctx = await engines.webkit.newContext({ ...VP.i13.ctx, ...COMMON }); const page = await ctx.newPage();
  await page.route((u) => !u.href.startsWith(base), (r) => r.abort());
  await page.goto(`${base}/${venue}`); await page.waitForSelector('#welcome', { state: 'visible' }); await sleep(1500);
  await page.click('#welcome button[data-lang="en"]'); await welcomeGone(page); await sleep(800);
  const ext = await page.evaluate(() => { const li = [...document.querySelectorAll('main li.item')].find((l) => /^https?:/.test(l.getAttribute('data-photo') || '')); if (!li) return null; li.scrollIntoView({ block: 'center' }); return li.getAttribute('data-id'); });
  await sleep(800); await page.screenshot({ path: path.join(SHOTS, `hosts-down-${venue}-1-rows.jpg`), type: 'jpeg', quality: 72 });
  const res = { venue, external: !!ext, img: await imgState(page) };
  if (ext) { await page.click(`main li.item[data-id="${ext}"]`); await page.waitForSelector('#sheet[open]'); await sleep(900); await page.screenshot({ path: path.join(SHOTS, `hosts-down-${venue}-2-popup.jpg`), type: 'jpeg', quality: 72 }); }
  await ctx.close(); return res;
}

// ---------- 7. 404 ----------
async function notFound(engine) {
  const out = [];
  const ctx = await engines[engine].newContext({ ...VP.i13.ctx, ...COMMON }); const page = await ctx.newPage();
  for (const p of ['/nope', '/senso/nope', '/admin/nope', '/uploads/senso/nope.jpg', '/kebab-land/']) {
    const r = await page.goto(base + p).catch((e) => ({ status: () => `error ${e.message.slice(0, 40)}` })); await sleep(400);
    const f = `404-${engine}${p.replace(/[^a-z0-9]+/gi, '-')}.jpg`; await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 72 });
    out.push({ path: p, status: r.status(), title: await page.title(), text: (await page.evaluate(() => document.body.innerText.trim().slice(0, 160))).replace(/\d{3,}/g, '#'), links: await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href'))), shot: f });
  }
  await ctx.close(); return out;
}

// ---------- 8. the admin as staff on a phone ----------
async function admin(engine, vp) {
  const pin = process.env.AUDIT_STAFF_SENSO_PIN; if (!pin) return { skipped: 'AUDIT_STAFF_SENSO_PIN missing' };
  const ctx = await engines[engine].newContext({ ...VP[vp].ctx, ...COMMON }); const page = await ctx.newPage();
  const id = `admin-${engine}-${vp}`; let n = 0; const res = { id, steps: [] }; const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name, note) => { const f = `${id}-${String(++n).padStart(2, '0')}-${name}.jpg`; await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 72 }); res.steps.push({ f, note }); };
  const status = async () => (await page.locator('[role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ').trim();
  const NAME = `Audit test item ${engine}`;
  try {
    await page.goto(`${base}/admin/senso`); await sleep(500); await shot('sign-in', 'the venue sign-in link');
    await page.fill('input[name=pin]', '000000'); await page.click('button[type=submit]'); await sleep(900);
    await shot('wrong-pin', 'a wrong PIN'); res.wrongPin = (await page.locator('main, body').first().innerText()).replace(/\d/g, '#').slice(0, 400);
    await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForSelector('[data-item]', { timeout: 15000 }); await sleep(600);
    await shot('menu-tab', 'signed in as staff: the Menu tab');
    res.topText = (await page.locator('body').innerText()).slice(0, 600);
    const sec = await page.$eval('[aria-label^="Add item to "]:not([aria-label$="Fall Menu"])', (b) => b.getAttribute('aria-label'));
    await page.click(`[aria-label="${sec}"]`); await sleep(500); await shot('add-item-sheet', 'Add item: the sheet');
    await page.fill('[role=dialog] input[name=name]', NAME); await page.fill('[role=dialog] input[name=price]', '6.50'); await shot('add-item-filled', 'name and price typed');
    await page.press('[role=dialog] input[name=price]', 'Enter'); await page.waitForSelector(`.item-panel[aria-label="Edit ${NAME}"]`, { timeout: 8000 }); await sleep(600);
    await shot('item-editor', 'the editor opens on the new item'); res.toastAfterAdd = await status();
    res.editorText = (await page.locator('.item-panel').innerText()).slice(0, 1500);
    const ga = page.locator('.item-panel').getByText(/Allergens/).first(); if (await ga.count()) { await ga.scrollIntoViewIfNeeded(); await sleep(300); await shot('allergens-as-staff', 'Allergens & diet as staff'); res.allergensText = (await page.locator('.item-panel').innerText()).match(/Allergens[^\n]*\n?[^\n]*/)?.[0]; }
    await page.locator('.item-panel').getByText('Other', { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(200); await shot('editor-bottom', 'the editor further down');
    const photo = page.locator('.item-panel input[type=file]').first();
    if (await photo.count()) { const tPhoto = Date.now(); await photo.setInputFiles(path.resolve('public/brand/senso-logo.png')); await page.waitForSelector('.item-panel [data-photo-field="set"], .item-panel img', { timeout: 10000 }).catch(() => {}); await sleep(800); res.photoMs = Date.now() - tPhoto; await page.evaluate(() => document.querySelector('.item-panel')?.scrollTo?.(0, 0)); await shot('photo-added', 'a photo added'); res.toastAfterPhoto = await status(); }
    await page.click('.item-panel button:has-text("Done")'); await page.waitForSelector('.item-panel', { state: 'detached', timeout: 5000 }).catch(() => {}); await sleep(400);
    const row = page.locator(`[data-item]:has-text("${NAME}")`).first(); await row.scrollIntoViewIfNeeded();
    await row.locator('[data-price]').click(); await sleep(300); await shot('price-edit', 'tap the price'); await page.keyboard.press('Control+A').catch(() => {}); await page.keyboard.type('7.25'); await page.keyboard.press('Enter'); await sleep(900);
    await shot('price-saved', 'price saved'); res.toastAfterPrice = await status();
    await row.locator('input[role=switch]').click(); await sleep(900); await shot('hidden', 'the switch: hidden'); res.toastAfterHide = await status();
    // a price that is not a number, and showing an item with no price
    await row.locator('[data-price]').click(); await sleep(200); await page.keyboard.press('Control+A').catch(() => {}); await page.keyboard.type('abc'); await page.keyboard.press('Enter'); await sleep(900); await shot('price-text', 'typing letters as a price'); res.priceText = await status();
    await page.keyboard.press('Escape').catch(() => {});
    await page.click(`[aria-label="${sec}"]`); await sleep(300); await page.fill('[role=dialog] input[name=name]', `${NAME} no price`); await page.press('[role=dialog] input[name=name]', 'Enter'); await sleep(1200); await shot('add-no-price', 'Add item without a price');
    res.addNoPrice = await status();
    if (await page.locator('.item-panel').count()) { await page.click('.item-panel button:has-text("Done")').catch(() => {}); await sleep(500); }
    const np = page.locator(`[data-item]:has-text("${NAME} no price")`).first();
    if (await np.count()) { await np.scrollIntoViewIfNeeded(); await np.locator('input[role=switch]').click().catch(() => {}); await sleep(900); await shot('show-no-price', 'trying to show it without a price'); res.showNoPrice = await status() || (await np.innerText()).slice(0, 200); }
    await page.evaluate(() => window.scrollTo(0, 0));
    const search = page.locator('input[type=search], input[placeholder*="Search" i]').first();
    if (await search.count()) { await search.fill('zzzzqq'); await sleep(600); await shot('search-empty', 'a search with no results'); res.searchEmpty = (await page.locator('body').innerText()).match(/No [^\n]*|Nothing[^\n]*/)?.[0] ?? '(no message found)'; await search.fill(''); }
    await ctx.setOffline(true);
    const row2 = page.locator(`[data-item]:has-text("${NAME}")`).first(); await row2.scrollIntoViewIfNeeded();
    await row2.locator('[data-price]').click(); await sleep(200); await page.keyboard.press('Control+A').catch(() => {}); await page.keyboard.type('8.75'); await page.keyboard.press('Enter'); await sleep(2500);
    await shot('offline-save', 'a price changed with no connection'); res.offline = await status();
    await ctx.setOffline(false); await sleep(1500); await shot('back-online', 'connection back'); res.backOnline = await status();
    const acct = page.locator('header button[aria-haspopup], [aria-label*="account" i]').first(); if (await acct.count()) { await acct.click(); await sleep(400); await shot('account-menu', 'the account menu'); }
  } catch (e) { res.error = e.message.split('\n')[0]; await shot('error', 'script stopped here').catch(() => {}); }
  res.errors = errors; await ctx.close(); return res;
}

// ---------- 9. link previews ----------
async function share() {
  const out = {};
  for (const v of VENUES) {
    const html = await (await fetch(`${base}/${v}`)).text(); const head = html.slice(0, html.indexOf('</head>'));
    const metas = [...head.matchAll(/<meta\s([^>]+?)\/?>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])));
    out[v] = { title: head.match(/<title[^>]*>([^<]*)<\/title>/)?.[1], description: metas.find((m) => m.name === 'description')?.content, og: metas.filter((m) => /^og:/.test(m.property || '')), twitter: metas.filter((m) => /^twitter:/.test(m.name || '')), icons: [...head.matchAll(/<link\s[^>]*rel="([^"]*icon[^"]*)"[^>]*href="([^"]*)"/g)].map((m) => ({ rel: m[1], href: m[2] })), manifest: /rel="manifest"/.test(head), themeColor: metas.find((m) => m.name === 'theme-color')?.content, lang: html.match(/<html[^>]*lang="([^"]*)"/)?.[1] };
  }
  const page = await (await (await cr()).newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  const logo = async (v) => `data:image/png;base64,${(await fs.readFile(path.resolve(`public/brand/${v}-logo.png`))).toString('base64')}`;
  const card = (bg, fg, sub, logoUrl, name, line, tile) => `<html><body style="margin:0;width:1200px;height:630px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,Helvetica,Arial,sans-serif;color:${fg}"><div style="${tile ? `background:${tile};padding:36px 48px;border-radius:28px;` : ''}"><img src="${logoUrl}" style="height:220px"></div><div style="margin-top:44px;font-size:52px;font-weight:700;letter-spacing:-0.5px">${name}</div><div style="margin-top:14px;font-size:30px;color:${sub}">${line}</div></body></html>`;
  await page.setContent(card('#fbf6ee', '#1d1d1f', '#6b6b6b', await logo('senso'), 'Menu · منو', 'Persian breakfast, coffee, desserts · Yonge St, Richmond Hill', null)); await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, 'share-proposal-senso.png') });
  await page.setContent(card('#141414', '#ffffff', '#c9c9c9', await logo('kebab-land'), 'Menu · منو', 'Persian grill and full bar · Yonge St, Richmond Hill', null)); await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, 'share-proposal-kebab-land.png') });
  await page.context().close(); return out;
}

// ---------- 10. contact sheets (for reading the walk at a glance) ----------
async function sheets(walks) {
  const page = await (await (await cr()).newContext({ viewport: { width: 1900, height: 1200 } })).newPage();
  for (const v of VENUES) for (const l of LANGS) for (const e of Object.keys(engines)) {
    const rows = Object.keys(VP).map((vp) => walks.find((w) => w.venue === v && w.lang === l && w.engine === e && w.vp === vp)).filter(Boolean);
    const html = `<html><body style="margin:0;background:#888;font:12px Helvetica"><div style="padding:6px;color:#fff;font-size:16px">${v} · ${l} · ${e}</div>${rows.map((w) => `<div style="display:flex;gap:4px;padding:4px;align-items:flex-start"><div style="width:70px;color:#fff">${w.vp}</div>${w.shots.map((s) => `<div><img src="file://${path.join(SHOTS, s)}" style="width:150px;display:block"><div style="color:#fff;width:150px;overflow:hidden;white-space:nowrap">${s.split('-').slice(-1)[0].replace('.jpg', '')}</div></div>`).join('')}</div>`).join('')}</body></html>`;
    const f = path.join(SHOTS, `_sheet-${v}-${l}-${e}.html`); await fs.writeFile(f, html); await page.goto(`file://${f}`); await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, `_sheet-${v}-${l}-${e}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
  }
  await page.context().close();
}

// ---------- run ----------
let walks = [];
if (parts.has('public')) {
  for (const e of Object.keys(engines)) for (const vp of Object.keys(VP)) for (const v of VENUES) for (const l of LANGS) { log('walk', v, l, vp, e); walks.push(await walk(e, vp, v, l)); }
  await save('walks.json', walks);
} else walks = JSON.parse(await fs.readFile(path.join(DATA, 'walks.json'), 'utf8').catch(() => '[]'));
if (parts.has('focus')) { const f = []; for (const e of Object.keys(engines)) for (const v of VENUES) for (const l of LANGS) { log('focus', v, l, e); f.push(await focusOrder(e, v, l).catch((x) => ({ venue: v, lang: l, engine: e, error: x.message.split('\n')[0] }))); } await save('focus.json', f); }
if (parts.has('motion')) { const m = []; for (const v of VENUES) { log('motion', v); m.push(await reducedMotion(v).catch((x) => ({ venue: v, error: x.message.split('\n')[0] }))); } await save('motion.json', m); }
if (parts.has('zoom')) { const z = []; for (const e of Object.keys(engines)) for (const v of VENUES) for (const l of LANGS) for (const pct of [150, 200]) { log('zoom', pct, v, l, e); z.push(await zoom(e, v, l, pct).catch((x) => ({ id: `zoom${pct}-${v}-${l}-${e}`, error: x.message.split('\n')[0] }))); } await save('zoom.json', z); }
if (parts.has('slow')) { const s = []; for (const v of VENUES) { log('slow', v); s.push(await slow(v).catch((x) => ({ venue: v, error: x.message.split('\n')[0] }))); } await save('slow.json', s); }
if (parts.has('hosts')) { const h = []; for (const v of VENUES) { log('hosts down', v); h.push(await hostsDown(v).catch((x) => ({ venue: v, error: x.message.split('\n')[0] }))); } await save('hosts-down.json', h); }
if (parts.has('404')) { const r = {}; for (const e of Object.keys(engines)) { log('404', e); r[e] = await notFound(e); } await save('404.json', r); }
if (parts.has('admin')) { const a = []; for (const [e, vp] of [['webkit', 'i13'], ['chromium', 'and']]) { log('admin', e, vp); a.push(await admin(e, vp)); } await save('admin.json', a); }
if (parts.has('share')) { log('share'); await save('share.json', await share()); }
if (parts.has('sheets') && walks.length) { log('contact sheets'); await sheets(walks); }
for (const b of Object.values(engines)) await b.close();
if (extraChromium) await extraChromium.close();
log('done');
