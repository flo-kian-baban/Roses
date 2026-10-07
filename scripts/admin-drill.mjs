#!/usr/bin/env node
// Admin acceptance drill on an iPhone viewport: sign-ins, cookie attributes, PIN creation and revocation (Team), the
// listing rule (UI switch, JSON API, database constraint, sizes), section shown/hidden and the public page, notes
// permissions (staff 403, owner and admin edit), venue details API for staff (403), the Style tab for staff.
// Editing tasks, Undo and the change record are in scripts/editor-drill.mjs. Screenshots and a timestamped transcript
// go to --out. Needs the production server at --base and DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD (+ DRILL_ADMIN_PIN).
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { chromium, devices } from 'playwright';
import { loadEnv } from './load-env.mjs';

loadEnv();
const jpeg = process.argv.includes('--jpeg');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a !== '--jpeg').map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const base = args.base || 'http://localhost:3000';
const out = path.resolve(args.out || 'reports/checkpoint-b/admin');
await fs.mkdir(out, { recursive: true });
const email = process.env.DRILL_ADMIN_EMAIL, password = process.env.DRILL_ADMIN_PASSWORD;
if (!email || !password) { console.error('DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD missing'); process.exit(2); }
const transcript = []; const results = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text).replaceAll(email, '<admin email>') }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); log('shot', f); };
const form = (o) => new URLSearchParams(o).toString();
async function post(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: form(body) }); return { status: r.status, location: r.headers.get('location'), setCookie: r.headers.get('set-cookie'), text: r.status === 200 ? await r.text() : '' }; }
async function api(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
const errorOf = (loc) => { try { return new URL(loc, 'http://x').searchParams.get('error'); } catch { return null; } };
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t }; await sleep(300); } return { ok: false, ms: Date.now() - t, html }; }
async function waitDb(sql, params, pred, ms = 5000) { const t = Date.now(); let row; while (Date.now() - t < ms) { row = (await db.query(sql, params)).rows[0]; if (pred(row)) return { ok: true, ms: Date.now() - t, row }; await sleep(50); } return { ok: false, ms: Date.now() - t, row }; }
async function loginPage(ctx, mode, fields) { const page = await ctx.newPage(); await page.goto(`${base}/admin/login${mode === 'admin' ? '?mode=admin' : ''}`); for (const [k, v] of Object.entries(fields)) { if (k === 'venue') await page.check(`input[name=venue][value=${v}]`); else await page.fill(`input[name=${k}]`, v); } await page.click('button[type=submit]'); await page.waitForLoadState('domcontentloaded'); return page; }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
const openItem = async (page, id) => { await page.click(`[data-item="${id}"] button[aria-label^="Edit"]`); await page.waitForSelector('[role=dialog]'); };

// a previous run that stopped early may have left drill PINs active: revoke them first
await db.query(`update pins set revoked_at = now() where revoked_at is null and name like 'Drill %'`);

// (e) unauthenticated POST to a mutation route
{ const r = await api('/api/admin/item', { action: 'update', id: '00000000-0000-0000-0000-000000000000', patch: { listed: true } }); check('e-unauth', r.status === 401, `unauthenticated POST /api/admin/item → ${r.status} ${JSON.stringify(r.json)}`); }

// (c) admin login + cookie attributes
const adminCtx = await browser.newContext(DEVICE);
{
  const page = await adminCtx.newPage(); await page.goto(`${base}/admin/login`); await snap(page, 'login-pin');
  await page.goto(`${base}/admin/login?mode=admin`); await snap(page, 'login-admin');
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password); await page.click('button[type=submit]'); await page.waitForURL((u) => /^\/admin\/[a-z-]+$/.test(u.pathname));
  await page.waitForSelector('[data-item]'); await snap(page, 'editor-admin');
  const r = await post('/api/admin/login', { mode: 'admin', email, password });
  const sc = r.setCookie || '';
  check('c-cookie', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Path=\//.test(sc), `Set-Cookie attributes: ${sc.replace(/roses_session=[^;]+/, 'roses_session=<token>')} (Secure is added when served over https); signed in lands on ${page.url().replace(base, '')} (the first venue's page editor)`);
  await page.close();
}
const adminCookie = await cookieOf(adminCtx);

