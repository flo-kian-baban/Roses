// Undo. Every change wrote a record (revisions: before/after snapshots, the silent change record). Undoing record R
// puts the row back to R.before: undoing a "create" removes the created row, undoing a "delete" brings the row back
// with its section memberships, undoing a "reorder" puts the old order back. The undo writes a record of its own.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import { recordRevision, type By } from './revisions';
import { applyItemOrder, applyItemSnapshot, dbError, listingProblem, sectionOrder, type ItemSnapshot, type Result } from './items';
import { applySectionOrder, applySectionSnapshot, venueSectionOrder, type SectionSnapshot } from './sections';
import { applyVenueSnapshot, type VenueSnapshot } from './venue';

export type Revision = { id: number; venue_id: string; table_name: 'items' | 'sections' | 'venues'; row_id: string; action: string; before: unknown; after: unknown; by: By; at: string };

export async function getRevisions(ids: number[]): Promise<Revision[]> {
  return (await pool.query<Revision>('select id, venue_id, table_name, row_id, action, before, after, by, at from revisions where id = any($1)', [ids])).rows;
}

// Undoes the given records, newest first, in one transaction. Returns the ids of the records the undo wrote.
export async function undoRevisions(ids: number[], by: By): Promise<Result & { revisions?: number[] }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const rows = (await client.query<Revision>('select id, venue_id, table_name, row_id, action, before, after, by, at from revisions where id = any($1) order by id desc', [ids])).rows;
    if (rows.length !== ids.length) { await client.query('rollback'); return { ok: false, error: 'change record not found' }; }
    const written: number[] = [];
    for (const r of rows) {
      const res = await undoOne(client, r, by);
      if (!res.ok) { await client.query('rollback'); return res; }
      written.push(res.revision!);
    }
    await client.query('commit');
    return { ok: true, id: rows[0]?.row_id ?? '', revisions: written };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

async function undoOne(client: PoolClient, r: Revision, by: By): Promise<Result> {
  const undoneBy: By = { ...by, undo_of: r.id } as By;
  const rec = (before: unknown, after: unknown) => recordRevision(client, { venueId: r.venue_id, table: r.table_name, rowId: r.row_id, action: 'restore', before, after, by: undoneBy });
  if (r.action === 'reorder') {
    if (r.table_name === 'sections') {
      const target = (r.before as { items: string[] }).items;
      const now = await sectionOrder(client, r.row_id);
      await applyItemOrder(client, r.row_id, target.filter((id) => now.includes(id)));
      return { ok: true, id: r.row_id, revision: await rec({ items: now }, { items: target }) };
    }
    const target = (r.before as { sections: string[] }).sections;
    const now = await venueSectionOrder(client, r.row_id);
    await applySectionOrder(client, r.row_id, target.filter((id) => now.includes(id)));
    return { ok: true, id: r.row_id, revision: await rec({ sections: now }, { sections: target }) };
  }
  const target = r.before as ItemSnapshot | SectionSnapshot | VenueSnapshot | null;
  if (r.table_name === 'items') {
    const beforeNow = await currentItem(client, r.row_id);
    if (!target) { // undo a create: remove the item
      if (beforeNow) await client.query('delete from items where id = $1', [r.row_id]);
      return { ok: true, id: r.row_id, revision: await rec(beforeNow, null) };
    }
    const snap = target as ItemSnapshot;
    if (snap.listed && listingProblem(snap)) return { ok: false, error: `Cannot undo: ${listingProblem(snap)!.toLowerCase()}` };
    await applyItemSnapshot(client, r.venue_id, r.row_id, snap, by);
    return { ok: true, id: r.row_id, revision: await rec(beforeNow, snap) };
  }
  if (r.table_name === 'sections') {
    const cur = (await client.query<SectionSnapshot>('select name, note, position, listed, fa_draft, layout from sections where id = $1', [r.row_id])).rows[0] ?? null;
    if (cur) cur.items = await sectionOrder(client, r.row_id);
    if (!target) { if (cur) await client.query('delete from sections where id = $1', [r.row_id]); }
    else {
      const snap = target as SectionSnapshot;
      await applySectionSnapshot(client, r.venue_id, r.row_id, snap, by);
      // a delete that moved the items elsewhere: take those placements back (only the ones the delete added)
      if (r.action === 'delete' && snap.moved_to?.item_ids?.length) await client.query('delete from item_sections where section_id = $1 and item_id = any($2)', [snap.moved_to.section_id, snap.moved_to.item_ids]);
    }
    return { ok: true, id: r.row_id, revision: await rec(cur, target) };
  }
  const cur = (await client.query('select name, tagline, locations, settings, brand, style from venues where id = $1', [r.row_id])).rows[0] ?? null;
  if (!target) return { ok: false, error: 'Adding a venue cannot be undone from here' };
  await applyVenueSnapshot(client, r.row_id, target as VenueSnapshot, by);
  return { ok: true, id: r.row_id, revision: await rec(cur, target) };
}

async function currentItem(client: Q, id: string): Promise<ItemSnapshot | null> {
  const r = (await client.query('select name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft from items where id = $1', [id])).rows[0] as ItemSnapshot | undefined;
  if (!r) return null;
  const p = (await client.query('select section_id, position from item_sections where item_id = $1 order by position', [id])).rows as ItemSnapshot['placements'];
  return { ...r, placements: p };
}
