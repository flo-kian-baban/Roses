// Items: read, create, update, list/unlist, delete. Every change goes through one transaction that also writes
// the revision row. Listing rule (PM): an item can be listed only if it has a price, or every size has a price.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
import type { Bi, Variant, AddOn, Component } from '@/lib/types';
type Q = Pool | PoolClient;
import { recordRevision, type By } from './revisions';

export type Notes = { allergens: string[]; dietary: string[]; halal: boolean | null; text: Bi };
export type ItemRow = {
  id: string; venue_id: string; name: Bi; description: Bi; price: string | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: { url: string; alt: Bi } | null; notes: Notes; listed: boolean; fa_draft: string[]; updated_at: string; updated_by: By | null; import_key: string | null;
};
export type Placement = { section_id: string; position: number; section_name?: Bi };
export type ItemSnapshot = Omit<ItemRow, 'id' | 'venue_id' | 'updated_at' | 'updated_by' | 'import_key' | 'price'> & { price: string | number | null; placements: Placement[] };
export type ItemPatch = Partial<Pick<ItemRow, 'name' | 'description' | 'variants' | 'add_ons' | 'components' | 'serves' | 'photo' | 'notes' | 'listed'>> & { price?: string | number | null; section_ids?: string[] };

const COLS = 'id, venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_at, updated_by, import_key';

export function listingProblem(i: { price: string | number | null; variants: Variant[] }): string | null {
  if (i.price != null && i.price !== '') return null;
  if (i.variants.length && i.variants.every((v) => v.price != null)) return null;
  return i.variants.length ? 'every size needs a price before the item can be listed' : 'the item needs a price before it can be listed';
}

export function persianMissing(i: { name: Bi; description: Bi; variants?: Variant[] }): string[] {
  const out: string[] = [];
  if (i.name.en && !i.name.fa) out.push('name');
  if (i.description?.en && !i.description.fa) out.push('description');
  if (i.variants?.some((v) => v.label.en && !v.label.fa)) out.push('sizes');
  return out;
}

export async function getItem(id: string): Promise<(ItemRow & { placements: Placement[] }) | null> {
  const r = await pool.query<ItemRow>(`select ${COLS} from items where id = $1`, [id]);
  if (!r.rows[0]) return null;
  const p = await pool.query<Placement>(`select x.section_id, x.position, s.name as section_name from item_sections x join sections s on s.id = x.section_id where x.item_id = $1 order by s.position`, [id]);
  return { ...r.rows[0], placements: p.rows };
}

async function snapshot(client: Q, id: string): Promise<ItemSnapshot | null> {
  const r = await client.query<ItemRow>(`select ${COLS} from items where id = $1`, [id]);
  if (!r.rows[0]) return null;
  const { id: _i, venue_id: _v, updated_at: _a, updated_by: _b, import_key: _k, ...rest } = r.rows[0];
  void _i; void _v; void _a; void _b; void _k;
  const p = await client.query<Placement>(`select section_id, position from item_sections where item_id = $1 order by position`, [id]);
  return { ...rest, placements: p.rows };
}

// Persian typed by a person is no longer a draft.
function clearDrafts(fa_draft: string[], before: ItemSnapshot, after: ItemSnapshot): string[] {
  const keep = new Set(fa_draft);
  if (before.name.fa !== after.name.fa) keep.delete('name');
  if (before.description?.fa !== after.description?.fa) keep.delete('description');
  if (JSON.stringify(before.variants) !== JSON.stringify(after.variants)) keep.delete('variants');
  if (JSON.stringify(before.add_ons) !== JSON.stringify(after.add_ons)) keep.delete('addOns');
  if (JSON.stringify(before.components) !== JSON.stringify(after.components)) keep.delete('components');
  return [...keep];
}

export type Result = { ok: true; id: string } | { ok: false; error: string };

