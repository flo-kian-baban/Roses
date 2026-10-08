// Measures how the category tabs follow taps and manual scrolling on a venue page.
//   node reports/tabs-follow-scroll/tabs-measure.mjs <base> <venue> <before|after> [chromium|webkit] [en|fa]   (from the repo root; TABS_OUT overrides the output folder)
import fs from 'node:fs/promises';
import * as pw from 'playwright';
const [base = 'http://127.0.0.1:3000', venue = 'senso', label = 'before', browserName = 'chromium', lang = 'en'] = process.argv.slice(2);
const { devices } = pw;
const OUT = process.env.TABS_OUT || 'reports/tabs-follow-scroll';
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: browserName };
const browser = await pw[browserName].launch();
const ctx = await browser.newContext(DEVICE);
const page = await ctx.newPage();
await page.goto(`${base}/${venue}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.intro === 'done' || document.documentElement.dataset.intro === 'skip', null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(800);
if (lang === 'fa') { await page.click('header button'); await page.waitForTimeout(400); }
await page.evaluate(() => {
  window.__log = [];
  const tabs = document.querySelectorAll('#tabs a[data-tab]');
  const mo = new MutationObserver(() => { const a = document.querySelector('#tabs a.active'); const id = a ? a.dataset.tab : null; const last = window.__log[window.__log.length - 1]; if (!last || last.id !== id) window.__log.push({ t: Math.round(performance.now()), id, y: Math.round(scrollY) }); });
  tabs.forEach((a) => mo.observe(a, { attributes: true, attributeFilter: ['class'] }));
  window.__state = () => {
    const bar = document.getElementById('tabs').getBoundingClientRect();
    const secs = [...document.querySelectorAll('main section[id]')].map((s) => { const r = s.getBoundingClientRect(); return { id: s.id, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 }; });
    const maxY = document.documentElement.scrollHeight - innerHeight;
    const atBottom = scrollY >= maxY - 1;
    let expected = secs[0]?.id ?? null;
    for (const s of secs) if (s.top <= bar.bottom + 1) expected = s.id;
    if (atBottom) expected = secs[secs.length - 1].id;
    const active = document.querySelector('#tabs a.active')?.dataset.tab ?? null;
    const a = active ? document.querySelector(`#tabs a[data-tab="${active}"]`) : null;
    const ul = document.querySelector('#tabs ul').getBoundingClientRect();
    const ar = a ? a.getBoundingClientRect() : null;
    const activeTabVisible = ar ? ar.left >= ul.left - 1 && ar.right <= ul.right + 1 : null;
    return { y: Math.round(scrollY), maxY: Math.round(maxY), barHeight: Math.round(bar.height * 10) / 10, barBottom: Math.round(bar.bottom * 10) / 10, atBottom, active, expected, activeTabVisible, secs };
  };
});
const state = () => page.evaluate(() => window.__state());
const settle = async () => { const t0 = Date.now(); let last = -1, stableSince = Date.now(); while (Date.now() - t0 < 4000) { const y = await page.evaluate(() => scrollY); if (y !== last) { last = y; stableSince = Date.now(); } else if (Date.now() - stableSince > 300) break; await page.waitForTimeout(50); } return Date.now() - t0; };
const s0 = await state();
const ids = s0.secs.map((s) => s.id);
const result = { label, venue, base, browser: browserName, lang, dir: await page.evaluate(() => document.documentElement.dir || 'ltr'), at: new Date().toISOString(), viewport: DEVICE.viewport, barHeight: s0.barHeight, sections: ids.length, taps: [], manual: {} };

