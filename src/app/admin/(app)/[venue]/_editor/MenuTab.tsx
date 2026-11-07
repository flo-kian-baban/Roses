'use client';
// The Menu tab: "Needs attention" (only when there is something to do), search as you type, Jump to section,
// collapsible sections with their switch, count, "+ Add item" and menu, and item rows (photo · name with Persian
// underneath · price edited in place · Shown/Hidden switch). Drag to reorder on a laptop; Move up / Move down on a phone.
// Items in no section are not a pile in the normal flow (Kian, 2026-10-08): they count in the Needs-attention bar and
// are listed only when that count is tapped (or a search finds them).
// Seasonal items (Kian, 2026-10-12): the venue's Seasonal section sits at the top with its switch and "+ Add item" (adding there tags the
// item with today's season); it cannot be renamed, moved or deleted. Items hidden by their seasons today show "Out of season" (or "No
// season" in the Seasonal section) and count in the Needs-attention bar.
// In the admin's look (the admin-wide clean-up, 2026-11-06): white cards on the grey page, the needs as chips, names in full (never cut short).
// Reorder items (the PM's clean-up of the item editor, 2026-11-04, which took Move up / Move down out of the editor): every section's menu,
// the Seasonal section's included, has "Reorder items"; the section's rows then show Move up and Move down (44 × 44 each) in place of the
// price and the switch, and Done ends it. A laptop also drags the rows, as before.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorItem, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, attention, money, needs, priceSummary, seasonState, seasonsCtx, type Filter, type Need, type Menu as MenuData, type Seasons } from './state';
import { Badge, Menu, Photo, Switch } from './ui';
import { card, chipCls, headingCls, headingStyle, textBtn } from '../../../_ui/look';
import { retryable } from './api';
import { parsePrice, priceInput } from '@/lib/rules';

export type MenuTabProps = {
  menu: MenuData; season: SeasonId; canNotes: boolean; filter: Filter; setFilter: (f: Filter) => void; query: string; setQuery: (q: string) => void; highlightId: string | null;
  onOpen: (id: string, sectionId: string | null) => void; onAdd: (sectionId: string) => void; onAddSection: () => void;
  onToggleItem: (id: string, listed: boolean) => Promise<void>; onPrice: (id: string, price: number | null) => Promise<void>;
  onToggleSection: (id: string, listed: boolean) => Promise<void>; onRename: (id: string) => void; onMoveSection: (id: string, dir: 'up' | 'down') => Promise<void>;
  onDeleteSection: (id: string) => void; onReorderSections: (ids: string[]) => Promise<void>; onMoveItem: (sectionId: string, id: string, index: number) => Promise<void>;
};
type Drag = { kind: 'item'; id: string; section: string } | { kind: 'section'; id: string };
type Over = { id: string; after: boolean } | null;
const LABEL: Record<Exclude<Filter, 'all'>, (n: number) => string> = { none: (n) => `${n} in no section`, price: (n) => `${n} need${n === 1 ? 's' : ''} a price`, draft: (n) => `${n} Persian draft${n === 1 ? '' : 's'}`, fa: (n) => `${n} missing Persian`, photo: (n) => `${n} without a photo`, season: (n) => `${n} out of season`, allergens: (n) => `Allergens to confirm (${n})`, hidden: (n) => `Hidden items (${n})` };

