#!/usr/bin/env node
// Admin acceptance drill on an iPhone viewport: sign-ins, cookie attributes, PIN creation and revocation (Team), the
// listing rule (UI switch, JSON API, database constraint, sizes), section shown/hidden and the public page, notes
// permissions (staff 403, owner and admin edit), venue details API for staff (403) and the owner (Details tab, Undo),
// the Style route (403 for staff; the owner changes a colour in the Style tab, it reaches the public page, Undo),
// "+ Add venue" on the default template (tap count, the new page answers), revoked PIN.
// Editing tasks, Undo and the change record are in scripts/editor-drill.mjs. Screenshots and a timestamped transcript
// go to --out. Needs the production server at --base and DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD (+ DRILL_ADMIN_PIN).
import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { chromium, devices } from 'playwright';
import { connectDb, loadEnv } from './load-env.mjs';

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
const measures = []; const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const escHtml = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = await connectDb('admin-drill', (t) => log('db', t));
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
// Pre-go-live audit (the PM's fix batch, 2026-11-03): a request with headers of the drill's choosing, and a small valid PNG built here.
async function raw(p, { method = 'POST', headers = {}, body, cookie } = {}) { const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...headers }, body }); const text = await r.text().catch(() => ''); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ } return { status: r.status, headers: r.headers, text, json, location: r.headers.get('location') }; }
const crc = (b) => { let c = 0xffffffff; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const pngOf = (w, h) => { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.alloc((w * 4 + 1) * h))), chunk('IEND', Buffer.alloc(0))]); };
const upload = async (venue, kind, body, type, cookie) => { const r = await fetch(`${base}/api/admin/upload?venue=${venue}&kind=${kind}`, { method: 'POST', headers: { 'content-type': type, cookie }, body }); return { status: r.status, json: await r.json().catch(() => null) }; };
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
// pre-go-live audit (2026-11-02, S1-01): an owner manages the PINs of their own venues only (before, a Senso owner could mint an owner PIN for Kebab Land)
{ const so = await makePin('Drill owner senso', 'owner', ['senso']);
  const l = await post('/api/admin/login', { mode: 'pin', venue: 'senso', pin: so.pin }); const oc = (l.setCookie || '').split(';')[0];
  const mint = await post('/api/admin/pin', { _action: 'create', name: 'Drill escalation', role: 'owner', venue_ids: 'kebab-land', _back: '/admin/team' }, oc);
  const made = (await db.query(`select count(*)::int as n from pins where name = 'Drill escalation'`)).rows[0].n;
  const rev = await post('/api/admin/pin', { _action: 'revoke', id: owner.id, _back: '/admin/team' }, oc);
  const still = (await db.query('select revoked_at from pins where id = $1', [owner.id])).rows[0]?.revoked_at === null;
  check('owner-pin-scope', oc.startsWith('roses_session=') && mint.status === 403 && made === 0 && rev.status === 403 && still, `the Senso owner creates an owner PIN for Kebab Land → ${mint.status}, PINs made: ${made}; revokes a PIN that also covers Kebab Land → ${rev.status}, still active: ${still}`);
  await post('/api/admin/pin', { _action: 'revoke', id: so.id, _back: '/admin/team' }, adminCookie); }
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
await openItem(page, item.id); // since the editor rebuild (2026-10-13) no More or Advanced: staff get one line in place of "Allergens & diet"
const staffNotesField = await page.$('[role=dialog] [data-allergen], [role=dialog] [data-good-to-know], [role=dialog] [data-group="allergens"]'); const staffText = await page.textContent('[role=dialog]'); // the chips (2026-10-13) are not there for staff
await snap(page, 'staff-no-notes');
check('h-staff-ui', !staffNotesField && /set by the owner or an admin/.test(staffText || ''), `staff item panel: notes group or inputs present = ${!!staffNotesField}; explanatory line shown = ${/set by the owner or an admin/.test(staffText || '')}`);
{ const r = await api('/api/admin/item', { action: 'notes', id: item.id, notes: { allergens: 'nuts' } }, staffCookie); check('h-staff-403', r.status === 403, `staff POST action=notes → ${r.status} "${r.json?.error}"`); }
// Confirm of researched allergen and dietary notes (Kian, 2026-10-12): owner and admin only, like the notes
{ const r = await api('/api/admin/item', { action: 'confirm', id: item.id }, staffCookie); check('h-staff-confirm-403', r.status === 403, `staff POST action=confirm → ${r.status} "${r.json?.error}"`); }
{ const r = await fetch(`${base}/admin/senso?tab=style`, { headers: { cookie: staffCookie } }); const html = await r.text(); check('h-staff-style', /owner and admin only/.test(html) && !/data-style-tab/.test(html), `staff GET /admin/senso?tab=style → HTTP ${r.status}, refusal page shown: ${/owner and admin only/.test(html)}, no Style tab rendered`); }
// the preview bar's season switch (2026-10-09) is on every tab, staff included: the scene route answers staff for their venue, 403 elsewhere
{ const r = await fetch(`${base}/api/admin/welcome-scene?venue=senso&season=winter`, { headers: { cookie: staffCookie } }); const j = await r.json().catch(() => null);
  const r2 = await fetch(`${base}/api/admin/welcome-scene?venue=kebab-land&season=winter`, { headers: { cookie: staffCookie } });
  check('h-staff-scene', r.status === 200 && j?.ok && j.season === 'winter' && /scene-winter/.test(j.html || '') && r2.status === 403, `staff GET /api/admin/welcome-scene?venue=senso&season=winter → ${r.status} (${j?.season} scene, ${(j?.html || '').length} B of markup, engine script ${j?.script ? 'included' : 'none'}); on kebab-land (not their venue) → ${r2.status}`); }
// Style route (step 2): staff get 403 on both methods
{ const r = await fetch(`${base}/api/admin/style?venue=senso`, { headers: { cookie: staffCookie } }); const j = await r.json().catch(() => null);
  const r2 = await api('/api/admin/style', { action: 'update', venue: 'senso', patch: { accent: '#112233' } }, staffCookie);
  check('style-staff-403', r.status === 403 && r2.status === 403, `staff GET /api/admin/style?venue=senso → ${r.status} "${j?.error}"; staff POST update → ${r2.status} "${r2.json?.error}"`); }
