#!/usr/bin/env node
// "Goes well with" acceptance (Kian via the PM, 2026-11-18), measured by Playwright and through the admin API on a scratch server:
//   the rules on the route and in the database: 4 can be saved and a 5th cannot; never the item itself, an item of the other venue, one
//     that does not exist or one listed twice; one-way; the order picked; the change record with Undo; a save over a newer version refused;
//     the Undo of a record older than the lists leaves the list alone;
//   the public page: only pairs that are shown and in season (a hidden one and an out-of-season one left out, and back when they are);
//     a deleted item gone from every list (the admin's Delete with its Undo, and a plain SQL delete: the database's own rule); the style
//     of the block only on a page that has a pair to show;
//   customers (iPhone 13 viewport, Chromium; WebKit too): the block as the last group of the popup, below the item's own sizes, options,
//     combo parts and notes (the PM's ruling of 2026-11-19); the heading and the pairs in English and in Persian, each with its name in the
//     page's language, its price as its row in the menu shows it and its photo if it has one (the popup's template carries the paired
//     items' ids only; the page's script fills each row from that item's own row); no pair photo requested before the popup is
//     opened; a tap opens the paired item's popup (its name, its photo, at its top; no new history entry; Escape closes it);
//     nothing clipped at 360 px in either language;
//   the admin (iPhone 13 viewport): the card below PRICE and its choices (the PM's ruling of 2026-11-19) with "n of 4", four added
//     through the picker with the tap count, the add button gone at 4; while "Saved · Undo" shows after an add or a remove, and with the
//     picker open over it, no tappable control under the toast or its strip (390 × 664 and 360 px); the picker offers every item of the venue but the item itself and none of the other venue, hidden and out-of-season ones
//     labelled, the ones in the list as Added; remove and add again puts an item last; nothing clipped at 360 px (the card, the picker);
//     Duplicate copies the list; on a laptop the preview shows the item's popup with the list after a save, without taking the focus or
//     adding history entries; deleting a listed item updates the lists on screen so the next save goes through.
// The drill makes its own items on Senso through the admin API and removes them at the end.
// Needs a scratch server at --base and DRILL_ADMIN_PIN (an admin PIN valid on any venue).
//   DATABASE_URL=… DRILL_ADMIN_PIN=… node scripts/pairs-drill.mjs --base http://127.0.0.1:<port> --out reports/checks/<stamp>/pairs [--jpeg]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';
import { connectDb } from './load-env.mjs';
import { scratchTarget } from './scratch-target.mjs';
import { MEASURE as LAYOUT, RADIUS, SIZES, UNDER_TOAST } from './layout-rules.mjs';

// The target is a scratch server, or the drill stops before sending anything (the PM, 2026-11-06; scripts/scratch-target.mjs).
const { args } = await scratchTarget('scripts/pairs-drill.mjs', { options: { base: 'server', out: 'path', jpeg: 'flag' }, db: true, env: ['DRILL_ADMIN_PIN'] });
const jpeg = process.argv.includes('--jpeg');
const base = args.base, VENUE = 'senso', OTHER = 'kebab-land', MAX = 4;
const out = path.resolve(args.out);
await fs.mkdir(out, { recursive: true });
const pin = process.env.DRILL_ADMIN_PIN;
const transcript = [], results = [], measures = [];
const t0 = Date.now();
const log = (step, text) => { const l = { at: new Date().toISOString(), ms: Date.now() - t0, step, text: String(text) }; transcript.push(l); console.log(`${l.at} [${step}] ${l.text}`); };
const check = (step, ok, text) => { results.push({ step, ok: !!ok, text }); log(step, `${ok ? 'PASS' : 'FAIL'}: ${text}`); };
const measure = (text) => { measures.push(text); console.log(`MEASURE: ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const db = await connectDb('pairs-drill', (t) => log('db', t));
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' };
let shot = 0; const snap = async (page, name) => { const f = `${String(++shot).padStart(2, '0')}-${name}.${jpeg ? 'jpg' : 'png'}`; await page.screenshot({ path: path.join(out, f), ...(jpeg ? { type: 'jpeg', quality: 70 } : {}) }).catch(() => {}); log('shot', f); };
const publicHtml = async (venue = VENUE) => (await fetch(`${base}/${venue}`, { cache: 'no-store' })).text();
async function waitPublic(pred, ms = 10000) { const t = Date.now(); let html = ''; while (Date.now() - t < ms) { html = await publicHtml(); if (pred(html)) return { ok: true, ms: Date.now() - t, html }; await sleep(150); } return { ok: false, ms: Date.now() - t, html }; }
async function waitDb(sql, params, pred, ms = 5000) { const t = Date.now(); let row; while (Date.now() - t < ms) { row = (await db.query(sql, params)).rows[0]; if (pred(row)) return { ok: true, ms: Date.now() - t, row }; await sleep(50); } return { ok: false, ms: Date.now() - t, row }; }
async function signin(page, venue = VENUE) { await page.goto(`${base}/admin/${venue}`); await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/${venue}`); await page.waitForSelector('[data-item]'); }
const cookieOf = async (ctx) => (await ctx.cookies()).filter((c) => c.name === 'roses_session').map((c) => `${c.name}=${c.value}`)[0];
let cookie = null;
async function api(p, body) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }
const pairsOf = async (id) => (await db.query('select pairs from items where id = $1', [id])).rows[0]?.pairs ?? null;
const setPairs = (id, pairs, extra = {}) => api('/api/admin/item', { action: 'update', id, patch: { pairs }, ...extra });
// an item's popup as the public HTML carries it (its template), and the pairs in it, in order
const tplOf = (html, id) => (html.match(new RegExp(`<li class="item[^"]*"[^>]*data-id="${id}"[\\s\\S]*?</template>`)) || [null])[0];
const publicPairs = (html, id) => { const t = tplOf(html, id); return t ? [...t.matchAll(/data-pair="([^"]+)"/g)].map((x) => x[1]) : null; };
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`; // src/lib/format.ts price()

// ---- the drill's own items (removed at the end): the item, four pairs to show, a hidden one, an out-of-season one
const N = {
  A: 'Drill pairs item', P1: 'Drill pair one', P2: 'Drill pair two', P3: 'Drill pair three',
  P4: 'Drill pair four with a long name that has to wrap onto a second line on a narrow phone', PH: 'Drill pair hidden', PS: 'Drill pair out of season', T: 'Drill pair temp',
};
const FA = { A: 'آیتم آزمایشی', P1: 'همراه یک', P3: 'همراه سه', P4: 'همراه چهار با نامی بلند که در تلفن باریک به خط دوم می‌رود' }; // P2 has no Persian name (it falls back to English)
const ALL_NAMES = [...Object.values(N), `${N.A} (copy)`];
const cleanup = async () => { await db.query(`delete from items where venue_id = $1 and name->>'en' = any($2)`, [VENUE, ALL_NAMES]); };
await cleanup();
const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', month: 'numeric' }).format(new Date())) - 1;
const today = month >= 8 && month <= 10 ? 'fall' : month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : 'summer';
const offSeason = today === 'spring' ? 'fall' : 'spring';
const regular = (await db.query(`select id, name->>'en' as name from sections where venue_id = $1 and listed and not seasonal order by position`, [VENUE])).rows;
const first = regular[0], last = regular[regular.length - 1];
const other = (await db.query(`select id from items where venue_id = $1 order by id limit 1`, [OTHER])).rows[0]?.id;
const donor = (await db.query(`select photo from items where venue_id = $1 and photo->>'key' is not null order by id limit 1`, [VENUE])).rows[0]?.photo;
if (!first || !last || first.id === last.id || !other || !donor) { console.error('pairs drill: the scratch copy needs two shown sections on Senso, an uploaded photo there and an item on Kebab Land'); process.exit(2); }

const browser = await chromium.launch();
const phone = await browser.newContext(DEVICE); const p = await phone.newPage();
p.on('pageerror', (e) => log('pageerror', e.message));
await signin(p); cookie = await cookieOf(phone);
const id = {};
const make = async (key, section, price) => {
  const r = await api('/api/admin/item', { action: 'create', venue: VENUE, section_id: section.id, name: { en: N[key], fa: FA[key] ?? null }, price });
  if (r.status !== 200 || !r.json?.item?.id) throw new Error(`could not create ${N[key]}: ${r.status} ${JSON.stringify(r.json)}`);
  id[key] = r.json.item.id;
};
await make('A', first, 5);
for (const [key, price] of [['P1', 6.5], ['P2', 7], ['P3', 4], ['P4', 8.25], ['PH', 3], ['PS', 3.5]]) await make(key, last, price);
{ // the item with a description and every group of its own (two sizes, a choice, a combo part, the owner's notes), so the block's place
  // below them can be read; P3 with two sizes (its price line in the menu is its sizes); PH hidden; PS out of season; P1 with a photo
  // under an address of its own
  const d = await api('/api/admin/item', { action: 'update', id: id.A, patch: { description: { en: 'Made by the drill, with sizes, a choice, a part and a note of its own.', fa: 'ساخته‌ی آزمون، با اندازه، گزینه، بخش و یادداشت خودش.' },
    price: null, variants: [{ label: { en: 'Regular', fa: 'معمولی' }, price: 5 }, { label: { en: 'Large', fa: 'بزرگ' }, price: 6.5 }],
    add_ons: [{ group: { en: 'Drill milk', fa: 'شیر آزمون' }, label: { en: 'Oat', fa: 'جو دوسر' }, price: 1, required: false }],
    components: [{ item_id: null, label: { en: 'Drill part', fa: 'بخش آزمون' }, qty: 2 }] } });
  const n = await api('/api/admin/item', { action: 'notes', id: id.A, notes: { allergens: ['milk'], dietary: ['Vegetarian'], halal: true, text: { en: null, fa: null } } });
  if (d.status !== 200 || n.status !== 200) throw new Error(`setup failed: the item's own groups ${d.status} ${JSON.stringify(d.json?.error ?? '')}, its notes ${n.status} ${JSON.stringify(n.json?.error ?? '')}`);
  const a = await api('/api/admin/item', { action: 'update', id: id.P3, patch: { price: null, variants: [{ label: { en: 'Small', fa: 'کوچک' }, price: 4 }, { label: { en: 'Large', fa: 'بزرگ' }, price: 6 }] } });
  const b = await api('/api/admin/item', { action: 'update', id: id.PH, patch: { listed: false } });
  const c = await api('/api/admin/item', { action: 'update', id: id.PS, patch: { seasons: [offSeason] } });
  if (a.status !== 200 || b.status !== 200 || c.status !== 200) throw new Error(`setup failed: ${a.status} ${b.status} ${c.status}`);
}
// P1's photo: an uploaded photo of the venue under an address no other item has (the same file with a query), so a request for it can
// only come from P1's own row, far down the page, or from P1 as a pair in a popup
const P1_PHOTO = `${donor.url}?pairs-drill=1`;
await db.query('update items set photo = $2 where id = $1', [id.P1, JSON.stringify({ ...donor, url: P1_PHOTO, alt: { en: N.P1, fa: FA.P1 } })]);
await api('/api/admin/publish', { venue: VENUE });
{ const pub = await waitPublic((h) => h.includes(`data-id="${id.A}"`) && h.includes(`data-id="${id.P4}"`)); log('setup', `the drill's items made through the admin API: “${N.A}” last in “${first.name}”, six to pair it with last in “${last.name}” (one hidden, one tagged ${offSeason} only: out of season, it is ${today}); on the public page ${pub.ok ? `after ${pub.ms} ms` : 'NOT within the wait'}`); }

