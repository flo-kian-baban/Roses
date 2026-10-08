#!/usr/bin/env node
// Evidence for the item popup layout (Kian, 2026-10-08, after the Uber Eats reference) on a running build, Chromium:
//   iPhone 13 viewport, English and Persian, six items that between them carry every kind of content the popup can show
//   (a photo or none, a description or none, Serves, sizes, an optional and a required option group, combo parts, the owner's
//   notes): the title block (sizes, weights, the price span, the Serves line), the groups in order with their band (full width,
//   the popup's light shade), their rows (hairlines between rows only, the amount on the end side and left-to-right in Persian
//   too), the bottom clearance, the title clear of the Close button when there is no photo, the sheet within 92 % of the screen;
//   a laptop viewport (1280 × 800) for the centred card. Screenshots of every case.
//   node reports/sheet-layout/measure.mjs --base http://127.0.0.1:3002 --out reports/sheet-layout
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base, out = path.resolve(args.out || 'reports/sheet-layout'); if (!base) { console.error('need --base'); process.exit(2); }
await fs.mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CASES = [
  { venue: 'senso', name: 'Majoun', slug: 'majoun', why: 'photo, description, the owner\'s notes (halal, Vegan, NUTS, a note); opened from a grid card' },
  { venue: 'senso', name: 'Brewing Coffee Medium', slug: 'coffee', why: 'photo, an optional option group with a +$ price' },
  { venue: 'senso', name: 'Ice Cream', slug: 'ice-cream', why: 'photo, a required option group of seven' },
  { venue: 'kebab-land', name: 'Ketel One', slug: 'ketel-one', why: 'no photo, no description, two sizes (the price span)' },
  { venue: 'kebab-land', name: 'Kaseh Kebab', slug: 'kaseh-kebab', why: 'photo, Serves 2, combo parts with a quantity' },
  { venue: 'kebab-land', name: 'Mixed Appetizer', slug: 'mixed-appetizer', why: 'no photo, description, combo parts' },
];
const browser = await chromium.launch();
const ev = { base, at: new Date().toISOString(), cases: [] };

// what the popup shows, measured in the page
const LOOK = `(() => {
  const vis = (el) => { if (!el) return null; const spans = [...el.querySelectorAll('[lang]')]; if (!spans.length) return el.textContent.trim(); return spans.filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()).join(' '); };
  const s = document.getElementById('sheet'), sb = s.getBoundingClientRect(), content = document.getElementById('sheet-content');
  const h2 = content.querySelector('h2'), c2 = getComputedStyle(h2), hb = h2.getBoundingClientRect();
  const img = s.querySelector('.sheet-hero img'), close = s.querySelector('#sheet-close').getBoundingClientRect();
  const priceEl = content.querySelector('.sheet-price'), bdi = priceEl && priceEl.querySelector('bdi'), serves = priceEl && priceEl.querySelector('.sheet-serves');
  const locate = (el, off) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, acc = 0; while ((n = w.nextNode())) { if (off <= acc + n.length) return [n, off - acc]; acc += n.length; } return null; };
  const partRects = (el, a, b) => { const r = document.createRange(); const [na, oa] = locate(el, a), [nb, ob] = locate(el, b); r.setStart(na, oa); r.setEnd(nb, ob); return r.getBoundingClientRect(); }; /* the server's HTML separates adjacent text with comment nodes */
  let span = null; if (bdi) { const t = bdi.textContent; const i = t.indexOf(' – '); span = { text: t, fontSize: getComputedStyle(priceEl).fontSize, weight: getComputedStyle(priceEl).fontWeight }; if (i > 0) { const lo = partRects(bdi, 0, i), hi = partRects(bdi, i + 3, t.length); span.lowLeftOfHigh = lo.right <= hi.left; } }
  const desc = content.querySelector('.sheet-desc'), cd = desc && getComputedStyle(desc);
  const groups = [...content.querySelectorAll('.sheet-group')].map((g) => { const band = g.querySelector('.sheet-band'), bb = band.getBoundingClientRect(), h3 = band.querySelector('h3'), sub = band.querySelector(':scope > p'); const rows = [...g.querySelectorAll('.sheet-rows li')]; const r0 = rows[0];
    const amounts = rows.map((r) => { const a = r.querySelector('.amount'); if (!a) return null; const ab = a.getBoundingClientRect(); const t = a.textContent; const o = { text: t, startSide: Math.round(ab.left - sb.left), endSide: Math.round(sb.right - ab.right), color: getComputedStyle(a).color }; if (t.startsWith('+')) { const plus = partRects(a, 0, 1), rest = partRects(a, 1, t.length); o.plusLeftOfFigure = plus.right <= rest.left; } return o; }).filter(Boolean).slice(0, 2);
    return { heading: vis(h3), headingFont: getComputedStyle(h3).fontSize + ' ' + getComputedStyle(h3).fontWeight, sub: sub ? vis(sub) : null, subFont: sub ? getComputedStyle(sub).fontSize : null, bandBg: getComputedStyle(band).backgroundColor, bandInset: Math.round(bb.left - sb.left), bandWidth: Math.round(bb.width), sheetWidth: Math.round(sb.width), rows: rows.length, rowFont: r0 ? getComputedStyle(r0).fontSize : null, rowPad: r0 ? getComputedStyle(r0).paddingTop : null, hairlineBetween: rows.length > 1 ? getComputedStyle(r0).borderBottomWidth : null, hairlineAfterLast: rows.length ? getComputedStyle(rows[rows.length - 1]).borderBottomWidth : null, rowTexts: rows.slice(0, 3).map((r) => vis(r.firstElementChild)), amounts, notes: g.hasAttribute('data-notes') ? { chips: [...g.querySelectorAll('.chip')].map(vis), lines: [...g.querySelectorAll('.sheet-notes > p')].map(vis) } : undefined }; });
  const last = content.querySelector('.sheet-body').lastElementChild, lb = last.getBoundingClientRect();
  return { dir: document.documentElement.dir || 'ltr', hasPhoto: s.classList.contains('has-photo'), photo: img ? Math.round(img.getBoundingClientRect().width) + '×' + Math.round(img.getBoundingClientRect().height) : null,
    title: { text: vis(h2), fontSize: c2.fontSize, weight: c2.fontWeight, lineHeight: c2.lineHeight, startInset: Math.round(document.documentElement.dir === 'rtl' ? sb.right - hb.right : hb.left - sb.left), topVsPhotoBottom: img ? Math.round(hb.top - img.getBoundingClientRect().bottom) : null, topVsCloseBottom: Math.round(hb.top - close.bottom) },
    priceSpan: span, serves: serves ? { text: vis(serves), color: getComputedStyle(serves).color, weight: getComputedStyle(serves).fontWeight } : null,
    description: desc ? { fontSize: cd.fontSize, lineHeight: cd.lineHeight, color: cd.color, words: desc.textContent.trim().split(/\\s+/).length } : null,
    groups, bottomClearance: Math.round(sb.bottom - lb.bottom), sheetHeight: Math.round(sb.height), screen: innerHeight, share: Math.round((sb.height / innerHeight) * 100), scrollable: s.scrollHeight > s.clientHeight + 1,
    bandVar: getComputedStyle(document.documentElement).getPropertyValue('--c-sheet-hero').trim(), lineVar: getComputedStyle(document.documentElement).getPropertyValue('--c-sheet-line').trim() };
})()`;
const findAndOpen = (name) => `(() => { const li = [...document.querySelectorAll('li.item')].find((l) => { const h = l.querySelector('h3'); const en = h.querySelector('[lang=en]'); return (en ? en.textContent : h.textContent).trim() === ${JSON.stringify(name)}; }); if (!li) return false; li.click(); return li.classList.contains('card') ? 'card' : 'row'; })()`;

