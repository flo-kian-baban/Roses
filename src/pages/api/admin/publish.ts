// The customers' page regenerated again (pre-go-live audit H-13, the PM's fix batch of 2026-11-03): the editor's Try again when a save went
// through but the page did not update. { venue } → { ok, published }; anyone who can edit the venue.
import { jsonRoute, ApiError, revalidateVenue, str } from '@/lib/admin/api';
import { canEditVenue } from '@/lib/admin/auth';

export default jsonRoute(async ({ res, session, body }) => {
  const venueId = str(body.venue) ?? '';
  if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
  const published = await revalidateVenue(res, venueId);
  return { revisions: [], published };
});