try {
// ---- 1. the rules, on the route and in the database
{
  const four = [id.P1, id.P2, id.P3, id.P4];
  const ok4 = await setPairs(id.A, four), has4 = await pairsOf(id.A);
  const fifth = await setPairs(id.A, [...four, id.PH]), after5 = await pairsOf(id.A);
  let sql5 = null; try { await db.query('update items set pairs = $2::uuid[] where id = $1', [id.A, [...four, id.PH]]); } catch (e) { sql5 = e.constraint || e.message; }
  check('max-four', ok4.status === 200 && same(has4, four) && fifth.status === 400 && same(after5, four) && sql5 === 'items_pairs_valid',
    `four saved through the route (${ok4.status}; the database holds ${has4?.length}, in the order sent: ${same(has4, four)}); a fifth refused (${fifth.status} “${fifth.json?.error}”), the list still ${after5?.length}; written straight into the database, a fifth is refused by its own rule (${sql5})`);
  const self = await setPairs(id.A, [id.P1, id.A]), cross = await setPairs(id.A, [id.P1, other]), ghost = await setPairs(id.A, [id.P1, '00000000-0000-4000-8000-000000000000']), twice = await setPairs(id.A, [id.P1, id.P1]), junk = await setPairs(id.A, 'x');
  let sqlSelf = null; try { await db.query('update items set pairs = $2::uuid[] where id = $1', [id.A, [id.A]]); } catch (e) { sqlSelf = e.constraint || e.message; }
  const still = await pairsOf(id.A);
  check('not-itself-not-other-venue', [self, cross, ghost, twice, junk].every((r) => r.status === 400) && same(still, four) && sqlSelf === 'items_pairs_valid',
    `refused by the route, the list unchanged (${same(still, four)}): the item itself (${self.status} “${self.json?.error}”), an item of ${OTHER} (${cross.status} “${cross.json?.error}”), an id that is no item (${ghost.status}), one item twice (${twice.status} “${twice.json?.error}”), not a list (${junk.status}); the item itself written straight into the database is refused by its own rule (${sqlSelf})`);
  const p1 = await pairsOf(id.P1), p4 = await pairsOf(id.P4);
  check('one-way', same(p1, []) && same(p4, []), `“${N.A}” lists four items; their own lists are untouched (${N.P1}: ${p1?.length}, the fourth: ${p4?.length})`);
  const order = [id.P3, id.P1, id.P4];
  const set = await setPairs(id.A, order), got = await pairsOf(id.A);
  const pub = await waitPublic((h) => same(publicPairs(h, id.A), order));
  check('order-picked', set.status === 200 && same(got, order) && pub.ok, `saved as three, two of them swapped: the database keeps the order sent (${same(got, order)}) and the item's popup on the public page lists them in it (${pub.ok ? `${pub.ms} ms after the save` : `not within the wait: ${JSON.stringify(publicPairs(pub.html, id.A))}`})`);
  // the change record, Undo, and a save carrying an older version
  const rev = (await db.query(`select id, action, before->'pairs' as b, after->'pairs' as a from revisions where table_name = 'items' and row_id = $1 order by id desc limit 1`, [id.A])).rows[0];
  const undo = await api('/api/admin/undo', { venue: VENUE, revisions: set.json?.revisions ?? [] }), undone = await pairsOf(id.A);
  const stale = await setPairs(id.A, [id.P1], { base: '2020-01-01T00:00:00.000Z' }), kept = await pairsOf(id.A);
  check('record-undo-version', rev && Number(rev.id) === Number(set.json?.revisions?.[0]) && rev.action === 'update' && same(rev.b, four) && same(rev.a, order) && undo.status === 200 && same(undone, four) && stale.status === 409 && same(stale.json?.item?.pairs, four) && same(kept, four),
    `the save wrote one change record (${rev?.action}, before ${rev?.b?.length} items, after ${rev?.a?.length}); Undo put the four back (${undo.status}, ${same(undone, four)}); a save carrying an older version of the item is refused (${stale.status}) with the item as it is now (${stale.json?.item?.pairs?.length} pairs), nothing written (${same(kept, four)})`);
  // a change record from before the lists existed says nothing about the list: its Undo puts its own field back and leaves the list alone
  const served = await api('/api/admin/item', { action: 'update', id: id.A, patch: { serves: '2' } });
  await db.query(`update revisions set before = before - 'pairs', after = after - 'pairs' where id = $1`, [served.json?.revisions?.[0] ?? 0]);
  const undoOld = await api('/api/admin/undo', { venue: VENUE, revisions: served.json?.revisions ?? [] });
  const afterOld = (await db.query('select pairs, serves from items where id = $1', [id.A])).rows[0];
  check('old-record-keeps-list', served.status === 200 && undoOld.status === 200 && afterOld.serves === null && same(afterOld.pairs, four),
    `a change of another field whose record is made to look like one from before the lists existed (no list in it): its Undo (${undoOld.status}) puts that field back (${afterOld.serves === null}) and leaves the item's list as it is (${same(afterOld.pairs, four)})`);
}

// ---- 2. the public page: only what is shown and in season; a deleted item gone from every list
{
  const list = [id.P1, id.PH, id.PS, id.P2];
  await setPairs(id.A, list);
  const a = await waitPublic((h) => same(publicPairs(h, id.A), [id.P1, id.P2]));
  const absent = (h, key) => !h.includes(id[key]) && !h.includes(N[key]);
  const shownAgain = await api('/api/admin/item', { action: 'update', id: id.PH, patch: { listed: true } });
  const b = await waitPublic((h) => same(publicPairs(h, id.A), [id.P1, id.PH, id.P2]));
  const inSeason = await api('/api/admin/item', { action: 'update', id: id.PS, patch: { seasons: [] } });
  const c = await waitPublic((h) => same(publicPairs(h, id.A), list));
  await api('/api/admin/item', { action: 'update', id: id.PH, patch: { listed: false } }); await api('/api/admin/item', { action: 'update', id: id.PS, patch: { seasons: [offSeason] } });
  const d = await waitPublic((h) => same(publicPairs(h, id.A), [id.P1, id.P2]));
  check('public-shown-in-season', a.ok && absent(a.html, 'PH') && absent(a.html, 'PS') && same(await pairsOf(id.A), list) && shownAgain.status === 200 && b.ok && inSeason.status === 200 && c.ok && d.ok,
    `the list holds a shown item, a hidden one, one out of season (${offSeason} only) and another shown one: the public popup lists the two shown ones only, in their order (${a.ok}), the hidden and the out-of-season item nowhere on the page (${absent(a.html, 'PH')}, ${absent(a.html, 'PS')}), the list itself unchanged in the database; shown again, the hidden one is listed in its place (${b.ok}); with its season off, the other too (${c.ok}); hidden and out of season again, both are left out again (${d.ok})`);
  const styles = (h) => (h.match(/<style id="pairs-style"/g) || []).length, pairsIn = (h) => (h.match(/data-pair="/g) || []).length;
  const withPairs = d.html; await setPairs(id.A, []);
  const none = await waitPublic((h) => same(publicPairs(h, id.A), []));
  const venues = []; for (const v of [VENUE, OTHER]) { const h = await publicHtml(v); venues.push({ v, pairs: pairsIn(h), styles: styles(h), bytes: Buffer.byteLength(h) }); }
  check('style-only-with-pairs', styles(withPairs) === 1 && pairsIn(withPairs) > 0 && none.ok && venues.every((x) => (x.pairs > 0) === (x.styles === 1) && x.styles <= 1),
    `with a pair to show the page carries the block's style once (${styles(withPairs)} <style id="pairs-style">, ${pairsIn(withPairs)} pair rows in the popups' templates, each the paired item's id only); the drill's list emptied: ${venues.map((x) => `${x.v} ${x.pairs} pair rows and ${x.styles} such style`).join(', ')} (the style only where a pair is shown)`);

  // deleted through the admin: gone from the list, the other item at a new version, the record names the list for Undo
  await setPairs(id.A, [id.P1, id.P2, id.P3]);
  const before = (await db.query('select updated_at from items where id = $1', [id.A])).rows[0].updated_at;
  const del = await api('/api/admin/item', { action: 'delete', id: id.P2 });
  const listed = Number((await db.query('select count(*) as n from items where pairs @> array[$1::uuid]', [id.P2])).rows[0].n);
  const afterA = (await db.query('select pairs, updated_at from items where id = $1', [id.A])).rows[0];
  const pubGone = await waitPublic((h) => same(publicPairs(h, id.A), [id.P1, id.P3]) && !h.includes(id.P2));
  const rec = (await db.query(`select before->'paired_by' as lists from revisions where id = $1`, [del.json?.revisions?.[0] ?? 0])).rows[0];
  const sentA = (del.json?.items ?? []).find((x) => x.id === id.A);
  const undo = await api('/api/admin/undo', { venue: VENUE, revisions: del.json?.revisions ?? [] });
  const back = await pairsOf(id.A), exists = Number((await db.query('select count(*) as n from items where id = $1', [id.P2])).rows[0].n);
  const pubBack = await waitPublic((h) => same(publicPairs(h, id.A), [id.P1, id.P2, id.P3]));
  check('deleted-leaves-every-list', del.status === 200 && listed === 0 && same(afterA.pairs, [id.P1, id.P3]) && new Date(afterA.updated_at).getTime() !== new Date(before).getTime() && pubGone.ok
    && rec?.lists?.length === 1 && rec.lists[0].item_id === id.A && rec.lists[0].index === 1 && !!sentA && same(sentA.pairs, [id.P1, id.P3]) && sentA.updated_at === new Date(afterA.updated_at).toISOString(),
    `“${N.P2}” deleted in the admin (${del.status}): no list names it any more (${listed}), “${N.A}” keeps the other two in order and has a new version, the public popup lists the two and the deleted item is nowhere on the page (${pubGone.ok}); the answer carries “${N.A}” as it is now (${!!sentA}, its version the database's: ${sentA?.updated_at === new Date(afterA.updated_at).toISOString()}); the delete's record keeps the list it was in and its place there (${JSON.stringify(rec?.lists)})`);
  check('delete-undone', undo.status === 200 && exists === 1 && same(back, [id.P1, id.P2, id.P3]) && pubBack.ok,
    `Undo of the delete (${undo.status}): the item is back (${exists}) and back in the list at its place (${same(back, [id.P1, id.P2, id.P3])}), on the public popup too (${pubBack.ok})`);
  // deleted by plain SQL (any path): the database's own rule
  await make('T', last, 2);
  await setPairs(id.A, [id.P1, id.T, id.P3]);
  const v0 = (await db.query('select updated_at from items where id = $1', [id.A])).rows[0].updated_at;
  await db.query('delete from items where id = $1', [id.T]);
  const v1 = (await db.query('select pairs, updated_at from items where id = $1', [id.A])).rows[0];
  const dangling = Number((await db.query(`select count(*) as n from items i, unnest(i.pairs) as p(id) where not exists (select 1 from items x where x.id = p.id)`)).rows[0].n);
  check('deleted-by-sql', same(v1.pairs, [id.P1, id.P3]) && new Date(v1.updated_at).getTime() !== new Date(v0).getTime() && dangling === 0,
    `an item of the list deleted straight in the database (no admin code): the list lost it by the database's own rule (${same(v1.pairs, [id.P1, id.P3])}), the listing item has a new version, and no list in the database names an item that does not exist (${dangling})`);
  await api('/api/admin/publish', { venue: VENUE });
}

// ---- 3. customers: the popup in English and Persian, the tap, the photos, 360 px
const FOUR = [id.P1, id.P2, id.P3, id.P4];
{
  await setPairs(id.A, FOUR); await setPairs(id.P1, [id.A]); // P1 lists the item back (its own, separate list): a pair followed there and back
  const ready = await waitPublic((h) => same(publicPairs(h, id.A), FOUR) && same(publicPairs(h, id.P1), [id.A]));
  log('public', `the item lists the four shown pairs (the second without a photo or a Persian name, the third with two sizes, the fourth with a long name): on the public page ${ready.ok ? `after ${ready.ms} ms` : 'NOT within the wait'}`);
  const expect = { en: { [id.P1]: [N.P1, money(6.5)], [id.P2]: [N.P2, money(7)], [id.P3]: [N.P3, `Small ${money(4)} · Large ${money(6)}`], [id.P4]: [N.P4, money(8.25)] },
    fa: { [id.P1]: [FA.P1, money(6.5)], [id.P2]: [N.P2, money(7)], [id.P3]: [FA.P3, `کوچک ${money(4)} · بزرگ ${money(6)}`], [id.P4]: [FA.P4, money(8.25)] } };
  // in the page: what the open popup shows; text is read as shown (the other language's spans are display: none)
  const READ = () => {
    const sheet = document.getElementById('sheet'), g = sheet.querySelector('#sheet-content [data-pairs]');
    const text = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);
    const rowPrice = (pid) => { const li = document.querySelector(`main li.item[data-id="${pid}"]`), line = li && li.querySelector('h3 + p'); if (!line) return null; const lang = document.documentElement.dataset.lang; let s = ''; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.textContent; else if (c.nodeType === 1 && !(c.getAttribute('lang') && c.getAttribute('lang') !== lang)) walk(c); } }; walk(line); return s.replace(/\s+/g, ' ').trim(); };
    return { open: sheet.open, title: text(sheet.querySelector('.sheet-title')), heading: g ? text(g.querySelector('h3')) : null, scrollTop: sheet.scrollTop, hero: sheet.querySelector('#sheet-hero img')?.getAttribute('src') ?? null,
      order: [...sheet.querySelectorAll('#sheet-content .sheet-group')].map((x) => text(x.querySelector('h3'))), last: g ? g === g.parentElement.lastElementChild : null,
      pairs: g ? [...g.querySelectorAll('li[data-pair]')].map((b) => ({ id: b.getAttribute('data-pair'), tag: b.children.length === 1 ? b.firstElementChild.tagName : `${b.children.length} children`, name: text(b.querySelector('.pair-name')), price: text(b.querySelector('.pair-price')), rowPrice: rowPrice(b.getAttribute('data-pair')), img: b.querySelector('img')?.getAttribute('src') ?? null })) : [] };
  };
  const visit = async (engine, lang, device = DEVICE) => {
    const ctx = await engine.newContext(device), page = await ctx.newPage(), requests = [], errors = [];
    page.on('request', (r) => requests.push(r.url())); page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/${VENUE}`); await page.click(`#welcome button[data-lang="${lang}"]`);
    await page.waitForFunction(() => document.documentElement.dataset.welcome === 'off', null, { timeout: 5000 });
    return { ctx, page, requests, errors };
  };
  const asked = (v, url) => v.requests.some((u) => u.endsWith(url));
  // the popup's groups, top to bottom: the item's own (its sizes, its choice group, its combo parts, the owner's notes), then the block
  const ORDER = { en: ['Sizes', 'Drill milk', 'Includes', 'Good to know', 'Goes well with'], fa: ['اندازه‌ها', 'شیر آزمون', 'شامل', 'نکات', 'پیشنهاد همراه'] };
  const openItem = async (page, pid) => { const li = page.locator(`main li.item[data-id="${pid}"]`).first(); await li.scrollIntoViewIfNeeded(); await li.click(); await page.waitForSelector('dialog#sheet[open] #sheet-content .sheet-title'); await sleep(450); };
  const tapPair = async (page, pid) => { const b = page.locator(`#sheet-content [data-pair="${pid}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); };

  for (const lang of ['en', 'fa']) {
    const v = await visit(browser, lang), { page } = v, E = expect[lang];
    const li = page.locator(`main li.item[data-id="${id.A}"]`).first(); await li.scrollIntoViewIfNeeded(); await sleep(600);
    const early = { asked: asked(v, P1_PHOTO), imgs: await page.evaluate(() => document.querySelectorAll('.pair img').length) };
    await openItem(page, id.A);
    const s = await page.evaluate(READ);
    await page.locator('#sheet-content [data-pairs]').scrollIntoViewIfNeeded(); await sleep(250); await snap(page, `public-popup-${lang}`);
    const photo = await (async () => { const t = Date.now(); while (Date.now() - t < 4000) { if (asked(v, P1_PHOTO)) return Date.now() - t; await sleep(50); } return null; })();
    const loaded = await page.evaluate((pid) => { const i = document.querySelector(`#sheet-content [data-pair="${pid}"] img`); return i ? { w: i.naturalWidth, box: `${Math.round(i.getBoundingClientRect().width)}×${Math.round(i.getBoundingClientRect().height)}` } : null; }, id.P1);
    const rows = s.pairs.map((x) => `${x.name} | ${x.price}${x.img ? ' | photo' : ''}`).join('; ');
    const okRows = same(s.pairs.map((x) => x.id), FOUR) && s.pairs.every((x) => x.tag === 'BUTTON' && x.name === E[x.id][0] && x.price === E[x.id][1] && x.price === x.rowPrice) // tag: each row holds one button && !!s.pairs[0].img && s.pairs[0].img.endsWith(P1_PHOTO) && s.pairs[1].img === null;
    check(`popup-${lang}`, s.open && s.heading === ORDER[lang][4] && s.last === true && same(s.order, ORDER[lang]) && okRows,
      `${lang === 'en' ? 'English' : 'Persian'}, iPhone 13 viewport: the item's popup shows its own groups first, then “${s.heading}” as the last group (${s.last}; top to bottom: ${s.order.join(' › ')}), with the four pairs in the order picked, each a button with its name in the page's language (the one without a Persian name in English) and its price exactly as its row in the menu shows it (${s.pairs.every((x) => x.price === x.rowPrice)}; the one with sizes: “${s.pairs[2]?.price}”), a photo where the item has one (the first: ${s.pairs[0]?.img ? 'shown' : 'MISSING'}; the second, which has none: ${s.pairs[1]?.img === null ? 'no image' : 'AN IMAGE'}): ${rows}`);
    if (lang === 'en') {
      check('photos-when-opened', early.asked === false && early.imgs === 0 && photo !== null && !!loaded && loaded.w > 0,
        `before any popup is opened, with the item's row on screen: the pair's photo not requested (${early.asked}) and no pair image in the page (${early.imgs}); once the item's popup is open it is requested (${photo === null ? 'NOT within 4 s' : `${photo} ms after`}) and shown (${loaded ? `${loaded.w} px wide, drawn ${loaded.box}` : 'no image'})`);
    }
    // the tap: the paired item's own popup
    const len0 = await page.evaluate(() => history.length);
    const t1 = Date.now(); await tapPair(page, id.P1);
    const swapped = await page.waitForFunction((want) => document.querySelector('#sheet .sheet-title')?.innerText.trim() === want, E[id.P1][0], { timeout: 3000 }).then(() => Date.now() - t1).catch(() => null);
    await sleep(500);
    const t = await page.evaluate(READ), len1 = await page.evaluate(() => history.length);
    await snap(page, `public-tapped-${lang}`);
    // from the paired item back to the item through its own list, then Escape closes the popup
    await tapPair(page, id.A); await page.waitForFunction((want) => document.querySelector('#sheet .sheet-title')?.innerText.trim() === want, lang === 'en' ? N.A : FA.A, { timeout: 3000 }).catch(() => {});
    const u = await page.evaluate(READ), len2 = await page.evaluate(() => history.length);
    await page.keyboard.press('Escape');
    const closed = await page.waitForFunction(() => !document.getElementById('sheet').open, null, { timeout: 3000 }).then(() => true).catch(() => false);
    const url = page.url();
    check(`tap-${lang}`, swapped !== null && t.open && t.title === E[id.P1][0] && !!t.hero && t.hero.endsWith(P1_PHOTO) && t.scrollTop === 0 && same(t.pairs.map((x) => x.id), [id.A]) && len1 === len0
      && u.title === (lang === 'en' ? N.A : FA.A) && same(u.pairs.map((x) => x.id), FOUR) && len2 === len0 && closed && url === `${base}/${VENUE}` && v.errors.length === 0,
      `${lang === 'en' ? 'English' : 'Persian'}: a tap on the first pair opens that item's own popup (${swapped === null ? 'NOT within 3 s' : `${swapped} ms`}): its name “${t.title}”, its photo, at its top (scrolled ${t.scrollTop}), with its own list (the item, one-way lists both ways here); a tap there goes back to “${u.title}” with its four; the history is as long as before the taps (${len0} → ${len1} → ${len2}); Escape closes the popup (${closed}), the page still ${url.replace(base, '')}; ${v.errors.length} page or console errors${v.errors.length ? `: ${v.errors.slice(0, 2).join(' | ')}` : ''}`);
    if (lang === 'en' && swapped !== null) measure(`a tap on a pair: the paired item's popup up ${swapped} ms after the tap (iPhone 13 viewport, Chromium)`);
    await v.ctx.close();
  }
  { // WebKit (the stand-in for an iPhone's Safari): the photos and the tap
    const wk = await webkit.launch();
    try {
      const v = await visit(wk, 'en', devices['iPhone 13']), { page } = v;
      const li = page.locator(`main li.item[data-id="${id.A}"]`).first(); await li.scrollIntoViewIfNeeded(); await sleep(600);
      const early = asked(v, P1_PHOTO);
      await openItem(page, id.A);
      const s = await page.evaluate(READ);
      const photo = await (async () => { const t = Date.now(); while (Date.now() - t < 4000) { if (asked(v, P1_PHOTO)) return Date.now() - t; await sleep(50); } return null; })();
      await tapPair(page, id.P3);
      const swapped = await page.waitForFunction((want) => document.querySelector('#sheet .sheet-title')?.innerText.trim() === want, N.P3, { timeout: 3000 }).then(() => true).catch(() => false);
      await sleep(400); const t = await page.evaluate(READ);
      check('webkit', early === false && photo !== null && same(s.pairs.map((x) => x.id), FOUR) && s.heading === 'Goes well with' && swapped && t.open && t.scrollTop === 0 && v.errors.length === 0,
        `WebKit, iPhone 13 viewport: the pair's photo not requested before the popup is opened (${early}), requested once it is (${photo === null ? 'NOT within 4 s' : `${photo} ms after`}); the four pairs under “${s.heading}”; a tap on the third opens “${t.title}” at its top (${swapped}); ${v.errors.length} page or console errors${v.errors.length ? `: ${v.errors.slice(0, 2).join(' | ')}` : ''}`);
      await v.ctx.close();
    } finally { await wk.close(); }
  }
  { // a pair whose own row is a card of a Grid section (the row is read from the card the same way), when the venue has one
    const grid = (await db.query(`select i.id, i.name, i.price, i.variants, i.photo->>'url' as photo from items i join item_sections x on x.item_id = i.id join sections s on s.id = x.section_id
      where i.venue_id = $1 and i.listed and s.listed and s.layout = 'grid' and (case when s.seasonal then $2 = any(i.seasons) else (cardinality(i.seasons) = 0 or $2 = any(i.seasons)) end) and i.name->>'en' <> all($3)
      order by s.seasonal desc, s.position, x.position limit 1`, [VENUE, today, ALL_NAMES])).rows[0];
    if (!grid) log('grid', 'no shown item in a Grid section on this copy: the card case is not measured');
    else {
      await setPairs(id.A, [grid.id]); await waitPublic((h) => same(publicPairs(h, id.A), [grid.id]));
      const v = await visit(browser, 'en'); await openItem(v.page, id.A);
      const s = await v.page.evaluate(READ), card = await v.page.evaluate((gid) => document.querySelector(`main li.item[data-id="${gid}"]`)?.classList.contains('card') ?? null, grid.id);
      const want = grid.price != null ? money(grid.price) : grid.variants.map((x) => `${x.label.en} ${x.price != null ? money(x.price) : ''}`.trim()).join(' · ');
      check('pair-from-grid', card === true && s.pairs.length === 1 && s.pairs[0].tag === 'BUTTON' && s.pairs[0].name === grid.name.en && s.pairs[0].price === want && (grid.photo ? s.pairs[0].img === grid.photo : s.pairs[0].img === null) && v.errors.length === 0,
        `a pair whose row in the menu is a card of a Grid section (“${grid.name.en}”, a card: ${card}): shown with its name “${s.pairs[0]?.name}”, its price “${s.pairs[0]?.price}” (the menu's: “${want}”) and ${grid.photo ? `its photo (${s.pairs[0]?.img === grid.photo})` : 'no photo'}; ${v.errors.length} page or console errors`);
      await v.ctx.close(); await setPairs(id.A, FOUR); await waitPublic((h) => same(publicPairs(h, id.A), FOUR));
    }
  }
  { // 360 px: nothing of the block past the popup's edges, cut short or scrolling sideways, in both languages
    const CLIP = () => {
      const sheet = document.getElementById('sheet'), g = sheet.querySelector('#sheet-content [data-pairs]'), sr = sheet.getBoundingClientRect(), found = [];
      const desc = (el) => `${el.tagName.toLowerCase()}.${el.className || ''} "${(el.textContent || '').trim().slice(0, 24)}"`;
      if (sheet.scrollWidth > sheet.clientWidth + 1) found.push('the popup scrolls sideways');
      if (document.documentElement.scrollWidth > innerWidth + 1) found.push('the page is wider than the screen');
      for (const el of [g, ...g.querySelectorAll('*')]) {
        const st = getComputedStyle(el), r = el.getBoundingClientRect();
        if (st.display === 'none' || r.width < 1 || r.height < 1) continue;
        if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5) found.push(`past the popup's edge: ${desc(el)}`);
        if (/(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1) found.push(`scrolls sideways: ${desc(el)}`);
        const hides = st.overflowX !== 'visible' || st.textOverflow === 'ellipsis' || +st.webkitLineClamp > 0;
        if (hides && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) found.push(`text cut short: ${desc(el)}`);
      }
      const rows = [...g.querySelectorAll('[data-pair]')].map((b) => {
        const br = b.getBoundingClientRect(), t = b.querySelector('.pair-text').getBoundingClientRect(), i = b.querySelector('img')?.getBoundingClientRect() ?? null, name = b.querySelector('.pair-name');
        const lines = Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight));
        return { h: Math.round(br.height), w: Math.round(br.width), lines, img: i ? `${Math.round(i.width)}×${Math.round(i.height)}` : null, apart: i ? (t.right <= i.left + 0.5 || i.right <= t.left + 0.5) : true };
      });
      return { width: innerWidth, sheet: Math.round(sr.width), found, rows };
    };
    const out360 = [];
    for (const lang of ['en', 'fa']) {
      const v = await visit(browser, lang, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await openItem(v.page, id.A); await v.page.locator('#sheet-content [data-pairs]').scrollIntoViewIfNeeded(); await sleep(700);
      const m = await v.page.evaluate(CLIP); out360.push({ lang, ...m }); await snap(v.page, `public-popup-360-${lang}`); await v.ctx.close();
    }
    const fine = (m) => m.width === 360 && m.found.length === 0 && m.rows.length === 4 && m.rows.every((r) => r.h >= 44 && r.apart && (r.img === null || r.img === '56×56')) && m.rows[3].lines >= 2;
    check('public-360', out360.every(fine), out360.map((m) => `${m.lang === 'en' ? 'English' : 'Persian'} at ${m.width} px: ${m.found.length ? m.found.slice(0, 3).join('; ') : 'nothing past the popup\'s edges, cut short or scrolling sideways'}; the four rows ${m.rows.map((r) => `${r.w}×${r.h}${r.img ? ` photo ${r.img}` : ''}`).join(', ')} (each 44 px tall at least, the text clear of the photo: ${m.rows.every((r) => r.apart)}), the long name on ${m.rows[3]?.lines} lines`).join(' | '));
  }
}

