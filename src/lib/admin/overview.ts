// The page editor's data (every section and item of a venue, shown or hidden) and the lockout alerts.
import { pool } from '@/lib/db';
import type { EditorItem, EditorMenu, EditorSection } from '@/lib/types';
import { toEditorItem, type ItemRow, type Placement } from './items';

export async function editorMenu(venueId: string): Promise<EditorMenu> {
  const sections = (await pool.query<Omit<EditorSection, 'item_ids'>>(`select id, name, note, position, listed, fa_draft, layout from sections where venue_id = $1 order by position, name->>'en'`, [venueId])).rows;
  const rows = (await pool.query<ItemRow>(`select id, venue_id, name, description, price, variants, add_ons, components, serves, photo, notes, listed, fa_draft, updated_at, updated_by, import_key from items where venue_id = $1 order by name->>'en'`, [venueId])).rows;
  const placements = (await pool.query<Placement & { item_id: string; name_en: string | null }>(
    `select x.item_id, x.section_id, x.position, i.name->>'en' as name_en from item_sections x join items i on i.id = x.item_id where i.venue_id = $1 order by x.position, i.name->>'en'`, [venueId])).rows;
  const byItem = new Map<string, Placement[]>();
  for (const p of placements) byItem.set(p.item_id, [...(byItem.get(p.item_id) ?? []), { section_id: p.section_id, position: p.position }]);
  const items: Record<string, EditorItem> = {};
  for (const r of rows) items[r.id] = toEditorItem({ ...r, placements: byItem.get(r.id) ?? [] });
  const out: EditorSection[] = sections.map((s) => ({ ...s, item_ids: placements.filter((p) => p.section_id === s.id).map((p) => p.item_id) }));
  const orphans = rows.filter((r) => !byItem.has(r.id)).map((r) => r.id);
  return { sections: out, items, orphans };
}

export type Alert = { id: number; venue_id: string | null; kind: string; message: string; created_at: string; seen_at: string | null };
export async function openAlerts(): Promise<Alert[]> {
  return (await pool.query<Alert>('select id, venue_id, kind, message, created_at, seen_at from admin_alerts where seen_at is null order by created_at desc')).rows;
}
export async function markAlertSeen(id: number): Promise<void> { await pool.query('update admin_alerts set seen_at = now() where id = $1', [id]); }