// Section layout (Kian, 2026-10-08): staff may rename or hide a section but not change its layout (owner and admin, Style tab)
{ const r = await api('/api/admin/section', { action: 'update', id: sec.id, patch: { layout: 'grid' } }, staffCookie);
  const r2 = await api('/api/admin/section', { action: 'update', id: sec.id, patch: { name: { en: sec.name, fa: null }, layout: 'grid' } }, staffCookie);
  const still = (await db.query('select layout from sections where id=$1', [sec.id])).rows[0].layout;
  check('layout-staff-403', r.status === 403 && r2.status === 403 && still === 'list', `staff POST section layout=grid → ${r.status} "${r.json?.error}"; with a rename in the same patch → ${r2.status}; "${sec.name}" still ${still}`); }
{ const r = await fetch(`${base}/admin/new`, { headers: { cookie: staffCookie } }); const html = await r.text(); check('staff-add-venue', /admin only/.test(html) && !/Create venue/.test(html), `staff GET /admin/new → refusal shown: ${/admin only/.test(html)}, no form`); }
const ownerCtx = await browser.newContext(DEVICE);
const opage = await loginPage(ownerCtx, 'pin', { venue: 'senso', pin: owner.pin }); await opage.waitForSelector('[data-item]');
await opage.fill('input[aria-label="Search items"]', 'Turkish Coffee');
await openItem(opage, item.id);
// the owner's chips (Kian via the PM, 2026-10-13: one tap each; in the "Allergens & diet" group since the editor rebuild of the same day)
{ const g = opage.locator('[role=dialog] [data-group="allergens"][aria-expanded="false"]'); if (await g.count()) await g.click(); }
{ const all = opage.locator('[role=dialog] [data-all-allergens]'); if (await all.count()) await all.click(); } // while a research suggestion waits, the full list is one tap away (the item editor's clean-up, 2026-11-04)
const nutChip = opage.locator('[role=dialog] [data-allergen="tree nuts"]');
if ((await nutChip.getAttribute('aria-pressed')) === 'true') { await nutChip.click(); await waitDb('select notes from items where id=$1', [item.id], (r) => !r?.notes?.allergens?.includes('tree nuts')); } // the drill's own precondition
await nutChip.click();
await waitDb('select notes from items where id=$1', [item.id], (r) => r?.notes?.allergens?.includes('tree nuts'));
await opage.click('[role=dialog] [data-halal="yes"]');
const wn = await waitDb('select notes from items where id=$1', [item.id], (r) => r?.notes?.halal === true);
await snap(opage, 'owner-notes-saved');
check('h-owner', wn.ok && wn.row.notes.allergens.includes('tree nuts'), `owner saved notes in the panel with the chips (Tree nuts, then Halal; each tap on its own): ${JSON.stringify(wn.row?.notes)}`);
// pre-go-live audit (2026-11-02, S1-02): Undo takes back one's own change only (before, staff could undo the owner's notes record and clear them)
{ const rev = (await db.query(`select id from revisions where table_name = 'items' and row_id = $1 and by->>'id' = $2 order by id desc limit 1`, [item.id, owner.id])).rows[0]?.id;
  const before = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes;
  const u = await api('/api/admin/undo', { venue: 'senso', revisions: [Number(rev)] }, staffCookie);
  const after = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes;
  check('undo-own-only', !!rev && u.status === 403 && JSON.stringify(after) === JSON.stringify(before), `staff Undo of the owner's notes record ${rev} → ${u.status} "${u.json?.error}"; the notes unchanged: ${JSON.stringify(after) === JSON.stringify(before)}`); }
{ const adminCtx2 = await browser.newContext(DEVICE); const ap = await loginPage(adminCtx2, 'admin', { email, password }); const ac = await cookieOf(adminCtx2); const r = await api('/api/admin/item', { action: 'notes', id: item.id, notes: { allergens: '', halal: null } }, ac); const n2 = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes; check('h-admin', r.status === 200 && n2.allergens.length === 0 && n2.halal === null, `admin cleared the notes again: ${JSON.stringify(n2)}`); await ap.close(); await adminCtx2.close(); }

// venue details API: staff gets 403; the owner reads and edits (Details tab), Undo puts it back
{ const r = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { name: { en: 'Senso Café & Bites', fa: null } } }, staffCookie); check('venue-staff-403', r.status === 403, `staff POST /api/admin/venue → ${r.status} "${r.json?.error}"`); }
const ownerCookie = await cookieOf(ownerCtx);
{ const g = await fetch(`${base}/api/admin/venue?id=senso`, { headers: { cookie: ownerCookie } }); const gj = await g.json().catch(() => null);
  check('details-owner-get', g.status === 200 && gj?.venue?.id === 'senso' && Array.isArray(gj.venue.locations), `owner GET /api/admin/venue?id=senso → ${g.status}; ${gj?.venue?.locations?.length} location(s), logo ${gj?.venue?.logo?.url}, template ${gj?.venue?.template}`);
  const before = gj.venue.tagline.en;
  await opage.goto(`${base}/admin/senso?tab=details`); await opage.waitForSelector('[data-details-tab]');
  let taps = 1; // the Details tab
  await opage.click('[data-details-tab] input[aria-label="Tagline"]'); taps++;
  await opage.fill('[data-details-tab] input[aria-label="Tagline"]', 'Drill tagline'); await opage.press('[data-details-tab] input[aria-label="Tagline"]', 'Enter');
  const w = await waitPublic('senso', (h) => h.includes('content="Drill tagline"'));
  await snap(opage, 'details-tagline');
  check('details-owner-save', w.ok, `owner changed the tagline in the Details tab (${taps} taps + typing + Enter) → the public page's description reads "Drill tagline" after ${w.ms} ms`);
  measure(`Details: change the tagline: ${taps} taps (Details tab, field) + typing + Enter; on the public page in ${w.ms} ms`);
  await opage.click('[role=status] button:has-text("Undo")'); await opage.waitForSelector('[role=status]:has-text("Undone")');
  const back = await waitPublic('senso', (h) => h.includes(`content="${escHtml(before)}"`));
  const row = (await db.query(`select tagline->>'en' as t from venues where id='senso'`)).rows[0].t;
  check('details-undo', back.ok && row === before, `Undo → tagline "${row}" again, back on the public page after ${back.ms} ms`); }