export async function updateItem(id: string, patch: ItemPatch, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<ItemRow>(`select ${COLS} from items where id = $1 for update`, [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'item not found' }; }
    const before = (await snapshot(client, id))!;
    const { section_ids: _s, ...fields } = patch; void _s;
    const next: ItemSnapshot = { ...before, ...stripUndefined(fields) } as ItemSnapshot;
    if (patch.section_ids) {
      const keep = before.placements.filter((p) => patch.section_ids!.includes(p.section_id));
      let pos = Math.max(0, ...before.placements.map((p) => p.position)) + 1;
      for (const sid of patch.section_ids) if (!keep.some((p) => p.section_id === sid)) keep.push({ section_id: sid, position: pos++ });
      next.placements = keep;
    }
    if (next.listed && listingProblem(next)) { await client.query('rollback'); return { ok: false, error: listingProblem(next)! }; }
    next.fa_draft = clearDrafts(row.fa_draft, before, next);
    await client.query(
      `update items set name=$2, description=$3, price=$4, variants=$5, add_ons=$6, components=$7, serves=$8, photo=$9, notes=$10, listed=$11, fa_draft=$12, updated_at=now(), updated_by=$13 where id=$1`,
      [id, next.name, next.description, next.price, JSON.stringify(next.variants), JSON.stringify(next.add_ons), JSON.stringify(next.components), next.serves, next.photo, next.notes, next.listed, next.fa_draft, by]);
    if (patch.section_ids) {
      await client.query('delete from item_sections where item_id = $1', [id]);
      for (const p of next.placements) await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3)', [id, p.section_id, p.position]);
    }
    const onlyListing = Object.keys(stripUndefined(fields)).every((k) => k === 'listed') && !patch.section_ids;
    const action = onlyListing ? (next.listed ? 'list' : 'unlist') : 'update';
    await recordRevision(client, { venueId: row.venue_id, table: 'items', rowId: id, action, before, after: next, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function createItem(venueId: string, data: ItemPatch & { name: Bi }, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const snap: ItemSnapshot = {
      name: data.name, description: data.description ?? { en: null, fa: null }, price: data.price ?? null, variants: data.variants ?? [], add_ons: data.add_ons ?? [], components: data.components ?? [],
      serves: data.serves ?? null, photo: data.photo ?? null, notes: data.notes ?? { allergens: [], dietary: [], halal: null, text: { en: null, fa: null } }, listed: !!data.listed, fa_draft: [], placements: [],
    };
    if (snap.listed && listingProblem(snap)) { await client.query('rollback'); return { ok: false, error: listingProblem(snap)! }; }
    const r = await client.query<{ id: string }>(
      `insert into items (venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [venueId, snap.name, snap.description, snap.price, JSON.stringify(snap.variants), JSON.stringify(snap.add_ons), JSON.stringify(snap.components), snap.serves, snap.photo, snap.notes, snap.listed, snap.fa_draft, by]);
    const id = r.rows[0].id;
    let pos = 1000;
    for (const sid of data.section_ids ?? []) {
      const max = await client.query<{ m: number | null }>('select max(position) as m from item_sections where section_id = $1', [sid]);
      pos = (max.rows[0].m ?? 0) + 1;
      await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3)', [id, sid, pos]);
      snap.placements.push({ section_id: sid, position: pos });
    }
    await recordRevision(client, { venueId, table: 'items', rowId: id, action: 'create', before: null, after: snap, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function deleteItem(id: string, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<ItemRow>(`select venue_id from items where id = $1 for update`, [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'item not found' }; }
    const before = (await snapshot(client, id))!;
    await client.query('delete from items where id = $1', [id]); // item_sections rows go with it (on delete cascade)
    await recordRevision(client, { venueId: row.venue_id, table: 'items', rowId: id, action: 'delete', before, after: null, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

// Puts an item back to a snapshot (restore from history). Re-creates a deleted item with its old id and placements.
export async function applyItemSnapshot(client: Q, venueId: string, id: string, snap: ItemSnapshot, by: By): Promise<void> {
  await client.query(
    `insert into items (id, venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (id) do update set name=excluded.name, description=excluded.description, price=excluded.price, variants=excluded.variants, add_ons=excluded.add_ons, components=excluded.components,
       serves=excluded.serves, photo=excluded.photo, notes=excluded.notes, listed=excluded.listed, fa_draft=excluded.fa_draft, updated_at=now(), updated_by=excluded.updated_by`,
    [id, venueId, snap.name, snap.description, snap.price, JSON.stringify(snap.variants), JSON.stringify(snap.add_ons), JSON.stringify(snap.components), snap.serves, snap.photo, snap.notes, snap.listed, snap.fa_draft, by]);
  await client.query('delete from item_sections where item_id = $1', [id]);
  for (const p of snap.placements ?? []) await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3) on conflict do nothing', [id, p.section_id, p.position]);
}

export function dbError(e: unknown): string {
  const err = e as { code?: string; constraint?: string; message?: string };
  if (err.constraint === 'listed_requires_price') return 'the item needs a price before it can be listed (database rule)';
  return err.message || 'database error';
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
