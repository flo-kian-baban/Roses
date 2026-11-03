// Items, JSON (the page editor). Every action answers { ok, revisions: [record ids], item? } and regenerates the public page.
//   create  { action:'create', venue, section_id, name:{en,fa}, price, photo:{url,key,width,height} | photo_url, seasons?, key? }   shown when it has a price;
//           key: the editor's key for this one "+ Add item" (D-05): sent again, it answers the item it already created (repeated: true)
//           added to the Seasonal section without seasons, it is tagged with the season of today in Toronto (Kian, 2026-10-12)
//   update  { action:'update', id, patch:{ name, description, price, variants, add_ons, components, serves, photo:{url,alt}, listed, section_ids, seasons } }
//           seasons: any of fall, winter, spring, summer (none = all year)
//   notes   { action:'notes', id, notes }                                            owner or admin only (403)
//   confirm { action:'confirm', id }   owner or admin only (403): the allergen and dietary notes drafted from research are confirmed as
//           they stand (Kian, 2026-10-12): their draft flags go, so the public popup shows them ("Contains: …"); one record, Undo puts them back
//   move    { action:'move', id, section_id, index }                                 order within one section
//   copy-choices { action:'copy-choices', id, group, targets: [ids] }   one choice group of item `id` copied to the target items (Kian via the
//           PM, 2026-10-13): a group of the same name is replaced, otherwise added; one record per item changed, one Undo for all
//   looks-good { action:'looks-good', id, field }   one field's draft flag cleared, its text unchanged (Kian, 2026-10-13: the Draft tag's
//           "Looks good" in the item editor): field 'description.en' (the research draft of the English description), 'name.fa',
//           'description.fa', 'variants', 'addOns', 'components' (the Persian drafts); one record, Undo puts the flag back. Allergen and
//           dietary drafts stay with Confirm (owner and admin only)
//   duplicate { action:'duplicate', id }   a hidden copy "<name> (copy)" in the same sections, right after the original (Kian, 2026-10-13);
//           one 'create' record (Undo removes it); answers the copy and the new order of each of its sections
//   delete  { action:'delete', id }
//   get     { action:'get', id }   the item as it is now (D-05)
import { jsonRoute, ApiError, refusal, revalidateVenue, arrOf, biOf, boolOf, idOf, idsOf, isObj, moneyOf, photoOf, str, textOf, type JsonBody } from '@/lib/admin/api';
import { canEditNotes, canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { copyChoices, createItem, deleteItem, duplicateItem, editorItem, getItem, moveItem, updateItem, type ItemPatch, type Notes } from '@/lib/admin/items';
import type { AddOn, Component, SeasonId, Variant } from '@/lib/types';
import { getSection } from '@/lib/admin/sections';
import { SEASON_IDS } from '@/lib/seasonal';
import { seasonNow } from '@/lib/welcome';
import { COUNTS, LIMITS } from '@/lib/rules';
import { pool } from '@/lib/db';

// "Looks good" (2026-10-13): which flag each field's Draft tag stands for
const LOOKS_GOOD: Record<string, { list: 'drafts' | 'fa_draft'; flag: string }> = {
  'description.en': { list: 'drafts', flag: 'description' }, 'name.fa': { list: 'fa_draft', flag: 'name' }, 'description.fa': { list: 'fa_draft', flag: 'description' },
  variants: { list: 'fa_draft', flag: 'variants' }, addOns: { list: 'fa_draft', flag: 'addOns' }, components: { list: 'fa_draft', flag: 'components' },
};

// Pre-go-live audit (the PM's fix batch, 2026-11-03): every field read strictly (S2-06: a wrong type is a 400 with the reason, never a
// silent change), held to its limit (S2-02: names 100, descriptions 500, labels 60; at most 20 sizes, 10 choice groups of 20, 20 combo
// parts) and cleaned (S2-03, S2-14); a combo part keeps only what it is (S2-01: the item it stands for, of this venue, its label and a
// quantity 1-99; before, every key sent was kept and one deeply nested value took the venue's editor down for everyone).
export function readSeasons(v: unknown): SeasonId[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && (SEASON_IDS as string[]).includes(x))) throw new ApiError(400, 'seasons: a list of fall, winter, spring, summer');
  return SEASON_IDS.filter((x) => v.includes(x));
}
function readSizes(v: unknown): Variant[] {
  return arrOf(v, 'Sizes', COUNTS.sizes).map((r): Variant => ({ label: biOf(r.label, 'A size\'s name', LIMITS.label), price: moneyOf(r.price, 'size price') })).filter((x) => x.label.en || x.label.fa);
}
function readChoices(v: unknown): AddOn[] {
  const rows = arrOf(v, 'Choices', COUNTS.groups * COUNTS.options).map((r): AddOn => ({
    group: biOf(r.group, 'A choice group\'s name', LIMITS.label), label: biOf(r.label, 'A choice', LIMITS.label), price: moneyOf(r.price, 'choice price') ?? 0,
    required: r.required === undefined ? false : boolOf(r.required, 'required'),
  })).filter((a) => a.label.en || a.label.fa);
  const groups = new Map<string, number>(); for (const a of rows) { const g = a.group.en ?? ''; groups.set(g, (groups.get(g) ?? 0) + 1); }
  if (groups.size > COUNTS.groups) throw new ApiError(400, `At most ${COUNTS.groups} choice groups`);
  for (const [g, n] of groups) if (n > COUNTS.options) throw new ApiError(400, `At most ${COUNTS.options} choices in a group (${g || 'Options'} has ${n})`);
  return rows;
}
async function readParts(v: unknown, venueId: string): Promise<Component[]> {
  const parts = arrOf(v, 'Combo parts', COUNTS.parts).map((r): Component => {
    const q = r.qty == null || r.qty === '' ? 1 : Number(r.qty);
    if (!Number.isInteger(q) || q < 1 || q > 99) throw new ApiError(400, 'A combo part\'s quantity is a whole number from 1 to 99');
    return { item_id: r.item_id == null || r.item_id === '' ? null : idOf(r.item_id), label: biOf(r.label, 'A combo part', LIMITS.label), qty: q };
  }).filter((c) => c.label.en || c.label.fa);
  const ids = [...new Set(parts.map((c) => c.item_id).filter((x): x is string => !!x))];
  if (ids.length) {
    const own = (await pool.query<{ id: string }>('select id from items where id = any($1) and venue_id = $2', [ids, venueId])).rows.length;
    if (own !== ids.length) throw new ApiError(400, 'A combo part must be an item of this venue');
  }
  return parts;
}

