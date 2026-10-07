// PINs (6 digits, one person each, venue-scoped, revocable) and admin accounts (email + password).
import { randomInt } from 'node:crypto';
import { pool } from '@/lib/db';
import { hashSecret, verifySecret, type Session } from './auth';

export type PinRow = { id: string; name: string; role: 'owner' | 'staff'; venue_ids: string[]; created_at: string; revoked_at: string | null; last_used_at: string | null; created_by_name: string | null };

export async function listPins(): Promise<PinRow[]> {
  return (await pool.query<PinRow>(`select p.id, p.name, p.role, p.venue_ids, p.created_at, p.revoked_at, p.last_used_at, a.name as created_by_name from pins p left join admins a on a.id = p.created_by order by p.revoked_at nulls first, p.created_at desc`)).rows;
}

// Returns the PIN once; only its hash is stored.
export async function createPin(data: { name: string; role: 'owner' | 'staff'; venueIds: string[]; createdBy: string }): Promise<{ id: string; pin: string }> {
  const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const r = await pool.query<{ id: string }>(`insert into pins (name, role, venue_ids, pin_hash, created_by) values ($1,$2,$3,$4,$5) returning id`, [data.name, data.role, data.venueIds, hashSecret(pin), data.createdBy]);
  return { id: r.rows[0].id, pin };
}

export async function revokePin(id: string): Promise<void> {
  await pool.query(`update pins set revoked_at = now() where id = $1 and revoked_at is null`, [id]);
}

// Checks the PIN against every active PIN of the venue (a handful of rows; scrypt per row).
export async function verifyPinLogin(venueId: string, pin: string): Promise<Session | null> {
  const rows = (await pool.query<{ id: string; name: string; role: 'owner' | 'staff'; venue_ids: string[]; pin_hash: string }>(
    `select id, name, role, venue_ids, pin_hash from pins where revoked_at is null and $1 = any(venue_ids)`, [venueId])).rows;
  for (const p of rows) {
    if (verifySecret(pin, p.pin_hash)) {
      await pool.query('update pins set last_used_at = now() where id = $1', [p.id]);
      return { kind: 'pin', id: p.id, name: p.name, role: p.role, venues: p.venue_ids };
    }
  }
  return null;
}

export async function verifyAdminLogin(email: string, password: string): Promise<Session | null> {
  const a = (await pool.query<{ id: string; name: string; password_hash: string }>('select id, name, password_hash from admins where lower(email) = lower($1)', [email])).rows[0];
  if (!a || !verifySecret(password, a.password_hash)) return null;
  return { kind: 'admin', id: a.id, name: a.name, role: 'admin', venues: 'all' };
}
