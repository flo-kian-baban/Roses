// Venue details, JSON: { action:'update', id, patch:{ name, tagline, locations, showPersianDrafts } }, main admin only.
// The Details tab that uses it comes in step 2 of the admin rebuild; the route is here so the API is complete.
import { jsonRoute, ApiError, revalidateVenue, biOf, boolOf, idOf, str, type JsonBody } from '@/lib/admin/api';
import { isAdmin } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { getVenueRow, updateVenue } from '@/lib/admin/venue';
import type { Location } from '@/lib/types';
void idOf;

export default jsonRoute(async ({ res, session, body }) => {
  if (!isAdmin(session)) throw new ApiError(403, 'venue details are edited by the main admin');
  const venue = await getVenueRow(str(body.id) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (body.action !== 'update') throw new ApiError(400, 'unknown action');
  const p = (body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody;
  const patch: Parameters<typeof updateVenue>[1] = {};
  if ('name' in p) { patch.name = biOf(p.name); if (!patch.name.en) throw new ApiError(400, 'The English name is required'); }
  if ('tagline' in p) patch.tagline = biOf(p.tagline);
  if ('showPersianDrafts' in p) patch.settings = { ...venue.settings, showPersianDrafts: boolOf(p.showPersianDrafts) };
  if ('locations' in p) {
    const locs = (Array.isArray(p.locations) ? p.locations : []).map((l, i): Location => {
      const o = (l && typeof l === 'object' ? l : {}) as JsonBody; const prev = venue.locations[i];
      const loc: Location = { label: biOf(o.label), address: str(o.address), phone: str(o.phone), hours: biOf(o.hours) };
      if (prev?.confirm?.length && !boolOf(o.confirmed)) { // "to confirm" marks clear per field when it is edited, or for the location when confirmed
        const still = prev.confirm.filter((f) => (f === 'address' && loc.address === prev.address) || (f === 'phone' && loc.phone === prev.phone) || (f === 'hours' && loc.hours.en === prev.hours.en));
        if (still.length) loc.confirm = still;
      }
      return loc;
    });
    if (!locs.length) throw new ApiError(400, 'at least one location is needed');
    if (locs.some((l) => l.phone && !/^[\d\s()+\-.]{7,20}$/.test(l.phone))) throw new ApiError(400, 'a phone number can hold digits, spaces, (), + and - only');
    patch.locations = locs;
  }
  const r = await updateVenue(venue.id, patch, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venue.id);
  return { revisions: r.revision ? [r.revision] : [] };
});
