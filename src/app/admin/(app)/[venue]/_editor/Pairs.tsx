'use client';
// "Goes well with" (Kian via the PM, 2026-11-18): the item editor's card, directly after ITEM, and its picker. Up to 4 other items of the
// same venue that go well with this one; customers see them in this item's popup, under its description (src/components/menu-kit.tsx).
//   The card: one row per pair, in the order picked (photo, name, price, Remove), then "+ Add item" with "n of 4"; at 4 the button is
//     gone and a line in its place says how to add another. Order is the order picked: remove and add again to change it. A pair that
//     customers do not see now (hidden, out of season, in no shown section) says so under its name, in the Menu list's words: it stays
//     in the list and the public page leaves it out until it is back on the menu (one line under the card says so, only then).
//     Empty, the card is its one row and nothing else: it sits between ITEM and PRICE, and a just-added item must keep its description
//     and its price on the first screen of a phone (the editor drill's t-add); what the list is for is said in the picker.
//   The picker: a sheet with a search field and this venue's items grouped by section, in the menu's order (the Seasonal section named
//     as customers see it now; an item in two sections under both; items in no section last). The item itself is not offered; the ones
//     already in the list are shown as Added; hidden and out-of-season items are listed and labelled. A tap adds the item at the end of
//     the list and closes the sheet. Its first line says what the list is for and where customers see it.
// One-way: adding B here does nothing to B's own list. Every add and remove is the item's usual save (the list as a whole, in its patch:
// save order, version check, change record, "Saved · Undo"); the preview then shows the item's popup with the list (Editor.tsx).
// In the editor's look (kit.tsx): no colour literal here.
import { useState } from 'react';
import type { EditorItem, EditorSection, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, notShownWhy, priceSummary, type Seasons } from './state';
import { Photo, Sheet } from './ui';
import { Heading, cardCls } from './kit';
import { COUNTS } from '@/lib/rules';

type Patch = (p: Record<string, unknown>) => Promise<void>;
const MAX = COUNTS.pairs;

export function Pairs({ item, sections, items, season, picking, setPicking, onPatch }: {
  item: EditorItem; sections: EditorSection[]; items: Record<string, EditorItem>; season: SeasonId; picking: boolean; setPicking: (open: boolean) => void; onPatch: Patch;
}) {
  const ctx: Seasons = { season, seasonalId: sections.find((s) => s.seasonal)?.id ?? null };
  const list = item.pairs.filter((id) => items[id] && id !== item.id); // the items of this venue the list names
  const marked = list.some((id) => notShownWhy(items[id], { sections }, ctx));
  const save = (pairs: string[]) => onPatch({ pairs });
  return (
    <section data-pairs="">
      <Heading>Goes well with</Heading>
      <div className={cardCls}>
        {list.map((id) => {
          const p = items[id], why = notShownWhy(p, { sections }, ctx);
          return (
            <div key={id} data-pair-row={id} className="flex items-center gap-3 py-1.5 pl-3">
              <Photo url={p.photo?.url} className="h-11 w-11 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-base leading-6 [overflow-wrap:anywhere]">{p.name.en}</span>
                {why && <span data-pair-why="" className="block text-[13px] leading-5 text-ink-muted">{why}</span>}
              </span>
              <span className="shrink-0 text-base tabular-nums text-ink-muted">{priceSummary(p)}</span>
              <button type="button" aria-label={`Remove ${p.name.en ?? 'item'} from Goes well with`} onClick={() => { void save(list.filter((x) => x !== id)).catch(() => undefined); /* a failed save: the toast and the top bar say so */ }}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          );
        })}
        {list.length < MAX
          ? <button type="button" data-pairs-add="" onClick={() => setPicking(true)} aria-label={`Add an item that goes well with this one (${list.length} of ${MAX})`}
              className="flex min-h-11 w-full items-center gap-1.5 px-3 text-left text-base font-semibold text-accent-ink">
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} /><span>Add item</span>
              <span data-pairs-count="" className="ml-auto text-[13px] font-normal text-ink-muted">{list.length} of {MAX}</span>
            </button>
          : <p data-pairs-full="" className="flex min-h-11 items-center justify-between gap-3 px-3 text-[13px] text-ink-muted"><span>Remove one to add another.</span><span data-pairs-count="">{MAX} of {MAX}</span></p>}
      </div>
      {marked && <p data-pairs-note="" className="px-3 pt-1.5 text-[13px] text-ink-muted">Customers do not see the ones marked until they are back on the menu.</p>}
      {picking && <PairPicker item={item} taken={list} sections={sections} items={items} ctx={ctx} onPick={(id) => save([...list, id])} onClose={() => setPicking(false)} />}
    </section>
  );
}

