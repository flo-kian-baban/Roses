// Items: read, create, update, show/hide, move, delete. Every change goes through one transaction that also writes
// the revision row (the silent change record; Undo restores the row from it). Listing rule (PM): an item can be
// shown only if it has a price, or every size has a price.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
import type { Bi, Variant, AddOn, Component, Notes, Placement, EditorItem } from '@/lib/types';
type Q = Pool | PoolClient;
import { recordRevision, type By } from './revisions';

export type { Notes, Placement };
export type ItemRow = {
  id: string; venue_id: string; name: Bi; description: Bi; price: string | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: { url: string; alt: Bi } | null; notes: Notes; listed: boolean; fa_draft: string[]; updated_at: string; updated_by: By | null; import_key: string | null;
};
export type ItemSnapshot = Omit<ItemRow, 'id' | 'venue_id' | 'updated_at' | 'updated_by' | 'import_key' | 'price'> & { price: string | number | null; placements: Placement[] };
export type ItemPatch = Partial<Pick<ItemRow, 'name' | 'description' | 'variants' | 'add_ons' | 'components' | 'serves' | 'photo' | 'notes' | 'listed'>> & { price?: string | number | null; section_ids?: string[] };

const COLS = 'id, venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_at, updated_by, import_key';

export function listingProblem(i: { price: string | number | null; variants: Variant[] }): string | null {
  if (i.price != null && i.price !== '') return null;
  if (i.variants.length && i.variants.every((v) => v.price != null)) return null;
  return i.variants.length ? 'Every size needs a price before the item can be shown' : 'The item needs a price before it can be shown';
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
  const p = await pool.query<Placement>(`select section_id, position from item_sections where item_id = $1 order by position`, [id]);
  return { ...r.rows[0], placements: p.rows };
}

// The item as the page editor holds it (numbers for money, placements included).
export function toEditorItem(row: ItemRow & { placements: Placement[] }): EditorItem {
  return {
    id: row.id, name: row.name, description: row.description, price: row.price == null ? null : Number(row.price), variants: row.variants, add_ons: row.add_ons, components: row.components,
    serves: row.serves, photo: row.photo, notes: row.notes, listed: row.listed, fa_draft: row.fa_draft, placements: row.placements,
  };
}
export async function editorItem(id: string): Promise<EditorItem | null> { const r = await getItem(id); return r ? toEditorItem(r) : null; }

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

// `revision` is the id of the change record written (absent when nothing changed).
export type Result = { ok: true; id: string; revision?: number } | { ok: false; error: string };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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
      for (const sid of patch.section_ids) if (!keep.some((p) => p.section_id === sid)) {
        const own = (await client.query<{ venue_id: string }>('select venue_id from sections where id = $1', [sid])).rows[0];
        if (!own || own.venue_id !== row.venue_id) { await client.query('rollback'); return { ok: false, error: 'section not found' }; }
        const max = (await client.query<{ m: number | null }>('select max(position) as m from item_sections where section_id = $1', [sid])).rows[0].m ?? -1;
        keep.push({ section_id: sid, position: max + 1 });
      }
      next.placements = keep;
    }
    if (next.listed && listingProblem(next)) { await client.query('rollback'); return { ok: false, error: listingProblem(next)! }; }
    next.fa_draft = clearDrafts(row.fa_draft, before, next);
    if (same(before, next)) { await client.query('rollback'); return { ok: true, id }; } // nothing changed: no write, no record
    await client.query(
      `update items set name=$2, description=$3, price=$4, variants=$5, add_ons=$6, components=$7, serves=$8, photo=$9, notes=$10, listed=$11, fa_draft=$12, updated_at=now(), updated_by=$13 where id=$1`,
      [id, next.name, next.description, next.price, JSON.stringify(next.variants), JSON.stringify(next.add_ons), JSON.stringify(next.components), next.serves, next.photo, next.notes, next.listed, next.fa_draft, by]);
    if (patch.section_ids) {
      await client.query('delete from item_sections where item_id = $1', [id]);
      for (const p of next.placements) await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3)', [id, p.section_id, p.position]);
    }
    const onlyListing = Object.keys(stripUndefined(fields)).every((k) => k === 'listed') && !patch.section_ids;
    const action = onlyListing ? (next.listed ? 'list' : 'unlist') : 'update';
    const revision = await recordRevision(client, { venueId: row.venue_id, table: 'items', rowId: id, action, before, after: next, by });
    await client.query('commit');
    return { ok: true, id, revision };
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
    for (const sid of data.section_ids ?? []) {
      const own = (await client.query<{ venue_id: string }>('select venue_id from sections where id = $1', [sid])).rows[0];
      if (!own || own.venue_id !== venueId) { await client.query('rollback'); return { ok: false, error: 'section not found' }; }
      const max = await client.query<{ m: number | null }>('select max(position) as m from item_sections where section_id = $1', [sid]);
      const pos = (max.rows[0].m ?? -1) + 1;
      await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3)', [id, sid, pos]);
      snap.placements.push({ section_id: sid, position: pos });
    }
    const revision = await recordRevision(client, { venueId, table: 'items', rowId: id, action: 'create', before: null, after: snap, by });
    await client.query('commit');
    return { ok: true, id, revision };
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
    const revision = await recordRevision(client, { venueId: row.venue_id, table: 'items', rowId: id, action: 'delete', before, after: null, by });
    await client.query('commit');
    return { ok: true, id, revision };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