// admin PIN sign-in (Kian's decision of 2026-10-07): the admin's PIN alone, on any venue, gives admin rights
if (process.env.DRILL_ADMIN_PIN) {
  const r = await post('/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: process.env.DRILL_ADMIN_PIN });
  const c = (r.setCookie || '').split(';')[0];
  const team = c ? await fetch(`${base}/admin/team`, { headers: { cookie: c } }) : null;
  const teamHtml = team ? await team.text() : '';
  check('admin-pin', r.status === 303 && r.location === '/admin/kebab-land' && !!c && team?.status === 200 && teamHtml.includes('Admin accounts'), `admin PIN on the Kebab Land sign-in → ${r.status} to ${r.location}, cookie set: ${!!c}; Team (owner and admin) answers ${team?.status} with the admin accounts: ${teamHtml.includes('Admin accounts')}`);
}

// Team: create staff (senso) and owner (both venues) PINs; the PIN pages are not screenshotted
async function makePin(name, role, venues) { const r = await post('/api/admin/pin', { _action: 'create', name, role, venue_ids: venues.join(','), _back: '/admin/team' }, adminCookie); const pin = r.text.match(/class="pin">(\d{6})</)?.[1]; const id = (await db.query('select id from pins where name = $1 order by created_at desc limit 1', [name])).rows[0]?.id; check('pin-create', !!pin && !!id, `PIN created for "${name}" (${role}, ${venues.join('+')}): shown once on the response page (6 digits: ${!!pin}), hash stored: ${!!id}`); return { pin, id }; }
const staff = await makePin('Drill staff', 'staff', ['senso']);
const owner = await makePin('Drill owner', 'owner', ['senso', 'kebab-land']);
{ const r = await db.query(`select count(*)::int as n from pins where pin_hash not like '$scrypt$%'`); check('d-hash', r.rows[0].n === 0, `pins with a hash not starting with $scrypt$: ${r.rows[0].n}; plain PIN column: none exists (schema has pin_hash only)`); }
{ const page = await adminCtx.newPage(); await page.goto(`${base}/admin/team`); await snap(page, 'team'); await page.close(); }

// (c) logout clears the cookie
{ const r = await post('/api/admin/logout', {}, adminCookie); const after = await fetch(`${base}/admin`, { redirect: 'manual', headers: { cookie: adminCookie } });
  await adminCtx.clearCookies(); const page = await adminCtx.newPage(); const resp = await page.goto(`${base}/admin`); const url = page.url();
  const signInShown = !!(await page.$('form[action="/api/admin/login"] input[name=pin]')) && !(await page.$('a[href="/admin/team"]'));
  check('c-logout', /Max-Age=0/.test(r.setCookie || '') && signInShown, `logout → Set-Cookie: ${r.setCookie}; GET /admin without the cookie → ${resp.status()} at ${url} shows the sign-in form and no admin frame (a still-valid token is simply no longer sent: ${after.status})`); await page.close(); }

// staff PIN login lands on the page editor
const staffCtx = await browser.newContext(DEVICE);
let page = await loginPage(staffCtx, 'pin', { venue: 'senso', pin: staff.pin });
await page.waitForSelector('[data-item]');
const staffTabs = await page.$$eval('a[aria-current], a[href*="tab="]', (els) => els.map((e) => e.textContent));
check('pin-login', page.url() === `${base}/admin/senso` && !staffTabs.includes('Style'), `staff PIN sign-in lands on ${page.url()} (page editor); tabs visible to staff: ${staffTabs.join(', ')} (no Style or Details)`);
await snap(page, 'editor-staff');
const staffCookie = await cookieOf(staffCtx);

// (f) listing rule: UI switch, JSON API, database constraint, sizes
const noPrice = (await db.query(`select i.id, i.name->>'en' as name from items i where i.venue_id='senso' and not i.listed and i.price is null and jsonb_array_length(i.variants)=0 order by i.name->>'en' limit 1`)).rows[0];
await page.fill('input[aria-label="Search items"]', noPrice.name);
await page.click(`[data-item="${noPrice.id}"] input[role=switch]`);
const reason = await page.textContent(`[data-item="${noPrice.id}"] [role=alert]`);
check('f-ui', /needs a price/i.test(reason || '') && (await db.query('select listed from items where id=$1', [noPrice.id])).rows[0].listed === false, `editor: the Shown switch on "${noPrice.name}" (no price) refuses with "${reason?.trim()}"; still hidden in the database`);
await snap(page, 'needs-price-refused');
{ const r = await api('/api/admin/item', { action: 'update', id: noPrice.id, patch: { listed: true } }, staffCookie); check('f-server', r.status === 400 && /needs a price/i.test(r.json?.error || ''), `direct POST action=update listed=true → ${r.status}, error="${r.json?.error}"`); }
{ let err = null; try { await db.query('update items set listed = true where id = $1', [noPrice.id]); } catch (e) { err = e; } check('f-check', !!err && err.constraint === 'listed_requires_price', `SQL "update items set listed = true" on the priceless item → ${err ? `${err.code} ${err.constraint}: ${err.message}` : 'no error (unexpected)'}`); }
{ const sized = (await db.query(`select id, name->>'en' as name, variants from items where venue_id='kebab-land' and name->>'en'='Prosecco'`)).rows[0];
  const ownerCtx0 = await browser.newContext(DEVICE); const op = await loginPage(ownerCtx0, 'pin', { venue: 'kebab-land', pin: owner.pin }); const ownerCookieKl = await cookieOf(ownerCtx0); await op.close();
  const r = await api('/api/admin/item', { action: 'update', id: sized.id, patch: { listed: true, variants: [{ label: { en: '6 oz', fa: null }, price: 12 }, { label: { en: '9 oz', fa: null }, price: null }] } }, ownerCookieKl);
  const after = (await db.query('select listed, variants from items where id=$1', [sized.id])).rows[0];
  check('f-sizes', r.status === 400 && /every size needs a price/i.test(r.json?.error || '') && JSON.stringify(after.variants) === JSON.stringify(sized.variants), `save "${sized.name}" shown with a second size without price → ${r.status} "${r.json?.error}"; row unchanged: ${JSON.stringify(after.variants) === JSON.stringify(sized.variants)}`); await ownerCtx0.close(); }
// price it in place, show it, see it on the public page; then hide it and clear the price again (API)
await page.click(`[data-item="${noPrice.id}"] [data-price]`); await page.keyboard.type('7.25'); await page.keyboard.press('Enter');
await waitDb('select price from items where id=$1', [noPrice.id], (r) => Number(r?.price) === 7.25);
await page.click(`[data-item="${noPrice.id}"] input[role=switch]`);
let w = await waitPublic('senso', (h) => h.includes(`data-id="${noPrice.id}"`));
check('f-public-listed', w.ok, `"${noPrice.name}" priced $7.25 in place and switched on → on the public page after ${w.ms} ms`);
await snap(page, 'priced-and-shown');
{ const r = await api('/api/admin/item', { action: 'update', id: noPrice.id, patch: { listed: false, price: null } }, staffCookie); w = await waitPublic('senso', (h) => !h.includes(`data-id="${noPrice.id}"`)); check('f-public-hidden', r.status === 200 && w.ok, `hidden and price cleared again → gone from the public page after ${w.ms} ms`); }
await page.fill('input[aria-label="Search items"]', '');

// (g) a hidden section disappears; a section whose last shown item is hidden disappears too
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id='senso' and name->>'en'='Extra'`)).rows[0];
await page.click(`#sec-${sec.id} header input[role=switch]`);
w = await waitPublic('senso', (h) => !h.includes(`data-id="${sec.id}"`));
check('g-section', w.ok && (await db.query('select listed from sections where id=$1', [sec.id])).rows[0].listed === false, `section "${sec.name}" switched off in the editor → gone from the public page after ${w.ms} ms`);
await page.evaluate((id) => document.getElementById(`sec-${id}`)?.scrollIntoView(), sec.id); await snap(page, 'section-hidden');
await page.click(`#sec-${sec.id} header input[role=switch]`);
w = await waitPublic('senso', (h) => h.includes(`data-id="${sec.id}"`));
check('g-section-back', w.ok, `section "${sec.name}" switched on again → back after ${w.ms} ms`);
const bev = (await db.query(`select s.id, s.name->>'en' as name, array_agg(i.id) as items from sections s join item_sections x on x.section_id=s.id join items i on i.id=x.item_id and i.listed where s.venue_id='senso' and s.name->>'en'='Beverage' group by s.id`)).rows[0];
for (const id of bev.items) await api('/api/admin/item', { action: 'update', id, patch: { listed: false } }, staffCookie);
w = await waitPublic('senso', (h) => !h.includes(`data-id="${bev.id}"`));
check('g-last-item', w.ok, `all ${bev.items.length} items of "${bev.name}" hidden → the section disappears from the public page after ${w.ms} ms`);
for (const id of bev.items) await api('/api/admin/item', { action: 'update', id, patch: { listed: true } }, staffCookie);
w = await waitPublic('senso', (h) => h.includes(`data-id="${bev.id}"`));
check('g-last-item-back', w.ok, `items shown again → "${bev.name}" back after ${w.ms} ms`);

// (h) notes: staff sees no fields and gets 403; owner edits them in the panel; admin clears them
const item = (await db.query(`select id from items where venue_id='senso' and name->>'en'='Turkish Coffee'`)).rows[0];
await page.fill('input[aria-label="Search items"]', 'Turkish Coffee');
await openItem(page, item.id); await page.click('[role=dialog] button:has-text("Advanced")');
const staffNotesField = await page.$('[role=dialog] input[aria-label="Allergens"]'); const staffText = await page.textContent('[role=dialog]');
await snap(page, 'staff-no-notes');
check('h-staff-ui', !staffNotesField && /set by the owner or an admin/.test(staffText || ''), `staff item panel (Advanced): notes inputs present = ${!!staffNotesField}; explanatory line shown = ${/set by the owner or an admin/.test(staffText || '')}`);
{ const r = await api('/api/admin/item', { action: 'notes', id: item.id, notes: { allergens: 'nuts' } }, staffCookie); check('h-staff-403', r.status === 403, `staff POST action=notes → ${r.status} "${r.json?.error}"`); }
{ const r = await fetch(`${base}/admin/senso?tab=style`, { headers: { cookie: staffCookie } }); const html = await r.text(); check('h-staff-style', /owner and admin only/.test(html) && !/Built in step 2/.test(html), `staff GET /admin/senso?tab=style → HTTP ${r.status}, refusal page shown: ${/owner and admin only/.test(html)} (the Style tab and its HTTP 403 come with step 2)`); }
const ownerCtx = await browser.newContext(DEVICE);
const opage = await loginPage(ownerCtx, 'pin', { venue: 'senso', pin: owner.pin }); await opage.waitForSelector('[data-item]');
await opage.fill('input[aria-label="Search items"]', 'Turkish Coffee');
await openItem(opage, item.id); await opage.click('[role=dialog] button:has-text("Advanced")');
await opage.fill('[role=dialog] input[aria-label="Allergens"]', 'nuts'); await opage.press('[role=dialog] input[aria-label="Allergens"]', 'Enter');
await waitDb('select notes from items where id=$1', [item.id], (r) => r?.notes?.allergens?.includes('nuts'));
await opage.click('[role=dialog] input[name=halal][value=yes]');
const wn = await waitDb('select notes from items where id=$1', [item.id], (r) => r?.notes?.halal === true);
await snap(opage, 'owner-notes-saved');
check('h-owner', wn.ok && wn.row.notes.allergens.includes('nuts'), `owner saved notes in the panel (each field on its own): ${JSON.stringify(wn.row?.notes)}`);
{ const adminCtx2 = await browser.newContext(DEVICE); const ap = await loginPage(adminCtx2, 'admin', { email, password }); const ac = await cookieOf(adminCtx2); const r = await api('/api/admin/item', { action: 'notes', id: item.id, notes: { allergens: '', halal: null } }, ac); const n2 = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes; check('h-admin', r.status === 200 && n2.allergens.length === 0 && n2.halal === null, `admin cleared the notes again: ${JSON.stringify(n2)}`); await ap.close(); await adminCtx2.close(); }

// venue details API: staff gets 403 (the Details tab comes with step 2)
{ const r = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { name: { en: 'Senso Café & Bites', fa: null } } }, staffCookie); check('venue-staff-403', r.status === 403, `staff POST /api/admin/venue → ${r.status} "${r.json?.error}"`); }

// revoke drill PINs; revoked staff PIN refused
{ const actx = await browser.newContext(DEVICE); const ap = await loginPage(actx, 'admin', { email, password }); const ac = await cookieOf(actx);
  for (const p of [staff, owner]) await post('/api/admin/pin', { _action: 'revoke', id: p.id, _back: '/admin/team' }, ac);
  const r = await post('/api/admin/login', { mode: 'pin', venue: 'senso', pin: staff.pin });
  check('b-revoked', !r.setCookie && /wrong PIN/.test(errorOf(r.location) || ''), `revoked staff PIN → ${r.status}, error="${errorOf(r.location)}", cookie set: ${!!r.setCookie}`);
  await ap.close(); await actx.close(); }
await db.query(`delete from login_failures where key like 'senso:%'`);
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'admin-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, transcript }, null, 2));
await fs.writeFile(path.join(out, 'admin-drill.txt'), [`Admin drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n') + '\n');
console.log(`ADMIN DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