// The picker: this venue's items by section, searched by name (English or Persian). One tap adds an item and closes the sheet.
function PairPicker({ item, taken, sections, items, ctx, onPick, onClose }: {
  item: EditorItem; taken: string[]; sections: EditorSection[]; items: Record<string, EditorItem>; ctx: Seasons; onPick: (id: string) => Promise<void>; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = (i: EditorItem) => !q || (i.name.en ?? '').toLowerCase().includes(q) || (i.name.fa ?? '').includes(query.trim());
  const offered = (id: string) => id !== item.id && !!items[id] && matches(items[id]); // never the item itself
  const loose = Object.values(items).filter((i) => !i.placements.length).sort((a, b) => (a.name.en ?? '').localeCompare(b.name.en ?? '')).map((i) => i.id);
  const groups = [
    ...sections.map((s) => ({ key: s.id, name: s.seasonal ? `Seasonal (${SEASON_NAMES[ctx.season]} Menu)` : s.name.en ?? '', ids: s.item_ids })),
    { key: 'none', name: 'In no section', ids: loose },
  ].map((g) => ({ ...g, ids: g.ids.filter(offered) })).filter((g) => g.ids.length > 0);
  const pick = async (id: string) => { setBusy(id); setErr(null); try { await onPick(id); onClose(); } catch (e) { setErr((e as Error).message); setBusy(null); } };
  return (
    <Sheet title={`Goes well with “${item.name.en ?? 'this item'}”`} onClose={onClose} wide>
      <p className="mb-3 text-[13px] text-ink-muted">Pick an item to add, up to {MAX} in all. Customers see them in this item’s popup, under the description.</p>
      <label className="relative block">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search this venue’s items" autoComplete="off"
          className="h-11 w-full rounded-xl border-0 bg-fill pl-10 pr-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent-ink/40" />
      </label>
      <div className="mt-3 max-h-[56dvh] space-y-4 overflow-y-auto" data-pair-list="">
        {groups.map((g) => (
          <div key={g.key} data-pair-section={g.name}>
            <p className="pb-1 text-base font-semibold [overflow-wrap:anywhere]">{g.name}</p>
            {g.ids.map((id) => {
              const p = items[id], added = taken.includes(id), label = added ? 'Added' : notShownWhy(p, { sections }, ctx);
              return (
                <button key={id} type="button" data-pair-pick={id} disabled={added || busy !== null} aria-label={`${p.name.en ?? 'Item'}${label ? `, ${label}` : ''}`} onClick={() => { void pick(id); }}
                  className="flex min-h-11 w-full items-center gap-3 border-t border-line px-1 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50">
                  <Photo url={p.photo?.url} className="h-11 w-11 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-6 [overflow-wrap:anywhere]">{p.name.en}</span>
                    {label && <span data-pair-label="" className="block text-[13px] leading-5 text-ink-muted">{label}</span>}
                  </span>
                  <span className="shrink-0 text-base tabular-nums text-ink-muted">{priceSummary(p)}</span>
                </button>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="py-6 text-center text-base text-ink-muted">Nothing matches.</p>}
      </div>
      {err && <p role="alert" className="mt-3 text-[13px] text-danger">{err}</p>}
    </Sheet>
  );
}
