'use client';
// The Menu tab: "Needs attention" (only when there is something to do), search as you type, Jump to section,
// collapsible sections with their switch, count, "+ Add item" and menu, and item rows (photo · name with Persian
// underneath · price edited in place · Shown/Hidden switch). Drag to reorder on a laptop; Move up / Move down on a phone.
// Items in no section are not a pile in the normal flow (Kian, 2026-10-08): they count in the Needs-attention bar and
// are listed only when that count is tapped (or a search finds them).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorItem, EditorSection } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { attention, listingProblem, money, needs, priceSummary, type Filter, type Need, type Menu as MenuData } from './state';
import { Badge, Menu, Photo, Switch, btnSecondary } from './ui';

export type MenuTabProps = {
  menu: MenuData; filter: Filter; setFilter: (f: Filter) => void; query: string; setQuery: (q: string) => void; highlightId: string | null;
  onOpen: (id: string, sectionId: string | null) => void; onAdd: (sectionId: string) => void; onAddSection: () => void;
  onToggleItem: (id: string, listed: boolean) => Promise<void>; onPrice: (id: string, price: number | null) => Promise<void>;
  onToggleSection: (id: string, listed: boolean) => Promise<void>; onRename: (id: string) => void; onMoveSection: (id: string, dir: 'up' | 'down') => Promise<void>;
  onDeleteSection: (id: string) => void; onReorderSections: (ids: string[]) => Promise<void>; onMoveItem: (sectionId: string, id: string, index: number) => Promise<void>;
};
type Drag = { kind: 'item'; id: string; section: string } | { kind: 'section'; id: string };
type Over = { id: string; after: boolean } | null;
const LABEL: Record<Exclude<Filter, 'all'>, (n: number) => string> = { none: (n) => `${n} in no section`, price: (n) => `${n} need${n === 1 ? 's' : ''} a price`, draft: (n) => `${n} Persian draft${n === 1 ? '' : 's'}`, fa: (n) => `${n} missing Persian`, photo: (n) => `${n} without a photo` };

