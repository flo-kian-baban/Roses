// Undo (the "Saved · Undo" toast): { venue, revisions: [record ids] } puts the rows back to how they were before those
// changes, newest first, and answers with the whole menu again so the editor shows the restored state.
import { jsonRoute, ApiError, revalidateVenue, str } from '@/lib/admin/api';
import { canEditVenue, isAdmin } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { getRevisions, undoRevisions } from '@/lib/admin/restore';
import { editorMenu } from '@/lib/admin/overview';

export default jsonRoute(async ({ res, session, body }) => {
  const venueId = str(body.venue) ?? '';
  if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
  const ids = (Array.isArray(body.revisions) ? body.revisions : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) throw new ApiError(400, 'nothing to undo');
  const revs = await getRevisions(ids);
  if (revs.length !== ids.length || revs.some((r) => r.venue_id !== venueId)) throw new ApiError(404, 'change record not found');
  if (revs.some((r) => r.table_name === 'venues' && r.action !== 'reorder') && !isAdmin(session)) throw new ApiError(403, 'venue details are edited by the main admin');
  const r = await undoRevisions(ids, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venueId);
  return { revisions: r.revisions, menu: await editorMenu(venueId) };
});
