#!/usr/bin/env node
// Evidence for the item popup and section list motion (Kian, 2026-10-08) on a running build, iPhone 13 viewport, Chromium:
//   item popup: opens from a row and from a card; its transform sampled every 16 ms from the tap (slides up from 100 % to 0),
//     the dim's opacity rising with it; Close → the dialog stays open under .closing while it slides down, then closes (time
//     measured); Escape and Back close the same way; the photo is 4:3 with the gradient strip and the title block overlapping
//     the faded part; reduced motion: open and close at once;
//   section list: opens with the same slide, its height ≤ 75 % of the screen with the tab bar visible above it, the Close button
//     on the left in English and on the right in Persian, scrollable inside; a tap on a section starts the page's scroll and the
//     list's exit at the same time (both sampled), the list gone and the page at the section afterwards.
//   node reports/sheet-motion/measure.mjs --base http://127.0.0.1:3004 --out reports/sheet-motion
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base, out = path.resolve(args.out || 'reports/sheet-motion'); if (!base) { console.error('need --base'); process.exit(2); }
await fs.mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ev = { base, at: new Date().toISOString() };
const open = async (ctx, lang = 'en') => { const p = await ctx.newPage(); await p.goto(`${base}/senso`, { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.intro === 'done'); if (lang === 'fa') { await p.click('#lang-toggle'); await sleep(300); } return p; };
const matrixY = (t) => { const m = t.match(/matrix\(([^)]+)\)/); return m ? Math.round(parseFloat(m[1].split(',')[5])) : (t === 'none' ? 0 : null); };
// samples the sheet's transform and the backdrop's opacity for `ms` after `fn`
const sampleMotion = async (p, sel, fn, ms = 600) => {
  await p.evaluate(({ sel }) => { const d = document.querySelector(sel); window.__m = []; const t0 = performance.now(); window.__tick = () => { const cs = getComputedStyle(d); window.__m.push({ t: Math.round(performance.now() - t0), transform: cs.transform, open: d.open, closing: d.classList.contains('closing'), dim: getComputedStyle(d, '::backdrop').opacity }); if (performance.now() - t0 < 1500) requestAnimationFrame(window.__tick); }; requestAnimationFrame(window.__tick); }, { sel });
  await fn(); await sleep(ms);
  const m = await p.evaluate(() => window.__m);
  return m.map((s) => ({ ...s, y: matrixY(s.transform) }));
};
{ // the item popup on a phone
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' }); const p = await open(ctx);
  const inSamples = await sampleMotion(p, '#sheet', () => p.evaluate(() => document.querySelector('main section li.item').click()));
  const firstOpen = inSamples.find((s) => s.open); const settled = inSamples.find((s) => s.open && s.y === 0);
  ev.sheetOpen = { firstOpenAtMs: firstOpen?.t ?? null, startY: firstOpen?.y ?? null, settledAtMs: settled?.t ?? null, dimAtStart: firstOpen?.dim, dimAtEnd: settled?.dim, samples: inSamples.length };
  await sleep(400);
  ev.sheetLook = await p.evaluate(() => { const s = document.getElementById('sheet'); const img = s.querySelector('.sheet-hero img'); const hero = s.querySelector('.sheet-hero'); const after = getComputedStyle(hero, '::after'); const content = document.getElementById('sheet-content'); const h2 = content.querySelector('h2'); const ib = img.getBoundingClientRect(), hb = h2.getBoundingClientRect(); return { hasPhoto: s.classList.contains('has-photo'), photo: `${Math.round(ib.width)}×${Math.round(ib.height)}`, ratio: Math.round((ib.width / ib.height) * 100) / 100, gradient: after.backgroundImage.startsWith('linear-gradient'), gradientHeight: Math.round(parseFloat(after.height)), contentMarginTop: getComputedStyle(content).marginTop, titleTopVsPhotoBottom: Math.round(hb.top - ib.bottom), title: h2.textContent.trim().slice(0, 40), closeLeft: Math.round(s.querySelector('#sheet-close').getBoundingClientRect().left) }; });
  await p.screenshot({ path: path.join(out, 'sheet-open-en.jpg'), type: 'jpeg', quality: 72 });
  const outSamples = await sampleMotion(p, '#sheet', () => p.click('#sheet-close'), 700);
  const firstClosing = outSamples.find((s) => s.closing); const closedAt = outSamples.find((s) => !s.open);
  const lastClosing = [...outSamples].reverse().find((s) => s.closing);
  ev.sheetClose = { closingFromMs: firstClosing?.t ?? null, closedAtMs: closedAt?.t ?? null, yJustBeforeClose: lastClosing?.y ?? null, dimJustBeforeClose: lastClosing?.dim ?? null };
  // Escape and Back close the same way
  await p.evaluate(() => document.querySelector('main section li.item').click()); await sleep(450);
  const esc = await sampleMotion(p, '#sheet', () => p.keyboard.press('Escape'), 700);
  ev.sheetEscape = { closingSeen: esc.some((s) => s.closing), closedAtMs: esc.find((s) => !s.open)?.t ?? null };
  await p.evaluate(() => document.querySelector('main section li.item').click()); await sleep(450);
  const back = await sampleMotion(p, '#sheet', () => p.goBack(), 700);
  ev.sheetBack = { closingSeen: back.some((s) => s.closing), closedAtMs: back.find((s) => !s.open)?.t ?? null };
  // from a grid card, if any section is a grid
  ev.cardPopup = await p.evaluate(() => { const c = document.querySelector('li.item.card'); if (!c) return 'no grid section on this page'; c.click(); const s = document.getElementById('sheet'); const r = { open: s.open, hasPhoto: s.classList.contains('has-photo') }; return r; });
  if (typeof ev.cardPopup === 'object') { await sleep(500); await p.screenshot({ path: path.join(out, 'sheet-open-from-card.jpg'), type: 'jpeg', quality: 72 }); await p.click('#sheet-close'); await sleep(500); }
  // the owner's notes (Majoun carries halal, a dietary word, an allergen and a note in both languages): shown under "Good to know"
  const majoun = await p.evaluate(() => { const li = [...document.querySelectorAll('li.item')].find((l) => l.querySelector('h3 [lang=en]')?.textContent.trim() === 'Majoun'); if (!li) return null; li.click(); const s = document.getElementById('sheet'); const n = s.querySelector('[data-notes]'); const vis = (el) => [...el.querySelectorAll('[lang=en]')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()); return { open: s.open, notesShown: !!n, heading: n?.querySelector('h3 [lang=en]')?.textContent, chips: n ? [...n.querySelectorAll('.chip')].map((c) => c.querySelector('[lang=en]')?.textContent) : [], lines: n ? vis(n) : [], withoutNotes: (() => { const other = [...document.querySelectorAll('li.item')].find((l) => l.querySelector('h3 [lang=en]')?.textContent.trim() === 'Green Mojito'); return other ? !other.querySelector('template.detail').content.querySelector('[data-notes]') : null; })() }; });
  ev.notes = majoun; if (majoun) { await sleep(450); await p.evaluate(() => document.getElementById('sheet').scrollTo(0, 260)); await sleep(200); await p.screenshot({ path: path.join(out, 'sheet-notes-en.jpg'), type: 'jpeg', quality: 72 }); const toggle = () => p.evaluate(() => document.getElementById('lang-toggle').click()); /* the popup is modal, so the toggle behind it is switched by script */ await toggle(); await sleep(300); ev.notesFa = await p.evaluate(() => { const n = document.querySelector('#sheet [data-notes]'); return n ? [...n.querySelectorAll('[lang=fa]')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()) : null; }); await p.screenshot({ path: path.join(out, 'sheet-notes-fa.jpg'), type: 'jpeg', quality: 72 }); await toggle(); await sleep(300); await p.evaluate(() => document.getElementById('sheet').close()); await sleep(300); }
  // Persian: the close button on the right
  await p.click('#lang-toggle'); await sleep(300); await p.evaluate(() => document.querySelector('main section li.item').click()); await sleep(450);
  ev.sheetFa = await p.evaluate(() => { const s = document.getElementById('sheet'); const b = s.querySelector('#sheet-close').getBoundingClientRect(); return { dir: document.documentElement.dir, closeLeft: Math.round(b.left), closeRight: Math.round(innerWidth - b.right) }; });
  await p.screenshot({ path: path.join(out, 'sheet-open-fa.jpg'), type: 'jpeg', quality: 72 });
  await p.click('#sheet-close'); await sleep(500); await p.click('#lang-toggle'); await sleep(300);
  // the section list
  const listIn = await sampleMotion(p, '#sections-dialog', () => p.click('#tabs-list'));
  const lFirst = listIn.find((s) => s.open), lSettled = listIn.find((s) => s.open && s.y === 0);
  ev.listOpen = { firstOpenAtMs: lFirst?.t ?? null, startY: lFirst?.y ?? null, settledAtMs: lSettled?.t ?? null };
  await sleep(300);
  ev.listLook = await p.evaluate(() => { const l = document.getElementById('sections-dialog'); const b = l.getBoundingClientRect(); const tabs = document.getElementById('tabs').getBoundingClientRect(); const close = l.querySelector('#list-close').getBoundingClientRect(); const top = l.querySelector('.list-top'); return { height: Math.round(b.height), screen: innerHeight, share: Math.round((b.height / innerHeight) * 100), top: Math.round(b.top), tabBarBottom: Math.round(tabs.bottom), tabBarVisibleAbove: tabs.bottom <= b.top, scrollable: l.scrollHeight > l.clientHeight, scrollHeight: l.scrollHeight, clientHeight: l.clientHeight, closeLeft: Math.round(close.left), closeRight: Math.round(innerWidth - close.right), topSticky: getComputedStyle(top).position, sections: l.querySelectorAll('li').length }; });
  await p.screenshot({ path: path.join(out, 'list-open-en.jpg'), type: 'jpeg', quality: 72 });
  // a tap on a section: the list's exit and the page's scroll start together
  const target = await p.evaluate(() => { const a = document.querySelectorAll('#sections-dialog a')[5]; return { href: a.getAttribute('href'), id: decodeURIComponent(a.getAttribute('href').slice(1)) }; });
  await p.evaluate((id) => { const l = document.getElementById('sections-dialog'); window.__s = []; const t0 = performance.now(); const tick = () => { window.__s.push({ t: Math.round(performance.now() - t0), scrollY: Math.round(scrollY), open: l.open, closing: l.classList.contains('closing'), sectionTop: Math.round(document.getElementById(id).getBoundingClientRect().top) }); if (performance.now() - t0 < 1500) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, target.id);
  await p.evaluate((href) => document.querySelector(`#sections-dialog a[href="${href}"]`).click(), target.href);
  await sleep(1400);
  const tap = await p.evaluate(() => window.__s);
  const firstScroll = tap.find((s) => s.scrollY !== tap[0].scrollY), firstClosingL = tap.find((s) => s.closing), closedL = tap.find((s) => !s.open);
  const end = tap.at(-1); const bar = await p.evaluate(() => Math.round(document.getElementById('tabs').getBoundingClientRect().bottom));
  ev.listTap = { section: target.id, scrollStartedAtMs: firstScroll?.t ?? null, exitStartedAtMs: firstClosingL?.t ?? null, listClosedAtMs: closedL?.t ?? null, pageScrolledPx: end.scrollY - tap[0].scrollY, sectionTopAtEnd: end.sectionTop, tabBarBottom: bar, sectionUnderBar: Math.abs(end.sectionTop - bar) <= 2, activeTab: await p.evaluate(() => document.querySelector('#tabs a.active')?.getAttribute('data-tab')) };
  await p.screenshot({ path: path.join(out, 'list-tap-result.jpg'), type: 'jpeg', quality: 72 });
  // Persian list: close on the right
  await p.click('#lang-toggle'); await sleep(300); await p.click('#tabs-list'); await sleep(450);
  ev.listFa = await p.evaluate(() => { const l = document.getElementById('sections-dialog'); const c = l.querySelector('#list-close').getBoundingClientRect(); return { dir: document.documentElement.dir, closeLeft: Math.round(c.left), closeRight: Math.round(innerWidth - c.right) }; });
  await p.screenshot({ path: path.join(out, 'list-open-fa.jpg'), type: 'jpeg', quality: 72 });
  const listOut = await sampleMotion(p, '#sections-dialog', () => p.click('#list-close'), 700);
  ev.listClose = { closingFromMs: listOut.find((s) => s.closing)?.t ?? null, closedAtMs: listOut.find((s) => !s.open)?.t ?? null };
  await ctx.close();
}
{ // reduced motion: no animation, open and close at once
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium', reducedMotion: 'reduce' }); const p = await ctx.newPage();
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await sleep(300);
  const r = await sampleMotion(p, '#sheet', () => p.evaluate(() => document.querySelector('main section li.item').click()), 200);
  const c = await sampleMotion(p, '#sheet', () => p.click('#sheet-close'), 200);
  ev.reducedMotion = { openYAtFirstSample: r.find((s) => s.open)?.y ?? null, closedAtMs: c.find((s) => !s.open)?.t ?? null, closingClassSeen: c.some((s) => s.closing) };
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'measure.json'), JSON.stringify(ev, null, 2));
console.log(JSON.stringify(ev, null, 2));
