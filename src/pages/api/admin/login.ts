import type { NextApiRequest, NextApiResponse } from 'next';
import { route, redirect } from '@/lib/admin/api';
import { cookieHeader, createSessionToken } from '@/lib/admin/auth';
import { clientAddress, lockState, recordFailure, clearFailures, forgiveAttempt, limits } from '@/lib/admin/lockout';
import { verifyAdminLogin, verifyPinLogin } from '@/lib/admin/pins';
import { pool } from '@/lib/db';

const until = (d: Date | null) => d ? d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) : '';

export default route({ anonymous: true }, async ({ req, res, body, back }) => {
  const address = clientAddress(req);
  const mode = body.mode === 'admin' ? 'admin' : 'pin';
  if (mode === 'pin') {
    const venue = body.venue;
    const ok = venue && (await pool.query('select 1 from venues where id = $1', [venue])).rowCount;
    if (!ok) return redirect(res, '/admin', { error: 'choose a venue' });
    const loginUrl = `/admin/${venue}`; // the venue's own sign-in link; a wrong PIN counts against this venue + address
    const lock = await lockState(venue, address);
    if (lock.locked) return redirect(res, loginUrl, { error: lock.scope === 'venue' ? `PIN login for this venue is locked until ${until(lock.until)}; an admin can unlock it` : `too many wrong PINs; try again at ${until(lock.until)}` });
    const pin = (body.pin ?? '').replace(/\s/g, '');
    // Pre-go-live audit (2026-11-02, S1-04): the attempt is counted before the PIN is checked, so attempts sent at the same moment
    // each take their own number and no more than the limit are ever checked (before, a burst all passed the lock check together).
    const c = limits(); const f = await recordFailure(venue, address);
    if (f.pairFailures > c.failures || f.venueFailures > c.capFailures) return redirect(res, loginUrl, { error: f.scope === 'venue' ? `PIN login for this venue is locked until ${until(f.until)}; an admin can unlock it` : `too many wrong PINs; try again at ${until(f.until)}` });
    const session = /^\d{4,6}$/.test(pin) ? await verifyPinLogin(venue, pin) : null;
    if (!session) {
      const left = Math.max(0, c.failures - f.pairFailures);
      return redirect(res, loginUrl, { error: f.locked ? (f.scope === 'venue' ? `PIN login for this venue is locked until ${until(f.until)}` : `too many wrong PINs; locked until ${until(f.until)}`) : `wrong PIN (${left} ${left === 1 ? 'try' : 'tries'} left)` });
    }
    await forgiveAttempt(venue, address);
    res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
    return redirect(res, `/admin/${venue}`);
  }
  const loginUrl = back.replace(/\?.*$/, '') || '/admin';
  const lock = await lockState('admin', address);
  if (lock.locked) return redirect(res, loginUrl, { mode: 'admin', error: `too many failed sign-ins; try again at ${until(lock.until)}` });
  const f = await recordFailure('admin', address, { cap: false }); // counted before the check, as for PINs (S1-04)
  if (f.pairFailures > limits().failures) return redirect(res, loginUrl, { mode: 'admin', error: `too many failed sign-ins; try again at ${until(f.until)}` });
  const session = body.email && body.password ? await verifyAdminLogin(body.email.trim(), body.password) : null;
  if (!session) return redirect(res, loginUrl, { mode: 'admin', error: f.locked ? `too many failed sign-ins; locked until ${until(f.until)}` : 'wrong email or password' });
  await clearFailures('admin', address);
  res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
  return redirect(res, /^\/admin\/[a-z0-9-]+$/.test(loginUrl) ? loginUrl : '/admin');
});