// 1. taps: every tab in order, then a few long jumps
const order = [...ids.map((_, i) => i), 0, ids.length - 1, 1, ids.length - 2, 0];
for (const i of order) {
  const id = ids[i];
  await page.evaluate(() => { window.__log = []; });
  const before = await state();
  const goalY = Math.min(before.maxY, Math.round(before.y + before.secs[i].top - before.barHeight));
  const t0 = Date.now();
  await page.evaluate((id) => document.querySelector(`#tabs a[data-tab="${id}"]`).click(), id);
  const ms = await settle();
  const s = await state();
  const log = await page.evaluate(() => window.__log);
  const sec = s.secs.find((x) => x.id === id);
  result.taps.push({ tapped: id, index: i, activeAfter: s.active, ok: s.active === id, expectedByPosition: s.expected, sectionTopMinusBar: Math.round((sec.top - s.barBottom) * 10) / 10, goalY, finalY: s.y, reachedGoal: Math.abs(s.y - goalY) <= 2, settleMs: ms, hops: log.map((l) => l.id).filter((h) => h !== id), activeTabVisible: s.activeTabVisible });
  if (i === 1 && result.taps.length === 2) await page.screenshot({ path: `${OUT}/${label}-${venue}-${browserName}-${lang}-tap-second.png` });
}

// 2. manual scroll: 60 px steps down then up, instant; compare the active tab with the section under the bar
for (const dir of ['down', 'up']) {
  const samples = [];
  if (dir === 'down') await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  for (let n = 0; n < 400; n++) {
    await page.evaluate((d) => scrollBy(0, d === 'down' ? 60 : -60), dir);
    await page.waitForTimeout(70);
    const s = await state();
    samples.push({ y: s.y, active: s.active, expected: s.expected, mismatch: s.active !== s.expected, atBottom: s.atBottom, activeTabVisible: s.activeTabVisible, lagPx: s.active !== s.expected ? Math.round(s.barBottom - (s.secs.find((x) => x.id === s.expected)?.top ?? s.barBottom)) : 0 });
    if (dir === 'down' && s.atBottom) break;
    if (dir === 'up' && s.y === 0) break;
  }
  const mism = samples.filter((x) => x.mismatch);
  result.manual[dir] = { samples: samples.length, mismatches: mism.length, maxLagPx: Math.max(0, ...mism.map((x) => x.lagPx)), tabHiddenInStrip: samples.filter((x) => x.activeTabVisible === false).length, lastTabActiveAtBottom: dir === 'down' ? samples[samples.length - 1].active === ids[ids.length - 1] : null, firstMismatches: mism.slice(0, 6) };
}
await page.screenshot({ path: `${OUT}/${label}-${venue}-${browserName}-${lang}-bottom.png` });
await fs.writeFile(`${OUT}/${label}-${venue}-${browserName}-${lang}.json`, JSON.stringify(result, null, 2));
const tapsOk = result.taps.filter((t) => t.ok).length, reached = result.taps.filter((t) => t.reachedGoal).length, hopped = result.taps.filter((t) => t.hops.length > 0).length, hiddenTab = result.taps.filter((t) => t.activeTabVisible === false).length;
console.log(`${label} ${venue} ${browserName} ${lang} (${result.dir}): bar ${result.barHeight}px, ${ids.length} sections; taps ${tapsOk}/${result.taps.length} end on the tapped tab, ${reached}/${result.taps.length} reach the goal position, ${hopped} pass through other tabs on the way, ${hiddenTab} leave the active tab out of the strip; manual down: ${result.manual.down.mismatches}/${result.manual.down.samples} mismatches (max lag ${result.manual.down.maxLagPx}px), last tab active at bottom: ${result.manual.down.lastTabActiveAtBottom}; up: ${result.manual.up.mismatches}/${result.manual.up.samples} mismatches (max lag ${result.manual.up.maxLagPx}px)`);
for (const t of result.taps) if (!t.ok || !t.reachedGoal || t.hops.length || t.activeTabVisible === false) console.log(`  tap ${t.tapped}: active=${t.activeAfter} top-bar=${t.sectionTopMinusBar} goal=${t.goalY} final=${t.finalY} hops=${t.hops.join('>')} ${t.settleMs}ms`);
await browser.close();
