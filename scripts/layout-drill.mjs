#!/usr/bin/env node
// The admin's layout rules on every screen (the PM, 2026-11-06: the item editor's rules of 2026-11-04, its t-calm-layout, extended to the
// whole admin). On a laptop (1440 × 900), a 390 px phone (the iPhone 13 viewport) and a 360 px phone, each screen of the admin (the
// three sign-in screens; the Menu tab with an alert, the venue switcher and the account menu open, a section's menu, a section being
// reordered, the Add item, Add section, Rename and Delete section sheets; the item editor; the Style tab, a colour open, the Welcome
// group open; Details; Team; Add venue) is measured by scripts/layout-rules.mjs: nothing past the screen's edges, cut by its box, cut
// short or scrolling sideways; the text sizes 13, 16 and 17 px and the page title's (28 px); one corner radius (12 px) on what the admin
// draws. One check per screen width. On the two phones also: every row that scrolls sideways (the preview bar in the Style tab's sheet)
// keeps the chip at the screen's edge visibly cut, at least CUT_MIN px shown and hidden (the PM, 2026-11-06). On every width, the Menu tab's
// search row (Kian, 2026-11-07: its white bar stuck out past the cards): at the top and once stuck, its backing in the page's own colour,
// its fields in the cards' white, the search field's left edge and the section menu's right edge on the cards' edges, 12 px from the
// cards above and below at the top (as between cards), stuck right under the tab row. Needs a scratch server at
// --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DRILL_ADMIN_PIN=… node scripts/layout-drill.mjs --base http://127.0.0.1:<port> --out reports/checks/<stamp>/layout
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb } from './load-env.mjs';
import { scratchTarget } from './scratch-target.mjs';
import { CUT_MIN, MEASURE, RADIUS, SIZES, adminScreens } from './layout-rules.mjs';

