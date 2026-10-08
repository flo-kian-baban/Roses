'use client';
// The page editor (Kian's admin rebuild, 2026-10-07; step 2 on 2026-10-08): the Menu, Style and Details tabs on the
// left, the customers' page as a phone preview on the right (a Preview button on phones). Every change is saved at
// once through the JSON API, answered with "Saved · Undo" for 10 seconds, and the preview reloads and scrolls to what
// was edited. Tapping an item, a section heading or the header inside the preview opens the matching editor.
import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Bi, EditorItem, EditorVenue, Notes, Photo } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { call, type Resp } from './api';
import { reduce, type Filter, type Menu } from './state';
import { MenuTab } from './MenuTab';
import { ItemPanel, PhotoField } from './ItemPanel';
import { Preview, type Focus, type Pick } from './Preview';
import { StyleTab } from './StyleTab';
import { DetailsTab } from './DetailsTab';
import { ConfirmSheet, MoneyField, Sheet, TextField, btnDanger, btnPrimary, btnSecondary, fieldCls } from './ui';

export type Me = { name: string; role: 'admin' | 'owner' | 'staff'; canNotes: boolean; canManage: boolean };
export type VenueInfo = EditorVenue;
type Tab = 'menu' | 'style' | 'details';
type Toast = { text: string; revisions: number[]; key: number; error?: boolean };
type Confirm = { title: string; body: React.ReactNode; label: string; action: () => Promise<void> };
export type DeleteMode = { items: 'move'; target: string } | { items: 'delete' };