// ---- 4. the admin on a phone: the card, the picker, four and no fifth
let taps = 0; const tap = async (page, sel) => { taps++; await page.click(sel); };
const openEditor = async (page, name) => {
  if (await page.locator('.item-panel').count()) { await page.locator('.item-panel [data-back]').click(); await page.waitForSelector('.item-panel', { state: 'detached', timeout: 5000 }).catch(() => {}); }
  await page.fill('input[aria-label="Search items"]', name);
  const b = page.locator(`[data-item] button[aria-label="Edit ${name}"]`).first(); await b.scrollIntoViewIfNeeded(); await b.click();
  await page.waitForSelector(`.item-panel[aria-label="Edit ${name}"]`); await sleep(350);
};
const PICKER = '[role=dialog][aria-label^="Goes well with"]';
// the toast rule (the PM, 2026-11-19): what lies under the toast and its strip while it shows (scripts/layout-rules.mjs UNDER_TOAST)
const underToast = async (page) => { await page.waitForSelector('.toast', { timeout: 4000 }).catch(() => {}); await sleep(300); return page.evaluate(UNDER_TOAST); };
const toastSeen = [];
const card = (page) => page.evaluate(() => { const c = document.querySelector('.item-panel [data-pairs]'); return c ? { rows: [...c.querySelectorAll('[data-pair-row]')].map((r) => ({ id: r.getAttribute('data-pair-row'), why: r.querySelector('[data-pair-why]')?.textContent ?? null })), count: c.querySelector('[data-pairs-count]')?.textContent ?? null, add: !!c.querySelector('[data-pairs-add]'), full: !!c.querySelector('[data-pairs-full]'), below: c.previousElementSibling?.hasAttribute('data-choices') ? 'choices' : c.previousElementSibling?.hasAttribute('data-price-choices') ? 'price' : (c.previousElementSibling?.tagName ?? null), aboveWhere: c.nextElementSibling?.hasAttribute('data-where') ?? false, heading: c.querySelector('h3')?.textContent ?? null } : null; });
{
  await setPairs(id.A, []); await setPairs(id.P1, []);
  await p.reload(); await p.waitForSelector('[data-item]');
  await openEditor(p, N.A);
  const empty = await card(p);
  await p.locator('.item-panel [data-pairs]').scrollIntoViewIfNeeded(); await snap(p, 'editor-0-pairs');
  // the picker: what it offers
  await p.click('.item-panel [data-pairs-add]'); await p.waitForSelector(PICKER); await sleep(300);
  const offered = await p.evaluate(() => [...document.querySelectorAll('[data-pair-pick]')].map((b) => ({ id: b.getAttribute('data-pair-pick'), label: b.querySelector('[data-pair-label]')?.textContent ?? null, section: b.closest('[data-pair-section]')?.getAttribute('data-pair-section') ?? null })));
  const venueIds = new Set((await db.query('select id from items where venue_id = $1', [VENUE])).rows.map((r) => r.id)), otherIds = new Set((await db.query('select id from items where venue_id = $1', [OTHER])).rows.map((r) => r.id));
  const ids = new Set(offered.map((o) => o.id)), labelOf = (key) => offered.find((o) => o.id === id[key])?.label ?? null;
  const missing = [...venueIds].filter((x) => x !== id.A && !ids.has(x)), foreign = [...ids].filter((x) => otherIds.has(x) || !venueIds.has(x));
  const sections = [...new Set(offered.map((o) => o.section))];
  await snap(p, 'picker');
  check('picker-offers', empty?.heading === 'Goes well with' && empty.below === 'choices' && empty.aboveWhere && empty.rows.length === 0 && empty.count === `0 of ${MAX}` && empty.add && !ids.has(id.A) && foreign.length === 0 && missing.length === 0 && labelOf('PH') === 'Hidden' && labelOf('PS') === 'Out of season' && labelOf('P1') === null && sections.includes(last.name),
    `the card “${empty?.heading}” below PRICE and the item's choices (directly after: ${empty?.below}) and above Appears in (${empty?.aboveWhere}), with “${empty?.count}” beside + Add item; the picker lists ${ids.size} items in ${sections.length} sections: every item of ${VENUE} but the item itself (${missing.length} missing, the item itself offered: ${ids.has(id.A)}), none of ${OTHER} (${foreign.length}); the hidden one is listed and labelled “${labelOf('PH')}”, the out-of-season one “${labelOf('PS')}”, a shown one has no label`);
  await p.locator(`${PICKER} button[aria-label="Close"]`).last().click(); await p.waitForSelector(PICKER, { state: 'detached', timeout: 5000 });
  // four through the picker, with the taps counted; the first found with the search field
  taps = 0;
  const said = [];
  for (const [n, key] of [[1, 'P1'], [2, 'P2'], [3, 'PH'], [4, 'P4']]) {
    await tap(p, '.item-panel [data-pairs-add]');
    await p.waitForSelector(PICKER);
    if (n === 1) { await p.fill(`${PICKER} input[type=search]`, 'pair one'); await sleep(150); said.push(`search “pair one” → ${await p.locator('[data-pair-pick]').count()} row`); }
    const row = p.locator(`[data-pair-pick="${id[key]}"]`).first(); await row.scrollIntoViewIfNeeded(); taps++; await row.click();
    await p.waitForSelector(PICKER, { state: 'detached', timeout: 5000 });
    const saved = await waitDb('select pairs from items where id = $1', [id.A], (r) => r?.pairs?.length === n);
    const c = await card(p); said.push(`${n}: ${c?.rows.length} rows, “${c?.count}”${saved.ok ? '' : ' (NOT saved)'}`);
  }
  const full = await card(p), picked = [id.P1, id.P2, id.PH, id.P4], saved = await pairsOf(id.A);
  toastSeen.push(['390 × 664, the fourth just added', await underToast(p)]);
  await p.locator('.item-panel [data-pairs]').scrollIntoViewIfNeeded(); await sleep(300); await snap(p, 'editor-4-pairs');
  const fifth = await setPairs(id.A, [...picked, id.P3]);
  check('four-then-no-more', same(saved, picked) && same(full?.rows.map((r) => r.id), picked) && full.count === `${MAX} of ${MAX}` && !full.add && full.full && full.rows[2].why === 'Hidden' && full.rows[0].why === null && fifth.status === 400 && same(await pairsOf(id.A), picked),
    `four added through the picker on the iPhone 13 viewport, ${taps} taps (+ Add item and the item, four times; ${said.join('; ')}): the card lists them in the order picked, as the database holds them (${same(saved, picked)}), “${full?.count}”, the add button gone (${!full?.add}) with a line in its place; the hidden one is in the list, marked “${full?.rows[2]?.why}”; a fifth sent to the route is refused (${fifth.status})`);
  measure(`add four items under Goes well with on the iPhone 13 viewport: ${taps} taps (2 each: + Add item, the item)`);
  // remove one, add it again: it lands last; the picker shows the ones in the list as Added
  await p.click(`.item-panel [data-pair-row="${id.P2}"] button[aria-label^="Remove"]`);
  const three = await waitDb('select pairs from items where id = $1', [id.A], (r) => r?.pairs?.length === 3);
  const c3 = await card(p);
  toastSeen.push(['390 × 664, one just removed', await underToast(p)]);
  await p.click('.item-panel [data-pairs-add]'); await p.waitForSelector(PICKER);
  await sleep(350); toastSeen.push(['390 × 664, the picker opened while it shows', await underToast(p)]);
  const added = await p.evaluate((pid) => { const b = document.querySelector(`[data-pair-pick="${pid}"]`); return b ? { label: b.querySelector('[data-pair-label]')?.textContent ?? null, disabled: b.disabled } : null; }, id.P1);
  await p.locator(`[data-pair-pick="${id.P2}"]`).first().scrollIntoViewIfNeeded(); await p.locator(`[data-pair-pick="${id.P2}"]`).first().click(); await p.waitForSelector(PICKER, { state: 'detached', timeout: 5000 });
  const again = await waitDb('select pairs from items where id = $1', [id.A], (r) => r?.pairs?.length === 4);
  const want = [id.P1, id.PH, id.P4, id.P2];
  check('remove-add-again', three.ok && c3?.count === `3 of ${MAX}` && c3.add && added?.label === 'Added' && added.disabled === true && again.ok && same(again.row?.pairs, want) && same((await card(p))?.rows.map((r) => r.id), want),
    `the second removed: “${c3?.count}” and + Add item is back (${c3?.add}); in the picker an item already in the list is shown as “${added?.label}” and cannot be picked (${added?.disabled}); the removed one added again lands last (${same(again.row?.pairs, want)}): the order is the order picked`);
}
{ // nothing clipped at 360 px in the admin: the card with four (one with the long name), and the picker
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }); const q = await ctx.newPage();
  q.on('pageerror', (e) => log('pageerror', e.message));
  await signin(q); await openEditor(q, N.A);
  await q.locator('.item-panel [data-pairs]').scrollIntoViewIfNeeded(); await sleep(400);
  const m1 = await q.evaluate(LAYOUT); await snap(q, 'editor-360');
  await q.click(`.item-panel [data-pair-row="${id.P2}"] button[aria-label^="Remove"]`); await waitDb('select pairs from items where id = $1', [id.A], (r) => r?.pairs?.length === 3);
  toastSeen.push(['360 px, one just removed', await underToast(q)]);
  await q.waitForSelector('.item-panel [data-pairs-add]'); await q.click('.item-panel [data-pairs-add]'); await q.waitForSelector(PICKER);
  await q.locator(`[data-pair-pick="${id.P4}"]`).first().scrollIntoViewIfNeeded(); await sleep(400);
  toastSeen.push(['360 px, the picker opened while it shows', await underToast(q)]);
  const m2 = await q.evaluate(LAYOUT); await snap(q, 'picker-360');
  const bad = (m) => [...m.found, ...m.sizes.filter((x) => !SIZES.includes(x)).map((x) => `text ${x}`), ...m.radii.filter((x) => x !== RADIUS).map((x) => `radius ${x}`)];
  check('admin-360', bad(m1).length === 0 && bad(m2).length === 0, `360 px phone, the admin's layout rules (scripts/layout-rules.mjs) on the item editor with four pairs, one with an 84-character name: ${bad(m1).length ? bad(m1).slice(0, 3).join('; ') : 'nothing past the edges, cut short or scrolling sideways, the admin\'s text sizes and one radius'}; with the picker open on that long name: ${bad(m2).length ? bad(m2).slice(0, 3).join('; ') : 'the same'}`);
  await ctx.close();
  // the toast rule where this feature shows a toast: with the editor open the toast sits in the strip kept free for it; with the picker
  // open it is at the top of the screen, over the dim
  const strip = (m) => (m.zone ? `in the editor's strip (${m.zone.top}–${m.zone.bottom} px)` : 'at the top, the sheet open');
  check('toast-nothing-under', toastSeen.length === 5 && toastSeen.every(([, m]) => m.toast && m.under.length === 0) && toastSeen.filter(([what]) => !what.includes('picker')).every(([, m]) => !!m.zone) && toastSeen.filter(([what]) => what.includes('picker')).every(([, m]) => !m.zone && m.toast.top < 100),
    `while a toast shows, no tappable control under it or its strip (a tap tried at every second pixel): ${toastSeen.map(([what, m]) => `${what} (${m.view}): ${m.toast ? `“${m.toast.text}” at ${m.toast.top}–${m.toast.bottom} px, ${strip(m)}, ${m.points} points, under it: ${m.under.length ? m.under.slice(0, 3).join('; ') : 'none'}` : 'NO TOAST SEEN'}`).join(' | ')}`);
}
{ // Duplicate copies the list; the copy is in nobody's list
  await setPairs(id.A, [id.P1, id.P2, id.P3]);
  const d = await api('/api/admin/item', { action: 'duplicate', id: id.A }), copy = d.json?.item;
  const copyPairs = copy ? await pairsOf(copy.id) : null, listing = copy ? Number((await db.query('select count(*) as n from items where pairs @> array[$1::uuid]', [copy.id])).rows[0].n) : -1;
  const undo = await api('/api/admin/undo', { venue: VENUE, revisions: d.json?.revisions ?? [] });
  const gone = copy ? Number((await db.query('select count(*) as n from items where id = $1', [copy.id])).rows[0].n) : -1;
  check('duplicate-copies', d.status === 200 && !!copy && copy.name?.en === `${N.A} (copy)` && same(copyPairs, [id.P1, id.P2, id.P3]) && same(copy.pairs, [id.P1, id.P2, id.P3]) && listing === 0 && undo.status === 200 && gone === 0,
    `Duplicate (${d.status}): “${copy?.name?.en}” has the same list in the same order (${same(copyPairs, [id.P1, id.P2, id.P3])}) and is in no item's list (${listing}); Undo removes the copy (${undo.status}, left ${gone})`);
}

