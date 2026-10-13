#!/usr/bin/env node
// Admin audit (report only): where things sit on the iPhone 13 viewport (390 × 664). Reads positions, changes nothing.
//   1. the Menu tab: page height, the top of every section header on a fresh load;
//   2. the item editor of one plain item ("Caramel Macchiato": one price, a linked photo, no sizes, no add-ons) with More and
//      Advanced closed, then both open: the panel's visible height and the top of every heading, field and button in it
//      (y in the panel's own scroll, 0 = top of its content; the panel shows 0…clientHeight without scrolling).
//   DATABASE_URL is not needed; --sp <scratch dir with port and admin.env>
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '/Users/kianbaban/Roses/node_modules/playwright/index.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const SP = args.sp;
const base = `http://127.0.0.1:${fs.readFileSync(path.join(SP, 'port'), 'utf8').trim()}`;
const cred = Object.fromEntries(fs.readFileSync(path.join(SP, 'admin.env'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto(`${base}/admin/senso`);
await page.fill('input[name=pin]', cred.AUDIT_ADMIN_PIN); await page.click('button[type=submit]');
await page.waitForURL(`${base}/admin/senso`); await page.waitForSelector('[data-item]');
const menu = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight], pageHeight: document.documentElement.scrollHeight,
  stickyBottom: Math.round(document.querySelector('input[aria-label="Search items"]').closest('.glass').getBoundingClientRect().bottom),
  sections: [...document.querySelectorAll('section[id^="sec-"]')].map((s) => ({ name: s.querySelector('header span.truncate')?.textContent, shownAs: s.querySelector('header span.truncate') ? (s.querySelector('header span.truncate').scrollWidth > s.querySelector('header span.truncate').clientWidth ? 'truncated' : 'full') : null, top: Math.round(s.getBoundingClientRect().top + scrollY) })),
}));
const ITEM = 'Caramel Macchiato';
await page.fill('input[aria-label="Search items"]', ITEM);
await page.locator(`[data-item] button[aria-label="Edit ${ITEM}"]`).first().click();
const d = page.locator('[role=dialog][aria-label^="Edit "]'); await d.waitFor();
await page.waitForTimeout(400);
const read = () => d.evaluate((dlg) => {
  const sc = dlg.querySelector('.overflow-y-auto'); const top = sc.getBoundingClientRect().top - sc.scrollTop;
  const seen = new Set(); const rows = [];
  for (const el of sc.querySelectorAll('span.text-sm.font-medium, p.text-sm.font-medium, button, input, textarea')) {
    if (!el.offsetParent && el.type !== 'file') continue;
    let label = el.getAttribute('aria-label') || (el.tagName === 'BUTTON' ? el.textContent.trim() : el.textContent.trim());
    if (el.type === 'checkbox' && !el.getAttribute('aria-label')) label = `checkbox: ${el.closest('label')?.textContent.trim()}`;
    if (el.type === 'radio') label = `radio: ${el.closest('label')?.textContent.trim()}`;
    if (el.type === 'file') label = 'Add/Replace photo (file input)';
    const y = Math.round((el.type === 'file' ? el.closest('label') : el).getBoundingClientRect().top - top);
    const key = `${label}@${y}`; if (seen.has(key)) continue; seen.add(key);
    rows.push({ y, kind: el.tagName.toLowerCase() + (el.type ? `[${el.type}]` : ''), label: label.slice(0, 80) });
  }
  return { panelVisibleHeight: sc.clientHeight, panelTopOnScreen: Math.round(sc.getBoundingClientRect().top), contentHeight: sc.scrollHeight, controls: rows.sort((a, b) => a.y - b.y) };
});
const closed = await read();
await d.locator('button[aria-expanded]:has-text("More")').click();
await d.locator('button[aria-expanded]:has-text("Advanced")').click();
await page.waitForTimeout(300);
const open = await read();
await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', 'layout-panel-open-top.jpg'), type: 'jpeg', quality: 60 });
await browser.close();
const out = { at: new Date().toISOString(), item: ITEM, menu, panelClosed: closed, panelOpen: open };
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'panel-layout.json'), JSON.stringify(out, null, 2));
console.log(`menu tab: page height ${menu.pageHeight} px; sticky bars end at y ${menu.stickyBottom}; sections:`, menu.sections.map((s) => `${s.name} @${s.top}${s.shownAs === 'truncated' ? ' (name cut)' : ''}`).join(', '));
console.log(`item panel (${ITEM}): visible ${closed.panelVisibleHeight} px from y ${closed.panelTopOnScreen}; content ${closed.contentHeight} px closed, ${open.contentHeight} px with More and Advanced open`);
for (const c of open.controls) console.log(String(c.y).padStart(5), c.y > open.panelVisibleHeight ? 'below ' : 'in view', c.kind.padEnd(16), c.label);