export function MenuTab(p: MenuTabProps) {
  const { menu, filter, setFilter, query, setQuery } = p;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fine, setFine] = useState(false);
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [reordering, setReordering] = useState<string | null>(null); // the section whose items are being put in order
  const [moving, setMoving] = useState(false); // one move at a time, so a quick second tap moves from where the first left it
  useEffect(() => { setFine(window.matchMedia('(pointer: fine)').matches); }, []);
  const ctx = useMemo(() => seasonsCtx(menu, p.season), [menu, p.season]);
  const counts = useMemo(() => { const c = attention(menu, ctx); if (!p.canNotes) c.allergens = 0; return c; }, [menu, ctx, p.canNotes]); // allergens to confirm: owners and admins only (they confirm)
  const anyAttention = Object.values(counts).some((n) => n > 0);
  const q = query.trim().toLowerCase();
  const matches = (i: EditorItem) => !q || (i.name.en ?? '').toLowerCase().includes(q) || (i.name.fa ?? '').includes(query.trim());
  // a need is looked for among the shown items (the bar counts them only); "Hidden items" lists the hidden ones (Part B #5)
  const keep = (i: EditorItem, orphan: boolean) => (filter === 'all' || (filter === 'none' ? orphan : filter === 'hidden' ? !i.listed : i.listed && needs(i, ctx)[filter as Need])) && matches(i);
  const narrowing = filter !== 'all' || !!q;
  const groups = useMemo(() => {
    const g = menu.sections.map((s) => ({ s, ids: s.item_ids.filter((id) => menu.items[id] && keep(menu.items[id], false)) }));
    const o = narrowing ? menu.orphans.filter((id) => menu.items[id] && keep(menu.items[id], true)) : []; // in no section: only when asked for
    return { sections: narrowing ? g.filter((x) => x.ids.length > 0) : g, orphans: o };
  }, [menu, filter, q, ctx]);
  const shown = groups.sections.reduce((n, g) => n + g.ids.length, 0) + groups.orphans.length;
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const reorder = (id: string) => { setFilter('all'); setQuery(''); setCollapsed((c) => { const n = new Set(c); n.delete(id); return n; }); setReordering(id); };
  const moveBy = async (sectionId: string, id: string, by: number) => {
    const ids = menu.sections.find((x) => x.id === sectionId)?.item_ids ?? []; const i = ids.indexOf(id);
    if (moving || i < 0 || i + by < 0 || i + by >= ids.length) return;
    setMoving(true); try { await p.onMoveItem(sectionId, id, i + by); } catch { /* the toast says why */ } finally { setMoving(false); }
  };
  const jump = (id: string) => { setCollapsed((c) => { const n = new Set(c); n.delete(id); return n; }); requestAnimationFrame(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };

  // Drag and drop (laptop): items within one section, sections among themselves.
  const dnd = {
    start: (d: Drag) => (e: React.DragEvent) => { drag.current = d; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); },
    overRow: (kind: Drag['kind'], id: string, section?: string) => (e: React.DragEvent) => {
      const d = drag.current; if (!d || d.kind !== kind || (d.kind === 'item' && d.section !== section) || d.id === id || (kind === 'section' && id === ctx.seasonalId)) return;
      e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setOver({ id, after: e.clientY > r.top + r.height / 2 });
    },
    drop: (kind: Drag['kind'], id: string, section?: string) => async (e: React.DragEvent) => {
      e.preventDefault(); const d = drag.current; drag.current = null; setOver(null);
      if (!d || d.kind !== kind || d.id === id || (d.kind === 'item' && d.section !== section) || (kind === 'section' && id === ctx.seasonalId)) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2; // read at the drop itself, not from state
      if (d.kind === 'item' && section) {
        const ids = menu.sections.find((s) => s.id === section)!.item_ids.filter((x) => x !== d.id);
        const idx = ids.indexOf(id) + (after ? 1 : 0);
        await p.onMoveItem(section, d.id, idx).catch(() => undefined);
      } else if (d.kind === 'section') {
        const ids = menu.sections.filter((s) => !s.seasonal).map((s) => s.id).filter((x) => x !== d.id);
        ids.splice(ids.indexOf(id) + (after ? 1 : 0), 0, d.id);
        await p.onReorderSections(ids).catch(() => undefined);
      }
    },
    end: () => { drag.current = null; setOver(null); },
  };
  const dropCls = (id: string) => (over?.id === id ? (over.after ? 'drop-after' : 'drop-before') : '');
  const regular = menu.sections.filter((s) => !s.seasonal).map((s) => s.id); // the order the section menus move in

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-32 sm:px-5">
      {anyAttention && (
        <div className="mt-4" aria-label="Needs attention">
          <p className={`${headingCls} px-3 pb-1.5`} style={headingStyle}>Needs attention</p>
          <div className={`${card} flex flex-wrap items-center gap-1.5 p-2`}>
            {(Object.keys(counts) as Exclude<Filter, 'all'>[]).filter((k) => counts[k] > 0).map((k) => (
              <button key={k} type="button" onClick={() => setFilter(filter === k ? 'all' : k)} aria-pressed={filter === k} className={chipCls(filter === k).replace('text-base', 'text-[13px]')}>{LABEL[k](counts[k])}</button>
            ))}
          </div>
        </div>
      )}
      <div className="sticky top-[6.25rem] z-20 -mx-3 glass px-3 py-2 sm:-mx-5 sm:px-5">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search items" autoComplete="off" className="h-11 w-full rounded-xl border-0 bg-fill pl-10 pr-9 text-base placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent-ink/40" />
            {query && <button type="button" onClick={() => setQuery('')} className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-muted" aria-label="Clear search"><Icon name="close" className="h-4 w-4" /></button>}
          </label>
          <label className="relative shrink-0">
            <span className="sr-only">Jump to section</span>
            <select value="" onChange={(e) => { if (e.target.value) jump(e.target.value); }} aria-label="Jump to section" className="h-11 max-w-[11rem] appearance-none rounded-xl bg-fill pl-3 pr-9 text-base font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/40">
              <option value="">Jump to section</option>
              {menu.sections.map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}
            </select>
            <Icon name="down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          </label>
        </div>
        {narrowing && <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted"><span>{shown} item{shown === 1 ? '' : 's'}{filter !== 'all' && <> · {LABEL[filter](counts[filter]).replace(/^\d+ /, '').replace(/ \(\d+\)$/, '')}</>}</span><button type="button" onClick={() => { setFilter('all'); setQuery(''); }} className="tap font-semibold text-accent-ink">Show all</button></p>}
      </div>

      {groups.sections.map(({ s, ids }) => (
        <section key={s.id} id={`sec-${s.id}`} data-seasonal={s.seasonal ? '' : undefined} data-reorder={reordering === s.id ? s.id : undefined} className={`relative mt-3 scroll-mt-40 rounded-xl bg-canvas ${dropCls(s.id)}`}
          onDragOver={dnd.overRow('section', s.id)} onDrop={dnd.drop('section', s.id)}>
          <header className={`flex items-center gap-1 py-1.5 pl-1 pr-2 ${s.listed ? '' : 'opacity-70'}`} draggable={fine && !s.seasonal} onDragStart={dnd.start({ kind: 'section', id: s.id })} onDragEnd={dnd.end}>
            <button type="button" onClick={() => toggle(s.id)} aria-expanded={!collapsed.has(s.id)} aria-label={collapsed.has(s.id) ? `Expand ${s.name.en}` : `Collapse ${s.name.en}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-fill"><Icon name="down" className={`h-5 w-5 transition ${collapsed.has(s.id) ? '-rotate-90' : ''}`} /></button>
            {/* the name wraps (two lines at most) instead of "Senso …" on a 360 px phone (Part B #6) */}
            <button type="button" onClick={() => toggle(s.id)} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-2 text-left" data-section-name="">
              <span className="line-clamp-2 min-w-0 text-[17px] font-semibold leading-6 [overflow-wrap:anywhere]">{s.name.en}</span>
              <span className="shrink-0 text-[13px] leading-6 tabular-nums text-ink-muted">{s.item_ids.length}</span>
              {s.name.fa && <span lang="fa" dir="rtl" className="hidden min-w-0 text-[13px] leading-6 text-ink-muted [overflow-wrap:anywhere] sm:inline">{s.name.fa}</span>}
              {/* the badges sit inside the name button, so on a small phone they do not squeeze its tap area below 44 px (the PM, 2026-10-09) */}
              {!s.listed && <Badge>Hidden</Badge>}
              {s.listed && s.item_ids.length > 0 && !s.item_ids.some((id) => menu.items[id]?.listed) && <Badge tone="amber">No item shown</Badge>}
              {s.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
            </button>
            {reordering === s.id
              ? <button type="button" data-reorder-done="" onClick={() => setReordering(null)} className="ml-1 flex h-11 min-w-11 shrink-0 items-center rounded-xl px-3 text-base font-semibold text-accent-ink hover:bg-accent-soft">Done</button>
              : <span className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => p.onAdd(s.id)} className="ml-1 flex h-11 min-w-11 items-center gap-1 rounded-xl px-2.5 text-base font-semibold text-accent-ink hover:bg-accent-soft" aria-label={`Add item to ${s.name.en}`}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} /><span className="hidden sm:inline">Add item</span><span className="sm:hidden">Add</span></button>
              <Menu label={`Section menu: ${s.name.en}`} items={s.seasonal ? [{ text: 'Reorder items', disabled: s.item_ids.length < 2, onClick: () => reorder(s.id) }] : [
                { text: 'Rename', onClick: () => p.onRename(s.id) },
                { text: 'Reorder items', disabled: s.item_ids.length < 2, onClick: () => reorder(s.id) },
                { text: 'Move up', disabled: regular.indexOf(s.id) <= 0, onClick: () => { void p.onMoveSection(s.id, 'up').catch(() => undefined); } },
                { text: 'Move down', disabled: regular.indexOf(s.id) === regular.length - 1, onClick: () => { void p.onMoveSection(s.id, 'down').catch(() => undefined); } },
                { text: 'Delete section', danger: true, onClick: () => p.onDeleteSection(s.id) },
              ]} />
              <span className="ml-1 flex items-center"><Switch checked={s.listed} label={s.listed ? `${s.name.en}: shown. Tap to hide` : `${s.name.en}: hidden. Tap to show`} onChange={(v) => p.onToggleSection(s.id, v)} /></span>
            </span>}
          </header>
          {reordering === s.id && <p className="border-t border-line px-4 py-2 text-[13px] text-ink-muted">Move items with the arrows. Customers see the new order at once.</p>}
          {s.seasonal && !collapsed.has(s.id) && reordering !== s.id && <p className="border-t border-line px-4 py-2 text-[13px] text-ink-muted">Customers see it first, as “{SEASON_NAMES[p.season]} Menu”, with the items here tagged {SEASON_NAMES[p.season]}. An item added here is tagged {SEASON_NAMES[p.season]}; change its seasons in the item.</p>}
          {!collapsed.has(s.id) && (
            ids.length === 0
              ? <p className="border-t border-line px-4 py-3 text-base text-ink-muted">{narrowing ? 'No matching item here.' : <>No items yet. <button type="button" onClick={() => p.onAdd(s.id)} className="inline-flex min-h-11 items-center font-semibold text-accent-ink">Add the first item</button></>}</p>
              : <ul className="border-t border-line px-1 pb-1">{ids.map((id) => <Row key={id} item={menu.items[id]} ctx={ctx} sectionId={s.id} fine={fine} dropCls={dropCls(id)} highlighted={p.highlightId === id} onOpen={p.onOpen} onToggle={p.onToggleItem} onPrice={p.onPrice}
                  reorder={reordering === s.id ? { first: s.item_ids.indexOf(id) <= 0, last: s.item_ids.indexOf(id) >= s.item_ids.length - 1, busy: moving, up: () => { void moveBy(s.id, id, -1); }, down: () => { void moveBy(s.id, id, 1); } } : undefined}
                  dragProps={{ draggable: fine, onDragStart: dnd.start({ kind: 'item', id, section: s.id }), onDragOver: dnd.overRow('item', id, s.id), onDrop: dnd.drop('item', id, s.id), onDragEnd: dnd.end }} />)}</ul>
          )}
        </section>
      ))}

      {groups.orphans.length > 0 && (
        <section id="sec-none" className="mt-3 scroll-mt-40 rounded-xl bg-canvas">
          <header className="flex flex-wrap items-center gap-2 px-4 py-3"><span className="text-[17px] font-semibold">In no section</span><span className="text-[13px] tabular-nums text-ink-muted">{groups.orphans.length}</span><Badge tone="amber">Not shown to customers</Badge><span className="basis-full text-[13px] text-ink-muted">Open an item and tick a section under “Also show in…” to put it back on the menu.</span></header>
          <ul className="border-t border-line px-1 pb-1">{groups.orphans.map((id) => <Row key={id} item={menu.items[id]} ctx={ctx} sectionId={null} fine={false} dropCls="" highlighted={p.highlightId === id} onOpen={p.onOpen} onToggle={p.onToggleItem} onPrice={p.onPrice} dragProps={{}} />)}</ul>
        </section>
      )}

      {shown === 0 && narrowing && <p className="mt-8 text-center text-base text-ink-muted">Nothing matches. <button type="button" onClick={() => { setFilter('all'); setQuery(''); }} className="tap font-semibold text-accent-ink">Show all</button></p>}
      {!narrowing && <div className="mt-4 flex justify-center"><button type="button" onClick={p.onAddSection} className={textBtn}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />Add section</button></div>}
    </div>
  );
}

type Reorder = { first: boolean; last: boolean; busy: boolean; up: () => void; down: () => void };
function Row({ item, ctx, sectionId, fine, dropCls, highlighted, onOpen, onToggle, onPrice, reorder, dragProps }: { item: EditorItem; ctx: Seasons; sectionId: string | null; fine: boolean; dropCls: string; highlighted: boolean; onOpen: MenuTabProps['onOpen']; onToggle: MenuTabProps['onToggleItem']; onPrice: MenuTabProps['onPrice']; reorder?: Reorder; dragProps: React.HTMLAttributes<HTMLLIElement> & { draggable?: boolean } }) {
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => { if (!reason) return; const t = setTimeout(() => setReason(null), 5000); return () => clearTimeout(t); }, [reason]);
  const n = needs(item, ctx);
  const st = seasonState(item, ctx), off = st === 'none' && sectionId !== ctx.seasonalId ? null : st; // "No season" only where it is not shown: in the Seasonal section
  return (
    <li {...dragProps} data-item={item.id} className={`group relative flex flex-wrap items-center gap-x-2 rounded-xl px-1 py-1 ${dropCls} ${highlighted ? 'bg-accent-soft' : ''}`}>
      {fine && <span className="hidden h-8 w-4 shrink-0 cursor-grab items-center justify-center text-ink-muted/40 group-hover:text-ink-muted sm:flex" aria-hidden="true"><Icon name="grip" className="h-4 w-4" /></span>}
      <button type="button" onClick={() => onOpen(item.id, sectionId)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left" aria-label={`Edit ${item.name.en ?? 'item'}`}>
        <Photo url={item.photo?.url} className="h-12 w-12 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className={`block text-base font-medium leading-5 [overflow-wrap:anywhere] ${item.listed ? '' : 'text-ink-muted'}`}>{item.name.en}</span>
          {item.name.fa && <span lang="fa" dir="rtl" className="block text-left text-[13px] leading-5 text-ink-muted [overflow-wrap:anywhere]">{item.name.fa}</span>}
          {(!item.listed || n.price || n.draft || n.photo || off) && (
            <span className="mt-0.5 flex flex-wrap gap-x-2">{!item.listed && <Badge>Hidden</Badge>}{off === 'out' && <Badge tone="amber">Out of season</Badge>}{off === 'none' && <Badge tone="amber">No season</Badge>}{n.price && <Badge tone="amber">Needs price</Badge>}{n.draft && <Badge tone="blue">Persian draft</Badge>}{n.photo && <Badge>No photo</Badge>}</span>
          )}
        </span>
      </button>
      {reorder ? (
        // reordering the section: Move up and Move down in place of the price and the switch
        <span className="flex shrink-0 items-center" data-reorder-row="">
          <button type="button" aria-label={`Move ${item.name.en ?? 'item'} up`} disabled={reorder.first || reorder.busy} onClick={reorder.up} className="flex h-11 w-11 items-center justify-center rounded-xl text-accent-ink hover:bg-accent-soft disabled:text-ink-muted/30 disabled:hover:bg-transparent"><Icon name="up" className="h-5 w-5" strokeWidth={2.2} /></button>
          <button type="button" aria-label={`Move ${item.name.en ?? 'item'} down`} disabled={reorder.last || reorder.busy} onClick={reorder.down} className="flex h-11 w-11 items-center justify-center rounded-xl text-accent-ink hover:bg-accent-soft disabled:text-ink-muted/30 disabled:hover:bg-transparent"><Icon name="down" className="h-5 w-5" strokeWidth={2.2} /></button>
        </span>
      ) : (<>
      <PriceCell item={item} onPrice={(v) => onPrice(item.id, v)} onOpen={() => onOpen(item.id, sectionId)} />
      {/* Controls column: the Shown switch; a "Sold out today" switch is meant to go under it later. */}
      <span className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-1 self-stretch">
        <Switch checked={item.listed} label={item.listed ? `${item.name.en}: shown. Tap to hide` : `${item.name.en}: hidden. Tap to show`} onChange={async (v) => { setReason(null); try { await onToggle(item.id, v); } catch (e) { setReason((e as Error).message); } }} />
      </span>
      </>)}
      {reason && <p role="alert" className="basis-full px-1 pb-1 text-[13px] text-danger">{reason}</p>}
    </li>
  );
}

// The price, edited in place: one tap turns it into a field; Enter or leaving the field saves. Items with sizes open the editor instead.
// A price whose save did not go through stays on screen, marked "Not saved", until the toast's Try again saves it or it is edited again
// (pre-go-live audit, the residual of D-02: before, the old price came back while Try again held the typed one).
function PriceCell({ item, onPrice, onOpen }: { item: EditorItem; onPrice: (v: number | null) => Promise<void>; onOpen: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<{ v: number | null } | null>(null);
  const committed = useRef(false);
  useEffect(() => { if (!err || unsaved) return; const t = setTimeout(() => setErr(null), 4000); return () => clearTimeout(t); }, [err, unsaved]);
  useEffect(() => { if (unsaved && item.price === unsaved.v) { setUnsaved(null); setErr(null); } }, [item.price, unsaved]);
  if (item.variants.length) return <button type="button" onClick={onOpen} className="min-h-11 shrink-0 rounded-xl px-2 text-right text-base font-semibold tabular-nums hover:bg-fill" aria-label={`Sizes: ${priceSummary(item)}. Tap to edit`}>{priceSummary(item)}</button>;
  const commit = async () => {
    if (committed.current) return; committed.current = true;
    const n = parsePrice(draft); // the server's own reading (pre-go-live audit S2-07)
    setEditing(false);
    if (n === 'bad') { setErr('Not a price'); return; }
    if (n === item.price) { setUnsaved(null); return; }
    setUnsaved(null);
    try { await onPrice(n); } catch (e) { if (retryable(e)) { setUnsaved({ v: n }); setErr('Not saved'); } else setErr((e as Error).message); }
  };
  if (editing) return (
    <span className="relative shrink-0">
      <input type="text" inputMode="decimal" value={draft} autoFocus aria-label="Price" onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.target.select()}
        onBlur={() => { void commit(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commit(); } if (e.key === 'Escape') { committed.current = true; setEditing(false); } }}
        className="h-11 w-24 rounded-xl bg-fill px-2 text-right text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-ink/40" />
    </span>
  );
  return (
    <span className="relative shrink-0">
      <button type="button" data-price data-unsaved={unsaved ? '' : undefined} onClick={() => { committed.current = false; const shown = unsaved ? unsaved.v : item.price; setDraft(priceInput(shown)); setEditing(true); }} className={`min-h-11 min-w-[4.5rem] rounded-xl px-2 text-right text-base font-semibold tabular-nums hover:bg-fill ${unsaved ? 'text-danger underline decoration-dotted' : item.price == null ? 'text-ink-muted' : ''}`} aria-label={unsaved ? `Price ${unsaved.v == null ? 'cleared' : money(unsaved.v)}, not saved. Tap to change` : item.price == null ? 'No price. Tap to add one' : `Price ${money(item.price)}. Tap to change`}>
        {unsaved ? (unsaved.v == null ? 'No price' : money(unsaved.v)) : item.price == null ? 'Add price' : money(item.price)}
      </button>
      {err && <span role="alert" className="absolute right-0 top-full z-10 mt-0.5 whitespace-nowrap rounded-xl bg-danger px-2 py-0.5 text-[13px] text-canvas">{err}</span>}
    </span>
  );
}