// ---- 5. the admin on a laptop: the preview shows the popup with the list; deleting a listed item keeps the editor in step
{
  await setPairs(id.A, [id.P1]);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const q = await ctx.newPage();
  q.on('pageerror', (e) => log('pageerror', e.message));
  await signin(q); await openEditor(q, N.A);
  await q.waitForSelector('iframe[data-preview-frame]'); await q.waitForLoadState('networkidle').catch(() => {}); await sleep(500); // the preview's first load done (its linked photos), as the editor drill's preview check waits
  const frame = () => q.frameLocator('iframe[data-preview-frame]');
  const len0 = await q.evaluate(() => history.length);
  await q.click('.item-panel [data-pairs-add]'); await q.waitForSelector(PICKER);
  const row = q.locator(`[data-pair-pick="${id.P3}"]`).first(); await row.scrollIntoViewIfNeeded();
  await row.click();
  // typing in the Menu list's search field while the preview reloads and opens the popup: every key must land in the field
  const search = q.locator('input[aria-label="Search items"]'); await search.click(); await search.fill(''); await search.pressSequentially('drill pairs', { delay: 110 });
  const shown = await frame().locator(`dialog#sheet[open] #sheet-content [data-pair="${id.P3}"]`).waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  const typed = await search.inputValue(), active = await q.evaluate(() => `${document.activeElement?.tagName}${document.activeElement?.getAttribute('aria-label') ? ` [${document.activeElement.getAttribute('aria-label')}]` : ''}`);
  const inFrame = await frame().locator('dialog#sheet[open]').evaluate((s) => ({ title: s.querySelector('.sheet-title')?.innerText.trim(), pairs: [...s.querySelectorAll('[data-pair]')].map((b) => b.getAttribute('data-pair')), inView: (() => { const g = s.querySelector('[data-pairs]').getBoundingClientRect(), r = s.getBoundingClientRect(); return g.top >= r.top && g.bottom <= r.bottom + 1; })() })).catch(() => null);
  const len1 = await q.evaluate(() => history.length);
  await snap(q, 'laptop-preview');
  // timed on its own: a removal, from the tap to the popup in the fresh frame without the removed pair
  await q.click(`.item-panel [data-pair-row="${id.P3}"] button[aria-label^="Remove"]`); const t2 = Date.now();
  const refreshed = await frame().locator(`dialog#sheet[open] #sheet-content [data-pairs]:not(:has([data-pair="${id.P3}"]))`).waitFor({ state: 'visible', timeout: 8000 }).then(() => Date.now() - t2).catch(() => null);
  check('preview-shows-popup', shown && inFrame?.title === N.A && same(inFrame.pairs, [id.P1, id.P3]) && inFrame.inView && typed === 'drill pairs' && /^INPUT \[Search items\]$/.test(active) && len1 === len0 && refreshed !== null,
    `laptop: an item picked in the editor → the preview shows the item's own popup (“${inFrame?.title}”) with the list in it, in view (${inFrame?.inView}), ${shown ? 'while the drill typed elsewhere' : 'NOT within 8 s'}; the text typed in the Menu list's search field while the preview reloaded and opened the popup is whole (“${typed}”) and the focus is still there (${active}); the admin page's history is as long as before (${len0} → ${len1}); a pair removed → the popup in the fresh frame without it ${refreshed === null ? 'NOT within 8 s' : `${refreshed} ms after the tap`}`);
  if (refreshed !== null) measure(`Goes well with in the preview: a pair removed in the editor → the item's popup in the preview without it ${refreshed} ms after the tap (laptop)`);
  // delete a listed item in the admin: the list on screen loses it, and the next save of the listing item goes through (its new version is held)
  await setPairs(id.A, [id.P1, id.P4]); await q.reload(); await q.waitForSelector('[data-item]');
  await openEditor(q, N.P4);
  await q.locator('.item-panel button:has-text("Delete item")').scrollIntoViewIfNeeded(); await q.click('.item-panel button:has-text("Delete item")');
  await q.waitForSelector('[role=dialog][aria-label="Delete this item?"]'); await q.click('[role=dialog][aria-label="Delete this item?"] button:has-text("Delete")');
  await q.waitForSelector('.item-panel', { state: 'detached', timeout: 5000 }).catch(() => {});
  const delOk = await waitDb('select count(*) as n from items where id = $1', [id.P4], (r) => Number(r.n) === 0);
  await openEditor(q, N.A);
  const after = await card(q);
  await q.click('.item-panel [data-pairs-add]'); await q.waitForSelector(PICKER);
  await q.locator(`[data-pair-pick="${id.P2}"]`).first().scrollIntoViewIfNeeded(); await q.locator(`[data-pair-pick="${id.P2}"]`).first().click();
  const saved = await waitDb('select pairs from items where id = $1', [id.A], (r) => same(r?.pairs, [id.P1, id.P2]), 5000);
  const errorToast = await q.locator('.toast[data-toast-error]').count();
  check('delete-keeps-editor-in-step', delOk.ok && same(after?.rows.map((r) => r.id), [id.P1]) && saved.ok && errorToast === 0,
    `a listed item deleted in the admin (${delOk.ok}): the listing item's card shows the list without it (${same(after?.rows.map((r) => r.id), [id.P1])}) and its next save, another pair added, goes through (${saved.ok}; ${errorToast} error toast): the editor holds the item's new version`);
  await ctx.close();
}
} catch (e) { check('drill-completed', false, `the drill stopped: ${e.message.split('\n')[0]}`); log('error', e.stack || e.message); }