// Style tab (rebuilt 2026-10-08, colours by page region): the owner loads the template's tokens and layout options, opens the
// Footer group, picks a venue colour for the phone link, the colour reaches the public page, Undo puts it back; the welcome screen's switch too (in its Welcome group)
{ const r = await fetch(`${base}/api/admin/style?venue=senso`, { headers: { cookie: ownerCookie } }); const j = await r.json().catch(() => null);
  const layout = (j?.layout || []).map((o) => o.key); const tokens = (j?.tokens || []).map((t) => t.key);
  check('style-owner-options', r.status === 200 && j?.template?.id === 'senso' && tokens.includes('footer.phone') && tokens.includes('rows.price') && layout.includes('welcome') && layout.includes('photos') && (j?.palette || []).length > 0, `owner GET /api/admin/style?venue=senso → ${r.status}; template ${j?.template?.id}, ${j?.groups?.length} groups, ${tokens.length} colour tokens, layout options ${layout.join(', ')}, ${j?.palette?.length} venue colours as swatches`);
  await opage.goto(`${base}/admin/senso?tab=style`); await opage.waitForSelector('[data-style-group="footer"]');
  let taps = 0; const tap = async (sel) => { taps++; await opage.click(sel); };
  await tap('[data-style-group="footer"] > button'); await opage.waitForSelector('[data-style-token="footer.phone"] > button');
  await tap('[data-style-token="footer.phone"] > button'); await opage.waitForSelector('[data-style-token="footer.phone"] input[type=color]');
  const current = ((await opage.textContent('[data-style-token="footer.phone"] [data-style-value]')) || '').trim().toLowerCase();
  // the first venue colour that is not the current one and that the readability guard accepts on the footer background (WCAG ≥ 4.5:1;
  // Senso's gold is refused there at 2.7:1, which the Style drill covers): the same contrast maths as src/venues/tokens.ts
  const footerBg = ((await publicHtml('senso')).match(/--c-footer-bg:(#[0-9a-f]{6})/) || [])[1] || '#ffffff';
  const lin = (x) => { const v = x / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (h) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16));
  const contrast = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
  const swatches = opage.locator('[data-style-token="footer.phone"] button[aria-label^="Phone link: "]');
  let pick = null; const skipped = []; for (let i = 0; i < await swatches.count(); i++) { const lab = await swatches.nth(i).getAttribute('aria-label'); const c = (lab.match(/#[0-9a-f]{6}/i) || [])[0]?.toLowerCase(); if (!c || c === current) continue; if (contrast(c, footerBg) < 4.5) { skipped.push(`${c} (${(Math.round(contrast(c, footerBg) * 10) / 10)}:1)`); continue; } pick = { i, c, lab }; break; }
  log('style', `footer background ${footerBg}; venue colours the guard would refuse there, skipped: ${skipped.join(', ') || 'none'}; picking ${pick?.c}`);
  const t0 = Date.now(); await tap(`[data-style-token="footer.phone"] button[aria-label="${pick.lab}"]`);
  const w = await waitPublic('senso', (h) => h.includes(`--c-footer-phone:${pick.c}`));
  const chosen = (await db.query(`select style->'colors' as c from venues where id='senso'`)).rows[0].c;
  await snap(opage, 'style-footer-phone');
  check('style-owner-save', w.ok && chosen?.['footer.phone'] === pick.c, `owner tapped the venue colour "${pick.lab}" for the phone link (${taps} taps: Footer group, Phone link, swatch) → venues.style.colors ${JSON.stringify(chosen)}; the public page's CSS carries --c-footer-phone:${pick.c} after ${w.ms} ms (${Date.now() - t0} ms after the tap)`);
  measure(`Style: change the footer phone-link colour: ${taps} taps (group, token, swatch); on the public page in ${w.ms} ms`);
  await opage.click('[role=status] button:has-text("Undo")'); await opage.waitForSelector('[role=status]:has-text("Undone")');
  const back = await waitPublic('senso', (h) => h.includes(`--c-footer-phone:${current}`));
  const after = (await db.query(`select coalesce(style->'colors', '{}'::jsonb) as c from venues where id='senso'`)).rows[0].c;
  check('style-undo', back.ok && !after['footer.phone'], `Undo → --c-footer-phone:${current} back on the public page after ${back.ms} ms; venues.style.colors now ${JSON.stringify(after)}`);
  // the switches save too: the welcome screen's kill switch (at the top of the Welcome group) off removes the overlay and its head decision from the page; Undo brings it back
  await opage.click('[data-style-group="welcome"] > button'); await opage.waitForSelector('[data-style-option="welcome"] input[role=switch]');
  const hasWelcome = (h) => /id="welcome"/.test(h) && /dataset\.welcome='show'/.test(h);
  await opage.click('[data-style-option="welcome"] input[role=switch]');
  const off = await waitPublic('senso', (h) => !hasWelcome(h));
  await opage.click('[role=status] button:has-text("Undo")'); await opage.waitForSelector('[role=status]:has-text("Undone")');
  const on = await waitPublic('senso', hasWelcome);
  check('style-welcome-switch', off.ok && on.ok, `Welcome screen switch off → no overlay and no head decision in the public HTML after ${off.ms} ms; Undo → back after ${on.ms} ms`); }

// ---- Pre-go-live audit, the PM's fix batch of 2026-11-03 (A1): one check per fix the API or a page can show ----
const ac = ((await post('/api/admin/login', { mode: 'admin', email, password })).setCookie || '').split(';')[0];
const target = (await db.query(`select id, name, description, price, variants, add_ons, components, photo, listed, serves, seasons from items where venue_id='senso' and not listed and price is null and jsonb_array_length(variants)=0 order by name->>'en' offset 1 limit 1`)).rows[0];
const restoreTarget = async () => { await db.query('update items set name=$2, description=$3, price=$4, variants=$5, add_ons=$6, components=$7, photo=$8, listed=$9, serves=$10, seasons=$11 where id=$1', [target.id, target.name, target.description, target.price, JSON.stringify(target.variants), JSON.stringify(target.add_ons), JSON.stringify(target.components), target.photo, target.listed, target.serves, target.seasons]); };
const getJson = (body) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
// S1-08: a POST from another site is refused (Origin or Sec-Fetch-Site); a JSON route refuses a form body
{ const g = { action: 'get', id: target.id };
  const evil = await raw('/api/admin/item', { ...getJson(g), headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, cookie: staffCookie });
  const sameSite = await raw('/api/admin/item', { ...getJson(g), headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-site' }, cookie: staffCookie });
  const own = await raw('/api/admin/item', { ...getJson(g), headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin' }, cookie: staffCookie });
  const formEvil = await raw('/api/admin/pin', { headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' }, body: form({ _action: 'create', name: 'Drill forged', role: 'staff', venue_ids: 'senso', _back: '/admin/team' }), cookie: ac });
  const forged = (await db.query(`select count(*)::int as n from pins where name='Drill forged'`)).rows[0].n;
  check('csrf-refused', evil.status === 403 && sameSite.status === 403 && own.status === 200 && formEvil.status === 403 && forged === 0, `POST /api/admin/item from Origin https://evil.example → ${evil.status}; with Sec-Fetch-Site same-site → ${sameSite.status}; from the app's own origin → ${own.status}; a forged Team form (Origin https://evil.example) → ${formEvil.status}, PINs made: ${forged}`);
  const f = await raw('/api/admin/item', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ action: 'delete', id: target.id }), cookie: staffCookie });
  const still = (await db.query('select 1 from items where id=$1', [target.id])).rowCount === 1;
  check('json-only', f.status === 415 && still, `a form-encoded "action=delete" to the JSON item route → ${f.status} "${f.json?.error}"; the item still there: ${still}`); }
// S1-08 and S2-10: headers on the admin and the public page; the page's own CSP lists every inline script's hash and nothing inline otherwise
{ const a = await fetch(`${base}/admin`, { redirect: 'manual' }); const acsp = a.headers.get('content-security-policy') || '';
  const pg = await fetch(`${base}/senso`); const html = await pg.text(); const pcsp = pg.headers.get('content-security-policy') || '';
  const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const hashes = scripts.map((x) => `'sha256-${createHash('sha256').update(x, 'utf8').digest('base64')}'`);
  const scriptSrc = (meta.match(/script-src ([^;]+)/) || [])[1] || '';
  const ok = /frame-ancestors 'none'/.test(acsp) && a.headers.get('x-frame-options') === 'DENY' && a.headers.get('x-content-type-options') === 'nosniff' && !!a.headers.get('referrer-policy')
    && /frame-ancestors 'self'/.test(pcsp) && hashes.length >= 4 && hashes.every((h) => scriptSrc.includes(h)) && !/unsafe-inline|unsafe-eval/.test(scriptSrc) && /img-src 'self' data: https:\/\/mealsymedia/.test(meta);
  check('security-headers', ok, `/admin: CSP "${acsp}", X-Frame-Options ${a.headers.get('x-frame-options')}, nosniff ${a.headers.get('x-content-type-options')}, Referrer-Policy ${a.headers.get('referrer-policy')}; /senso: header CSP "${pcsp}", its <meta> CSP allows ${scriptSrc.split(' ').length} script hashes, the page's ${hashes.length} inline scripts all among them: ${hashes.every((h) => scriptSrc.includes(h))}; 'unsafe-inline' or eval in script-src: ${/unsafe-inline|unsafe-eval/.test(scriptSrc)}`);
  const fonts = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]); let css = ''; for (const f of fonts) css += await (await fetch(base + f)).text();
  check('fonts-removed', fonts.length > 0 && !/tinos|montserrat/i.test(css + html), `the public page's ${fonts.length} stylesheet(s) and HTML name Tinos or Montserrat: ${/tinos|montserrat/i.test(css + html)} (H-17: two fonts loaded on every page, never used)`);
  const ctx = await browser.newContext(DEVICE); await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample || ''}`.trim())); });
  const seen = {};
  for (const v of ['senso', 'kebab-land']) { const p = await ctx.newPage(); await p.goto(`${base}/${v}`); await p.click('#welcome button[data-lang="en"]').catch(() => undefined); await p.waitForTimeout(1000);
    await p.click('main li.item'); await p.waitForSelector('#sheet[open]', { timeout: 5000 }).catch(() => undefined); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    await p.click('#tabs-list').catch(() => undefined); await p.waitForTimeout(600); seen[v] = await p.evaluate(() => window.__csp); await p.close(); }
  await ctx.close();
  check('csp-no-violation', Object.values(seen).every((x) => x.length === 0), `the public pages under their CSP, the welcome tap, an item popup and the section list: violations ${JSON.stringify(seen)}`); }
// S1-11: "+ Add venue" is for admins
{ const r = await api('/api/admin/venue', { action: 'create', name: { en: 'Drill owner venue', fa: null } }, ownerCookie);
  const html = await (await fetch(`${base}/admin/new`, { headers: { cookie: ownerCookie } })).text();
  const made = (await db.query(`select count(*)::int as n from venues where name->>'en' = 'Drill owner venue'`)).rows[0].n;
  check('owner-add-venue-403', r.status === 403 && made === 0 && /admin only/.test(html) && !/Create venue/.test(html), `owner POST "+ Add venue" → ${r.status} "${r.json?.error}", venues made: ${made}; owner GET /admin/new → refusal: ${/admin only/.test(html)}, no form`); }
// S1-21: a PIN for a venue that does not exist is refused; an owner's PIN records the owner
{ const bad = await post('/api/admin/pin', { _action: 'create', name: 'Drill nowhere', role: 'staff', venue_ids: 'nowhere', _back: '/admin/team' }, ac);
  const none = (await db.query(`select count(*)::int as n from pins where name='Drill nowhere'`)).rows[0].n;
  const made = await post('/api/admin/pin', { _action: 'create', name: 'Drill by owner', role: 'staff', venue_ids: 'senso', _back: '/admin/team' }, ownerCookie);
  const row = (await db.query(`select id from pins where name='Drill by owner' order by created_at desc limit 1`)).rows[0];
  const who = row ? (await db.query(`select by->>'name' as n from revisions where table_name='pins' and row_id=$1 and action='create'`, [row.id])).rows[0]?.n : null;
  const team = await (await fetch(`${base}/admin/team`, { headers: { cookie: ownerCookie } })).text();
  check('pin-create-checks', bad.status === 303 && errorOf(bad.location) === 'venue-unknown' && none === 0 && /class="pin">\d{6}</.test(made.text) && who === 'Drill owner' && team.includes('by Drill owner'), `a PIN for venue "nowhere" → ${bad.status} error=${errorOf(bad.location)}, PINs made: ${none}; the owner's new staff PIN → recorded as made by "${who}", Team says "by Drill owner": ${team.includes('by Drill owner')}`);
  if (row) await post('/api/admin/pin', { _action: 'revoke', id: row.id, _back: '/admin/team' }, ac); }
// S2-01: a combo part keeps only what it is; another venue's item is refused
{ const kl = (await db.query(`select id from items where venue_id='kebab-land' limit 1`)).rows[0].id;
  const other = await api('/api/admin/item', { action: 'update', id: target.id, patch: { components: [{ item_id: kl, label: { en: 'Part', fa: null }, qty: 1 }] } }, staffCookie);
  const deep = {}; let d = deep; for (let i = 0; i < 2000; i++) { d.x = {}; d = d.x; }
  const extra = await api('/api/admin/item', { action: 'update', id: target.id, patch: { components: [{ item_id: null, label: { en: 'Drill part', fa: null }, qty: 2, evil: deep, price: 9 }] } }, staffCookie);
  const parts = (await db.query('select components from items where id=$1', [target.id])).rows[0].components;
  const editor = await fetch(`${base}/admin/senso`, { headers: { cookie: staffCookie } });
  check('components-strict', other.status === 400 && extra.status === 200 && parts.length === 1 && JSON.stringify(Object.keys(parts[0]).sort()) === '["item_id","label","qty"]' && editor.status === 200, `a combo part naming a Kebab Land item → ${other.status} "${other.json?.error}"; one with a 2000-deep extra value and a price → ${extra.status}, stored keys ${JSON.stringify(Object.keys(parts[0] || {}).sort())}; the venue's editor still answers ${editor.status}`); }
// S2-04: new photo and logo addresses are uploads or the menus' own photo hosts
{ const tries = {}; for (const u of ['//evil.example/x.jpg', '/\\evil.example/x.jpg', 'https://evil.example/x.jpg', 'javascript:alert(1)']) tries[u] = (await api('/api/admin/item', { action: 'update', id: target.id, patch: { photo: { url: u } } }, staffCookie)).status;
  const known = await api('/api/admin/item', { action: 'update', id: target.id, patch: { photo: { url: 'https://mealsymedia.s3.amazonaws.com/drill.jpg' } } }, staffCookie);
  const logo = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { logo: { url: 'https://evil.example/logo.png', width: 100, height: 50 } } }, ownerCookie);
  check('photo-hosts', Object.values(tries).every((x) => x === 400) && known.status === 200 && logo.status === 400, `photo addresses ${JSON.stringify(tries)}; a linked photo on mealsymedia.s3.amazonaws.com → ${known.status}; a logo at https://evil.example → ${logo.status}`); }
// S2-06: a wrong type is refused with the reason, nothing changed
{ const place0 = (await db.query('select section_id from item_sections where item_id=$1', [target.id])).rows.map((r) => r.section_id).sort().join();
  const v0 = (await db.query(`select locations, brand->'logo' as logo from venues where id='senso'`)).rows[0];
  const rs = { section_ids: await api('/api/admin/item', { action: 'update', id: target.id, patch: { section_ids: 'x' } }, staffCookie), listed: await api('/api/admin/item', { action: 'update', id: target.id, patch: { listed: 'yes' } }, staffCookie), variants: await api('/api/admin/item', { action: 'update', id: target.id, patch: { variants: 'x' } }, staffCookie), locations: await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { locations: {} } }, ownerCookie), logo: await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { logo: 'x' } }, ownerCookie) };
  const place1 = (await db.query('select section_id from item_sections where item_id=$1', [target.id])).rows.map((r) => r.section_id).sort().join();
  const v1 = (await db.query(`select locations, brand->'logo' as logo from venues where id='senso'`)).rows[0];
  check('strict-readers', Object.values(rs).every((r) => r.status === 400) && place0 === place1 && JSON.stringify(v0) === JSON.stringify(v1), `${Object.entries(rs).map(([k, r]) => `${k} → ${r.status} "${r.json?.error}"`).join('; ')}; the item's sections, the locations and the logo unchanged: ${place0 === place1 && JSON.stringify(v0) === JSON.stringify(v1)}`); }