export function Editor({ venue, me, initial, tab }: { venue: VenueInfo; me: Me; initial: Menu; tab: Tab }) {
  const [menu, dispatch] = useReducer(reduce, initial);
  const [open, setOpen] = useState<{ id: string; section: string | null } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'fa'>('en');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [wide, setWide] = useState(false); // ≥ 1366 px: the item panel gets its own column between the list and the preview
  useEffect(() => { const mq = window.matchMedia('(min-width: 1366px)'); const f = () => setWide(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.error ? 6000 : 10000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!highlight) return; const t = setTimeout(() => setHighlight(null), 2500); return () => clearTimeout(t); }, [highlight]);
  useEffect(() => { try { const l = localStorage.getItem('roses-lang'); if (l === 'fa') setLang('fa'); } catch { /* ignore */ } }, []);
  const chooseLang = (l: 'en' | 'fa') => { setLang(l); try { localStorage.setItem('roses-lang', l); } catch { /* ignore */ } };

  const apply = useCallback((r: Resp) => {
    if (r.item) dispatch({ type: 'item', item: r.item as EditorItem });
    if (r.section) dispatch({ type: 'section', section: r.section as Menu['sections'][number] });
    if (r.order) dispatch({ type: 'item-order', ...(r.order as { section_id: string; item_ids: string[] }) });
    if (r.section_order) dispatch({ type: 'section-order', section_ids: r.section_order as string[] });
    if (r.menu) dispatch({ type: 'replace', menu: r.menu as Menu });
  }, []);
  const done = useCallback((r: Resp, text: string, f: Focus) => {
    if (!r.revisions.length) return;
    setToast({ text, revisions: r.revisions, key: Date.now() });
    setReloadKey((k) => k + 1);
    setFocus(f);
  }, []);
  const sectionOf = (id: string) => open?.id === id && open.section ? open.section : menu.items[id]?.placements[0]?.section_id ?? null;

  // Items. Simple patches are applied at once (the switch flips, the price shows) and put back if the server refuses.
  const itemUpdate = async (id: string, patch: Record<string, unknown>, text = 'Saved') => {
    const before = menu.items[id];
    const optimistic = before && !('section_ids' in patch) ? { ...before, ...(patch as Partial<EditorItem>) } : null;
    if (optimistic) dispatch({ type: 'item', item: optimistic });
    try { const r = await call('/api/admin/item', { action: 'update', id, patch }); apply(r); done(r, text, { id, alt: sectionOf(id) }); }
    catch (e) { if (before) dispatch({ type: 'item', item: before }); throw e; }
  };
  const itemNotes = async (id: string, notes: Notes) => { const r = await call('/api/admin/item', { action: 'notes', id, notes }); apply(r); done(r, 'Saved', { id, alt: sectionOf(id) }); };
  const itemCreate = async (sectionId: string, data: { name: string; price: number | null; photo: Photo | null }) => {
    const r = await call('/api/admin/item', { action: 'create', venue: venue.id, section_id: sectionId, name: { en: data.name, fa: null }, price: data.price, photo: data.photo });
    apply(r); const item = r.item as EditorItem; done(r, 'Added', { id: item.id, alt: sectionId }); setHighlight(item.id);
  };
  const itemDelete = (id: string) => {
    const it = menu.items[id]; if (!it) return;
    setConfirm({ title: 'Delete this item?', body: <>“{it.name.en}” will be removed from the menu. You can undo for 10 seconds.</>, label: 'Delete', action: async () => {
      const sec = sectionOf(id); const r = await call('/api/admin/item', { action: 'delete', id });
      dispatch({ type: 'item-removed', id }); setOpen(null); setConfirm(null); done(r, 'Deleted', sec ? { id: sec } : null);
    } });
  };
  const itemMove = async (sectionId: string, id: string, index: number) => { const r = await call('/api/admin/item', { action: 'move', id, section_id: sectionId, index }); apply(r); done(r, 'Moved', { id, alt: sectionId }); };

  // Sections.
  const sectionUpdate = async (id: string, patch: Record<string, unknown>, text = 'Saved') => {
    const before = menu.sections.find((s) => s.id === id);
    if (before && 'listed' in patch) dispatch({ type: 'section', section: { ...before, listed: !!patch.listed } });
    try { const r = await call('/api/admin/section', { action: 'update', id, patch }); apply(r); done(r, text, { id }); }
    catch (e) { if (before) dispatch({ type: 'section', section: before }); throw e; }
  };
  const sectionCreate = async (name: string) => { const r = await call('/api/admin/section', { action: 'create', venue: venue.id, name: { en: name, fa: null } }); apply(r); const s = r.section as Menu['sections'][number]; done(r, 'Added', { id: s.id }); setAddingSection(false); requestAnimationFrame(() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ block: 'center' })); };
  const sectionMove = async (id: string, direction: 'up' | 'down') => { const r = await call('/api/admin/section', { action: 'move', id, direction }); apply(r); done(r, 'Moved', { id }); };
  const sectionReorder = async (ids: string[]) => { const r = await call('/api/admin/section', { action: 'reorder', venue: venue.id, section_ids: ids }); apply(r); done(r, 'Moved', null); };
  // Deleting a section with items asks once: move them to another section (the default) or delete them too (Kian, 2026-10-08). Undo restores either.
  const sectionDelete = (id: string) => {
    const s = menu.sections.find((x) => x.id === id); if (!s) return;
    if (s.item_ids.length) { setDeleting(id); return; }
    setConfirm({ title: 'Delete this section?', label: 'Delete section', body: <>“{s.name.en}” will be removed. You can undo for 10 seconds.</>,
      action: async () => { const r = await call('/api/admin/section', { action: 'delete', id, items: 'keep' }); apply(r); setConfirm(null); done(r, 'Deleted', null); } });
  };
  const sectionDeleteWith = async (id: string, mode: DeleteMode) => {
    const r = await call('/api/admin/section', { action: 'delete', id, items: mode.items, ...(mode.items === 'move' ? { target_section_id: mode.target } : {}) });
    apply(r); setDeleting(null); if (open && menu.items[open.id]?.placements.some((p) => p.section_id === id)) setOpen(null);
    done(r, mode.items === 'move' ? 'Deleted · items moved' : 'Deleted', mode.items === 'move' ? { id: mode.target } : null);
  };

  const undo = async () => {
    if (!toast?.revisions.length) return;
    const revisions = toast.revisions; setToast({ text: 'Undoing…', revisions: [], key: Date.now() });
    try { const r = await call('/api/admin/undo', { venue: venue.id, revisions }); apply(r); setToast({ text: 'Undone', revisions: [], key: Date.now() }); setReloadKey((k) => k + 1); }
    catch (e) { setToast({ text: (e as Error).message, revisions: [], key: Date.now(), error: true }); }
  };
  // Style and Details tabs report their saves here (the toast, the Undo and the preview reload are shared).
  const savedElsewhere = (r: Resp, text = 'Saved') => done(r, text, null);

  // Tap-to-edit in the preview: an item opens its editor, a section heading its rename sheet, the header the Details tab.
  const onPick = (pk: Pick) => {
    setPreviewOpen(false);
    if (pk.kind === 'item' && pk.id && menu.items[pk.id]) { setOpen({ id: pk.id, section: menu.items[pk.id].placements[0]?.section_id ?? null }); setHighlight(pk.id); if (tab !== 'menu') return; requestAnimationFrame(() => document.querySelector(`[data-item="${pk.id}"]`)?.scrollIntoView({ block: 'center' })); }
    else if (pk.kind === 'section' && pk.id && menu.sections.some((s) => s.id === pk.id)) setRenaming(pk.id);
    else if (pk.kind === 'header' && me.canManage && tab !== 'details') window.location.href = `/admin/${venue.id}?tab=details`;
  };

  const openItem = open ? menu.items[open.id] : null;
  const tabLink = (t: Tab, label: string) => <a href={`/admin/${venue.id}${t === 'menu' ? '' : `?tab=${t}`}`} aria-current={tab === t ? 'page' : undefined} className={`flex h-9 items-center rounded-full px-3.5 text-[15px] font-semibold ${tab === t ? 'bg-ink text-white' : 'text-ink-muted hover:bg-fill hover:text-ink'}`}>{label}</a>;

  const panel = openItem && <ItemPanel item={openItem} venueId={venue.id} sections={menu.sections} sectionId={open?.section ?? null} canNotes={me.canNotes} column={wide} onPatch={(p) => itemUpdate(openItem.id, p)} onNotes={(n) => itemNotes(openItem.id, n)} onDelete={() => itemDelete(openItem.id)} onMove={itemMove} onClose={() => setOpen(null)} />;
  return (
    <div className={`lg:grid ${openItem && wide ? 'lg:grid-cols-[minmax(0,1fr)_440px_520px]' : 'lg:grid-cols-[minmax(0,1fr)_520px]'}`}>
      <div className="relative min-w-0">
        <div className="glass sticky top-14 z-30 flex h-11 items-center gap-1 border-b border-line px-3 sm:px-5">
          {tabLink('menu', 'Menu')}
          {me.canManage && tabLink('style', 'Style')}
          {me.canManage && tabLink('details', 'Details')}
          <span className="flex-1" />
          <button type="button" onClick={() => setPreviewOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[14px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:hidden"><Icon name="smartphone" className="h-4 w-4" />Preview</button>
        </div>
        {tab === 'menu' && <MenuTab menu={menu} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} highlightId={highlight}
              onOpen={(id, section) => setOpen({ id, section })} onAdd={(sid) => setAdding(sid)} onAddSection={() => setAddingSection(true)}
              onToggleItem={(id, listed) => itemUpdate(id, { listed }, listed ? 'Shown' : 'Hidden')} onPrice={(id, price) => itemUpdate(id, { price })}
              onToggleSection={(id, listed) => sectionUpdate(id, { listed }, listed ? 'Shown' : 'Hidden')} onRename={(id) => setRenaming(id)} onMoveSection={sectionMove}
              onDeleteSection={sectionDelete} onReorderSections={sectionReorder} onMoveItem={itemMove} />}
        {tab === 'style' && me.canManage && <StyleTab venueId={venue.id} version={reloadKey} onSaved={savedElsewhere} />}
        {tab === 'details' && me.canManage && <DetailsTab venue={venue} version={reloadKey} onSaved={savedElsewhere} />}
      </div>
      {openItem && wide ? <div className="hidden lg:block">{panel}</div> : null}
      <aside className="hidden border-l border-line bg-fill lg:block">
        <div className="sticky top-14 h-[calc(100dvh-3.5rem)]"><Preview venueId={venue.id} reloadKey={reloadKey} focus={focus} lang={lang} onLang={chooseLang} frame onPick={onPick} /></div>
      </aside>

      {openItem && !wide && <>
        <button type="button" aria-label="Close the item" onClick={() => setOpen(null)} className="fixed inset-0 z-40 hidden bg-black/10 lg:block" />
        {panel}
      </>}
      {previewOpen && <div className="fixed inset-0 z-[60] lg:hidden"><Preview venueId={venue.id} reloadKey={reloadKey} focus={focus} lang={lang} onLang={chooseLang} frame={false} onClose={() => setPreviewOpen(false)} onPick={onPick} /></div>}
      {adding && <AddItemSheet venueId={venue.id} sectionName={menu.sections.find((s) => s.id === adding)?.name.en ?? ''} onClose={() => setAdding(null)} onAdd={async (d) => { await itemCreate(adding, d); setAdding(null); }} />}
      {addingSection && <AddSectionSheet onClose={() => setAddingSection(false)} onAdd={sectionCreate} />}
      {renaming && menu.sections.some((s) => s.id === renaming) && <RenameSheet section={menu.sections.find((s) => s.id === renaming)!} onClose={() => setRenaming(null)} onPatch={(p) => sectionUpdate(renaming, p)} />}
      {deleting && menu.sections.some((s) => s.id === deleting) && <DeleteSectionSheet section={menu.sections.find((s) => s.id === deleting)!} others={menu.sections.filter((s) => s.id !== deleting)} items={menu.items} onClose={() => setDeleting(null)} onDelete={(mode) => sectionDeleteWith(deleting, mode)} />}
      {confirm && <ConfirmSheet title={confirm.title} body={confirm.body} label={confirm.label} onConfirm={confirm.action} onClose={() => setConfirm(null)} />}
      {toast && (
        <div className={`toast fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-1 rounded-full py-1.5 pl-4 pr-1.5 text-[15px] font-medium text-white shadow-pop ${toast.error ? 'bg-red-600' : 'bg-ink'}`} role="status" style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <span>{toast.text}</span>
          {toast.revisions.length > 0 && <><span className="text-white/50">·</span><button type="button" onClick={() => { void undo(); }} className="flex h-9 items-center gap-1 rounded-full px-3 font-semibold hover:bg-white/15"><Icon name="undo" className="h-4 w-4" />Undo</button></>}
        </div>
      )}
    </div>
  );
}