// The target is a scratch server, or the drill stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('scripts/layout-drill.mjs', { options: { base: 'server', out: 'path' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const base = args.base, out = path.resolve(args.out), pin = process.env.DRILL_ADMIN_PIN;
await fs.mkdir(out, { recursive: true });
const transcript = [], results = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const db = await connectDb('layout-drill', (t) => log('db', t));
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id = 'senso' and not seasonal and listed order by position offset 1 limit 1`)).rows[0];
// an open alert, so the alerts card is measured too (removed at the end)
await db.query(`delete from admin_alerts where message like 'Layout drill:%'`);
await db.query(`insert into admin_alerts (venue_id, kind, message) values ('senso', 'lockout-cap', 'Layout drill: 50 wrong PINs on this venue in the last hour')`);
const { SCREENS, signin, settle } = adminScreens({ base, pin, sec });
const VIEWS = [
  { id: 'laptop', title: 'laptop (1440 × 900)', ctx: { viewport: { width: 1440, height: 900 } } },
  { id: '390', title: '390 px phone (iPhone 13)', ctx: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  { id: '360', title: '360 px phone', ctx: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
];
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const all = [];
for (const v of VIEWS) {
  const outCtx = await browser.newContext(v.ctx), inCtx = await browser.newContext(v.ctx);
  const signedOut = await outCtx.newPage(), signedIn = await inCtx.newPage();
  signedIn.on('pageerror', (e) => log('pageerror', e.message)); signedOut.on('pageerror', (e) => log('pageerror', e.message));
  await signin(signedIn);
  const rows = [];
  for (const [key, title, inside, setup] of SCREENS) {
    const page = inside ? signedIn : signedOut;
    try { await setup(page); await settle(page); } catch (e) { rows.push({ key, title, error: e.message.split('\n')[0] }); log(v.id, `${key}: NOT REACHED (${e.message.split('\n')[0]})`); continue; }
    const m = await page.evaluate(MEASURE);
    const sizes = m.sizes.filter((x) => !SIZES.includes(x)), radii = m.radii.filter((x) => x !== RADIUS);
    rows.push({ key, title, ...m, otherSizes: sizes, otherRadii: radii });
    log(v.id, `${key}: ${m.found.length ? `${m.found.length} problem(s): ${m.found.slice(0, 3).join('; ')}` : 'nothing cut, past the edges or sideways'}; sizes ${m.sizes.join(' ')}; radii ${m.radii.join(' ') || 'none'}`);
    await page.keyboard.press('Escape').catch(() => {}); await page.keyboard.press('Escape').catch(() => {});
  }
  { // the Menu tab's search row: nothing of it shows as a band; the fields line up with the cards
    await signedIn.goto(`${base}/admin/senso`); await signedIn.waitForSelector('[data-item]'); await settle(signedIn);
    const at = async (y) => { await signedIn.evaluate((top) => scrollTo(0, top), y); await sleep(300); return signedIn.evaluate(() => {
      const input = document.querySelector('input[aria-label="Search items"]'), row = input?.closest('.sticky'), select = row?.querySelector('select[aria-label="Jump to section"]');
      const card = document.querySelector('section[id^="sec-"]'), tabs = document.querySelector('.glass.sticky.top-14'), attention = document.querySelector('[aria-label="Needs attention"] > div');
      if (!row || !input || !select || !card || !tabs) return null;
      const bg = (el) => getComputedStyle(el).backgroundColor, b = (el) => el.getBoundingClientRect();
      return { rowBg: bg(row), pageBg: bg(document.querySelector('.admin')), fieldBg: bg(input), selectBg: bg(select), cardBg: bg(card), fieldLeft: b(input).left, selectRight: b(select).right, cardLeft: b(card).left, cardRight: b(card).right, rowTop: b(row).top, tabsBottom: b(tabs).bottom, gapAbove: attention ? b(input).top - b(attention).bottom : null, gapBelow: b(card).top - b(input).bottom, scrollY };
    }); };
    const top = await at(0), stuck = await at(800);
    const spaced = (m) => !!m && (m.gapAbove === null || Math.abs(m.gapAbove - 12) <= 0.5) && Math.abs(m.gapBelow - 12) <= 0.5; // as cards are from each other (mt-3)
    const fits = (m) => !!m && m.rowBg === m.pageBg && m.fieldBg === m.cardBg && m.selectBg === m.cardBg && Math.abs(m.fieldLeft - m.cardLeft) <= 0.5 && Math.abs(m.selectRight - m.cardRight) <= 0.5;
    const say = (m) => (m ? `backing ${m.rowBg} (the page ${m.pageBg}), fields ${m.fieldBg} and ${m.selectBg} (the cards ${m.cardBg}), the fields' edges ${Math.round(m.fieldLeft * 10) / 10}–${Math.round(m.selectRight * 10) / 10} on the cards' ${Math.round(m.cardLeft * 10) / 10}–${Math.round(m.cardRight * 10) / 10}` : 'not found');
    check(`search-row-${v.id}`, fits(top) && spaced(top) && fits(stuck) && stuck.scrollY > 0 && Math.abs(stuck.rowTop - stuck.tabsBottom) <= 0.5, `${v.title}, the Menu tab's search row: at the top, ${say(top)}, ${top ? `${top.gapAbove === null ? 'no Needs attention card' : `${Math.round(top.gapAbove * 10) / 10} px under the Needs attention card`} and ${Math.round(top.gapBelow * 10) / 10} px over the first section (12 each, as between cards)` : ''}; scrolled ${stuck?.scrollY} px, ${say(stuck)}, its top ${stuck ? Math.round(stuck.rowTop * 10) / 10 : '?'} under the tab row's bottom ${stuck ? Math.round(stuck.tabsBottom * 10) / 10 : '?'}`);
  }
  await outCtx.close(); await inCtx.close();
  if (v.id !== 'laptop') {
    const cuts = rows.flatMap((r) => (r.sideways || []).map((c) => ({ key: r.key, ...c })));
    const thin = cuts.filter((c) => Math.min(c.shown, c.hidden) < CUT_MIN);
    check(`sideways-cut-${v.id}`, cuts.length > 0 && thin.length === 0, `${v.title}: ${cuts.length ? `${cuts.length} sideways row(s) measured (${cuts.map((c) => `${c.key}: ${c.chip ? `"${c.chip}" ${c.shown} px shown, ${c.hidden} px hidden` : 'no chip under the edge'}`).join('; ')})${thin.length ? `; ${thin.length} not visibly cut (under ${CUT_MIN} px)` : `, the chip at the edge visibly cut in each (at least ${CUT_MIN} px shown and hidden)`}` : 'no row scrolling sideways was found on the Style screens'}`);
  }
  const bad = rows.filter((r) => r.error || r.found.length || r.otherSizes.length || r.otherRadii.length);
  check(`layout-${v.id}`, bad.length === 0, `${v.title}: ${rows.length} screens measured; ${bad.length ? `${bad.length} breaking the rules: ${bad.map((r) => `${r.key} (${r.error ?? [...r.found.slice(0, 2), ...r.otherSizes.map((x) => `text ${x}`), ...r.otherRadii.map((x) => `radius ${x}`)].join('; ')})`).join(' | ')}` : `every one with nothing cut, past the edges or scrolling sideways, text in ${SIZES.join(', ')} only and the one radius ${RADIUS}`}`);
  all.push({ view: v.id, rows });
}
await browser.close();
await db.query(`delete from admin_alerts where message like 'Layout drill:%'`); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'layout-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, views: all, transcript }, null, 2));
await fs.writeFile(path.join(out, 'layout-drill.txt'), [`Layout drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((x) => `${x.at} [${x.step}] ${x.text}`)].join('\n') + '\n');
console.log(`LAYOUT DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
