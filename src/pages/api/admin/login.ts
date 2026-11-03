// Sign-in: a PIN on a venue's sign-in (staff, owners and admins), or an admin's email and password. Every attempt is counted before it is
// checked (pre-go-live audit S1-04). Pre-go-live audit (the PM's fix batch, 2026-11-03): the answer is a code with its parameters (S2-18;
// the page has the wording, src/lib/admin/messages.ts), a lock's end in Toronto time (S1-18), a PIN typed with Persian digits read as the
// same PIN (S2-21), admin PINs not tried while they are paused after many wrong PINs across the venues ([Q3], src/lib/admin/lockout.ts).
import { route, redirect } from '@/lib/admin/api';
import { cookieHeader, createSessionToken } from '@/lib/admin/auth';
import { clientAddress, lockState, recordFailure, clearFailures, forgiveAttempt, limits, torontoTime } from '@/lib/admin/lockout';
import { verifyAdminLogin, verifyPinLogin } from '@/lib/admin/pins';
import { pool } from '@/lib/db';
import { westernDigits } from '@/lib/rules';

export default route({ anonymous: true }, async ({ req, res, body, back }) => {
  const address = clientAddress(req);
  const mode = body.mode === 'admin' ? 'admin' : 'pin';
  if (mode === 'pin') {
    const venue = body.venue ?? '';
    const ok = /^[a-z0-9-]{1,60}$/.test(venue) && (await pool.query('select 1 from venues where id = $1', [venue])).rowCount;
    if (!ok) return redirect(res, '/admin', { error: 'choose-venue' });
    const loginUrl = `/admin/${venue}`; // the venue's own sign-in link; a wrong PIN counts against this venue + address
    const lock = await lockState(venue, address);
    if (lock.locked) return redirect(res, loginUrl, { error: 'locked', at: torontoTime(lock.until) });
    const pin = westernDigits(body.pin ?? '').replace(/\s/g, '');
    const c = limits(); const f = await recordFailure(venue, address, { admin: !lock.adminPaused });
    if (f.pairFailures > c.failures) return redirect(res, loginUrl, { error: 'locked', at: torontoTime(f.until) });
    const admins = !lock.adminPaused && f.adminFailures <= c.adminCap; // admin PINs are tried while they are not paused
    const session = /^\d{4,12}$/.test(pin) ? await verifyPinLogin(venue, pin, { admins }) : null;
    if (!session) {
      const left = Math.max(0, c.failures - f.pairFailures);
      // checked and wrong: 'wrong-pin' (with the lock's end when this try set it); 'locked' means refused before the PIN was checked
      return redirect(res, loginUrl, { error: 'wrong-pin', left: String(left), at: f.locked ? torontoTime(f.until) : undefined, paused: admins ? undefined : '1' });
    }
    await forgiveAttempt(venue, address, { admin: !lock.adminPaused });
    res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
    return redirect(res, `/admin/${venue}`);
  }
  const loginUrl = back.replace(/\?.*$/, '') || '/admin';
  const lock = await lockState('admin', address);
  if (lock.locked) return redirect(res, loginUrl, { mode: 'admin', error: 'locked-password', at: torontoTime(lock.until) });
  const f = await recordFailure('admin', address, { cap: false, admin: false }); // counted before the check, as for PINs (S1-04)
  if (f.pairFailures > limits().failures) return redirect(res, loginUrl, { mode: 'admin', error: 'locked-password', at: torontoTime(f.until) });
  const session = body.email && body.password ? await verifyAdminLogin(body.email.trim(), body.password) : null;
  if (!session) return redirect(res, loginUrl, { mode: 'admin', error: 'wrong-password', at: f.locked ? torontoTime(f.until) : undefined });
  await clearFailures('admin', address);
  res.setHeader('Set-Cookie', cookieHeader(await createSessionToken(session), req));
  return redirect(res, /^\/admin\/[a-z0-9-]+$/.test(loginUrl) ? loginUrl : '/admin');
});
