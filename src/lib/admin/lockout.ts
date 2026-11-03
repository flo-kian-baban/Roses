// Lockout counters. Kian's decision of 2026-10-07: 5 failures lock the venue + address pair for 15 minutes. Pre-go-live audit (the PM's
// fix batch, 2026-11-03):
//   S1-14   50 failures per hour on one venue raise an alert in the admin and lock nothing (before, they locked the venue's PIN sign-in for
//           everyone for an hour, which anyone could do every hour); the per-address lock stays.
//   [Q3]    admin PINs are tried on every venue's sign-in, so the failures that reach them are counted across venues: 50 within an hour
//           pause admin PINs (every venue) until the hour is over or an admin unlocks them, with an alert; staff and owner PINs keep
//           working, and admins can sign in with email and password.
//   S1-09   the client address is the one the host's proxy saw (TRUST_PROXY hops from the right of the header), an IPv6 address counted
//           per /64 (one home or phone network holds a whole /64).
// Env overrides exist only so a drill can run quickly; the defaults are the decisions. A value that is not a whole number counts as unset.
import type { IncomingMessage } from 'node:http';
import { pool } from '@/lib/db';

const num = (v: string | undefined, d: number): number => { const n = Number(v); return v && Number.isInteger(n) && n > 0 ? n : d; };
const CFG = () => ({
  failures: num(process.env.LOCKOUT_FAILURES, 5),
  minutes: num(process.env.LOCKOUT_MINUTES, 15),
  capFailures: num(process.env.VENUE_CAP_FAILURES, 50),
  capWindowMinutes: num(process.env.VENUE_CAP_WINDOW_MINUTES, 60),
  adminCap: num(process.env.ADMIN_PIN_CAP_FAILURES, 50),
  adminWindowMinutes: num(process.env.ADMIN_PIN_CAP_WINDOW_MINUTES, 60),
});
export const limits = CFG;
export const ADMIN_PIN_KEY = 'admin-pin';

