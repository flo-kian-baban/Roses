// Venue details (name, tagline, logo, addresses, phones, hours), the Persian-drafts switch and the Style tab values;
// owner and admin (step 2 of the admin rebuild). "To confirm" marks per field come from the import and clear when the
// field is edited or the location is marked confirmed. "+ Add venue" creates a venue on the default template.
import type { Pool, PoolClient } from 'pg';
import { pool } from '@/lib/db';
type Q = Pool | PoolClient;
import type { Bi, Brand, StyleValues, Venue } from '@/lib/types';
import { recordRevision, type By } from './revisions';
import { dbError, type Result } from './items';

export type VenueSnapshot = { name: Bi; tagline: Bi; locations: Venue['locations']; settings: { showPersianDrafts: boolean }; brand?: Brand; style?: StyleValues };
const COLS = 'id, name, tagline, locations, brand, settings, template, style';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function getVenueRow(id: string): Promise<Venue | null> {
  return (await pool.query<Venue>(`select ${COLS} from venues where id = $1`, [id])).rows[0] ?? null;
}
export async function listVenueRows(): Promise<Venue[]> {
  return (await pool.query<Venue>(`select ${COLS} from venues order by id`)).rows;
}

export async function updateVenue(id: string, patch: Partial<VenueSnapshot>, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const row = (await client.query<Venue>(`select ${COLS} from venues where id = $1 for update`, [id])).rows[0];
    if (!row) { await client.query('rollback'); return { ok: false, error: 'venue not found' }; }
    const before: VenueSnapshot = { name: row.name, tagline: row.tagline, locations: row.locations, settings: row.settings, brand: row.brand, style: row.style };
    const next: VenueSnapshot = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as VenueSnapshot;
    if (same(before, next)) { await client.query('rollback'); return { ok: true, id }; }
    await applyVenueSnapshot(client, id, next, by);
    const revision = await recordRevision(client, { venueId: id, table: 'venues', rowId: id, action: 'update', before, after: next, by });
    await client.query('commit');
    return { ok: true, id, revision };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}

// Older records (before step 2) carry no brand or style: those columns are then left as they are.
export async function applyVenueSnapshot(client: Q, id: string, snap: VenueSnapshot, by: By): Promise<void> {
  await client.query('update venues set name=$2, tagline=$3, locations=$4, settings=$5, brand=coalesce($6, brand), style=coalesce($7, style), updated_at=now(), updated_by=$8 where id=$1',
    [id, snap.name, snap.tagline, JSON.stringify(snap.locations), snap.settings, snap.brand === undefined ? null : JSON.stringify(snap.brand), snap.style === undefined ? null : JSON.stringify(snap.style), by]);
}

// "+ Add venue": the id is made from the English name (letters, digits and dashes), must not clash with another venue or
// an address the app itself uses, and gets the default template with one empty section so "+ Add item" is at hand.
const RESERVED = new Set(['admin', 'api', 'uploads', 'brand', 'new', 'team', 'login', 'favicon.ico', 'robots.txt', 'sitemap.xml', '_next', 'index']);
export function slugOf(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
export async function createVenue(data: { name: Bi; id?: string | null }, by: By): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const wanted = data.id ? slugOf(data.id) : slugOf(data.name.en ?? '');
    if (!wanted || RESERVED.has(wanted)) { await client.query('rollback'); return { ok: false, error: 'That name cannot be used as a web address. Try another name.' }; }
    let id = wanted;
    for (let n = 2; (await client.query('select 1 from venues where id = $1', [id])).rowCount; n++) id = `${wanted}-${n}`;
    const brand: Brand = { logo: null, colors: {}, fonts: { heading: 'system-ui, sans-serif', body: 'system-ui, sans-serif', persian: 'var(--font-vazirmatn), system-ui, sans-serif' } };
    const snap: VenueSnapshot = { name: data.name, tagline: { en: null, fa: null }, locations: [], settings: { showPersianDrafts: true }, brand, style: {} };
    await client.query(`insert into venues (id, name, tagline, locations, brand, settings, template, style, updated_by) values ($1,$2,$3,'[]',$4,$5,'default','{}',$6)`, [id, snap.name, snap.tagline, JSON.stringify(brand), snap.settings, by]);
    await recordRevision(client, { venueId: id, table: 'venues', rowId: id, action: 'create', before: null, after: { ...snap, template: 'default' }, by });
    const sec = await client.query<{ id: string }>(`insert into sections (venue_id, name, note, position, listed, fa_draft, updated_by) values ($1, $2, '{"en": null, "fa": null}', 0, true, '{}', $3) returning id`, [id, { en: 'Menu', fa: 'منو' }, by]);
    await recordRevision(client, { venueId: id, table: 'sections', rowId: sec.rows[0].id, action: 'create', before: null, after: { name: { en: 'Menu', fa: 'منو' }, note: { en: null, fa: null }, position: 0, listed: true, fa_draft: [] }, by });
    await client.query('commit');
    return { ok: true, id };
  } catch (e) { await client.query('rollback'); return { ok: false, error: dbError(e) }; } finally { client.release(); }
}