async function readPatch(p: JsonBody, item: { venue_id: string; photo: { url: string } | null }): Promise<ItemPatch> {
  const out: ItemPatch = {};
  if ('name' in p) { out.name = biOf(p.name, 'The name', LIMITS.name); if (!out.name.en) throw new ApiError(400, 'The English name is required'); }
  if ('description' in p) out.description = biOf(p.description, 'The description', LIMITS.description, { lines: true });
  if ('price' in p) out.price = moneyOf(p.price);
  if ('serves' in p) out.serves = textOf(p.serves, 'Serves', LIMITS.label);
  if ('listed' in p) out.listed = boolOf(p.listed, 'listed');
  if ('variants' in p) out.variants = readSizes(p.variants);
  if ('add_ons' in p) out.add_ons = readChoices(p.add_ons);
  if ('components' in p) out.components = await readParts(p.components, item.venue_id);
  if ('photo' in p) out.photo = photoOf(p.photo, { en: null, fa: null }, item.photo?.url ?? null);
  if ('section_ids' in p) out.section_ids = idsOf(p.section_ids, 'section_ids');
  if ('seasons' in p) out.seasons = readSeasons(p.seasons);
  return out;
}

function readNotes(v: unknown): Notes {
  if (!isObj(v)) throw new ApiError(400, 'notes: expected { allergens, dietary, halal, text }');
  const words = (x: unknown, what: string) => {
    const list = x == null ? [] : Array.isArray(x) ? x : typeof x === 'string' ? x.split(',') : null;
    if (!list || !list.every((w) => typeof w === 'string')) throw new ApiError(400, `${what}: expected a list of words`);
    const out = list.map((w) => w.trim()).filter(Boolean);
    if (out.length > 40 || out.some((w) => w.length > 40)) throw new ApiError(400, `${what}: too many or too long`);
    return out;
  };
  if (v.halal !== undefined && v.halal !== null && typeof v.halal !== 'boolean') throw new ApiError(400, 'halal: true, false or null');
  return { allergens: words(v.allergens, 'allergens'), dietary: words(v.dietary, 'dietary'), halal: v.halal === true ? true : v.halal === false ? false : null, text: biOf(v.text, 'The note', LIMITS.note, { lines: true }) };
}
// The editor's key for one "+ Add item" (D-05): letters, digits and dashes.
const keyOf = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null);

