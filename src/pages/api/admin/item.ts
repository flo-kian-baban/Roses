import { route, redirect, forbidden, revalidateVenue, bi, text, money, flag, list, rows, type Body } from '@/lib/admin/api';
import { canEditNotes, canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createItem, deleteItem, getItem, updateItem, type ItemPatch, type Notes } from '@/lib/admin/items';
import type { AddOn, Component, Variant } from '@/lib/types';

function readForm(b: Body): ItemPatch {
  const variants: Variant[] = rows(b, 'v', ['en', 'fa', 'price']).map((r) => ({ label: { en: r.en || null, fa: r.fa || null }, price: r.price === '' ? null : money({ p: r.price }, 'p') }));
  const add_ons: AddOn[] = rows(b, 'a', ['group_en', 'group_fa', 'en', 'fa', 'price', 'required']).map((r) => ({ group: { en: r.group_en || null, fa: r.group_fa || null }, label: { en: r.en || null, fa: r.fa || null }, price: money({ p: r.price }, 'p') ?? 0, required: r.required === 'on' || r.required === '1' }));
  const components: Component[] = rows(b, 'c', ['en', 'fa', 'qty', 'item_id']).map((r) => ({ item_id: r.item_id || null, label: { en: r.en || null, fa: r.fa || null }, qty: Math.max(1, Number(r.qty || 1) || 1) }));
  const photoUrl = text(b, 'photo_url');
  if (photoUrl && !/^https?:\/\/\S+$/i.test(photoUrl) && !photoUrl.startsWith('/')) throw new Error('the photo must be a web address (https://…)');
  const name = bi(b, 'name');
  if (!name.en) throw new Error('the English name is required');
  return {
    name, description: bi(b, 'description'), price: money(b, 'price'), variants, add_ons, components,
    serves: text(b, 'serves'), photo: photoUrl ? { url: photoUrl, alt: { en: text(b, 'photo_alt_en') ?? name.en, fa: text(b, 'photo_alt_fa') ?? name.fa } } : null,
    listed: flag(b, 'listed'), section_ids: list(b, 'section_ids'),
  };
}

function readNotes(b: Body): Notes {
  const halal = b.notes_halal === 'yes' ? true : b.notes_halal === 'no' ? false : null;
  return { allergens: list(b, 'notes_allergens'), dietary: list(b, 'notes_dietary'), halal, text: bi(b, 'notes_text') };
}

export default route({}, async ({ res, session, body, back }) => {
  const s = session!; const by = byOf(s);
  const action = body._action;
  if (action === 'create') {
    const venueId = body.venue;
    if (!canEditVenue(s, venueId)) return forbidden(res, 'no access to this venue');
    const r = await createItem(venueId, readForm(body) as ItemPatch & { name: { en: string; fa: string | null } }, by);
    if (!r.ok) return redirect(res, back, { error: r.error });
    await revalidateVenue(res, venueId);
    return redirect(res, `/admin/${venueId}/items/${r.id}`, { saved: '1' });
  }
  const item = await getItem(body.id);
  if (!item) return redirect(res, back, { error: 'item not found' });
  if (!canEditVenue(s, item.venue_id)) return forbidden(res, 'no access to this venue');
  let r;
  if (action === 'save') r = await updateItem(item.id, readForm(body), by);
  else if (action === 'list') r = await updateItem(item.id, { listed: true }, by);
  else if (action === 'unlist') r = await updateItem(item.id, { listed: false }, by);
  else if (action === 'notes') { if (!canEditNotes(s)) return forbidden(res, 'allergen, dietary and halal notes are set by the owner or an admin only'); r = await updateItem(item.id, { notes: readNotes(body) }, by); }
  else if (action === 'delete') { if (!flag(body, 'confirm')) return redirect(res, back, { error: 'tick "I am sure" to delete' }); r = await deleteItem(item.id, by); }
  else return redirect(res, back, { error: 'unknown action' });
  if (!r.ok) return redirect(res, back, { error: r.error });
  await revalidateVenue(res, item.venue_id);
  if (action === 'delete') return redirect(res, `/admin/${item.venue_id}`, { deleted: '1' });
  return redirect(res, back, { saved: '1' });
});