// "+ Add item": name, price and an optional photo from the phone (uploaded when the item is added). Created shown when it has a price.
function AddItemSheet({ venueId, sectionName, onClose, onAdd }: { venueId: string; sectionName: string; onClose: () => void; onAdd: (d: { name: string; price: number | null; photo: Photo | null }) => Promise<void> }) {
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = price.trim().replace(/^\$/, ''); const n = t === '' ? null : Number(t);
    if (!name.trim()) { setErr('The name is required'); return; }
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setErr('Not a price'); return; }
    setBusy(true); setErr(null);
    try { await onAdd({ name: name.trim(), price: n, photo: photo ? { ...photo, alt: { en: name.trim(), fa: null } } : null }); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <Sheet title={`Add item to ${sectionName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="mb-1 block text-sm font-medium">Name</span><input className={fieldCls} name="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required aria-label="Name" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Price</span><span className="relative block"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-neutral-500">$</span><input className={`${fieldCls} pl-8 tabular-nums`} name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" aria-label="Price" /></span><span className="mt-1 block text-xs text-ink-muted">With a price the item is shown to customers at once; without one it stays hidden.</span></label>
        <div><span className="mb-1 block text-sm font-medium">Photo <span className="font-normal text-ink-muted">(optional)</span></span><PhotoField venueId={venueId} photo={photo} alt={{ en: name, fa: null }} onChange={async (p) => setPhoto(p)} /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>Add item</button>
      </form>
    </Sheet>
  );
}

function AddSectionSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title="Add section" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) { setErr('The name is required'); return; } setBusy(true); setErr(null); try { await onAdd(name.trim()); } catch (x) { setErr((x as Error).message); setBusy(false); } }} className="space-y-4">
        <label className="block"><span className="mb-1 block text-sm font-medium">Name</span><input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus required aria-label="Section name" placeholder="For example Desserts" /></label>
        <p className="text-xs text-ink-muted">It goes last; move it with the section menu. Customers see it once it has a shown item.</p>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>Add section</button>
      </form>
    </Sheet>
  );
}

function RenameSheet({ section: s, onClose, onPatch }: { section: Menu['sections'][number]; onClose: () => void; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  return (
    <Sheet title="Rename section" onClose={onClose}>
      <div className="space-y-4">
        <TextField label="Name" value={s.name.en} required onCommit={(v) => onPatch({ name: { ...s.name, en: v } })} autoFocus />
        <TextField label="Name (فارسی)" value={s.name.fa} dir="rtl" lang="fa" onCommit={(v) => onPatch({ name: { ...s.name, fa: v } })} />
        <TextField label="Note under the heading" value={s.note?.en} placeholder="Optional" onCommit={(v) => onPatch({ note: { ...(s.note ?? { en: null, fa: null }), en: v } })} />
        <TextField label="Note (فارسی)" value={s.note?.fa} dir="rtl" lang="fa" onCommit={(v) => onPatch({ note: { ...(s.note ?? { en: null, fa: null }), fa: v } })} />
        <p className="text-xs text-ink-muted">Each field saves when you leave it.</p>
        <button type="button" className={`${btnSecondary} w-full`} onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

// One confirmation with two choices (Kian, 2026-10-08): "Move items to [section]" (the default) or "Delete the items too".
function DeleteSectionSheet({ section: s, others, items, onClose, onDelete }: { section: Menu['sections'][number]; others: Menu['sections']; items: Menu['items']; onClose: () => void; onDelete: (mode: DeleteMode) => Promise<void> }) {
  const n = s.item_ids.length;
  const elsewhere = s.item_ids.filter((id) => (items[id]?.placements.length ?? 0) > 1).length;
  const [mode, setMode] = useState<'move' | 'delete'>(others.length ? 'move' : 'delete');
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title="Delete this section?" onClose={onClose}>
      <p className="text-[15px] text-ink-muted">“{s.name.en}” will be removed. It has {n} item{n === 1 ? '' : 's'}. What happens to {n === 1 ? 'it' : 'them'}?</p>
      <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Items of the section">
        <label className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 ${mode === 'move' ? 'border-accent bg-accent-soft' : 'border-line'} ${others.length ? '' : 'opacity-50'}`}>
          <input type="radio" className="check" name="section-items" value="move" checked={mode === 'move'} disabled={!others.length} onChange={() => setMode('move')} />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[15px]"><span className="font-medium">Move {n === 1 ? 'it' : 'them'} to</span>
            <select value={target} onChange={(e) => { setTarget(e.target.value); setMode('move'); }} disabled={!others.length} aria-label="Section to move the items to" className="h-9 min-w-0 max-w-full appearance-none rounded-full bg-white px-3 pr-8 text-[15px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.08)] focus:outline-none focus:ring-[3px] focus:ring-accent/25" style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236e6e73%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27><path d=%27m6 9 6 6 6-6%27/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name.en}</option>)}
            </select>
          </span>
        </label>
        <label className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 ${mode === 'delete' ? 'border-red-300 bg-red-50' : 'border-line'}`}>
          <input type="radio" className="check" name="section-items" value="delete" checked={mode === 'delete'} onChange={() => setMode('delete')} />
          <span className="text-[15px]"><span className="font-medium">Delete the item{n === 1 ? '' : 's'} too</span>{elsewhere > 0 && <span className="block text-xs text-ink-muted">{elsewhere} of them {elsewhere === 1 ? 'is' : 'are'} also in another section and stay{elsewhere === 1 ? 's' : ''} there.</span>}</span>
        </label>
      </div>
      {!others.length && <p className="mt-2 text-xs text-ink-muted">There is no other section to move the items to.</p>}
      <p className="mt-3 text-xs text-ink-muted">You can undo for 10 seconds.</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex gap-2">
        <button type="button" className={`${btnDanger} flex-1`} disabled={busy || (mode === 'move' && !target)} onClick={async () => { setBusy(true); setErr(null); try { await onDelete(mode === 'move' ? { items: 'move', target } : { items: 'delete' }); } catch (e) { setErr((e as Error).message); setBusy(false); } }}>Delete section</button>
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
void MoneyField;
export type { Bi };