export function MenuTab(p: MenuTabProps) {
  const { menu, filter, setFilter, query, setQuery } = p;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fine, setFine] = useState(false);
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  useEffect(() => { setFine(window.matchMedia('(pointer: fine)').matches); }, []);
  const counts = useMemo(() => attention(menu), [menu]);
  const anyAttention = Object.values(counts).some((n) => n > 0);
  const q = query.trim().toLowerCase();
  const matches = (i: EditorItem) => !q || (i.name.en ?? '').toLowerCase().includes(q) || (i.name.fa ?? '').includes(query.trim());
  const keep = (i: EditorItem, orphan: boolean) => (filter === 'all' || (filter === 'none' ? orphan : needs(i)[filter as Need])) && matches(i);
  const narrowing = filter !== 'all' || !!q;
  const groups = useMemo(() => {
    const g = menu.sections.map((s) => ({ s, ids: s.item_ids.filter((id) => menu.items[id] && keep(menu.items[id], false)) }));
    const o = narrowing ? menu.orphans.filter((id) => menu.items[id] && keep(menu.items[id], true)) : []; // in no section: only when asked for
    return { sections: narrowing ? g.filter((x) => x.ids.length > 0) : g, orphans: o };
  }, [menu, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = groups.sections.reduce((n, g) => n + g.ids.length, 0) + groups.orphans.length;
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const jump = (id: string) => { setCollapsed((c) => { const n = new Set(c); n.delete(id); return n; }); requestAnimationFrame(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };

  // Drag and drop (laptop): items within one section, sections among themselves.
  const dnd = {
    start: (d: Drag) => (e: React.DragEvent) => { drag.current = d; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); },
    overRow: (kind: Drag['kind'], id: string, section?: string) => (e: React.DragEvent) => {
      const d = drag.current; if (!d || d.kind !== kind || (d.kind === 'item' && d.section !== section) || d.id === id) return;
      e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setOver({ id, after: e.clientY > r.top + r.height / 2 });
    },
    drop: (kind: Drag['kind'], id: string, section?: string) => async (e: React.DragEvent) => {
      e.preventDefault(); const d = drag.current; drag.current = null; setOver(null);
      if (!d || d.kind !== kind || d.id === id || (d.kind === 'item' && d.section !== section)) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; // read at the drop itself, not from state
      if (d.kind === 'item' && section) {
        const ids = menu.sections.find((s) => s.id === section)!.item_ids.filter((x) => x !== d.id);
        const idx = ids.indexOf(id) + (after ? 1 : 0);
        await p.onMoveItem(section, d.id, idx).catch(() => undefined);
      } else if (d.kind === 'section') {
        const ids = menu.sections.map((s) => s.id).filter((x) => x !== d.id);
        ids.splice(ids.indexOf(id) + (after ? 1 : 0), 0, d.id);
        await p.onReorderSections(ids).catch(() => undefined);
      }
    },
    end: () => { drag.current = null; setOver(null); },
  };
  const dropCls = (id: string) => (over?.id === id ? (over.after ? 'drop-after' : 'drop-before') : '');

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-32 sm:px-5">
      {anyAttention && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2" aria-label="Needs attention">
          <span className="mr-1 flex items-center gap-1 text-sm font-semibold text-amber-900"><Icon name="alert" className="h-4 w-4" />Needs attention</span>
          {(Object.keys(counts) as Exclude<Filter, 'all'>[]).filter((k) => counts[k] > 0).map((k) => (
            <button key={k} type="button" onClick={() => setFilter(filter === k ? 'all' : k)} aria-pressed={filter === k} className={`min-h-11 rounded-full px-3 py-1 text-[13px] font-medium ${filter === k ? 'bg-amber-900 text-white' : 'bg-white text-amber-900 shadow-[0_1px_2px_rgba(0,0,0,.06)]'}`}>{LABEL[k](counts[k])}</button>
          ))}
        </div>
      )}
      <div className="sticky top-[6.25rem] z-20 -mx-3 glass px-3 py-2 sm:-mx-5 sm:px-5">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" aria-label="Search items" autoComplete="off" className="h-11 w-full rounded-full border-0 bg-fill pl-10 pr-9 text-base placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-accent/25" />
            {query && <button type="button" onClick={() => setQuery('')} className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted" aria-label="Clear search"><Icon name="close" className="h-4 w-4" /></button>}
          </label>
          <label className="relative shrink-0">
            <span className="sr-only">Jump to section</span>
            <select value="" onChange={(e) => { if (e.target.value) jump(e.target.value); }} aria-label="Jump to section" className="h-11 max-w-[11rem] appearance-none rounded-full bg-fill pl-4 pr-9 text-[15px] font-medium text-ink focus:outline-none focus:ring-[3px] focus:ring-accent/25">
              <option value="">Jump to section</option>
              {menu.sections.map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}
            </select>
            <Icon name="down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          </label>
        </div>
        {narrowing && <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted"><span>{shown} item{shown === 1 ? '' : 's'}{filter !== 'all' && <> · {LABEL[filter](counts[filter]).replace(/^\d+ /, '')}</>}</span><button type="button" onClick={() => { setFilter('all'); setQuery(''); }} className="font-medium text-ink underline-offset-4 hover:underline">Show all</button></p>}
      </div>

      {groups.sections.map(({ s, ids }, n) => (
        <section key={s.id} id={`sec-${s.id}`} className={`relative mt-3 scroll-mt-40 rounded-2xl border border-line bg-white shadow-card ${dropCls(s.id)}`}
          onDragOver={dnd.overRow('section', s.id)} onDrop={dnd.drop('section', s.id)}>
          <header className={`flex items-center gap-1 py-1.5 pl-1 pr-2 ${s.listed ? '' : 'opacity-70'}`} draggable={fine} onDragStart={dnd.start({ kind: 'section', id: s.id })} onDragEnd={dnd.end}>
            <button type="button" onClick={() => toggle(s.id)} aria-expanded={!collapsed.has(s.id)} aria-label={collapsed.has(s.id) ? `Expand ${s.name.en}` : `Collapse ${s.name.en}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-fill"><Icon name="down" className={`h-5 w-5 transition ${collapsed.has(s.id) ? '-rotate-90' : ''}`} /></button>
            <button type="button" onClick={() => toggle(s.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-x-2 text-left">
              <span className="truncate text-[17px] font-semibold leading-6">{s.name.en}</span>
              <span className="shrink-0 text-sm leading-6 tabular-nums text-ink-muted">{s.item_ids.length}</span>
              {s.name.fa && <span lang="fa" dir="rtl" className="hidden min-w-0 truncate text-[14px] leading-6 text-ink-muted sm:inline">{s.name.fa}</span>}
              {/* the badges sit inside the name button, so on a small phone they do not squeeze its tap area below 44 px (the PM, 2026-10-09) */}
              {!s.listed && <Badge>Hidden</Badge>}
              {s.listed && s.item_ids.length > 0 && !s.item_ids.some((id) => menu.items[id]?.listed) && <Badge tone="amber">No item shown</Badge>}
              {s.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
            </button>
            <span className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => p.onAdd(s.id)} className="ml-1 flex h-11 min-w-11 items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold text-accent-strong hover:bg-accent-soft" aria-label={`Add item to ${s.name.en}`}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} /><span className="hidden sm:inline">Add item</span><span className="sm:hidden">Add</span></button>
              <Menu label={`Section menu: ${s.name.en}`} items={[
                { text: 'Rename', onClick: () => p.onRename(s.id) },
                { text: 'Move up', disabled: n === 0, onClick: () => { void p.onMoveSection(s.id, 'up'); } },
                { text: 'Move down', disabled: n === menu.sections.length - 1, onClick: () => { void p.onMoveSection(s.id, 'down'); } },
                { text: 'Delete section', danger: true, onClick: () => p.onDeleteSection(s.id) },
              ]} />
              <span className="ml-1 flex items-center"><Switch checked={s.listed} label={s.listed ? `${s.name.en}: shown. Tap to hide` : `${s.name.en}: hidden. Tap to show`} onChange={(v) => p.onToggleSection(s.id, v)} /></span>
            </span>
          </header>
          {!collapsed.has(s.id) && (
            ids.length === 0
              ? <p className="border-t border-line px-4 py-4 text-sm text-ink-muted">{narrowing ? 'No matching item here.' : <>No items yet. <button type="button" onClick={() => p.onAdd(s.id)} className="inline-flex min-h-11 items-center font-medium text-accent-strong underline-offset-4 hover:underline">Add the first item</button></>}</p>
              : <ul className="border-t border-line px-1 pb-1">{ids.map((id) => <Row key={id} item={menu.items[id]} sectionId={s.id} fine={fine} dropCls={dropCls(id)} highlighted={p.highlightId === id} onOpen={p.onOpen} onToggle={p.onToggleItem} onPrice={p.onPrice}
                  dragProps={{ draggable: fine, onDragStart: dnd.start({ kind: 'item', id, section: s.id }), onDragOver: dnd.overRow('item', id, s.id), onDrop: dnd.drop('item', id, s.id), onDragEnd: dnd.end }} />)}</ul>
          )}
        </section>
      ))}

      {groups.orphans.length > 0 && (
        <section id="sec-none" className="mt-3 scroll-mt-40 rounded-2xl border border-amber-200 bg-white shadow-card">
          <header className="flex flex-wrap items-center gap-2 px-4 py-3"><span className="text-[17px] font-semibold">In no section</span><span className="text-sm tabular-nums text-ink-muted">{groups.orphans.length}</span><Badge tone="amber">Not shown to customers</Badge><span className="basis-full text-xs text-ink-muted">Open an item and tick a section under “Also show in…” to put it back on the menu.</span></header>
          <ul className="border-t border-line px-1 pb-1">{groups.orphans.map((id) => <Row key={id} item={menu.items[id]} sectionId={null} fine={false} dropCls="" highlighted={p.highlightId === id} onOpen={p.onOpen} onToggle={p.onToggleItem} onPrice={p.onPrice} dragProps={{}} />)}</ul>
        </section>
      )}

      {shown === 0 && narrowing && <p className="mt-8 text-center text-sm text-ink-muted">Nothing matches. <button type="button" onClick={() => { setFilter('all'); setQuery(''); }} className="font-medium text-ink underline-offset-4 hover:underline">Show all</button></p>}
      {!narrowing && <div className="mt-4 flex justify-center"><button type="button" onClick={p.onAddSection} className={btnSecondary}><Icon name="plus" className="h-4 w-4" />Add section</button></div>}
    </div>
  );
}

function Row({ item, sectionId, fine, dropCls, highlighted, onOpen, onToggle, onPrice, dragProps }: { item: EditorItem; sectionId: string | null; fine: boolean; dropCls: string; highlighted: boolean; onOpen: MenuTabProps['onOpen']; onToggle: MenuTabProps['onToggleItem']; onPrice: MenuTabProps['onPrice']; dragProps: React.HTMLAttributes<HTMLLIElement> & { draggable?: boolean } }) {
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => { if (!reason) return; const t = setTimeout(() => setReason(null), 5000); return () => clearTimeout(t); }, [reason]);
  const n = needs(item);
  return (
    <li {...dragProps} data-item={item.id} className={`group relative flex flex-wrap items-center gap-x-2 rounded-xl px-1 py-1 ${dropCls} ${highlighted ? 'bg-accent-soft' : ''}`}>
      {fine && <span className="hidden h-8 w-4 shrink-0 cursor-grab items-center justify-center text-neutral-300 group-hover:text-neutral-400 sm:flex" aria-hidden="true"><Icon name="grip" className="h-4 w-4" /></span>}
      <button type="button" onClick={() => onOpen(item.id, sectionId)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left" aria-label={`Edit ${item.name.en ?? 'item'}`}>
        <Photo url={item.photo?.url} className="h-12 w-12 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-medium leading-5 ${item.listed ? '' : 'text-ink-muted'}`}>{item.name.en}</span>
          {item.name.fa && <span lang="fa" dir="rtl" className="block truncate text-left text-[13px] leading-4 text-ink-muted">{item.name.fa}</span>}
          {(!item.listed || n.price || n.draft || n.photo) && (
            <span className="mt-0.5 flex flex-wrap gap-1">{!item.listed && <Badge>Hidden</Badge>}{n.price && <Badge tone="amber">Needs price</Badge>}{n.draft && <Badge tone="blue">Persian draft</Badge>}{n.photo && <Badge>No photo</Badge>}</span>
          )}
        </span>
      </button>
      <PriceCell item={item} onPrice={(v) => onPrice(item.id, v)} onOpen={() => onOpen(item.id, sectionId)} />
      {/* Controls column: the Shown switch; a "Sold out today" switch is meant to go under it later. */}
      <span className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-1 self-stretch">
        <Switch checked={item.listed} label={item.listed ? `${item.name.en}: shown. Tap to hide` : `${item.name.en}: hidden. Tap to show`} onChange={async (v) => { setReason(null); try { await onToggle(item.id, v); } catch (e) { setReason((e as Error).message); } }} />
      </span>
      {reason && <p role="alert" className="basis-full px-1 pb-1 text-[13px] text-red-600">{reason}</p>}
    </li>
  );
}

// The price, edited in place: one tap turns it into a field; Enter or leaving the field saves. Items with sizes open the editor instead.
function PriceCell({ item, onPrice, onOpen }: { item: EditorItem; onPrice: (v: number | null) => Promise<void>; onOpen: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const committed = useRef(false);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 4000); return () => clearTimeout(t); }, [err]);
  if (item.variants.length) return <button type="button" onClick={onOpen} className="min-h-11 shrink-0 rounded-lg px-2 text-right text-[15px] font-semibold tabular-nums hover:bg-fill" aria-label={`Sizes: ${priceSummary(item)}. Tap to edit`}>{priceSummary(item)}</button>;
  const commit = async () => {
    if (committed.current) return; committed.current = true;
    const t = draft.trim().replace(/^\$/, ''); const n = t === '' ? null : Number(t);
    setEditing(false);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setErr('Not a price'); return; }
    if (n === item.price) return;
    try { await onPrice(n); } catch (e) { setErr((e as Error).message); }
  };
  if (editing) return (
    <span className="relative shrink-0">
      <input type="text" inputMode="decimal" value={draft} autoFocus aria-label="Price" onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.target.select()}
        onBlur={() => { void commit(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commit(); } if (e.key === 'Escape') { committed.current = true; setEditing(false); } }}
        className="h-11 w-24 rounded-xl border border-accent bg-white px-2 text-right text-[15px] font-semibold tabular-nums focus:outline-none focus:ring-[3px] focus:ring-accent/25" />
    </span>
  );
  return (
    <span className="relative shrink-0">
      <button type="button" data-price onClick={() => { committed.current = false; setDraft(item.price == null ? '' : String(item.price)); setEditing(true); }} className={`min-h-11 min-w-[4.5rem] rounded-lg px-2 text-right text-[15px] font-semibold tabular-nums hover:bg-fill ${item.price == null ? 'text-neutral-400' : ''}`} aria-label={item.price == null ? 'No price. Tap to add one' : `Price ${money(item.price)}. Tap to change`}>
        {item.price == null ? 'Add price' : money(item.price)}
      </button>
      {err && <span role="alert" className="absolute right-0 top-full z-10 mt-0.5 whitespace-nowrap rounded-md bg-red-600 px-2 py-0.5 text-[12px] text-white">{err}</span>}
    </span>
  );
}
export { listingProblem };
