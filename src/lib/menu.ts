import { query } from './db';
import type { Venue, Section, Item } from './types';

export async function getVenues(): Promise<Venue[]> {
  return query<Venue>('select id, name, tagline, locations, brand, settings from venues order by id');
}

export async function getVenue(id: string): Promise<Venue | null> {
  const rows = await query<Venue>('select id, name, tagline, locations, brand, settings from venues where id = $1', [id]);
  return rows[0] ?? null;
}

// Public menu: listed sections that have at least one listed item, with their listed items in position order.
export async function getPublicMenu(venueId: string, showDrafts: boolean): Promise<Section[]> {
  const sections = await query<Section>(
    `select s.id, s.name, s.note, s.position, s.listed, s.fa_draft
       from sections s
      where s.venue_id = $1 and s.listed
        and exists (select 1 from item_sections x join items i on i.id = x.item_id where x.section_id = s.id and i.listed)
      order by s.position`, [venueId]);
  const items = await query<Item & { section_id: string }>(
    `select i.id, i.name, i.description, i.price, i.variants, i.add_ons, i.components, i.serves, i.photo, i.listed, i.fa_draft, x.position, x.section_id
       from item_sections x join items i on i.id = x.item_id
      where i.venue_id = $1 and i.listed
      order by x.position, i.name->>'en'`, [venueId]);
  for (const s of sections) s.items = items.filter((i) => i.section_id === s.id).map((i) => stripDrafts(i, showDrafts));
  return sections;
}

// When drafts are switched off for a venue, drafted Persian falls back to English.
function stripDrafts<T extends { fa_draft: string[]; name: Item['name']; description: Item['description'] }>(row: T, showDrafts: boolean): T {
  if (showDrafts || !row.fa_draft?.length) return row;
  const out = { ...row };
  if (row.fa_draft.includes('name')) out.name = { ...row.name, fa: null };
  if (row.fa_draft.includes('description')) out.description = { ...row.description, fa: null };
  return out;
}

