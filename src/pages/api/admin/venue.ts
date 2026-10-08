// Venue, JSON (owner and admin; staff get 403):
//   update  { action:'update', id, patch:{ name, tagline, locations, showPersianDrafts, logo } }   the Details tab
//   create  { action:'create', name:{en,fa} }                                                    "+ Add venue" (default template)
//   GET ?id=<venue>                                                                              the details as the tab holds them
import { jsonRoute, ApiError, revalidateVenue, biOf, boolOf, str, type JsonBody } from '@/lib/admin/api';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createVenue, getVenueRow, updateVenue } from '@/lib/admin/venue';
import type { Location, Logo, Venue } from '@/lib/types';

const details = (v: Venue) => ({ id: v.id, name: v.name, tagline: v.tagline, locations: v.locations, logo: v.brand?.logo ?? null, settings: v.settings, template: v.template, style: v.style, brandColors: v.brand?.colors ?? {} });

export default jsonRoute(async ({ req, res, session, body }) => {
  if (!canManage(session)) throw new ApiError(403, 'venue details are edited by the owner or an admin');
  if (req.method === 'GET') {
    const v = await getVenueRow(str(body.id) ?? ''); if (!v) throw new ApiError(404, 'venue not found');
    if (!canEditVenue(session, v.id)) throw new ApiError(403, 'no access to this venue');
    return { revisions: [], venue: details(v) };
  }
  if (body.action === 'create') {
    const name = biOf(body.name); if (!name.en) throw new ApiError(400, 'The name is required');
    const r = await createVenue({ name, id: str(body.id) }, byOf(session));
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, r.id);
    return { revisions: [], venue: r.id };
  }
  const venue = await getVenueRow(str(body.id) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  if (body.action !== 'update') throw new ApiError(400, 'unknown action');
  const p = (body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody;
  const patch: Parameters<typeof updateVenue>[1] = {};
  if ('name' in p) { patch.name = biOf(p.name); if (!patch.name.en) throw new ApiError(400, 'The English name is required'); }
  if ('tagline' in p) patch.tagline = biOf(p.tagline);
  if ('showPersianDrafts' in p) patch.settings = { ...venue.settings, showPersianDrafts: boolOf(p.showPersianDrafts) };
  if ('logo' in p) {
    const o = (p.logo && typeof p.logo === 'object' ? p.logo : null) as JsonBody | null;
    let logo: Logo | null = null;
    if (o) {
      const url = str(o.url); const width = Number(o.width), height = Number(o.height);
      if (!url || !(url.startsWith('/uploads/') || url.startsWith('/brand/') || /^https?:\/\/\S+$/i.test(url))) throw new ApiError(400, 'the logo must be an uploaded file');
      if (!(width > 0 && height > 0)) throw new ApiError(400, 'the logo size could not be read; try a PNG or JPEG');
      logo = { url, width: Math.round(width), height: Math.round(height), key: str(o.key) };
    }
    patch.brand = { ...venue.brand, logo };
  }
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
    if (locs.some((l) => l.phone && !/^[\d\s()+\-.]{7,20}$/.test(l.phone))) throw new ApiError(400, 'a phone number can hold digits, spaces, (), + and - only');
    patch.locations = locs;
  }
  const r = await updateVenue(venue.id, patch, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venue.id);
  const after = await getVenueRow(venue.id);
  return { revisions: r.revision ? [r.revision] : [], venue: after && details(after) };
}, { get: true });
