import { query } from './db';
import type { Venue, Section, Item, Bi, Variant, AddOn, Component, SeasonId } from './types';
import { SEASONAL_TITLES } from './seasonal';

export async function getVenues(): Promise<Venue[]> {
  return query<Venue>('select id, name, tagline, locations, brand, settings, template, style from venues order by id');
}

export async function getVenue(id: string): Promise<Venue | null> {
  const rows = await query<Venue>('select id, name, tagline, locations, brand, settings, template, style from venues where id = $1', [id]);
  return rows[0] ?? null;
}

// Public menu: listed sections that have at least one listed item in season, with those items in position order. In season (Kian,
// 2026-10-12): an item tagged with seasons only in them (none = all year), in every section; in the venue's Seasonal section only the
// items tagged for the season itself. The Seasonal section comes first, titled by the season (src/lib/seasonal.ts). A venue with no
// seasonal item gets exactly the sections and items it got before the feature.
const IN_SEASON = `(case when s.seasonal then $2 = any(i.seasons) else (cardinality(i.seasons) = 0 or $2 = any(i.seasons)) end)`;
export async function getPublicMenu(venueId: string, showDrafts: boolean, season: SeasonId): Promise<Section[]> {
  const sections = await query<Section>(
    `select s.id, s.name, s.note, s.position, s.listed, s.fa_draft, s.layout, s.seasonal
       from sections s
      where s.venue_id = $1 and s.listed
        and exists (select 1 from item_sections x join items i on i.id = x.item_id where x.section_id = s.id and i.listed and ${IN_SEASON})
      order by s.seasonal desc, s.position`, [venueId, season]);
  const items = await query<Item & { section_id: string }>(
    `select i.id, i.name, i.description, i.price, i.variants, i.add_ons, i.components, i.serves, i.photo, i.notes, i.listed, i.fa_draft, x.position, x.section_id
       from item_sections x join items i on i.id = x.item_id join sections s on s.id = x.section_id
      where i.venue_id = $1 and i.listed and ${IN_SEASON}
      order by x.position, i.name->>'en'`, [venueId, season]);
  return sections.map((s) => {
    const sec = stripDrafts(s, showDrafts);
    if (s.seasonal) sec.name = SEASONAL_TITLES[season];
    sec.items = items.filter((i) => i.section_id === s.id).map((i) => stripDrafts(i, showDrafts));
    return sec;
  });
}

// When drafts are switched off for a venue, drafted Persian falls back to English (every field that can carry a draft).
function stripDrafts<T extends { fa_draft: string[]; name: Bi; description?: Bi; note?: Bi; variants?: Variant[]; add_ons?: AddOn[]; components?: Component[] }>(row: T, showDrafts: boolean): T {
  if (showDrafts || !row.fa_draft?.length) return { ...row };
  const out = { ...row };
  const d = row.fa_draft;
  if (d.includes('name')) out.name = { ...row.name, fa: null };
  if (d.includes('description') && row.description) out.description = { ...row.description, fa: null };
  if (d.includes('note') && row.note) out.note = { ...row.note, fa: null };
  if (d.includes('variants') && row.variants) out.variants = row.variants.map((v) => ({ ...v, label: { ...v.label, fa: null } }));
  if (d.includes('addOns') && row.add_ons) out.add_ons = row.add_ons.map((a) => ({ ...a, group: { ...a.group, fa: null }, label: { ...a.label, fa: null } }));
  if (d.includes('components') && row.components) out.components = row.components.map((c) => ({ ...c, label: { ...c.label, fa: null } }));
  return out;
}

