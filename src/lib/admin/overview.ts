// Counts for the admin home and venue pages, plus alerts.
import { pool } from '@/lib/db';
import type { Bi } from '@/lib/types';

export type VenueCounts = { venue_id: string; listed: number; unlisted: number; needs_price: number; persian_missing: number; sections: number };
export async function venueCounts(): Promise<VenueCounts[]> {
  return (await pool.query<VenueCounts>(
    `select v.id as venue_id,
       (select count(*)::int from items i where i.venue_id = v.id and i.listed) as listed,
       (select count(*)::int from items i where i.venue_id = v.id and not i.listed) as unlisted,
       (select count(*)::int from items_needing_price i where i.venue_id = v.id) as needs_price,
       (select count(*)::int from items i where i.venue_id = v.id and i.listed and ((i.name->>'fa') is null or ((i.description->>'en') is not null and (i.description->>'fa') is null))) as persian_missing,
       (select count(*)::int from sections s where s.venue_id = v.id) as sections
     from venues v order by v.id`)).rows;
}

export type Alert = { id: number; venue_id: string | null; kind: string; message: string; created_at: string; seen_at: string | null };
export async function openAlerts(): Promise<Alert[]> {
  return (await pool.query<Alert>('select id, venue_id, kind, message, created_at, seen_at from admin_alerts where seen_at is null order by created_at desc')).rows;
}
export async function markAlertSeen(id: number): Promise<void> { await pool.query('update admin_alerts set seen_at = now() where id = $1', [id]); }

export type AdminItem = { id: string; name: Bi; description: Bi; price: string | null; variants: { label: Bi; price: number | null }[]; listed: boolean; photo: { url: string } | null; fa_draft: string[]; section_id: string | null; position: number | null };
export type AdminSection = { id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; items: AdminItem[] };

// Every section (listed or not) with every item placed in it, plus items placed nowhere.
export async function venueMenuForAdmin(venueId: string): Promise<{ sections: AdminSection[]; orphans: AdminItem[] }> {
  const sections = (await pool.query<AdminSection>('select id, name, note, position, listed, fa_draft from sections where venue_id = $1 order by position, name->>\'en\'', [venueId])).rows;
  const items = (await pool.query<AdminItem>(
    `select i.id, i.name, i.description, i.price, i.variants, i.listed, i.photo, i.fa_draft, x.section_id, x.position
       from items i left join item_sections x on x.item_id = i.id where i.venue_id = $1 order by x.position, i.name->>'en'`, [venueId])).rows;
  for (const s of sections) s.items = items.filter((i) => i.section_id === s.id);
  return { sections, orphans: items.filter((i) => i.section_id == null) };
}