// S2-02: the limits (names 100, descriptions 500, labels 60, section names 60, tagline 160, location fields 200; 20 sizes, 10 groups of 20, 20 parts)
{ const L = (n) => 'x'.repeat(n); const up = (patch) => api('/api/admin/item', { action: 'update', id: target.id, patch }, staffCookie);
  const loc0 = (await db.query(`select locations from venues where id='senso'`)).rows[0].locations;
  const sec0 = (await db.query(`select id from sections where venue_id='senso' and not seasonal order by position limit 1`)).rows[0].id;
  const cases = {
    'name 101': await up({ name: { en: L(101), fa: null } }), 'description 501': await up({ description: { en: L(501), fa: null } }),
    'size name 61': await up({ variants: [{ label: { en: L(61), fa: null }, price: 5 }] }), '21 sizes': await up({ variants: Array.from({ length: 21 }, (_, i) => ({ label: { en: `S${i}`, fa: null }, price: 1 })) }),
    '11 choice groups': await up({ add_ons: Array.from({ length: 11 }, (_, i) => ({ group: { en: `G${i}`, fa: null }, label: { en: 'x', fa: null }, price: 0 })) }), '21 choices in a group': await up({ add_ons: Array.from({ length: 21 }, (_, i) => ({ group: { en: 'G', fa: null }, label: { en: `c${i}`, fa: null }, price: 0 })) }),
    '21 combo parts': await up({ components: Array.from({ length: 21 }, (_, i) => ({ item_id: null, label: { en: `p${i}`, fa: null }, qty: 1 })) }),
    'section name 61': await api('/api/admin/section', { action: 'update', id: sec0, patch: { name: { en: L(61), fa: null } } }, staffCookie),
    'tagline 161': await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { tagline: { en: L(161) } } }, ownerCookie),
    'address 201': await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { locations: loc0.map((l, i) => (i === 0 ? { ...l, address: L(201) } : l)) } }, ownerCookie),
  };
  const fits = await up({ name: { en: L(100), fa: null } });
  check('length-limits', Object.values(cases).every((r) => r.status === 400) && fits.status === 200, `${Object.entries(cases).map(([k, r]) => `${k} → ${r.status}`).join('; ')}; a 100-character name → ${fits.status}`); }