// The client address (S1-09). Directly on the internet: the socket's. Behind the host's proxy (Vercel, or nginx in front of `next start`),
// TRUST_PROXY is the number of proxies in front of the app (1 on Vercel: required there, or every client shares the proxy's address): the
// address is the entry that many hops from the right of the forwarding header (X-Forwarded-For unless CLIENT_IP_HEADER names another),
// the one the outermost trusted proxy saw. Entries to its left come from the client and are never trusted (before, the first entry was
// used, so anyone could send a new one with every guess).
export function clientAddress(req: IncomingMessage): string {
  const hops = num(process.env.TRUST_PROXY, 0);
  if (hops > 0) {
    const header = (process.env.CLIENT_IP_HEADER || 'x-forwarded-for').toLowerCase();
    const raw = req.headers[header];
    const entries = (Array.isArray(raw) ? raw.join(',') : String(raw ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
    const pick = entries.length >= hops ? entries[entries.length - hops] : entries[0];
    if (pick) return groupOf(pick);
  }
  return groupOf(req.socket.remoteAddress || 'unknown');
}
// An IPv4 address as it is; an IPv6 address as its /64 ("2001:db8:1:2::/64"); an IPv4-mapped IPv6 address as the IPv4 one.
export function groupOf(a: string): string {
  let s = a.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (s.toLowerCase().startsWith('::ffff:') && s.includes('.')) s = s.slice(7);
  if (!s.includes(':')) return s;
  const [head, tail = ''] = s.toLowerCase().split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const full = s.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  if (full.length !== 8) return s;
  return `${full.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export type LockState = { locked: boolean; until: Date | null; adminPaused: boolean };

// The venue + address lock (a venue's old cap lock, from before the cap became an alert, no longer counts) and whether admin PINs are paused.
export async function lockState(venueId: string, address: string): Promise<LockState> {
  const r = await pool.query<{ key: string; locked_until: Date | null }>(
    `select key, locked_until from login_failures where key = any($1) and locked_until is not null and locked_until > now()`,
    [[`${venueId}:${address}`, ADMIN_PIN_KEY]]);
  const pair = r.rows.find((x) => x.key !== ADMIN_PIN_KEY);
  return { locked: !!pair, until: pair?.locked_until ?? null, adminPaused: r.rows.some((x) => x.key === ADMIN_PIN_KEY) };
}

// Counts one failure on the pair, on the venue (alert at the cap) and, unless `admin: false`, on the admin PINs across venues (pause at the
// cap); locks the pair at its limit. Returns the counts and the resulting state.
export async function recordFailure(venueId: string, address: string, opts: { cap?: boolean; admin?: boolean } = {}): Promise<LockState & { pairFailures: number; venueFailures: number; adminFailures: number }> {
  const c = CFG();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const bump = async (key: string, windowMinutes: number) => {
      const r = await client.query<{ failures: number; locked_until: Date | null }>(
        `insert into login_failures (key, failures, window_started_at) values ($1, 1, now())
         on conflict (key) do update set
           failures = case when login_failures.window_started_at < now() - make_interval(mins => $2) then 1 else login_failures.failures + 1 end,
           window_started_at = case when login_failures.window_started_at < now() - make_interval(mins => $2) then now() else login_failures.window_started_at end
         returning failures, locked_until`, [key, windowMinutes]);
      return r.rows[0];
    };
    const lockFor = async (key: string, minutes: number) => (await client.query<{ locked_until: Date }>(`update login_failures set locked_until = now() + make_interval(mins => $2) where key = $1 returning locked_until`, [key, minutes])).rows[0].locked_until;
    const pairKey = `${venueId}:${address}`, venueKey = `venue:${venueId}`;
    const pair = await bump(pairKey, c.minutes);
    let state: LockState = { locked: false, until: null, adminPaused: false };
    if (pair.failures >= c.failures) state = { ...state, locked: true, until: await lockFor(pairKey, c.minutes) };
    let venueFailures = 0;
    if (opts.cap !== false) {
      venueFailures = (await bump(venueKey, c.capWindowMinutes)).failures;
      if (venueFailures === c.capFailures) await client.query(`insert into admin_alerts (venue_id, kind, message) values ($1, 'lockout-cap', $2)`,
        [venueId, `${venueFailures} wrong PINs within ${c.capWindowMinutes} minutes on this venue's sign-in. Nothing is locked for the venue (the cap is an alert only); each device is still locked for ${c.minutes} minutes after ${c.failures} wrong PINs.`]);
    }
    let adminFailures = 0;
    // a try refused before its PIN is checked (its device is locked) never reaches the admin PINs, so it does not count against them
    if (opts.admin !== false && pair.failures <= c.failures) {
      const a = await bump(ADMIN_PIN_KEY, c.adminWindowMinutes); adminFailures = a.failures;
      if (adminFailures >= c.adminCap) {
        const until = a.locked_until && a.locked_until > new Date() ? a.locked_until : await lockFor(ADMIN_PIN_KEY, c.adminWindowMinutes);
        state = { ...state, adminPaused: true };
        if (adminFailures === c.adminCap) await client.query(`insert into admin_alerts (venue_id, kind, message) values (null, 'admin-pin-cap', $1)`,
          [`${adminFailures} wrong PINs across the venues within ${c.adminWindowMinutes} minutes: admin PINs are paused until ${torontoTime(until)} (Toronto). Staff and owner PINs still work; admins can sign in with email and password, or unlock admin PINs here.`]);
      }
    }
    await client.query('commit');
    return { ...state, pairFailures: pair.failures, venueFailures, adminFailures };
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}

// Lock times as the people reading them live them (pre-go-live audit S1-18: before, the server's time zone, UTC on Vercel).
export const torontoTime = (d: Date | null): string => (d ? d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' }) : '');

// A successful sign-in whose attempt was counted before the check (pre-go-live audit S1-04): the pair's counter is cleared as before, and
// the attempt comes off the venue's hourly count and the admin PINs' count.
export async function forgiveAttempt(venueId: string, address: string, opts: { admin?: boolean } = {}): Promise<void> {
  await clearFailures(venueId, address);
  await pool.query(`update login_failures set failures = greatest(failures - 1, 0) where key = $1`, [`venue:${venueId}`]);
  if (opts.admin !== false) await pool.query(`update login_failures set failures = greatest(failures - 1, 0), locked_until = case when failures - 1 < $2 then null else locked_until end where key = $1`, [ADMIN_PIN_KEY, CFG().adminCap]);
}

export async function clearFailures(venueId: string, address: string): Promise<void> {
  await pool.query(`delete from login_failures where key = $1`, [`${venueId}:${address}`]);
}

// An admin's way out: every lock of the venue (each address) goes; unlockAdminPins ends a pause of the admin PINs.
export async function unlockVenue(venueId: string): Promise<void> {
  await pool.query(`delete from login_failures where key = $1 or key like $2`, [`venue:${venueId}`, `${venueId}:%`]);
}
export async function unlockAdminPins(): Promise<void> {
  await pool.query(`delete from login_failures where key = $1`, [ADMIN_PIN_KEY]);
}