// ---- the end: the drill's items removed, the public page without them
await cleanup();
const pub = await api('/api/admin/publish', { venue: VENUE });
const clean = await waitPublic((h) => !Object.values(N).some((n) => h.includes(n)));
const left = Number((await db.query(`select count(*) as n from items where venue_id = $1 and name->>'en' = any($2)`, [VENUE, ALL_NAMES])).rows[0].n);
const dangling = Number((await db.query(`select count(*) as n from items i, unnest(i.pairs) as p(id) where not exists (select 1 from items x where x.id = p.id)`)).rows[0].n);
check('cleaned-up', left === 0 && clean.ok && dangling === 0, `the drill's items removed (${left} left), the public page regenerated without them (${pub.status}, ${clean.ok}); no list in the database names an item that does not exist (${dangling})`);
await browser.close(); await db.end();
const pass = results.every((r) => r.ok);
await fs.writeFile(path.join(out, 'pairs-drill.json'), JSON.stringify({ base, at: new Date().toISOString(), pass, results, measures, transcript }, null, 2));
await fs.writeFile(path.join(out, 'pairs-drill.txt'), [`Goes well with drill ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)`, '', 'Measurements:', ...measures.map((m) => `- ${m}`), '', ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.step}: ${r.text}`), '', 'Transcript:', ...transcript.map((l) => `${l.at} [${l.step}] ${l.text}`)].join('\n') + '\n');
console.log(`PAIRS DRILL ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length})`);
process.exit(pass ? 0 : 1);