// S2-03 and S2-14: direction marks and control characters dropped; an invisible-only name is empty; a row's sizes isolated on the public page
{ const r = await api('/api/admin/item', { action: 'update', id: target.id, patch: { name: { en: 'Drill‮ clean\u0007 name⁦', fa: null } } }, staffCookie);
  const stored = (await db.query(`select name->>'en' as n from items where id=$1`, [target.id])).rows[0].n;
  const z = await api('/api/admin/item', { action: 'update', id: target.id, patch: { name: { en: '​‌‏', fa: null } } }, staffCookie);
  const sized = (await db.query(`select id from items where venue_id='senso' and listed and price is null and jsonb_array_length(variants) > 1 order by name->>'en' limit 1`)).rows[0];
  const html = await publicHtml('senso'); const at = sized ? html.indexOf(`data-id="${sized.id}"`) : -1; const rowHtml = at >= 0 ? html.slice(at, html.indexOf('</li>', at)) : '';
  check('text-cleaned', r.status === 200 && stored === 'Drill clean name' && z.status === 400 && /<bdi><span/.test(rowHtml) && /<bdi dir="ltr" class="tabular-nums">\$/.test(rowHtml), `a name with U+202E, U+0007 and U+2066 → stored "${stored}"; a name of only zero-width characters → ${z.status} "${z.json?.error}"; on the public page a row with sizes isolates each size's name and amount: ${/<bdi><span/.test(rowHtml) && /<bdi dir="ltr" class="tabular-nums">\$/.test(rowHtml)}`); }