export default jsonRoute(async ({ res, session, body }) => {
  const by = byOf(session);
  if (body.action === 'create') {
    const venueId = str(body.venue) ?? ''; const sectionId = idOf(body.section_id);
    if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
    const name = biOf(body.name, 'The name', LIMITS.name); if (!name.en) throw new ApiError(400, 'The name is required');
    const price = moneyOf(body.price);
    const seasons = 'seasons' in body ? readSeasons(body.seasons) : (await getSection(sectionId))?.seasonal ? [seasonNow()] : [];
    const r = await createItem(venueId, { name, price, photo: photoOf(body.photo ?? body.photo_url, { en: name.en, fa: name.fa }), listed: price != null, section_ids: [sectionId], seasons }, by, keyOf(body.key));
    if (!r.ok) throw refusal(r);
    await revalidateVenue(res, venueId);
    return { revisions: [r.revision], item: await editorItem(r.id), ...(r.repeated ? { repeated: true } : {}) };
  }
  const id = idOf(body.id);
  const item = await getItem(id);
  if (!item) throw new ApiError(404, 'item not found');
  if (!canEditVenue(session, item.venue_id)) throw new ApiError(403, 'no access to this venue');
  // get (pre-go-live audit D-05): the item as it is now, read again after a save whose answer was lost, so the editor shows what the
  // server holds (the save may have gone through) instead of putting back its own older copy
  if (body.action === 'get') return { revisions: [], item: await editorItem(id) };
  let r;
  const base = str(body.base); // the version of the item the editor holds (D-03): a save over a newer change is refused with 409 and the item as it is now
  if (body.action === 'update') { if (!isObj(body.patch)) throw new ApiError(400, 'patch: expected an object'); r = await updateItem(id, await readPatch(body.patch, item), by, base); }
  else if (body.action === 'notes') { if (!canEditNotes(session)) throw new ApiError(403, 'Allergen, dietary and halal notes are set by the owner or an admin only'); r = await updateItem(id, { notes: readNotes(body.notes) }, by, base); }
  else if (body.action === 'confirm') { if (!canEditNotes(session)) throw new ApiError(403, 'Allergen and dietary notes are confirmed by the owner or an admin only'); r = await updateItem(id, { drafts: (item.drafts ?? []).filter((f) => f !== 'allergens' && f !== 'dietary') }, by); }
  else if (body.action === 'looks-good') {
    const f = LOOKS_GOOD[typeof body.field === 'string' ? body.field : ''];
    if (!f) throw new ApiError(400, 'unknown field');
    r = await updateItem(id, f.list === 'drafts' ? { drafts: (item.drafts ?? []).filter((x) => x !== f.flag) } : { fa_draft: item.fa_draft.filter((x) => x !== f.flag) }, by);
  }
  else if (body.action === 'duplicate') {
    const d = await duplicateItem(id, by);
    if (!d.ok) throw refusal(d);
    await revalidateVenue(res, item.venue_id);
    return { revisions: d.revision ? [d.revision] : [], item: await editorItem(d.id), orders: d.orders };
  }
  else if (body.action === 'move') {
    const m = await moveItem(idOf(body.section_id), id, Number(body.index), by);
    if (!m.ok) throw refusal(m);
    await revalidateVenue(res, item.venue_id);
    return { revisions: m.revision ? [m.revision] : [], order: { section_id: body.section_id, item_ids: m.order } };
  }
  else if (body.action === 'copy-choices') {
    const targets = idsOf(body.targets, 'targets');
    if (!targets.length) throw new ApiError(400, 'Pick at least one item');
    const c = await copyChoices(id, typeof body.group === 'string' ? body.group : '', targets, by);
    if (!c.ok) throw refusal(c);
    await revalidateVenue(res, item.venue_id);
    return { revisions: c.revisions, items: (await Promise.all(c.ids.map((x) => editorItem(x)))).filter(Boolean) };
  }
  else if (body.action === 'delete') r = await deleteItem(id, by);
  else throw new ApiError(400, 'unknown action');
  if (!r.ok) throw refusal(r, r.conflict ? { item: await editorItem(id) } : {});
  await revalidateVenue(res, item.venue_id);
  return { revisions: r.revision ? [r.revision] : [], item: body.action === 'delete' ? null : await editorItem(id) };
});
