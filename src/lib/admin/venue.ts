// Venue details (name, tagline, addresses, phones, hours) and settings; main admin only. "To confirm" marks per field
// come from the import and clear when the field is edited or the location is marked confirmed.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import type { Bi, Location, Venue } from '@/lib/types';
import { recordRevision, type By } from './revisions';
import { dbError, type Result } from './items';

export type VenueSnapshot = { name: Bi; tagline: Bi; locations: Location[]; settings: { showPersianDrafts: boolean } };

export async function getVenueRow(id: string): Promise<Venue | null> {
  return (await pool.query<Venue>('select id, name, tagline, locations, brand, settings from venues where id = $1', [id])).rows[0] ?? null;
}
export async function listVenueRows(): Promise<Venue[]> {
  return (await pool.query<Venue>('select id, name, tagline, locations, brand, settings from venues order by id')).rows;
}

export async function updateVenue(id: string, patch: Partial<VenueSnapshot>, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<Venue>('select id, name, tagline, locations, settings from venues where id = $1 for update', [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'venue not found' }; }
    const before: VenueSnapshot = { name: row.name, tagline: row.tagline, locations: row.locations, settings: row.settings };
    const next: VenueSnapshot = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as VenueSnapshot;
    await client.query('update venues set name=$2, tagline=$3, locations=$4, settings=$5, updated_at=now(), updated_by=$6 where id=$1', [id, next.name, next.tagline, JSON.stringify(next.locations), next.settings, by]);
    await recordRevision(client, { venueId: id, table: 'venues', rowId: id, action: 'update', before, after: next, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function applyVenueSnapshot(client: Q, id: string, snap: VenueSnapshot, by: By): Promise<void> {
  await client.query('update venues set name=$2, tagline=$3, locations=$4, settings=$5, updated_at=now(), updated_by=$6 where id=$1', [id, snap.name, snap.tagline, JSON.stringify(snap.locations), snap.settings, by]);
}