// S2-07 and H-14: one reading of a price on both sides
{ const res = {}; for (const [k, v] of [['blank', ' '], ['dollar', '$'], ['hex', '0x10'], ['exponent', '1e3'], ['thousandth', '0.001'], ['comma', '1,50'], ['persian', '۱۲.۵۰']]) { const x = await api('/api/admin/item', { action: 'update', id: target.id, patch: { price: v } }, staffCookie); res[k] = { status: x.status, price: x.status === 200 ? (await db.query('select price from items where id=$1', [target.id])).rows[0].price : undefined }; }
  check('price-pattern', res.blank.status === 200 && res.blank.price === null && ['dollar', 'hex', 'exponent', 'thousandth'].every((k) => res[k].status === 400) && Number(res.comma.price) === 1.5 && Number(res.persian.price) === 12.5, `prices sent: ${Object.entries(res).map(([k, x]) => `${k} → ${x.status}${x.price !== undefined ? ` (${x.price})` : ''}`).join('; ')}`); }
await restoreTarget();
// S2-15: a phone number has 7 to 15 digits; Persian digits are read as Western
{ const loc0 = (await db.query(`select locations from venues where id='senso'`)).rows[0].locations;
  const bad = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { locations: loc0.map((l, i) => (i === 0 ? { ...l, phone: '------' } : l)) } }, ownerCookie);
  const fa = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { locations: loc0.map((l, i) => (i === 0 ? { ...l, phone: '۹۰۵ ۵۵۵ ۰۱۰۰' } : l)) } }, ownerCookie);
  const phone = (await db.query(`select locations->0->>'phone' as p from venues where id='senso'`)).rows[0].p;
  await db.query(`update venues set locations = $1 where id = 'senso'`, [JSON.stringify(loc0)]); await api('/api/admin/publish', { venue: 'senso' }, ownerCookie);
  check('phone-digits', bad.status === 400 && fa.status === 200 && phone === '905 555 0100', `a phone "------" → ${bad.status} "${bad.json?.error}"; one typed in Persian digits → ${fa.status}, stored "${phone}"`); }
// S2-21: a PIN typed with Persian digits signs in
{ const fa = staff.pin.replace(/\d/g, (x) => String.fromCharCode(0x06f0 + Number(x)));
  const r = await post('/api/admin/login', { mode: 'pin', venue: 'senso', pin: fa });
  check('pin-persian-digits', r.status === 303 && r.location === '/admin/senso' && !!r.setCookie, `the staff PIN typed in Persian digits → ${r.status} to ${r.location}, cookie set: ${!!r.setCookie}`); }
// S2-18: the sign-in page shows its own words for a code, never the address's text
{ const evil = await (await fetch(`${base}/admin/senso?error=${encodeURIComponent('Your PIN expired. Call 555-0100 now')}`)).text();
  const known = await (await fetch(`${base}/admin/senso?error=wrong-pin&left=3`)).text();
  check('signin-messages', !evil.includes('Call 555-0100') && evil.includes('Something went wrong. Try again.') && known.includes('Wrong PIN (3 tries left).'), `?error=<text of anyone's choosing> shows it: ${evil.includes('Call 555-0100')} (the page's own line instead: ${evil.includes('Something went wrong. Try again.')}); ?error=wrong-pin&left=3 → "Wrong PIN (3 tries left).": ${known.includes('Wrong PIN (3 tries left).')}`); }
// H-05: another cookie with a stray "%" does not break the admin API
{ const r = await raw('/api/admin/item', { ...getJson({ action: 'get', id: target.id }), headers: { 'content-type': 'application/json', cookie: `other=%E0%A4%A; ${staffCookie}` } });
  check('stray-cookie', r.status === 200 && r.json?.item?.id === target.id, `a request carrying another cookie "other=%E0%A4%A" beside the session → ${r.status}`); }
// H-06: a server fault answers 500 with one plain line (the suite's test seam simulates a database fault)
{ const r = await raw('/api/admin/item', { ...getJson({ action: 'get', id: target.id }), headers: { 'content-type': 'application/json', 'x-roses-test': 'fault' }, cookie: staffCookie });
  check('server-fault-500', r.status === 500 && r.json?.error === 'Something went wrong on the server. Try again.' && !/relation|does not exist/.test(r.text), `a database fault → ${r.status} "${r.json?.error}"; the database's own text in the answer: ${/relation|does not exist/.test(r.text)}`); }
