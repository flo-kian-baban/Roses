#!/usr/bin/env node
// Admin acceptance drill on an iPhone viewport (T6): sign-ins, PIN creation and revocation, item editing with
// three price edits and a restore, the listing rule (UI, server, database), section listing and the public page,
// notes permissions, create/delete/restore of an item, venue details. Screenshots and a timestamped transcript go
// to reports/checkpoint-b/admin/. Needs the production server at --base and DRILL_ADMIN_EMAIL / DRILL_ADMIN_PASSWORD.
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
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
const browser = await chromium.launch();
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), fullPage: true, ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }); log('shot', f); };
const form = (o) => new URLSearchParams(o).toString();
async function post(p, body, cookie) { const r = await fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: form(body) }); return { status: r.status, location: r.headers.get('location'), setCookie: r.headers.get('set-cookie'), text: r.status === 200 ? await r.text() : '' }; }
const errorOf = (loc) => { try { return new URL(loc, 'http://x').searchParams.get('error'); } catch { return null; } };
const publicHtml = async (venue) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(venue, pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(venue); if (pred(html)) return { ok: true, ms: Date.now() - t }; await new Promise((r) => setTimeout(r, 300)); } return { ok: false, ms: Date.now() - t, html }; }
async function loginPage(ctx, mode, fields) { const page = await ctx.newPage(); await page.goto(`${base}/admin/login${mode === 'admin' ? '?mode=admin' : ''}`); for (const [k, v] of Object.entries(fields)) { if (k === 'venue') await page.check(`input[name=venue][value=${v}]`); else await page.fill(`input[name=${k}]`, v); } await page.click('button[type=submit]'); await page.waitForLoadState('domcontentloaded'); return page; }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];

// a previous run that stopped early may have left drill PINs active: revoke them first
await db.query(`update pins set revoked_at = now() where revoked_at is null and name like 'Drill %'`);
await db.query(`delete from items where venue_id='senso' and name->>'en' = 'Drill test item'`);

// (e) unauthenticated POST to a mutation route
{ const r = await post('/api/admin/item', { _action: 'list', id: '00000000-0000-0000-0000-000000000000' }); check('e-unauth', r.status === 401, `unauthenticated POST /api/admin/item → ${r.status}`); }

