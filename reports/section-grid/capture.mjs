#!/usr/bin/env node
// Evidence for the per-section grid layout (Kian, 2026-10-08) on a running build: switches "Fresh Juice" to Grid through
// the admin route, saves the public page as a customer sees it on an iPhone (English and Persian, scrolled to the section),
// measures the grid (columns, card widths, photo size), opens the popup from a card, records the Style tab's Layout group
// on a laptop, then puts the section back to List.
//   DRILL_ADMIN_PIN=… node reports/section-grid/capture.mjs --base http://127.0.0.1:3002 --out reports/section-grid
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base, out = path.resolve(args.out || 'reports/section-grid'); const pin = process.env.DRILL_ADMIN_PIN;
if (!pin || !base) { console.error('need --base and DRILL_ADMIN_PIN'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = await fetch(`${base}/api/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ mode: 'pin', venue: 'senso', pin }).toString() });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const api = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const html0 = await (await fetch(`${base}/senso`, { cache: 'no-store' })).text();
const sectionId = (html0.match(/<section[^>]*id="fresh-juice"[^>]*data-id="([^"]+)"/) || [])[1];
if (!sectionId) { console.error('Fresh Juice not on the page'); process.exit(1); }
const evidence = { base, at: new Date().toISOString(), sectionId };
const r = await api('/api/admin/section', { action: 'update', id: sectionId, patch: { layout: 'grid' } });
evidence.save = { status: r.status, layout: r.json?.section?.layout, revisions: r.json?.revisions };
let html = ''; const t0 = Date.now(); while (Date.now() - t0 < 10000) { html = await (await fetch(`${base}/senso`, { cache: 'no-store' })).text(); if (/id="fresh-juice"[\s\S]*?<ul class="[^"]*grid-cols-2[^"]*"[^>]*data-layout="grid"/.test(html)) break; await sleep(150); }
evidence.publicAfterMs = Date.now() - t0;
const sec = html.match(/<section[^>]*id="fresh-juice"[\s\S]*?<\/section>/)[0];
const cardBlocks = sec.split('<li class="item card ').slice(1).map((b) => b.split('<template class="detail"')[0]); // each card's own markup, before its popup template
evidence.publicHtml = { cards: (sec.match(/<li class="item card /g) || []).length, descriptionsOnCards: cardBlocks.filter((b) => /rows-desc/.test(b)).length, descriptionsInPopups: (sec.match(/sheet-body/g) || []).length, rows: (sec.match(/<li class="item flex /g) || []).length, popups: (sec.match(/<template class="detail"/g) || []).length, placeholders: (sec.match(/rounded-xl bg-\(--c-rows-photo\)" aria-hidden/g) || []).length, eagerPhotos: (sec.match(/loading="eager"/g) || []).length, listSectionsLeft: (html.match(/data-layout="list"/g) || []).length, scriptTags: (html.match(/<script[^>]*>/g) || []).length, externalScripts: (html.match(/<script[^>]*\bsrc=/g) || []).length };
const browser = await chromium.launch();
{ const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' }); const p = await ctx.newPage();
  await p.goto(`${base}/senso`, { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.intro === 'done');
  await p.evaluate(() => document.getElementById('fresh-juice').scrollIntoView({ block: 'start' })); await sleep(700);
  await p.evaluate(async () => { const imgs = [...document.querySelectorAll('#fresh-juice img')].slice(0, 8); await Promise.all(imgs.map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))); });
  evidence.grid = await p.evaluate(() => { const ul = document.querySelector('#fresh-juice ul'); const cs = getComputedStyle(ul); const cards = [...ul.querySelectorAll('li.item')]; const r = cards.slice(0, 4).map((c) => { const b = c.getBoundingClientRect(); const img = c.querySelector('img, div[aria-hidden]'); const ib = img?.getBoundingClientRect(); return { left: Math.round(b.left), top: Math.round(b.top), width: Math.round(b.width), photo: ib ? `${Math.round(ib.width)}×${Math.round(ib.height)}` : null, name: c.querySelector('h3 [lang=en]')?.textContent, price: c.querySelector('p [lang]')?.textContent || c.querySelector('p')?.textContent }; }); const h2 = document.querySelector('#fresh-juice h2').getBoundingClientRect(); const sec = document.getElementById('fresh-juice'); const band = sec.nextElementSibling?.querySelector('.section-divider')?.getBoundingClientRect(); const last = cards[cards.length - 1].getBoundingClientRect(); const lastText = cards[cards.length - 1].querySelector('p')?.getBoundingClientRect(); const listSec = [...document.querySelectorAll('main section')].find((s) => s.querySelector('ul[data-layout="list"]') && s.nextElementSibling?.querySelector('.section-divider')); const listLast = listSec && [...listSec.querySelectorAll('li.item')].pop(); const listBand = listSec && listSec.nextElementSibling.querySelector('.section-divider').getBoundingClientRect(); return { display: cs.display, columns: cs.gridTemplateColumns, columnGap: cs.columnGap, rowGap: cs.rowGap, cards: cards.length, firstFour: r, spacing: { headingBottomToFirstCard: Math.round(ul.getBoundingClientRect().top - h2.bottom), lastCardBottomToBand: band ? Math.round(band.top - last.bottom) : null, lastPriceBottomToBand: band && lastText ? Math.round(band.top - lastText.bottom) : null, listForComparison: listLast ? { lastRowTextBottomToBand: Math.round(listBand.top - [...listLast.querySelectorAll('p, h3')].pop().getBoundingClientRect().bottom) } : null }, listRowPhoto: (() => { const i = document.querySelector('#senso-signature li.item img'); const b = i?.getBoundingClientRect(); return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : null; })() }; });
  await p.screenshot({ path: path.join(out, 'public-grid-en.jpg'), type: 'jpeg', quality: 72 });
  await p.evaluate(() => document.querySelector('#fresh-juice li.item').click()); await sleep(500);
  evidence.popup = await p.evaluate(() => { const s = document.getElementById('sheet'); return { open: s.open, title: s.querySelector('h2 [lang=en]')?.textContent, hero: !!s.querySelector('#sheet-hero img') }; });
  await p.screenshot({ path: path.join(out, 'public-grid-popup.jpg'), type: 'jpeg', quality: 72 });
  await p.evaluate(() => document.getElementById('sheet').close()); await sleep(200);
  await p.click('#lang-toggle'); await sleep(500); await p.evaluate(() => document.getElementById('fresh-juice').scrollIntoView({ block: 'start' })); await sleep(500);
  evidence.persian = await p.evaluate(() => ({ dir: document.documentElement.dir, firstCardLeft: Math.round(document.querySelector('#fresh-juice li.item').getBoundingClientRect().left), secondCardLeft: Math.round(document.querySelectorAll('#fresh-juice li.item')[1].getBoundingClientRect().left) }));
  await p.screenshot({ path: path.join(out, 'public-grid-fa.jpg'), type: 'jpeg', quality: 72 });
  await ctx.close(); }
{ const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const l = await ctx.newPage();
  await l.goto(`${base}/admin/senso`); await l.fill('input[name=pin]', pin); await l.click('button[type=submit]'); await l.waitForURL(`${base}/admin/senso`);
  await l.goto(`${base}/admin/senso?tab=style`); await l.waitForSelector('[data-section-layout]');
  await l.evaluate(() => document.querySelector('[data-style-option="sectionLayout"]').scrollIntoView({ block: 'start' })); await sleep(600);
  evidence.styleTab = await l.$$eval('[data-section-layout]', (els) => els.map((e) => ({ section: e.querySelector('span span')?.textContent, layout: e.getAttribute('data-layout') })));
  await l.screenshot({ path: path.join(out, 'style-tab-layout-group.jpg'), type: 'jpeg', quality: 72 });
  await ctx.close(); }
await browser.close();
const back = await api('/api/admin/section', { action: 'update', id: sectionId, patch: { layout: 'list' } });
evidence.restored = { status: back.status, layout: back.json?.section?.layout };
await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
