// Style tab, JSON (owner and admin; staff get 403 on both methods, checked by the suite).
//   GET  ?venue=<id>                       the template's declared options with the venue's current values
//   POST { action:'update', venue, patch }  saves the chosen values (one record on the venue; Undo works) and regenerates the page
import { jsonRoute, ApiError, revalidateVenue, str, type JsonBody } from '@/lib/admin/api';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { getVenueRow, updateVenue } from '@/lib/admin/venue';
import { readStylePatch, styleOf, templateOf } from '@/venues/styles';

export default jsonRoute(async ({ req, res, session, body }) => {
  if (!canManage(session)) throw new ApiError(403, 'the Style tab is for the owner and admins');
  const venue = await getVenueRow(str(body.venue) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  const template = templateOf(venue);
  if (req.method === 'GET') return { template: { id: template.id, name: template.name }, options: template.options(venue.brand), values: styleOf(venue), chosen: venue.style };
  if (body.action !== 'update') throw new ApiError(400, 'unknown action');
  const read = readStylePatch(venue, (body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody);
  if (!read.ok) throw new ApiError(400, read.error);
  const r = await updateVenue(venue.id, { style: { ...venue.style, ...read.values } }, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venue.id);
  const after = await getVenueRow(venue.id);
  return { revisions: r.revision ? [r.revision] : [], values: styleOf(after!), chosen: after!.style };
}, { get: true });
