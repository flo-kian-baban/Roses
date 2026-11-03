// Undo (the "Saved · Undo" toast): { venue, revisions: [record ids] } puts the rows back to how they were before those
// changes, newest first, and answers with the whole menu again so the editor shows the restored state.
import { jsonRoute, ApiError, revalidateVenue, str } from '@/lib/admin/api';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { changedSinceByOthers, getRevisions, undoRevisions } from '@/lib/admin/restore';
import { editorMenu } from '@/lib/admin/overview';

export default jsonRoute(async ({ res, session, body }) => {
  const venueId = str(body.venue) ?? '';
  if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
  const ids = (Array.isArray(body.revisions) ? body.revisions : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) throw new ApiError(400, 'nothing to undo');
  const revs = await getRevisions(ids);
  if (revs.length !== ids.length || revs.some((r) => r.venue_id !== venueId)) throw new ApiError(404, 'change record not found');
  // Pre-go-live audit (2026-11-02, S1-02): Undo is the "Saved · Undo" of one's own change. A record someone else made is refused
  // (staff could otherwise take back the owner's allergen notes, a Confirm or a section's layout), and so is a record whose row
  // someone else has changed since (putting the old row back would overwrite their change).
  if (revs.some((r) => r.by?.kind !== session.kind || r.by?.id !== session.id)) throw new ApiError(403, 'Undo works on your own changes only');
  if (await changedSinceByOthers(revs, session)) throw new ApiError(409, 'Someone else has changed this since; it cannot be undone');
  if (revs.some((r) => r.table_name === 'venues' && r.action !== 'reorder') && !canManage(session)) throw new ApiError(403, 'venue details are edited by the owner or an admin');
  const r = await undoRevisions(ids, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venueId);
  return { revisions: r.revisions, menu: await editorMenu(venueId) };
});