// Moves an item to `index` within one section (drag on a laptop, Move up / Move down on a phone). Positions of the
// section are rewritten 0..n-1; one 'reorder' record on the section holds the order before and after.
export async function moveItem(sectionId: string, itemId: string, index: number, by: By): Promise<Result & { order?: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const sec = (await client.query<{ venue_id: string }>('select venue_id from sections where id = $1 for update', [sectionId])).rows[0];
    if (!sec) { await client.query('rollback'); return { ok: false, error: 'section not found' }; }
    const before = await sectionOrder(client, sectionId);
    if (!before.includes(itemId)) { await client.query('rollback'); return { ok: false, error: 'the item is not in this section' }; }
    const after = before.filter((x) => x !== itemId);
    after.splice(Math.max(0, Math.min(after.length, Math.trunc(index))), 0, itemId);
    if (same(before, after)) { await client.query('rollback'); return { ok: true, id: itemId, order: before }; }
    await applyItemOrder(client, sectionId, after);
    const revision = await recordRevision(client, { venueId: sec.venue_id, table: 'sections', rowId: sectionId, action: 'reorder', before: { items: before }, after: { items: after }, by });
    await client.query('commit');
    return { ok: true, id: itemId, revision, order: after };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

export async function sectionOrder(client: Q, sectionId: string): Promise<string[]> {
  return (await client.query<{ item_id: string }>(`select x.item_id from item_sections x join items i on i.id = x.item_id where x.section_id = $1 order by x.position, i.name->>'en'`, [sectionId])).rows.map((r) => r.item_id);
}
export async function applyItemOrder(client: Q, sectionId: string, order: string[]): Promise<void> {
  for (let i = 0; i < order.length; i++) await client.query('update item_sections set position = $3 where section_id = $1 and item_id = $2', [sectionId, order[i], i]);
}

// Puts an item back to a snapshot (Undo). Re-creates a deleted item with its old id and placements.
export async function applyItemSnapshot(client: Q, venueId: string, id: string, snap: ItemSnapshot, by: By): Promise<void> {
  await client.query(
    `insert into items (id, venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (id) do update set name=excluded.name, description=excluded.description, price=excluded.price, variants=excluded.variants, add_ons=excluded.add_ons, components=excluded.components,
       serves=excluded.serves, photo=excluded.photo, notes=excluded.notes, listed=excluded.listed, fa_draft=excluded.fa_draft, updated_at=now(), updated_by=excluded.updated_by`,
    [id, venueId, snap.name, snap.description, snap.price, JSON.stringify(snap.variants), JSON.stringify(snap.add_ons), JSON.stringify(snap.components), snap.serves, snap.photo, snap.notes, snap.listed, snap.fa_draft, by]);
  await client.query('delete from item_sections where item_id = $1', [id]);
  for (const p of snap.placements ?? []) await client.query('insert into item_sections (item_id, section_id, position) select $1, $2, $3 where exists (select 1 from sections where id = $2) on conflict do nothing', [id, p.section_id, p.position]);
}

export function dbError(e: unknown): string {
  const err = e as { code?: string; constraint?: string; message?: string };
  if (err.constraint === 'listed_requires_price') return 'The item needs a price before it can be shown (database rule)';
  return err.message || 'database error';
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
