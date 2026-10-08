// Editor state: the whole menu of one venue (sections in order, items by id, items in no section) and the small
// pure helpers the client needs. No database code here (this module runs in the browser).
import type { Bi, EditorItem, EditorMenu, EditorSection, Variant } from '@/lib/types';

export type Menu = EditorMenu;
export type Action =
  | { type: 'replace'; menu: Menu }
  | { type: 'item'; item: EditorItem }
  | { type: 'item-removed'; id: string }
  | { type: 'section'; section: EditorSection }
  | { type: 'section-removed'; id: string; orphaned: string[] }
  | { type: 'item-order'; section_id: string; item_ids: string[] }
  | { type: 'section-order'; section_ids: string[] };

export function reduce(m: Menu, a: Action): Menu {
  switch (a.type) {
    case 'replace': return a.menu;
    case 'item': {
      const items = { ...m.items, [a.item.id]: a.item };
      const placed = new Set(a.item.placements.map((p) => p.section_id));
      const sections = m.sections.map((s) => {
        const has = s.item_ids.includes(a.item.id);
        if (placed.has(s.id) && !has) return { ...s, item_ids: [...s.item_ids, a.item.id] };
        if (!placed.has(s.id) && has) return { ...s, item_ids: s.item_ids.filter((x) => x !== a.item.id) };
        return s;
      });
      const orphans = placed.size ? m.orphans.filter((x) => x !== a.item.id) : m.orphans.includes(a.item.id) ? m.orphans : [...m.orphans, a.item.id];
      return { sections, items, orphans };
    }
    case 'item-removed': {
      const items = { ...m.items }; delete items[a.id];
      return { sections: m.sections.map((s) => (s.item_ids.includes(a.id) ? { ...s, item_ids: s.item_ids.filter((x) => x !== a.id) } : s)), items, orphans: m.orphans.filter((x) => x !== a.id) };
    }
    case 'section': {
      const exists = m.sections.some((s) => s.id === a.section.id);
      const sections = exists ? m.sections.map((s) => (s.id === a.section.id ? a.section : s)) : [...m.sections, a.section];
      return { ...m, sections };
    }
    case 'section-removed': {
      const items = { ...m.items };
      for (const id of Object.keys(items)) if (items[id].placements.some((p) => p.section_id === a.id)) items[id] = { ...items[id], placements: items[id].placements.filter((p) => p.section_id !== a.id) };
      return { sections: m.sections.filter((s) => s.id !== a.id), items, orphans: [...m.orphans, ...a.orphaned.filter((x) => !m.orphans.includes(x))] };
    }
    case 'item-order': return { ...m, sections: m.sections.map((s) => (s.id === a.section_id ? { ...s, item_ids: a.item_ids } : s)) };
    case 'section-order': { const by = new Map(m.sections.map((s) => [s.id, s])); return { ...m, sections: a.section_ids.map((id) => by.get(id)!).filter(Boolean) }; }
  }
}

export type Filter = 'all' | 'price' | 'draft' | 'fa' | 'photo' | 'none';
export type Need = Exclude<Filter, 'all' | 'none'>;

export function listingProblem(i: { price: number | null; variants: Variant[] }): string | null {
  if (i.price != null) return null;
  if (i.variants.length && i.variants.every((v) => v.price != null)) return null;
  return i.variants.length ? 'Every size needs a price before the item can be shown' : 'The item needs a price before it can be shown';
}
export function persianMissing(i: { name: Bi; description: Bi; variants?: Variant[] }): boolean {
  return !!(i.name.en && !i.name.fa) || !!(i.description?.en && !i.description.fa) || !!i.variants?.some((v) => v.label.en && !v.label.fa);
}
export const needs = (i: EditorItem) => ({ price: !!listingProblem(i), draft: i.fa_draft.length > 0, fa: persianMissing(i), photo: !i.photo });

// Counts for the Needs-attention bar; "none" = items in no section (hidden from customers until moved; Kian, 2026-10-08).
export function attention(m: Menu): Record<Exclude<Filter, 'all'>, number> {
  const c = { price: 0, draft: 0, fa: 0, photo: 0, none: m.orphans.filter((id) => m.items[id]).length };
  for (const i of Object.values(m.items)) { const n = needs(i); if (n.price) c.price++; if (n.draft) c.draft++; if (n.fa) c.fa++; if (n.photo) c.photo++; }
  return c;
}

export const money = (n: number | null | undefined): string => (n == null ? '' : `$${Number(n).toFixed(2).replace(/\.00$/, '')}`);
export function priceSummary(i: EditorItem): string {
  if (i.price != null) return money(i.price);
  const ps = i.variants.map((v) => v.price).filter((p): p is number => p != null);
  if (!i.variants.length) return '';
  if (ps.length !== i.variants.length) return `${i.variants.length} sizes`;
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}
