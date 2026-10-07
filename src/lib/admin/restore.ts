// History and one-click restore. Restoring revision R puts the row back to R.before (how it was before that edit);
// restoring a "create" removes the created row; restoring a "delete" brings the row back with its section memberships.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import { recordRevision, type By } from './revisions';
import { applyItemSnapshot, dbError, listingProblem, type ItemSnapshot, type Result } from './items';
import { applySectionSnapshot, type SectionSnapshot } from './sections';
import { applyVenueSnapshot, type VenueSnapshot } from './venue';

export type Revision = { id: number; venue_id: string; table_name: 'items' | 'sections' | 'venues'; row_id: string; action: string; before: unknown; after: unknown; by: By; at: string };

export async function listRevisions(venueId: string, opts: { table?: string; rowId?: string; limit?: number } = {}): Promise<Revision[]> {
  const cond = ['venue_id = $1']; const params: unknown[] = [venueId];
  if (opts.table) { params.push(opts.table); cond.push(`table_name = $${params.length}`); }
  if (opts.rowId) { params.push(opts.rowId); cond.push(`row_id = $${params.length}`); }
  params.push(opts.limit ?? 200);
  return (await pool.query<Revision>(`select id, venue_id, table_name, row_id, action, before, after, by, at from revisions where ${cond.join(' and ')} order by at desc, id desc limit $${params.length}`, params)).rows;
}

export async function restoreRevision(revisionId: number, by: By): Promise<Result & { table?: string; rowId?: string }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = (await client.query<Revision>('select id, venue_id, table_name, row_id, action, before, after, by, at from revisions where id = $1', [revisionId])).rows[0];
    if (!r) { await client.query('rollback'); return { ok: false, error: 'revision not found' }; }
    const target = r.before as ItemSnapshot | SectionSnapshot | VenueSnapshot | null;
    const restoredBy: By = { ...by, restored_from: r.id } as By;
    if (r.table_name === 'items') {
      const cur = (await client.query('select id from items where id = $1', [r.row_id])).rows[0];
      const beforeNow = cur ? await currentItem(client, r.row_id) : null;
      if (!target) { // undo a create: remove the item
        if (cur) await client.query('delete from items where id = $1', [r.row_id]);
        await recordRevision(client, { venueId: r.venue_id, table: 'items', rowId: r.row_id, action: 'restore', before: beforeNow, after: null, by: restoredBy });
      } else {
        const snap = target as ItemSnapshot;
        if (snap.listed && listingProblem(snap)) { await client.query('rollback'); return { ok: false, error: `cannot restore: ${listingProblem(snap)}` }; }
        await applyItemSnapshot(client, r.venue_id, r.row_id, snap, by);
        await recordRevision(client, { venueId: r.venue_id, table: 'items', rowId: r.row_id, action: 'restore', before: beforeNow, after: snap, by: restoredBy });
      }
    } else if (r.table_name === 'sections') {
      const cur = (await client.query('select name, note, position, listed, fa_draft from sections where id = $1', [r.row_id])).rows[0] ?? null;
      if (!target) { if (cur) await client.query('delete from sections where id = $1', [r.row_id]); }
      else await applySectionSnapshot(client, r.venue_id, r.row_id, target as SectionSnapshot, by);
      await recordRevision(client, { venueId: r.venue_id, table: 'sections', rowId: r.row_id, action: 'restore', before: cur, after: target, by: restoredBy });
    } else {
      const cur = (await client.query('select name, tagline, locations, settings from venues where id = $1', [r.row_id])).rows[0] ?? null;
      if (!target) { await client.query('rollback'); return { ok: false, error: 'nothing to restore' }; }
      await applyVenueSnapshot(client, r.row_id, target as VenueSnapshot, by);
      await recordRevision(client, { venueId: r.venue_id, table: 'venues', rowId: r.row_id, action: 'restore', before: cur, after: target, by: restoredBy });
    }
    await client.query('commit');
    return { ok: true, id: r.row_id, table: r.table_name, rowId: r.row_id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

async function currentItem(client: Q, id: string): Promise<ItemSnapshot | null> {
  const r = (await client.query('select name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft from items where id = $1', [id])).rows[0] as ItemSnapshot | undefined;
  if (!r) return null;
  const p = (await client.query('select section_id, position from item_sections where item_id = $1 order by position', [id])).rows as ItemSnapshot['placements'];
  return { ...r, placements: p };
}
