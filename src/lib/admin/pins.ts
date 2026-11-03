// PINs (6 digits, one person each, venue-scoped, revocable) and admin accounts (email + password).
import { createHash, randomInt } from 'node:crypto';
import { pool } from '@/lib/db';
import { hashSecret, verifySecret, type Session } from './auth';
import { recordRevision, type By } from './revisions';

export type PinRow = { id: string; name: string; role: 'owner' | 'staff'; venue_ids: string[]; created_at: string; revoked_at: string | null; last_used_at: string | null; created_by_name: string | null };

// created_by_name: the admin who made it, or, for a PIN an owner made, the owner (from its change record: pre-go-live audit S1-21).
export async function listPins(): Promise<PinRow[]> {
  return (await pool.query<PinRow>(`select p.id, p.name, p.role, p.venue_ids, p.created_at, p.revoked_at, p.last_used_at,
      coalesce(a.name, (select r.by->>'name' from revisions r where r.table_name = 'pins' and r.row_id = p.id::text and r.action = 'create' order by r.id limit 1)) as created_by_name
    from pins p left join admins a on a.id = p.created_by order by p.revoked_at nulls first, p.created_at desc`)).rows;
}

// Returns the PIN once; only its hash is stored. Pre-go-live audit (the PM's fix batch, 2026-11-03, S1-21): every venue must exist; a new
// PIN never equals an active PIN or an admin PIN (it would sign one of them in as the other; drawn again on a clash, checked against every
// hash); the person who made it is recorded (an owner in the PIN's change record: pins.created_by holds admins only).
export async function createPin(data: { name: string; role: 'owner' | 'staff'; venueIds: string[]; by: By }): Promise<{ id: string; pin: string } | { error: 'venue-unknown' }> {
  const known = (await pool.query<{ id: string }>('select id from venues where id = any($1)', [data.venueIds])).rows.length;
  if (known !== new Set(data.venueIds).size) return { error: 'venue-unknown' };
  const hashes = [
    ...(await pool.query<{ h: string }>('select pin_hash as h from pins where revoked_at is null')).rows,
    ...(await pool.query<{ h: string }>('select pin_hash as h from admins where pin_hash is not null')).rows,
  ].map((r) => r.h);
  let pin = '';
  for (let tries = 0; tries < 20; tries++) { pin = String(randomInt(0, 1_000_000)).padStart(6, '0'); if (!hashes.some((h) => verifySecret(pin, h))) break; }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = await client.query<{ id: string }>(`insert into pins (name, role, venue_ids, pin_hash, created_by) values ($1,$2,$3,$4,$5) returning id`, [data.name, data.role, data.venueIds, hashSecret(pin), data.by.kind === 'admin' ? data.by.id : null]);
    await recordRevision(client, { venueId: data.venueIds[0], table: 'pins', rowId: r.rows[0].id, action: 'create', before: null, after: { name: data.name, role: data.role, venue_ids: data.venueIds }, by: data.by });
    await client.query('commit');
    return { id: r.rows[0].id, pin };
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}

// Pre-go-live audit (2026-11-02, S1-01): an owner's PIN is for their own venues, so an owner creates, sees and revokes only PINs
// whose venues are all theirs (a PIN for another venue would give its owner rights there); admins manage every PIN.
export function within(s: Session, venues: string[]): boolean { return s.venues === 'all' || venues.every((v) => (s.venues as string[]).includes(v)); }

export async function pinVenues(id: string): Promise<string[] | null> {
  return (await pool.query<{ venue_ids: string[] }>('select venue_ids from pins where id = $1', [id])).rows[0]?.venue_ids ?? null;
}

export async function revokePin(id: string): Promise<void> {
  await pool.query(`update pins set revoked_at = now() where id = $1 and revoked_at is null`, [id]);
}

// Checks the PIN against every active PIN of the venue, then against the admin accounts that have a PIN
// (Kian's decision of 2026-10-07: admins sign in with a PIN, no email typing). A handful of rows; scrypt per row.
// admins: false while admin PINs are paused after many wrong PINs across the venues (pre-go-live audit, [Q3]).
export async function verifyPinLogin(venueId: string, pin: string, opts: { admins?: boolean } = {}): Promise<Session | null> {
  const rows = (await pool.query<{ id: string; name: string; role: 'owner' | 'staff'; venue_ids: string[]; pin_hash: string }>(
    `select id, name, role, venue_ids, pin_hash from pins where revoked_at is null and $1 = any(venue_ids)`, [venueId])).rows;
  for (const p of rows) {
    if (verifySecret(pin, p.pin_hash)) {
      await pool.query('update pins set last_used_at = now() where id = $1', [p.id]);
      return { kind: 'pin', id: p.id, name: p.name, role: p.role, venues: p.venue_ids };
    }
  }
  if (opts.admins === false) return null;
  const admins = (await pool.query<{ id: string; name: string; pin_hash: string; password_hash: string | null }>('select id, name, pin_hash, password_hash from admins where pin_hash is not null')).rows;
  for (const a of admins) if (verifySecret(pin, a.pin_hash)) return { kind: 'admin', id: a.id, name: a.name, role: 'admin', venues: 'all', cred: credOf(a) };
  return null;
}

export type AdminRow = { id: string; name: string; email: string; has_pin: boolean; has_password: boolean; created_at: string };
export async function listAdmins(): Promise<AdminRow[]> {
  return (await pool.query<AdminRow>('select id, name, email, pin_hash is not null as has_pin, password_hash is not null as has_password, created_at from admins order by created_at')).rows;
}

export async function verifyAdminLogin(email: string, password: string): Promise<Session | null> {
  const a = (await pool.query<{ id: string; name: string; pin_hash: string | null; password_hash: string | null }>('select id, name, pin_hash, password_hash from admins where lower(email) = lower($1)', [email])).rows[0];
  if (!a || !a.password_hash || !verifySecret(password, a.password_hash)) return null;
  return { kind: 'admin', id: a.id, name: a.name, role: 'admin', venues: 'all', cred: credOf(a) };
}

// Pre-go-live audit (2026-11-02, S1-03): a session token is signed for 12 hours, so the person behind it is read again on every
// request. A revoked PIN, a deleted admin, or an admin whose PIN or password was reset since signing in (admin:create --reset)
// has no session any more; the role and venues are the database's, not the token's.
export const credOf = (a: { pin_hash: string | null; password_hash: string | null }): string =>
  createHash('sha256').update(`${a.pin_hash ?? ''}\n${a.password_hash ?? ''}`).digest('base64url').slice(0, 22);
export async function liveSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  if (s.kind === 'pin') {
    const p = (await pool.query<{ name: string; role: 'owner' | 'staff'; venue_ids: string[] }>('select name, role, venue_ids from pins where id = $1 and revoked_at is null', [s.id])).rows[0];
    return p ? { kind: 'pin', id: s.id, name: p.name, role: p.role, venues: p.venue_ids } : null;
  }
  const a = (await pool.query<{ name: string; pin_hash: string | null; password_hash: string | null }>('select name, pin_hash, password_hash from admins where id = $1', [s.id])).rows[0];
  return a && s.cred === credOf(a) ? { kind: 'admin', id: s.id, name: a.name, role: 'admin', venues: 'all', cred: s.cred } : null;
}
