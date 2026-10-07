import { route, redirect, forbidden } from '@/lib/admin/api';
import { isAdmin } from '@/lib/admin/auth';
import { markAlertSeen } from '@/lib/admin/overview';
import { unlockVenue } from '@/lib/admin/lockout';

export default route({}, async ({ res, session, body, back }) => {
  if (!isAdmin(session)) return forbidden(res, 'alerts are handled by the main admin');
  if (body._action === 'unlock' && body.venue) { await unlockVenue(body.venue); return redirect(res, back, { unlocked: body.venue }); }
  if (body._action === 'seen' && body.id) { await markAlertSeen(Number(body.id)); return redirect(res, back, { seen: body.id }); }
  return redirect(res, back, { error: 'unknown action' });
});