const run = async (ctx, c, lang, tag) => {
  const p = await ctx.newPage(); await p.goto(`${base}/${c.venue}`, { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.intro === 'done').catch(() => {});
  // the toggle's choice persists across page loads in the context, so the wanted language is set explicitly
  if (await p.evaluate(() => document.documentElement.getAttribute('data-lang')) !== lang) { await p.click('#lang-toggle'); await sleep(300); }
  const dir = await p.evaluate(() => document.documentElement.dir || 'ltr');
  const from = await p.evaluate(findAndOpen(c.name)); if (!from) { await p.close(); return { error: `${c.name} not found on /${c.venue}` }; }
  await sleep(500);
  const look = await p.evaluate(LOOK); look.from = from; look.lang = await p.evaluate(() => document.documentElement.getAttribute('data-lang')); look.dir = dir;
  await p.screenshot({ path: path.join(out, `${c.slug}-${lang}${tag}.jpg`), type: 'jpeg', quality: 72 });
  if (look.scrollable) { await p.evaluate(() => { const s = document.getElementById('sheet'); s.scrollTop = s.scrollHeight; }); await sleep(200); look.bottomClearance = await p.evaluate(() => { const s = document.getElementById('sheet'); const last = s.querySelector('.sheet-body').lastElementChild; return Math.round(s.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom); }); await p.screenshot({ path: path.join(out, `${c.slug}-${lang}${tag}-end.jpg`), type: 'jpeg', quality: 72 }); }
  await p.close(); return look;
};
{ // phone
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
  for (const c of CASES) ev.cases.push({ ...c, en: await run(ctx, c, 'en', ''), fa: await run(ctx, c, 'fa', '') });
  await ctx.close();
}
{ // laptop: the centred card
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  ev.laptop = [];
  for (const c of CASES.filter((x) => ['majoun', 'coffee'].includes(x.slug))) { const l = await run(ctx, c, 'en', '-laptop'); ev.laptop.push({ slug: c.slug, sheetWidth: l.groups?.[0]?.sheetWidth ?? null, sheetHeight: l.sheetHeight, share: l.share, scrollable: l.scrollable, groups: l.groups?.map((g) => g.heading) }); }
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'measure.json'), JSON.stringify(ev, null, 2));
console.log(JSON.stringify(ev, null, 2));
