import { route, redirect, forbidden, revalidateVenue } from '@/lib/admin/api';
import { canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { restoreRevision } from '@/lib/admin/restore';
import { pool } from '@/lib/db';

export default route({}, async ({ res, session, body, back }) => {
  const s = session!;
  const id = Number(body.revision);
  const rev = (await pool.query<{ venue_id: string; table_name: string }>('select venue_id, table_name from revisions where id = $1', [id])).rows[0];
  if (!rev) return redirect(res, back, { error: 'revision not found' });
  if (!canEditVenue(s, rev.venue_id)) return forbidden(res, 'no access to this venue');
  if (rev.table_name === 'venues' && s.kind !== 'admin') return forbidden(res, 'venue details are edited by the main admin');
  const r = await restoreRevision(id, byOf(s));
  if (!r.ok) return redirect(res, back, { error: r.error });
  await revalidateVenue(res, rev.venue_id);
  return redirect(res, back, { restored: String(id) });
});
