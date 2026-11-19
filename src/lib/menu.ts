import { query } from './db';
import type { Venue, Section, Item, Bi, Variant, AddOn, Component, SeasonId } from './types';
import { SEASONAL_TITLES } from './seasonal';
import { confirmedNotes } from './allergens';

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
// seasonal item gets exactly the sections and items it got before the feature. Allergen and dietary notes still drafted from research
// (items.drafts, Kian's ruling of 2026-10-12) are removed here, so they never reach a public page until an owner or admin confirms them.
// "Goes well with" (Kian via the PM, 2026-11-18; items.pairs, src/lib/pairs.ts): each item carries the ids of the items it is paired
// with that are on this page themselves (shown, in a shown section, in season: one of the items returned here), in the order picked; a
// pair that is hidden or out of season is left out silently, so every pair has a row on the page to be shown from and a popup to open.
// An item with no pair to show carries no list.
const IN_SEASON = `(case when s.seasonal then $2 = any(i.seasons) else (cardinality(i.seasons) = 0 or $2 = any(i.seasons)) end)`;
export async function getPublicMenu(venueId: string, showDrafts: boolean, season: SeasonId): Promise<Section[]> {
  const sections = await query<Section>(
    `select s.id, s.name, s.note, s.position, s.listed, s.fa_draft, s.layout, s.seasonal
       from sections s
      where s.venue_id = $1 and s.listed
        and exists (select 1 from item_sections x join items i on i.id = x.item_id where x.section_id = s.id and i.listed and ${IN_SEASON})
      order by s.seasonal desc, s.position`, [venueId, season]);
  const items = await query<Item & { section_id: string; drafts: string[]; pair_ids: string[] }>(
    `select i.id, i.name, i.description, i.price, i.variants, i.add_ons, i.components, i.serves, i.photo, i.notes, i.listed, i.fa_draft, i.drafts, i.pairs as pair_ids, x.position, x.section_id
       from item_sections x join items i on i.id = x.item_id join sections s on s.id = x.section_id
      where i.venue_id = $1 and i.listed and ${IN_SEASON}
      order by x.position, i.name->>'en'`, [venueId, season]);
  const wanted = new Map<string, string[]>(); // item → the ids it is paired with
  const out = sections.map((s) => {
    const sec = stripDrafts(s, showDrafts);
    if (s.seasonal) sec.name = SEASONAL_TITLES[season];
    sec.items = items.filter((i) => i.section_id === s.id).map(({ drafts, pair_ids, ...i }) => { if (pair_ids?.length) wanted.set(i.id, pair_ids); return stripDrafts({ ...i, notes: confirmedNotes(i.notes, drafts) }, showDrafts); });
    return sec;
  });
  if (!wanted.size) return out;
  const onPage = new Set<string>(); // every item of the page
  for (const s of out) for (const i of s.items) onPage.add(i.id);
  for (const s of out) s.items = s.items.map((i) => {
    const pairs = (wanted.get(i.id) ?? []).filter((id) => onPage.has(id));
    return pairs.length ? { ...i, pairs } : i;
  });
  return out;
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

