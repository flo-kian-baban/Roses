#!/usr/bin/env node
// The admin's layout rules on every screen (the PM, 2026-11-06: the item editor's rules of 2026-11-04, its t-calm-layout, extended to the
// whole admin). On a laptop (1440 × 900), a 390 px phone (the iPhone 13 viewport) and a 360 px phone, each screen of the admin (the
// three sign-in screens; the Menu tab with an alert, the venue switcher and the account menu open, a section's menu, a section being
// reordered, the Add item, Add section, Rename and Delete section sheets; the item editor; the Style tab, a colour open, the Welcome
// group open; Details; Team; Add venue) is measured by scripts/layout-rules.mjs: nothing past the screen's edges, cut by its box, cut
// short or scrolling sideways; the text sizes 13, 16 and 17 px and the page title's (28 px); one corner radius (12 px) on what the admin
// draws. One check per screen width. Needs the production server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DRILL_ADMIN_PIN=… node scripts/layout-drill.mjs --base http://127.0.0.1:<port> --out reports/checks/<stamp>/layout
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';
import { MEASURE, RADIUS, SIZES, adminScreens } from './layout-rules.mjs';

loadEnv();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const base = args.base || 'http://localhost:3000', out = path.resolve(args.out || 'reports/layout'), pin = process.env.DRILL_ADMIN_PIN;
if (!pin) { console.error('DRILL_ADMIN_PIN missing'); process.exit(2); }
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
  await outCtx.close(); await inCtx.close();
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
