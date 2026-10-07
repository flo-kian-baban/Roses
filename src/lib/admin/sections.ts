// Sections: name, note, order, listed. A section shows to customers only if listed and holding a listed item (query rule).
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import type { Bi } from '@/lib/types';
import { recordRevision, type By } from './revisions';
import { dbError, type Result } from './items';

export type SectionRow = { id: string; venue_id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; updated_at: string; updated_by: By | null };
export type SectionSnapshot = Pick<SectionRow, 'name' | 'note' | 'position' | 'listed' | 'fa_draft'>;
export type SectionPatch = Partial<SectionSnapshot>;
const COLS = 'id, venue_id, name, note, position, listed, fa_draft, updated_at, updated_by';

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
    const keep = new Set(row.fa_draft); if (before.name.fa !== next.name.fa) keep.delete('name'); if (before.note?.fa !== next.note?.fa) keep.delete('note'); next.fa_draft = [...keep];
    await client.query(`update sections set name=$2, note=$3, position=$4, listed=$5, fa_draft=$6, updated_at=now(), updated_by=$7 where id=$1`, [id, next.name, next.note, next.position, next.listed, next.fa_draft, by]);
    const onlyListing = Object.keys(patch).every((k) => k === 'listed');
    await recordRevision(client, { venueId: row.venue_id, table: 'sections', rowId: id, action: onlyListing ? (next.listed ? 'list' : 'unlist') : 'update', before, after: next, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function createSection(venueId: string, data: { name: Bi; note?: Bi }, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const max = (await client.query<{ m: number | null }>('select max(position) as m from sections where venue_id = $1', [venueId])).rows[0].m ?? -1;
    const snap: SectionSnapshot = { name: data.name, note: data.note ?? { en: null, fa: null }, position: max + 1, listed: true, fa_draft: [] };
    const r = await client.query<{ id: string }>(`insert into sections (venue_id, name, note, position, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [venueId, snap.name, snap.note, snap.position, snap.listed, snap.fa_draft, by]);
    await recordRevision(client, { venueId, table: 'sections', rowId: r.rows[0].id, action: 'create', before: null, after: snap, by });
    await client.query('commit');
    return { ok: true, id: r.rows[0].id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function applySectionSnapshot(client: Q, venueId: string, id: string, snap: SectionSnapshot, by: By): Promise<void> {
  await client.query(
    `insert into sections (id, venue_id, name, note, position, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set name=excluded.name, note=excluded.note, position=excluded.position, listed=excluded.listed, fa_draft=excluded.fa_draft, updated_at=now(), updated_by=excluded.updated_by`,
    [id, venueId, snap.name, snap.note, snap.position, snap.listed, snap.fa_draft, by]);
}
