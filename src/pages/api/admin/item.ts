// Items, JSON (the page editor). Every action answers { ok, revisions: [record ids], item? } and regenerates the public page.
//   create  { action:'create', venue, section_id, name:{en,fa}, price, photo_url }   shown when it has a price
//   update  { action:'update', id, patch:{ name, description, price, variants, add_ons, components, serves, photo:{url,alt}, listed, section_ids } }
//   notes   { action:'notes', id, notes }                                            owner or admin only (403)
//   move    { action:'move', id, section_id, index }                                 order within one section
//   delete  { action:'delete', id }
import { jsonRoute, ApiError, revalidateVenue, biOf, moneyOf, boolOf, idOf, str, photoOf, type JsonBody } from '@/lib/admin/api';
import { canEditNotes, canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createItem, deleteItem, editorItem, getItem, moveItem, updateItem, type ItemPatch, type Notes } from '@/lib/admin/items';
import type { AddOn, Component, Variant } from '@/lib/types';

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

function readPatch(p: JsonBody): ItemPatch {
  const out: ItemPatch = {};
  if ('name' in p) { out.name = biOf(p.name); if (!out.name.en) throw new ApiError(400, 'The English name is required'); }
  if ('description' in p) out.description = biOf(p.description);
  if ('price' in p) out.price = moneyOf(p.price);
  if ('serves' in p) out.serves = str(p.serves);
  if ('listed' in p) out.listed = boolOf(p.listed);
  if ('variants' in p) out.variants = arr(p.variants).map((r): Variant => ({ label: biOf(r.label), price: moneyOf(r.price) })).filter((v) => v.label.en || v.label.fa);
  if ('add_ons' in p) out.add_ons = arr(p.add_ons).map((r): AddOn => ({ group: biOf(r.group), label: biOf(r.label), price: moneyOf(r.price) ?? 0, required: boolOf(r.required) })).filter((a) => a.label.en || a.label.fa);
  if ('components' in p) out.components = arr(p.components).map((r): Component => ({ ...r, item_id: str(r.item_id), label: biOf(r.label), qty: Math.max(1, Math.trunc(Number(r.qty) || 1)) })).filter((c) => c.label.en || c.label.fa);
  if ('photo' in p) { const ph = (p.photo && typeof p.photo === 'object' ? p.photo : {}) as JsonBody; out.photo = photoOf(ph.url, biOf(ph.alt)); }
  if ('section_ids' in p) out.section_ids = Array.isArray(p.section_ids) ? p.section_ids.map(idOf) : [];
  return out;
}

function readNotes(v: unknown): Notes {
  const n = (v && typeof v === 'object' ? v : {}) as JsonBody;
  const words = (x: unknown) => (Array.isArray(x) ? x.map(String) : String(x ?? '').split(',')).map((s) => s.trim()).filter(Boolean);
  return { allergens: words(n.allergens), dietary: words(n.dietary), halal: n.halal === true ? true : n.halal === false ? false : null, text: biOf(n.text) };
}

export default jsonRoute(async ({ res, session, body }) => {
  const by = byOf(session);
  if (body.action === 'create') {
    const venueId = str(body.venue) ?? ''; const sectionId = idOf(body.section_id);
    if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
    const name = biOf(body.name); if (!name.en) throw new ApiError(400, 'The name is required');
    const price = moneyOf(body.price);
    const r = await createItem(venueId, { name, price, photo: photoOf(body.photo_url, { en: name.en, fa: name.fa }), listed: price != null, section_ids: [sectionId] }, by);
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, venueId);
    return { revisions: [r.revision], item: await editorItem(r.id) };
  }
  const id = idOf(body.id);
  const item = await getItem(id);
  if (!item) throw new ApiError(404, 'item not found');
  if (!canEditVenue(session, item.venue_id)) throw new ApiError(403, 'no access to this venue');
  let r;
  if (body.action === 'update') r = await updateItem(id, readPatch((body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody), by);
  else if (body.action === 'notes') { if (!canEditNotes(session)) throw new ApiError(403, 'Allergen, dietary and halal notes are set by the owner or an admin only'); r = await updateItem(id, { notes: readNotes(body.notes) }, by); }
  else if (body.action === 'move') {
    const m = await moveItem(idOf(body.section_id), id, Number(body.index), by);
    if (!m.ok) throw new ApiError(400, m.error);
    await revalidateVenue(res, item.venue_id);
    return { revisions: m.revision ? [m.revision] : [], order: { section_id: body.section_id, item_ids: m.order } };
  }
  else if (body.action === 'delete') r = await deleteItem(id, by);
  else throw new ApiError(400, 'unknown action');
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, item.venue_id);
  return { revisions: r.revision ? [r.revision] : [], item: body.action === 'delete' ? null : await editorItem(id) };
});
