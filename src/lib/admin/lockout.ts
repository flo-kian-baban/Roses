// Lockout counters (Kian's decision of 2026-10-07): 5 failures lock the venue + address pair for 15 minutes;
// 50 failures per hour per venue lock the venue for everyone and raise an alert shown in the admin until email exists.
// Env overrides exist only so the drill can run quickly (LOCKOUT_MINUTES etc.); the defaults are the decision.
import type { IncomingMessage } from 'node:http';
import { pool } from '@/lib/db';

const CFG = () => ({
  failures: Number(process.env.LOCKOUT_FAILURES || 5),
  minutes: Number(process.env.LOCKOUT_MINUTES || 15),
  capFailures: Number(process.env.VENUE_CAP_FAILURES || 50),
  capWindowMinutes: Number(process.env.VENUE_CAP_WINDOW_MINUTES || 60),
});

// The client address from the socket. Behind a reverse proxy set TRUST_PROXY=1 so the first X-Forwarded-For entry is used.
export function clientAddress(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') { const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (xf) return xf; }
  const a = req.socket.remoteAddress || 'unknown';
  return a.startsWith('::ffff:') ? a.slice(7) : a;
}

export type LockState = { locked: boolean; until: Date | null; scope: 'address' | 'venue' | null };

export async function lockState(venueId: string, address: string): Promise<LockState> {
  const r = await pool.query<{ key: string; locked_until: Date | null }>(
    `select key, locked_until from login_failures where key = any($1) and locked_until is not null and locked_until > now()`,
    [[`venue:${venueId}`, `${venueId}:${address}`]]);
  const venue = r.rows.find((x) => x.key.startsWith('venue:'));
  if (venue) return { locked: true, until: venue.locked_until, scope: 'venue' };
  const pair = r.rows[0];
  if (pair) return { locked: true, until: pair.locked_until, scope: 'address' };
  return { locked: false, until: null, scope: null };
}

// Counts one failure on both keys and locks when a threshold is reached. Returns the resulting state.
export async function recordFailure(venueId: string, address: string, opts: { cap?: boolean } = {}): Promise<LockState & { pairFailures: number; venueFailures: number }> {
  const c = CFG();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const bump = async (key: string, windowMinutes: number) => {
      const r = await client.query<{ failures: number; window_started_at: Date }>(
        `insert into login_failures (key, failures, window_started_at) values ($1, 1, now())
         on conflict (key) do update set
           failures = case when login_failures.window_started_at < now() - make_interval(mins => $2) then 1 else login_failures.failures + 1 end,
           window_started_at = case when login_failures.window_started_at < now() - make_interval(mins => $2) then now() else login_failures.window_started_at end
         returning failures, window_started_at`, [key, windowMinutes]);
      return r.rows[0].failures;
    };
    const pairKey = `${venueId}:${address}`, venueKey = `venue:${venueId}`;
    const pairFailures = await bump(pairKey, c.minutes);
    const venueFailures = opts.cap === false ? 0 : await bump(venueKey, c.capWindowMinutes);
    let state: LockState = { locked: false, until: null, scope: null };
    if (pairFailures >= c.failures) {
      const r = await client.query<{ locked_until: Date }>(`update login_failures set locked_until = now() + make_interval(mins => $2) where key = $1 returning locked_until`, [pairKey, c.minutes]);
      state = { locked: true, until: r.rows[0].locked_until, scope: 'address' };
    }
    if (venueFailures >= c.capFailures) {
      const r = await client.query<{ locked_until: Date }>(`update login_failures set locked_until = now() + make_interval(mins => $2) where key = $1 returning locked_until`, [venueKey, c.capWindowMinutes]);
      state = { locked: true, until: r.rows[0].locked_until, scope: 'venue' };
      if (venueFailures === c.capFailures) await client.query(`insert into admin_alerts (venue_id, kind, message) values ($1, 'lockout-cap', $2)`,
        [venueId, `${venueFailures} failed PIN attempts within ${c.capWindowMinutes} minutes: PIN login for this venue is locked until ${r.rows[0].locked_until.toISOString()}. An admin can unlock it from this page.`]);
    }
    await client.query('commit');
    return { ...state, pairFailures, venueFailures };
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}

export async function clearFailures(venueId: string, address: string): Promise<void> {
  await pool.query(`delete from login_failures where key = $1`, [`${venueId}:${address}`]);
}

export async function unlockVenue(venueId: string): Promise<void> {
  await pool.query(`delete from login_failures where key = $1 or key like $2`, [`venue:${venueId}`, `${venueId}:%`]);
}