// H-13: a save whose customers' page did not regenerate says so; the publish route regenerates it
{ const r = await raw('/api/admin/item', { ...getJson({ action: 'update', id: target.id, patch: { serves: '2' } }), headers: { 'content-type': 'application/json', 'x-roses-test': 'unpublished' }, cookie: staffCookie });
  const p = await api('/api/admin/publish', { venue: 'senso' }, staffCookie);
  check('publish-reported', r.status === 200 && r.json?.published === false && p.status === 200 && p.json?.published === true, `a save whose page regeneration failed → ${r.status} with published: ${r.json?.published}; POST /api/admin/publish → ${p.status}, published: ${p.json?.published}`); }
await restoreTarget();
// D-05: one "+ Add item" sent twice with its key makes one item
{ const key = `drill-${Date.now().toString(36)}`; const sid = (await db.query(`select id from sections where venue_id='senso' and not seasonal order by position limit 1`)).rows[0].id;
  const body = { action: 'create', venue: 'senso', section_id: sid, name: { en: 'Drill once', fa: null }, price: null, key };
  const a = await api('/api/admin/item', body, staffCookie), b = await api('/api/admin/item', body, staffCookie);
  const n = (await db.query(`select count(*)::int as n from items where name->>'en' = 'Drill once'`)).rows[0].n;
  check('create-once', a.status === 200 && b.status === 200 && a.json?.item?.id === b.json?.item?.id && b.json?.repeated === true && n === 1, `the same add sent twice with its key → ${a.status}, ${b.status}, the same item: ${a.json?.item?.id === b.json?.item?.id} (second marked repeated: ${b.json?.repeated}); items made: ${n}`);
  if (a.json?.item?.id) await api('/api/admin/item', { action: 'delete', id: a.json.item.id }, staffCookie); }
// D-15: six Style saves sent at once each build on the last; every accepted colour is kept
{ const before = (await db.query(`select style from venues where id='senso'`)).rows[0].style;
  const g = await (await fetch(`${base}/api/admin/style?venue=senso`, { headers: { cookie: ownerCookie } })).json();
  const html = await publicHtml('senso'); const cssVar = (k) => `--c-${k.replace(/\./g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
  const six = (g.tokens || []).map((t) => [t.key, (html.match(new RegExp(`${cssVar(t.key)}:(#[0-9a-f]{6})`)) || [])[1]]).filter(([, c]) => c).slice(0, 6)
    .map(([k, c]) => { const b = parseInt(c.slice(5, 7), 16); return [k, `${c.slice(0, 5)}${(b > 0 ? b - 1 : b + 1).toString(16).padStart(2, '0')}`]; });
  const rs = await Promise.all(six.map(([k, c]) => api('/api/admin/style', { action: 'update', venue: 'senso', patch: { colors: { [k]: c } } }, ownerCookie)));
  const accepted = six.filter((_, i) => rs[i].status === 200); const after = (await db.query(`select coalesce(style->'colors', '{}'::jsonb) as c from venues where id='senso'`)).rows[0].c;
  const kept = accepted.filter(([k, c]) => after[k] === c).length;
  await db.query(`update venues set style = $1 where id = 'senso'`, [JSON.stringify(before)]); await api('/api/admin/publish', { venue: 'senso' }, ownerCookie);
  check('style-concurrent', six.length === 6 && accepted.length >= 4 && kept === accepted.length, `6 colour saves sent at once (each a token's colour moved by one step): ${accepted.length} accepted, ${six.length - accepted.length} refused by the readability guard; kept at the end: ${kept} of ${accepted.length} (before the fix: 1)`); }
// residual of D-03: the locations and a section's name carry their version; an older one is refused (409) and nothing changes
{ const cur = (await db.query(`select locations from venues where id='senso'`)).rows[0].locations;
  const r = await api('/api/admin/venue', { action: 'update', id: 'senso', patch: { locations: cur.map((l, i) => (i === 0 ? { ...l, hours: { ...l.hours, en: 'Drill hours' } } : l)) }, base: { locations: cur.map((l, i) => (i === 0 ? { ...l, address: `${l.address} (older)` } : l)) } }, ownerCookie);
  const after = (await db.query(`select locations from venues where id='senso'`)).rows[0].locations;
  const s0 = (await db.query(`select id, name from sections where venue_id='senso' and not seasonal order by position limit 1`)).rows[0];
  const r2 = await api('/api/admin/section', { action: 'update', id: s0.id, patch: { name: { en: 'Drill rename', fa: s0.name.fa } }, base: { name: { en: 'An older name', fa: s0.name.fa } } }, staffCookie);
  const name = (await db.query('select name from sections where id=$1', [s0.id])).rows[0].name;
  check('versions-stale-409', r.status === 409 && JSON.stringify(after) === JSON.stringify(cur) && Array.isArray(r.json?.venue?.locations) && r2.status === 409 && name.en === s0.name.en && r2.json?.section?.id === s0.id, `locations saved over an older copy → ${r.status} "${r.json?.error}", unchanged: ${JSON.stringify(after) === JSON.stringify(cur)}; a section renamed over an older name → ${r2.status}, still "${name.en}"`); }
// H-04: the database refuses a shown item with an unpriced size (before, only "no price and no sizes" was refused)
{ const ls = (await db.query(`select id, variants from items where listed and price is null and jsonb_array_length(variants) > 0 limit 1`)).rows[0];
  let err = null; try { await db.query('update items set variants = $2 where id = $1', [ls.id, JSON.stringify([...ls.variants, { label: { en: 'Drill size', fa: null }, price: null }])]); } catch (e) { err = e; }
  check('f-check-sizes', !!err && err.constraint === 'listed_requires_price', `SQL adding an unpriced size to a shown item → ${err ? `${err.code} ${err.constraint}` : 'no error (unexpected)'}`); }
// S2-09: uploads read whole (an image with a page after it, an SVG with a script, an image of 20000 px refused)
{ const good = await upload('senso', 'photo', pngOf(4, 3), 'image/png', staffCookie);
  const html = await upload('senso', 'photo', Buffer.concat([pngOf(4, 3), Buffer.from('<html><script>alert(1)</script></html>')]), 'image/png', staffCookie);
  const svg = await upload('senso', 'logo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'), 'image/svg+xml', ownerCookie);
  const huge = await upload('senso', 'photo', pngOf(20000, 1), 'image/png', staffCookie);
  check('upload-structure', good.status === 200 && good.json?.width === 4 && good.json?.height === 3 && html.status === 400 && svg.status === 400 && huge.status === 400, `a 4 × 3 PNG → ${good.status} (${good.json?.width} × ${good.json?.height}); the same PNG with a web page after it → ${html.status} "${html.json?.error}"; an SVG logo with a script → ${svg.status}; a PNG 20000 px wide → ${huge.status}`); }
