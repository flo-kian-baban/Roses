import type { NextApiRequest, NextApiResponse } from 'next';
import { route, redirect } from '@/lib/admin/api';
import { cookieHeader, createSessionToken } from '@/lib/admin/auth';
import { clientAddress, lockState, recordFailure, clearFailures } from '@/lib/admin/lockout';
import { verifyAdminLogin, verifyPinLogin } from '@/lib/admin/pins';
import { pool } from '@/lib/db';

const until = (d: Date | null) => d ? d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) : '';

export default route({ anonymous: true }, async ({ req, res, body }) => {
  const address = clientAddress(req);
  const mode = body.mode === 'admin' ? 'admin' : 'pin';
  const loginUrl = '/admin/login';
  if (mode === 'pin') {
    const venue = body.venue;
    const ok = venue && (await pool.query('select 1 from venues where id = $1', [venue])).rowCount;
    if (!ok) return redirect(res, loginUrl, { error: 'choose a venue' });
    const lock = await lockState(venue, address);
    if (lock.locked) return redirect(res, loginUrl, { venue, error: lock.scope === 'venue' ? `PIN login for this venue is locked until ${until(lock.until)}; an admin can unlock it` : `too many wrong PINs; try again at ${until(lock.until)}` });
    const pin = (body.pin ?? '').replace(/\s/g, '');
    const session = /^\d{6}$/.test(pin) ? await verifyPinLogin(venue, pin) : null;
    if (!session) {
      const f = await recordFailure(venue, address);
      const left = Math.max(0, Number(process.env.LOCKOUT_FAILURES || 5) - f.pairFailures);
      return redirect(res, loginUrl, { venue, error: f.locked ? (f.scope === 'venue' ? `PIN login for this venue is locked until ${until(f.until)}` : `too many wrong PINs; locked until ${until(f.until)}`) : `wrong PIN (${left} ${left === 1 ? 'try' : 'tries'} left)` });
    }
    await clearFailures(venue, address);
    res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
    return redirect(res, `/admin/${venue}`);
  }
  const lock = await lockState('admin', address);
  if (lock.locked) return redirect(res, loginUrl, { mode: 'admin', error: `too many failed sign-ins; try again at ${until(lock.until)}` });
  const session = body.email && body.password ? await verifyAdminLogin(body.email.trim(), body.password) : null;
  if (!session) {
    const f = await recordFailure('admin', address, { cap: false });
    return redirect(res, loginUrl, { mode: 'admin', error: f.locked ? `too many failed sign-ins; locked until ${until(f.until)}` : 'wrong email or password' });
  }
  await clearFailures('admin', address);
  res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
  return redirect(res, '/admin');
});
