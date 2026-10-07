import { route, redirect, forbidden, revalidateVenue, bi, text } from '@/lib/admin/api';
import { canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createSection, getSection, updateSection } from '@/lib/admin/sections';

export default route({}, async ({ res, session, body, back }) => {
  const s = session!; const by = byOf(s);
  if (body._action === 'create') {
    const venueId = body.venue;
    if (!canEditVenue(s, venueId)) return forbidden(res, 'no access to this venue');
    const name = bi(body, 'name'); if (!name.en) return redirect(res, back, { error: 'the English name is required' });
    const r = await createSection(venueId, { name, note: bi(body, 'note') }, by);
    if (!r.ok) return redirect(res, back, { error: r.error });
    await revalidateVenue(res, venueId);
    return redirect(res, `/admin/${venueId}`, { saved: '1' });
  }
  const sec = await getSection(body.id);
  if (!sec) return redirect(res, back, { error: 'section not found' });
  if (!canEditVenue(s, sec.venue_id)) return forbidden(res, 'no access to this venue');
  let r;
  if (body._action === 'save') { const name = bi(body, 'name'); if (!name.en) return redirect(res, back, { error: 'the English name is required' }); const pos = text(body, 'position'); r = await updateSection(sec.id, { name, note: bi(body, 'note'), position: pos == null ? undefined : Number(pos), listed: body.listed === undefined ? undefined : body.listed === 'on' || body.listed === '1' }, by); }
  else if (body._action === 'list') r = await updateSection(sec.id, { listed: true }, by);
  else if (body._action === 'unlist') r = await updateSection(sec.id, { listed: false }, by);
  else return redirect(res, back, { error: 'unknown action' });
  if (!r.ok) return redirect(res, back, { error: r.error });
  await revalidateVenue(res, sec.venue_id);
  return redirect(res, back, { saved: '1' });
});
