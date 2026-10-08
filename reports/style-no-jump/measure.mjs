#!/usr/bin/env node
// Replays the Style tab "jump" (Kian, 2026-10-08) against a running build and records what happens after a save:
//   1. laptop viewport, Style tab of Senso; tap the footer in the preview (the Footer group opens: the preview → controls link);
//   2. open the Category tabs group on the left, open its "Tab text" colour, type a hex and press Enter (a save);
//   3. sample every 100 ms for 3 s: which group is open on the left, whether "Tab text" is still open, which region the
//      preview outlines; then tap the tab bar in the preview (the open group's own region) and sample once more.
// Before the fix the Footer group reopened a moment after the save (the data reload replayed the earlier preview tap);
// after it the Category tabs group and its colour stay open. Undo at the end puts the colour back.
//   DRILL_ADMIN_PIN=… node reports/style-no-jump/measure.mjs --base http://127.0.0.1:3002 --label after --out reports/style-no-jump
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base, label = args.label || 'run', out = path.resolve(args.out || 'reports/style-no-jump');
const pin = process.env.DRILL_ADMIN_PIN; if (!pin || !base) { console.error('need --base and DRILL_ADMIN_PIN'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const l = await ctx.newPage();
await l.goto(`${base}/admin/senso`); await l.fill('input[name=pin]', pin); await l.click('button[type=submit]'); await l.waitForURL(`${base}/admin/senso`);
await l.goto(`${base}/admin/senso?tab=style`); await l.waitForSelector('[data-style-group="rows"]');
const frameReady = () => l.waitForFunction(() => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return !!d && d.readyState === 'complete' && d.location.pathname === '/senso'; });
const frameEval = (fn, arg) => l.evaluate(([src, a]) => { const f = document.querySelector('iframe[data-preview-frame]'); const d = f && f.contentDocument; return d ? (new Function('d', 'arg', `return (${src})(d, arg)`))(d, a) : null; }, [fn.toString(), arg]);
await frameReady();
// One synchronous read of the admin page and the frame (no waiting on selectors, so the samples keep their 100 ms rhythm).
const state = async () => ({
  ...(await l.evaluate(() => ({
    openGroups: [...document.querySelectorAll('[data-style-group][data-open]')].map((e) => e.getAttribute('data-style-group')),
    tabTextOpen: document.querySelector('[data-style-token="tabs.text"] > button')?.getAttribute('aria-expanded') === 'true',
    toast: document.querySelector('[role=status]')?.textContent?.trim() || null,
  }))),
  outlined: await frameEval((d) => [...d.querySelectorAll('.roses-region')].map((e) => e.id || e.tagName.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i)),
});
const run = { base, label, at: new Date().toISOString(), steps: [] };
// 1. the preview tap
await frameEval((d) => { d.querySelector('main footer p').click(); });
await l.waitForSelector('[data-style-group="footer"][data-open]');
run.steps.push({ step: 'tapped the footer in the preview', ...(await state()) });
// 2. another group on the left, a colour, a save
await l.click('[data-style-group="tabs"] > button'); await l.waitForSelector('[data-style-group="tabs"][data-open]');
await l.click('[data-style-token="tabs.text"] > button'); await l.waitForSelector('[data-style-token="tabs.text"] input[aria-label$=": hex"]');
run.steps.push({ step: 'opened Category tabs on the left and its Tab text colour', ...(await state()) });
// a colour the readability guard accepts on whatever the bar background is right now (near-black on a light bar, near-white on a dark one)
const barBg = await frameEval((d) => getComputedStyle(d.documentElement).getPropertyValue('--c-tabs-bg').trim());
const lin = (x) => { const v = x / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
const colour = lum(barBg) > 0.3 ? '#101010' : '#f4f4f4';
run.colour = { barBg, chosen: colour };
const t0 = Date.now();
await l.fill('[data-style-token="tabs.text"] input[aria-label$=": hex"]', colour); await l.press('[data-style-token="tabs.text"] input[aria-label$=": hex"]', 'Enter');
// 3. samples after the save
const samples = [];
while (Date.now() - t0 < 3000) { samples.push({ ms: Date.now() - t0, ...(await state()) }); await sleep(100); }
run.samples = samples;
const jumped = samples.find((s) => s.openGroups.join() !== 'tabs' || !s.tabTextOpen);
run.afterSave = { firstJumpAtMs: jumped ? jumped.ms : null, jumpedTo: jumped ? jumped.openGroups : null, tabTextOpenAtEnd: samples.at(-1).tabTextOpen, openAtEnd: samples.at(-1).openGroups, outlinedAtEnd: samples.at(-1).outlined };
await l.screenshot({ path: path.join(out, `${label}-after-save.jpg`), type: 'jpeg', quality: 70 });
// 4. a tap on the open group's own region
await frameEval((d) => { d.querySelector('#tabs a').click(); }); await sleep(500);
run.afterTapOnOpenRegion = await state();
await l.click('[role=status] button:has-text("Undo")').catch(() => {}); await sleep(800);
await fs.writeFile(path.join(out, `${label}.json`), JSON.stringify(run, null, 2));
console.log(JSON.stringify({ label, colour: run.colour, afterSave: run.afterSave, afterTapOnOpenRegion: run.afterTapOnOpenRegion }, null, 2));
await browser.close();
