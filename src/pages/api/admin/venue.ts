import { route, redirect, forbidden, revalidateVenue, bi, text, flag, rows } from '@/lib/admin/api';
import { isAdmin } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { getVenueRow, updateVenue } from '@/lib/admin/venue';
import type { Location } from '@/lib/types';

export default route({}, async ({ res, session, body, back }) => {
  const s = session!;
  if (!isAdmin(s)) return forbidden(res, 'venue details are edited by the main admin');
  const venue = await getVenueRow(body.id);
  if (!venue) return redirect(res, back, { error: 'venue not found' });
  const name = bi(body, 'name'); if (!name.en) return redirect(res, back, { error: 'the English name is required' });
  const locations: Location[] = rows(body, 'l', ['label_en', 'label_fa', 'address', 'phone', 'hours_en', 'hours_fa', 'confirmed']).map((r, i) => {
    const prev = venue.locations[i];
    const loc: Location = { label: { en: r.label_en || null, fa: r.label_fa || null }, address: r.address || null, phone: r.phone || null, hours: { en: r.hours_en || null, fa: r.hours_fa || null } };
    // "to confirm" marks: cleared for a field when it is edited, or for the whole location when ticked confirmed.
    if (prev?.confirm?.length && !(r.confirmed === 'on' || r.confirmed === '1')) {
      const still = prev.confirm.filter((f) => (f === 'address' && loc.address === prev.address) || (f === 'phone' && loc.phone === prev.phone) || (f === 'hours' && loc.hours.en === prev.hours.en));
      if (still.length) loc.confirm = still;
    }
    return loc;
  });
  if (!locations.length) return redirect(res, back, { error: 'at least one location is needed' });
  if (locations.some((l) => l.phone && !/^[\d\s()+\-.]{7,20}$/.test(l.phone))) return redirect(res, back, { error: 'a phone number can hold digits, spaces, (), + and - only' });
  const r = await updateVenue(venue.id, { name, tagline: bi(body, 'tagline'), locations, settings: { ...venue.settings, showPersianDrafts: flag(body, 'showPersianDrafts') } }, byOf(s));
  if (!r.ok) return redirect(res, back, { error: r.error });
  await revalidateVenue(res, venue.id);
  return redirect(res, back, { saved: '1' });
});