// "+ Add venue" (step 2): admin, from the venue dropdown, on the phone
{ const actx = await browser.newContext(DEVICE); const ap = await loginPage(actx, 'admin', { email, password }); await ap.waitForSelector('[data-item]');
  let taps = 0; const tap = async (sel) => { taps++; await ap.click(sel); };
  await tap('summary[aria-label="Switch venue"]'); await tap('a[href="/admin/new"]'); await ap.waitForSelector('input[aria-label="Venue name"]');
  await ap.fill('input[aria-label="Venue name"]', 'Drill venue'); const t0 = Date.now(); await tap('button:has-text("Create venue")');
  await ap.waitForURL((u) => /^\/admin\/drill-venue(-\d+)?$/.test(u.pathname)); const id = new URL(ap.url()).pathname.split('/')[2];
  await ap.waitForSelector('[data-details-tab]'); const landed = Date.now() - t0;
  const row = (await db.query(`select template, name->>'en' as name from venues where id=$1`, [id])).rows[0];
  const sc = (await db.query('select count(*) filter (where not seasonal)::int as n, count(*) filter (where seasonal)::int as s from sections where venue_id=$1', [id])).rows[0], secs = sc.n, seasonalSecs = sc.s; // one section of its own and its Seasonal section (2026-10-12)
  const tPub = Date.now(); const pub = await fetch(`${base}/${id}`); const html = await pub.text(); const pubMs = Date.now() - tPub;
  await snap(ap, 'venue-added');
  const dd = await ap.$$eval('header details a[href^="/admin/"]', (els) => els.map((e) => e.getAttribute('href')));
  check('add-venue', taps === 3 && row?.template === 'default' && secs === 1 && seasonalSecs === 1 && pub.status === 200 && html.includes('Drill venue') && html.includes('--c-page-bg:') && dd.includes(`/admin/${id}`), `+ Add venue: ${taps} taps (venue menu, Add venue, Create) + the name → /admin/${id} (Details tab) ${landed} ms after Create; venues row template=${row?.template}, ${secs} starting section and ${seasonalSecs} Seasonal section; GET /${id} → ${pub.status} in ${pubMs} ms (default template, name on the page: ${html.includes('Drill venue')}); in the venue dropdown: ${dd.includes(`/admin/${id}`)}`);
  measure(`+ Add venue: ${taps} taps + the name; Details tab open ${landed} ms after Create; the new page answers ${pub.status} (${pubMs} ms)`);
  // S2-09: the upload quota (100 files an hour per venue), on a venue of its own made for it, whose uploads folder cannot exist yet, so the
  // count starts from nothing (the PM, 2026-11-06: on 2026-11-04 the check ran on "drill-venue", whose folder in the run's copy of the
  // working uploads already held 100 files a hand run had left there, and failed). UPLOAD_DIR is the server's (the suite gives it to drills).
  { const want = `drill-quota-${Date.now().toString(36)}`;
    const made = await api('/api/admin/venue', { action: 'create', name: { en: 'Drill quota', fa: null }, id: want }, ac); const qid = made.json?.venue;
    const dir = process.env.UPLOAD_DIR && qid ? path.join(path.resolve(process.env.UPLOAD_DIR), qid) : null;
    const before = dir ? (existsSync(dir) ? readdirSync(dir).length : 0) : null;
    const ok = []; for (let i = 0; i < 100; i++) ok.push((await upload(qid, 'photo', pngOf(1 + (i % 3), 1), 'image/png', ac)).status);
    const over = await upload(qid, 'photo', pngOf(2, 2), 'image/png', ac);
    check('upload-quota', made.status === 200 && qid === want && before === 0 && ok.every((x) => x === 200) && over.status === 429, `a venue made for the check, "${qid}" (${made.status}); its uploads folder at the start: ${before === null ? 'not known (UPLOAD_DIR not given)' : before === 0 ? 'empty' : `${before} file(s)`}; 100 photos uploaded to it → all 200: ${ok.every((x) => x === 200)}; the 101st within the hour → ${over.status} "${over.json?.error}"`); } // the venue stays in the scratch copy, which the suite drops at its end, like "+ Add venue"'s
  await ap.close(); await actx.close(); }

// revoke drill PINs; revoked staff PIN refused
{ const actx = await browser.newContext(DEVICE); const ap = await loginPage(actx, 'admin', { email, password }); const ac = await cookieOf(actx);
  for (const p of [staff, owner]) await post('/api/admin/pin', { _action: 'revoke', id: p.id, _back: '/admin/team' }, ac);
  const r = await post('/api/admin/login', { mode: 'pin', venue: 'senso', pin: staff.pin });
  check('b-revoked', !r.setCookie && errorOf(r.location) === 'wrong-pin', `revoked staff PIN → ${r.status}, error="${errorOf(r.location)}", cookie set: ${!!r.setCookie}`);
  // pre-go-live audit (2026-11-02, S1-03): the revoked PIN's session from before ends too (before, its cookie kept editing for up to 12 hours)
  const old = await api('/api/admin/item', { action: 'update', id: item.id, patch: {} }, staffCookie);
  check('revoked-session', old.status === 401, `the revoked staff PIN's earlier session (its cookie) → POST /api/admin/item ${old.status} "${old.json?.error}"`);
  await ap.close(); await actx.close(); }
await db.query(`delete from login_failures where key like 'senso:%'`);
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'admin-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'admin-drill.txt'), [`Admin drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n') + '\n');
console.log(`ADMIN DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
