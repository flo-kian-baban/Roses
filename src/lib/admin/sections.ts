// Sections: name, note, order, shown/hidden, delete. A section shows to customers only if listed and holding a
// listed item (query rule). Deleting a section keeps its items (they land in "no section", hidden from customers);
// the delete record carries the item order so Undo puts the section back with its items.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import type { Bi } from '@/lib/types';
import { recordRevision, type By } from './revisions';
import { dbError, sectionOrder, type Result } from './items';

export type SectionRow = { id: string; venue_id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; updated_at: string; updated_by: By | null };
export type SectionSnapshot = Pick<SectionRow, 'name' | 'note' | 'position' | 'listed' | 'fa_draft'> & { items?: string[] };
export type SectionPatch = Partial<Pick<SectionSnapshot, 'name' | 'note' | 'position' | 'listed'>>;
const COLS = 'id, venue_id, name, note, position, listed, fa_draft, updated_at, updated_by';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function getSection(id: string): Promise<SectionRow | null> {
  return (await pool.query<SectionRow>(`select ${COLS} from sections where id = $1`, [id])).rows[0] ?? null;
}
export async function listSections(venueId: string): Promise<SectionRow[]> {
  return (await pool.query<SectionRow>(`select ${COLS} from sections where venue_id = $1 order by position, name->>'en'`, [venueId])).rows;
}

export async function updateSection(id: string, patch: SectionPatch, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<SectionRow>(`select ${COLS} from sections where id = $1 for update`, [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'section not found' }; }
    const before: SectionSnapshot = { name: row.name, note: row.note, position: row.position, listed: row.listed, fa_draft: row.fa_draft };
    const next: SectionSnapshot = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as SectionSnapshot;
    if (!next.name?.en) { await client.query('rollback'); return { ok: false, error: 'The English name is required' }; }
    const keep = new Set(row.fa_draft); if (before.name.fa !== next.name.fa) keep.delete('name'); if (before.note?.fa !== next.note?.fa) keep.delete('note'); next.fa_draft = [...keep];
    if (same(before, next)) { await client.query('rollback'); return { ok: true, id }; }
    await client.query(`update sections set name=$2, note=$3, position=$4, listed=$5, fa_draft=$6, updated_at=now(), updated_by=$7 where id=$1`, [id, next.name, next.note, next.position, next.listed, next.fa_draft, by]);
    const onlyListing = Object.keys(patch).every((k) => k === 'listed');
    const revision = await recordRevision(client, { venueId: row.venue_id, table: 'sections', rowId: id, action: onlyListing ? (next.listed ? 'list' : 'unlist') : 'update', before, after: next, by });
    await client.query('commit');
    return { ok: true, id, revision };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function createSection(venueId: string, data: { name: Bi; note?: Bi }, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const max = (await client.query<{ m: number | null }>('select max(position) as m from sections where venue_id = $1', [venueId])).rows[0].m ?? -1;
    const snap: SectionSnapshot = { name: data.name, note: data.note ?? { en: null, fa: null }, position: max + 1, listed: true, fa_draft: [] };
    const r = await client.query<{ id: string }>(`insert into sections (venue_id, name, note, position, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [venueId, snap.name, snap.note, snap.position, snap.listed, snap.fa_draft, by]);
    const revision = await recordRevision(client, { venueId, table: 'sections', rowId: r.rows[0].id, action: 'create', before: null, after: snap, by });
    await client.query('commit');
    return { ok: true, id: r.rows[0].id, revision };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function deleteSection(id: string, by: By): Promise<Result & { orphaned?: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<SectionRow>(`select ${COLS} from sections where id = $1 for update`, [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'section not found' }; }
    const items = await sectionOrder(client, id);
    const before: SectionSnapshot = { name: row.name, note: row.note, position: row.position, listed: row.listed, fa_draft: row.fa_draft, items };
    await client.query('delete from sections where id = $1', [id]); // placements go with it (on delete cascade); the items stay
    const orphaned = (await client.query<{ id: string }>(`select i.id from items i where i.id = any($1) and not exists (select 1 from item_sections x where x.item_id = i.id)`, [items])).rows.map((r) => r.id);
    const revision = await recordRevision(client, { venueId: row.venue_id, table: 'sections', rowId: id, action: 'delete', before, after: null, by });
    await client.query('commit');
    return { ok: true, id, revision, orphaned };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

// New order of all the venue's sections (drag on a laptop, Move up / Move down on a phone). One 'reorder' record on the venue.
export async function reorderSections(venueId: string, order: string[], by: By): Promise<Result & { order?: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const before = await venueSectionOrder(client, venueId);
    if (before.length !== order.length || [...before].sort().join() !== [...order].sort().join()) { await client.query('rollback'); return { ok: false, error: 'the order must list every section of the venue once' }; }
    if (same(before, order)) { await client.query('rollback'); return { ok: true, id: venueId, order: before }; }
    await applySectionOrder(client, venueId, order);
    const revision = await recordRevision(client, { venueId, table: 'venues', rowId: venueId, action: 'reorder', before: { sections: before }, after: { sections: order }, by });
    await client.query('commit');
    return { ok: true, id: venueId, revision, order };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}
export async function venueSectionOrder(client: Q, venueId: string): Promise<string[]> {
  return (await client.query<{ id: string }>(`select id from sections where venue_id = $1 order by position, name->>'en'`, [venueId])).rows.map((r) => r.id);
}
export async function applySectionOrder(client: Q, venueId: string, order: string[]): Promise<void> {
  for (let i = 0; i < order.length; i++) await client.query('update sections set position = $3 where venue_id = $1 and id = $2', [venueId, order[i], i]);
}

// Puts a section back to a snapshot (Undo). A deleted section returns with its items in their old order.
export async function applySectionSnapshot(client: Q, venueId: string, id: string, snap: SectionSnapshot, by: By): Promise<void> {
  await client.query(
    `insert into sections (id, venue_id, name, note, position, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set name=excluded.name, note=excluded.note, position=excluded.position, listed=excluded.listed, fa_draft=excluded.fa_draft, updated_at=now(), updated_by=excluded.updated_by`,
    [id, venueId, snap.name, snap.note, snap.position, snap.listed, snap.fa_draft, by]);
  if (snap.items) {
    for (let i = 0; i < snap.items.length; i++) await client.query('insert into item_sections (item_id, section_id, position) select $1, $2, $3 where exists (select 1 from items where id = $1) on conflict (item_id, section_id) do update set position = excluded.position', [snap.items[i], id, i]);
  }
}