// (c) admin login + cookie attributes
const adminCtx = await browser.newContext(DEVICE);
{
  const page = await adminCtx.newPage(); await page.goto(`${base}/admin/login`); await snap(page, 'login-pin');
  await page.goto(`${base}/admin/login?mode=admin`); await snap(page, 'login-admin');
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', password); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin`);
  await snap(page, 'home-admin');
  const r = await post('/api/admin/login', { mode: 'admin', email, password });
  const sc = r.setCookie || '';
  check('c-cookie', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Path=\//.test(sc), `Set-Cookie attributes: ${sc.replace(/roses_session=[^;]+/, 'roses_session=<token>')} (Secure is added when served over https)`);
  await page.close();
}
const adminCookie = await cookieOf(adminCtx);

// admin PIN sign-in (Kian's decision of 2026-10-07): the admin's PIN alone, on any venue, gives admin rights
if (process.env.DRILL_ADMIN_PIN) {
  const r = await post('/api/admin/login', { mode: 'pin', venue: 'kebab-land', pin: process.env.DRILL_ADMIN_PIN });
  const c = (r.setCookie || '').split(';')[0];
  const pins = c ? await fetch(`${base}/admin/pins`, { headers: { cookie: c } }) : null;
  const pinsHtml = pins ? await pins.text() : '';
  check('admin-pin', r.status === 303 && r.location === '/admin/kebab-land' && !!c && pins?.status === 200 && pinsHtml.includes('Admin accounts'), `admin PIN on the Kebab Land sign-in → ${r.status} to ${r.location}, cookie set: ${!!c}; the PINs page (admin only) answers ${pins?.status} with the admin section: ${pinsHtml.includes('Admin accounts')}`);
}

// PINs: create staff (senso) and owner (both venues); the PIN pages are not screenshotted
async function makePin(name, role, venues) { const r = await post('/api/admin/pin', { _action: 'create', name, role, venue_ids: venues.join(','), _back: '/admin/pins' }, adminCookie); const pin = r.text.match(/class="pin">(\d{6})</)?.[1]; const id = (await db.query('select id from pins where name = $1 order by created_at desc limit 1', [name])).rows[0]?.id; check('pin-create', !!pin && !!id, `PIN created for "${name}" (${role}, ${venues.join('+')}): shown once on the response page (6 digits: ${!!pin}), hash stored: ${!!id}`); return { pin, id }; }
const staff = await makePin('Drill staff', 'staff', ['senso']);
const owner = await makePin('Drill owner', 'owner', ['senso', 'kebab-land']);
{ const r = await db.query(`select count(*)::int as n from pins where pin_hash not like '$scrypt$%'`); check('d-hash', r.rows[0].n === 0, `pins with a hash not starting with $scrypt$: ${r.rows[0].n}; plain PIN column: none exists (schema has pin_hash only)`); }
{ const page = await adminCtx.newPage(); await page.goto(`${base}/admin/pins`); await snap(page, 'pins-list'); await page.close(); }

// (c) logout clears the cookie
{ const r = await post('/api/admin/logout', {}, adminCookie); const after = await fetch(`${base}/admin`, { redirect: 'manual', headers: { cookie: adminCookie } });
  // the JWT itself stays valid until expiry; the cookie is cleared in the browser (Max-Age=0). Verify the browser context:
  await adminCtx.clearCookies(); const page = await adminCtx.newPage(); const resp = await page.goto(`${base}/admin`); const url = page.url();
  const signInShown = !!(await page.$('form[action="/api/admin/login"] input[name=pin]')) && !(await page.$('nav a[href="/admin/pins"]'));
  check('c-logout', /Max-Age=0/.test(r.setCookie || '') && signInShown, `logout → Set-Cookie: ${r.setCookie}; GET /admin without the cookie → ${resp.status()} at ${url} shows the sign-in form and no admin shell (a still-valid token is simply no longer sent: ${after.status})`); await page.close(); }

// staff PIN login
const staffCtx = await browser.newContext(DEVICE);
let page = await loginPage(staffCtx, 'pin', { venue: 'senso', pin: staff.pin });
check('pin-login', page.url() === `${base}/admin/senso`, `staff PIN sign-in lands on ${page.url()}`);
await snap(page, 'venue-senso-staff');
const staffCookie = await cookieOf(staffCtx);

// (i) three price edits then a restore to the first version
const item = (await db.query(`select id, price from items where venue_id='senso' and name->>'en'='Turkish Coffee'`)).rows[0];
const p0 = Number(item.price);
await page.goto(`${base}/admin/senso/items/${item.id}`); await snap(page, 'item-turkish-coffee');
for (const p of [p0 + 1, p0 + 2, p0 + 3]) { await page.fill('input[name=price]', p.toFixed(2)); await Promise.all([page.waitForURL((u) => u.searchParams.get('saved') === '1'), page.click('form[action="/api/admin/item"] button:has-text("Save")')]); log('i-edit', `saved price ${p.toFixed(2)}`); }
await snap(page, 'item-after-3-edits');
const revs = (await db.query(`select id, action, before->>'price' as b, after->>'price' as a from revisions where table_name='items' and row_id=$1 order by id`, [item.id])).rows;
const firstEdit = revs.filter((r) => r.action === 'update').slice(-3)[0];
await page.goto(`${base}/admin/senso/items/${item.id}`);
await Promise.all([page.waitForURL((u) => u.searchParams.has('restored')), page.click(`form[action="/api/admin/restore"]:has(input[value="${firstEdit.id}"]) button`)]);
const now = (await db.query('select price from items where id=$1', [item.id])).rows[0].price;
const last4 = (await db.query(`select action, before->>'price' as b, after->>'price' as a, by->>'name' as by from revisions where table_name='items' and row_id=$1 order by id desc limit 4`, [item.id])).rows.reverse();
check('i-restore', Number(now) === p0 && last4.map((r) => r.action).join(',') === 'update,update,update,restore', `price after restoring revision ${firstEdit.id}: ${now} (original ${p0}); last four revision rows: ${last4.map((r) => `${r.action} ${r.b}→${r.a}`).join(' | ')}`);
await snap(page, 'item-after-restore');

// (f) listing rule: UI, server action, database constraint
const noPrice = (await db.query(`select i.id, i.name->>'en' as name, (select s.name->>'en' from item_sections x join sections s on s.id=x.section_id where x.item_id=i.id limit 1) as section from items i where i.venue_id='senso' and not i.listed and i.price is null and jsonb_array_length(i.variants)=0 order by i.name->>'en' limit 1`)).rows[0];
await page.goto(`${base}/admin/senso`);
const disabled = await page.$eval(`form[action="/api/admin/item"]:has(input[value="${noPrice.id}"]) button`, (b) => b.disabled && b.title);
check('f-ui', !!disabled, `venue page: List button for "${noPrice.name}" (no price) is disabled with the hint "${disabled}"`);
await page.goto(`${base}/admin/senso/items/${noPrice.id}`); await page.check('input[name=listed]'); await Promise.all([page.waitForURL((u) => u.searchParams.has('error')), page.click('form[action="/api/admin/item"] button:has-text("Save")')]);
const uiError = await page.textContent('[role=alert]'); await snap(page, 'needs-price-refused');
check('f-form', /needs a price/.test(uiError || ''), `saving "${noPrice.name}" with Listed ticked and no price → "${uiError?.trim()}"`);
{ const r = await post('/api/admin/item', { _action: 'list', id: noPrice.id, _back: '/admin/senso' }, staffCookie); check('f-server', r.status === 303 && /needs a price/.test(errorOf(r.location) || ''), `direct POST _action=list → ${r.status}, error="${errorOf(r.location)}"`); }
{ let err = null; try { await db.query('update items set listed = true where id = $1', [noPrice.id]); } catch (e) { err = e; } check('f-check', !!err && err.constraint === 'listed_requires_price', `SQL "update items set listed = true" on the priceless item → ${err ? `${err.code} ${err.constraint}: ${err.message}` : 'no error (unexpected)'}`); }
// a size item with a missing size price is refused by the server action, not the CHECK (variants present)
{ const sized = (await db.query(`select id, name->>'en' as name, variants from items where venue_id='kebab-land' and name->>'en'='Prosecco'`)).rows[0];
  const ownerCtx0 = await browser.newContext(DEVICE); const op = await loginPage(ownerCtx0, 'pin', { venue: 'kebab-land', pin: owner.pin }); const ownerCookieKl = await cookieOf(ownerCtx0); await op.close();
  const body = { _action: 'save', id: sized.id, _back: `/admin/kebab-land/items/${sized.id}`, name_en: sized.name, listed: 'on', v0_en: '6 oz', v0_price: '12', v1_en: '9 oz', v1_price: '' };
  const r = await post('/api/admin/item', body, ownerCookieKl); const after = (await db.query('select listed, variants from items where id=$1', [sized.id])).rows[0];
  check('f-sizes', r.status === 303 && /every size needs a price/.test(errorOf(r.location) || '') && JSON.stringify(after.variants) === JSON.stringify(sized.variants), `save "${sized.name}" listed with a second size without price → error="${errorOf(r.location)}"; row unchanged: ${JSON.stringify(after.variants) === JSON.stringify(sized.variants)}`); await ownerCtx0.close(); }
// price it, list it, see it on the public page, then restore
await page.goto(`${base}/admin/senso/items/${noPrice.id}`); await page.fill('input[name=price]', '7.25'); await page.check('input[name=listed]');
await Promise.all([page.waitForURL((u) => u.searchParams.get('saved') === '1'), page.click('form[action="/api/admin/item"] button:has-text("Save")')]);
let w = await waitPublic('senso', (h) => h.includes(`${noPrice.name}</h3>`) || h.includes(`>${noPrice.name}<`));
check('f-public-listed', w.ok, `"${noPrice.name}" priced 7.25 and listed → on the public page after ${w.ms} ms`);
await page.goto(`${base}/admin/senso/items/${noPrice.id}`); await Promise.all([page.waitForURL((u) => u.searchParams.has('restored')), page.click('form[action="/api/admin/restore"] button')]);
w = await waitPublic('senso', (h) => !h.includes(`${noPrice.name}</h3>`) && !h.includes(`>${noPrice.name}<`));
check('f-public-restored', w.ok, `restored to unlisted/no price → gone from the public page after ${w.ms} ms`);

// (g) unlisting a section; a section whose last listed item is unlisted disappears
const sec = (await db.query(`select id, name->>'en' as name from sections where venue_id='senso' and name->>'en'='Extra'`)).rows[0];
{ const r = await post('/api/admin/section', { _action: 'unlist', id: sec.id, _back: '/admin/senso' }, staffCookie); w = await waitPublic('senso', (h) => !new RegExp(`<h2[^>]*>(<span lang="en">)?${sec.name}<`).test(h)); check('g-section', r.status === 303 && w.ok, `section "${sec.name}" unlisted → heading gone from the public page after ${w.ms} ms`); await page.goto(`${base}/admin/senso`); await snap(page, 'section-unlisted'); }
{ const r = await post('/api/admin/section', { _action: 'list', id: sec.id, _back: '/admin/senso' }, staffCookie); w = await waitPublic('senso', (h) => new RegExp(`<h2[^>]*>(<span lang="en">)?${sec.name}<`).test(h)); check('g-section-back', r.status === 303 && w.ok, `section "${sec.name}" listed again → heading back after ${w.ms} ms`); }
const bev = (await db.query(`select s.id, s.name->>'en' as name, array_agg(i.id) as items from sections s join item_sections x on x.section_id=s.id join items i on i.id=x.item_id and i.listed where s.venue_id='senso' and s.name->>'en'='Beverage' group by s.id`)).rows[0];
for (const id of bev.items) await post('/api/admin/item', { _action: 'unlist', id, _back: '/admin/senso' }, staffCookie);
w = await waitPublic('senso', (h) => !new RegExp(`<h2[^>]*>(<span lang="en">)?${bev.name}<`).test(h));
check('g-last-item', w.ok, `all ${bev.items.length} items of "${bev.name}" unlisted → the section disappears from the public page after ${w.ms} ms`);
for (const id of bev.items) await post('/api/admin/item', { _action: 'list', id, _back: '/admin/senso' }, staffCookie);
w = await waitPublic('senso', (h) => new RegExp(`<h2[^>]*>(<span lang="en">)?${bev.name}<`).test(h));
check('g-last-item-back', w.ok, `items listed again → "${bev.name}" back after ${w.ms} ms`);

// (h) notes: staff sees no fields and gets 403; owner edits them
await page.goto(`${base}/admin/senso/items/${item.id}`);
const staffNotesForm = await page.$('input[name=notes_allergens]'); const staffText = await page.textContent('body');
await snap(page, 'staff-no-notes');
check('h-staff-ui', !staffNotesForm && /set by the owner or an admin/.test(staffText || ''), `staff item page: notes inputs present = ${!!staffNotesForm}; explanatory line shown = ${/set by the owner or an admin/.test(staffText || '')}`);
{ const r = await post('/api/admin/item', { _action: 'notes', id: item.id, notes_allergens: 'nuts', _back: '/admin/senso' }, staffCookie); check('h-staff-403', r.status === 403, `staff POST _action=notes → ${r.status}`); }
const ownerCtx = await browser.newContext(DEVICE);
const opage = await loginPage(ownerCtx, 'pin', { venue: 'senso', pin: owner.pin });
await opage.goto(`${base}/admin/senso/items/${item.id}`);
await opage.fill('input[name=notes_allergens]', 'nuts'); await opage.check('input[name=notes_halal][value=yes]');
await Promise.all([opage.waitForURL((u) => u.searchParams.get('saved') === '1'), opage.click('form:has(input[value="notes"]) button')]);
const notes = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes;
await snap(opage, 'owner-notes-saved');
check('h-owner', notes.allergens.includes('nuts') && notes.halal === true, `owner saved notes: ${JSON.stringify(notes)}`);
{ const adminCtx2 = await browser.newContext(DEVICE); const ap = await loginPage(adminCtx2, 'admin', { email, password }); const ac = await cookieOf(adminCtx2); const r = await post('/api/admin/item', { _action: 'notes', id: item.id, notes_allergens: '', notes_halal: 'unknown', _back: '/admin/senso' }, ac); const n2 = (await db.query('select notes from items where id=$1', [item.id])).rows[0].notes; check('h-admin', r.status === 303 && n2.allergens.length === 0 && n2.halal === null, `admin cleared the notes again: ${JSON.stringify(n2)}`); await ap.close(); await adminCtx2.close(); }

// (j) create, delete, restore with section membership
await page.goto(`${base}/admin/senso/items/new`);
await page.fill('input[name=name_en]', 'Drill test item'); await page.fill('input[name=name_fa]', 'آیتم آزمایشی'); await page.fill('input[name=price]', '1'); await page.check('input[name=listed]'); await page.check(`input[name=section_ids][value="${sec.id}"]`);
await Promise.all([page.waitForURL((u) => u.searchParams.get('saved') === '1'), page.click('form[action="/api/admin/item"] button:has-text("Create item")')]);
const created = (await db.query(`select id from items where venue_id='senso' and name->>'en'='Drill test item' order by updated_at desc limit 1`)).rows[0];
w = await waitPublic('senso', (h) => h.includes('Drill test item'));
check('j-create', !!created && w.ok, `"Drill test item" created in "${sec.name}" → on the public page after ${w.ms} ms`);
await snap(page, 'item-created');
await page.check('input[name=confirm]'); await Promise.all([page.waitForURL((u) => u.searchParams.has('deleted')), page.click('button:has-text("Delete item")')]);
w = await waitPublic('senso', (h) => !h.includes('Drill test item'));
const gone = (await db.query('select count(*)::int as n from items where id=$1', [created.id])).rows[0].n === 0;
check('j-delete', gone && w.ok, `deleted → row gone (${gone}), off the public page after ${w.ms} ms`);
await page.goto(`${base}/admin/senso/history`); await snap(page, 'history');
const delRev = (await db.query(`select id from revisions where table_name='items' and row_id=$1 and action='delete'`, [created.id])).rows[0];
await Promise.all([page.waitForURL((u) => u.searchParams.has('restored')), page.click(`form[action="/api/admin/restore"]:has(input[value="${delRev.id}"]) button`)]);
const back = (await db.query(`select i.id, i.listed, x.section_id from items i left join item_sections x on x.item_id=i.id where i.id=$1`, [created.id])).rows[0];
w = await waitPublic('senso', (h) => h.includes('Drill test item'));
check('j-restore', !!back && back.section_id === sec.id && w.ok, `restored from history → row back with section "${sec.name}" (${back?.section_id === sec.id}), on the public page after ${w.ms} ms`);
await post('/api/admin/item', { _action: 'delete', id: created.id, confirm: 'on', _back: '/admin/senso' }, staffCookie);
await waitPublic('senso', (h) => !h.includes('Drill test item'));
log('j-cleanup', 'test item deleted again (stays in history)');

// venue details (admin only): staff gets a refusal, admin edits hours, public footer updates, restore
{ const r = await post('/api/admin/venue', { id: 'senso', name_en: 'Senso Café & Bites', l0_label_en: 'x', _back: '/admin/senso/details' }, staffCookie); check('venue-staff-403', r.status === 403, `staff POST /api/admin/venue → ${r.status}`); }
{ const actx = await browser.newContext(DEVICE); const ap = await loginPage(actx, 'admin', { email, password }); await ap.goto(`${base}/admin/senso/details`); await snap(ap, 'venue-details');
  const hoursBefore = await ap.inputValue('input[name=l0_hours_en]'); await ap.fill('input[name=l0_hours_en]', `${hoursBefore} (drill)`);
  await Promise.all([ap.waitForURL((u) => u.searchParams.get('saved') === '1'), ap.click('button:has-text("Save venue details")')]);
  w = await waitPublic('senso', (h) => h.includes(`${hoursBefore} (drill)`));
  const vrow = (await db.query(`select locations->0->'confirm' as confirm from venues where id='senso'`)).rows[0];
  check('venue-edit', w.ok && !(vrow.confirm || []).includes('hours'), `hours changed to "${hoursBefore} (drill)" → public footer after ${w.ms} ms; "to confirm" mark for hours cleared: ${!(vrow.confirm || []).includes('hours')}`);
  await snap(ap, 'venue-details-saved');
  await Promise.all([ap.waitForURL((u) => u.searchParams.has('restored')), ap.click('form[action="/api/admin/restore"] button')]);
  w = await waitPublic('senso', (h) => !h.includes('(drill)'));
  check('venue-restore', w.ok, `venue details restored from history → public footer back after ${w.ms} ms`);
  // revoke drill PINs; revoked staff PIN refused
  const ac = await cookieOf(actx);
  for (const p of [staff, owner]) await post('/api/admin/pin', { _action: 'revoke', id: p.id, _back: '/admin/pins' }, ac);
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
