'use client';
// The item editor: a side panel on laptops, full screen on phones. Three layers: Basics (always visible), More (one
// tap: description, sizes, other sections, order) and Advanced (collapsed: add-ons, combo parts, notes for owner and
// admin, delete). Every field saves itself on change; there is no Save button. Seasons (Kian, 2026-10-12): four chips in Basics, Fall /
// Winter / Spring / Summer; none selected = all year; a season chosen hides the item everywhere outside it. Research drafts (Kian, 2026-10-12):
// an English description written from research carries a Draft badge (customers see it); allergen and dietary notes written from research
// wait for Confirm (owner and admin) before customers see them; an item opened from the "Allergens to confirm" filter opens on them
// (Advanced open, the draft box in view), any other item opens as before.
import { useEffect, useState } from 'react';
import type { AddOn, Basis, Bi, Component, EditorItem, EditorSection, Notes, Photo as PhotoData, SeasonId, Variant } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, listingProblem, notesToConfirm, seasonState } from './state';
import { uploadImage } from './upload';
import { Badge, MoneyField, Photo, Switch, TextField, btnDanger, btnGhost, btnPrimary, btnSecondary, fieldCls } from './ui';

export type ItemPanelProps = {
  item: EditorItem; venueId: string; sections: EditorSection[]; sectionId: string | null; canNotes: boolean; column?: boolean; season: SeasonId; notesFirst?: boolean;
  onPatch: (patch: Record<string, unknown>) => Promise<void>; onNotes: (notes: Notes) => Promise<void>; onConfirm: () => Promise<void>; onDelete: () => void;
  onMove: (sectionId: string, id: string, index: number) => Promise<void>; onClose: () => void;
};

export function ItemPanel({ item, venueId, sections, sectionId, canNotes, column, season, notesFirst, onPatch, onNotes, onConfirm, onDelete, onMove, onClose }: ItemPanelProps) {
  const [more, setMore] = useState(false);
  const onNotesFirst = !!notesFirst && canNotes && notesToConfirm(item);
  const [advanced, setAdvanced] = useState(onNotesFirst);
  useEffect(() => { if (onNotesFirst) setAdvanced(true); }, [item.id, onNotesFirst]);
  useEffect(() => { if (onNotesFirst && advanced) document.querySelector('[data-research-draft]')?.scrollIntoView({ block: 'center' }); }, [item.id, onNotesFirst, advanced]);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 6000); return () => clearTimeout(t); }, [err]);
  const patch = async (p: Record<string, unknown>) => { try { setErr(null); await onPatch(p); } catch (e) { setErr((e as Error).message); throw e; } };
  const problem = listingProblem(item);
  const draft = (f: string) => item.fa_draft.includes(f);
  const inSections = new Set(item.placements.map((p) => p.section_id));
  const orderIn = sections.filter((s) => inSections.has(s.id));
  const seasonalId = sections.find((s) => s.seasonal)?.id ?? null;

  return (
    <div className={`item-panel panel-in flex flex-col bg-white ${column ? 'sticky top-14 h-[calc(100dvh-3.5rem)] border-l border-line' : 'fixed inset-0 z-50 lg:inset-auto lg:bottom-0 lg:right-[520px] lg:top-14 lg:w-[440px] lg:border-l lg:border-line lg:shadow-[-12px_0_32px_-24px_rgba(0,0,0,.3)]'}`} role="dialog" aria-modal={column ? undefined : true} aria-label={`Edit ${item.name.en ?? 'item'}`}>
      <div className="glass flex h-11 shrink-0 items-center gap-2 px-2 shadow-[inset_0_-1px_0_var(--color-line)]">
        <button type="button" onClick={onClose} className="flex h-11 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" /><span className="lg:hidden">Done</span><span className="hidden lg:inline">Close</span></button>
        <span className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{item.name.en}</span>
        <span className="hidden shrink-0 whitespace-nowrap text-xs text-ink-muted sm:block">Saves as you go</span>
      </div>
      {err && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
        {/* Basics */}
        <div className="space-y-4">
          <TextField label="Name" value={item.name.en} required onCommit={(v) => patch({ name: { ...item.name, en: v } })} />
          <TextField label="Name (فارسی)" value={item.name.fa} dir="rtl" lang="fa" badge={draft('name') ? <Badge tone="blue">Persian draft</Badge> : !item.name.fa ? <Badge tone="amber">Missing</Badge> : null} onCommit={(v) => patch({ name: { ...item.name, fa: v } })} />
          {item.variants.length === 0
            ? <MoneyField value={item.price} onCommit={(v) => patch({ price: v })} hint={problem && !item.listed ? 'Add a price to show this item.' : undefined} />
            : <div><span className="mb-1 block text-sm font-medium">Price</span><p className="rounded-xl bg-fill px-3.5 py-2.5 text-[15px]">Set by the sizes below ({item.variants.length}).</p></div>}
          <div>
            <span className="mb-1 block text-sm font-medium">Photo</span>
            <PhotoField venueId={venueId} photo={item.photo} alt={{ en: item.name.en, fa: item.name.fa }} onChange={(p) => patch({ photo: p })} />
          </div>
          <Seasons item={item} season={season} seasonalId={seasonalId} onPatch={patch} />
          <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
            <span><span className="block font-medium">{item.listed ? 'Shown to customers' : 'Hidden from customers'}</span>{reason ? <span className="block text-xs text-red-600">{reason}</span> : problem && !item.listed ? <span className="block text-xs text-ink-muted">{problem}</span> : null}</span>
            <Switch checked={item.listed} label={item.listed ? 'Shown. Tap to hide' : 'Hidden. Tap to show'} onChange={async (v) => { setReason(null); try { await onPatch({ listed: v }); } catch (e) { setReason((e as Error).message); } }} />
          </label>
        </div>

        {/* More */}
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-fill px-4 py-3 text-left font-semibold"><span>More</span><Icon name="down" className={`h-5 w-5 text-ink-muted transition ${more ? 'rotate-180' : ''}`} /></button>
        {more && (
          <div className="mt-4 space-y-5">
            <TextField label="Description" value={item.description.en} multiline badge={item.drafts.includes('description') ? <Badge tone="blue">Draft</Badge> : null} onCommit={(v) => patch({ description: { ...item.description, en: v } })} />
            <TextField label="Description (فارسی)" value={item.description.fa} multiline dir="rtl" lang="fa" badge={draft('description') ? <Badge tone="blue">Persian draft</Badge> : item.description.en && !item.description.fa ? <Badge tone="amber">Missing</Badge> : null} onCommit={(v) => patch({ description: { ...item.description, fa: v } })} />
            <Sizes item={item} onPatch={patch} />
            <div>
              <span className="mb-1 block text-sm font-medium">Also show in…</span>
              <div className="grid gap-1.5">
                {sections.map((s) => (
                  <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
                    <input type="checkbox" className="check" checked={inSections.has(s.id)} onChange={(e) => { const ids = sections.filter((x) => (x.id === s.id ? e.target.checked : inSections.has(x.id))).map((x) => x.id); void patch(s.seasonal && e.target.checked && !item.seasons.length ? { section_ids: ids, seasons: [season] } : { section_ids: ids }); }} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{s.name.en}</span>{!s.listed && <Badge>Hidden</Badge>}
                  </label>
                ))}
              </div>
              {item.placements.length === 0 && <p className="mt-1 text-xs text-amber-800">In no section: customers cannot see it.</p>}
            </div>
            {orderIn.map((s) => {
              const i = s.item_ids.indexOf(item.id);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Order in {s.name.en}: <span className="text-ink-muted">{i + 1} of {s.item_ids.length}</span></span>
                  <span className="ml-auto flex gap-1">
                    <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} disabled={i <= 0} onClick={() => { void onMove(s.id, item.id, i - 1).catch((e) => setErr(e.message)); }}><Icon name="up" className="h-4 w-4" />Move up</button>
                    <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} disabled={i < 0 || i >= s.item_ids.length - 1} onClick={() => { void onMove(s.id, item.id, i + 1).catch((e) => setErr(e.message)); }}><Icon name="down" className="h-4 w-4" />Move down</button>
                  </span>
                </div>
              );
            })}
            <TextField label="Serves" value={item.serves} placeholder="2 or 3-4 (for platters)" onCommit={(v) => patch({ serves: v })} />
          </div>
        )}

        {/* Advanced */}
        <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-fill px-4 py-3 text-left font-semibold"><span>Advanced</span><Icon name="down" className={`h-5 w-5 text-ink-muted transition ${advanced ? 'rotate-180' : ''}`} /></button>
        {advanced && (
          <div className="mt-4 space-y-6">
            <AddOns item={item} onPatch={patch} />
            <Parts item={item} onPatch={patch} />
            {canNotes ? <NotesEditor item={item} onNotes={onNotes} onConfirm={onConfirm} setErr={setErr} /> : <p className="text-sm text-ink-muted">Allergen, dietary and halal notes are set by the owner or an admin.</p>}
            <div className="border-t border-line pt-5">
              <button type="button" onClick={onDelete} className={btnDanger}><Icon name="trash" className="h-4 w-4" />Delete this item</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Seasons (Kian, 2026-10-12): the four chips save on every tap; none selected = all year. Today's season decides what the line under
// them says: out of season now (hidden everywhere until one of its seasons), or in the Seasonal section without today's season.
const SEASON_ORDER: SeasonId[] = ['fall', 'winter', 'spring', 'summer'];
function Seasons({ item, season, seasonalId, onPatch }: { item: EditorItem; season: SeasonId; seasonalId: string | null; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const st = seasonState(item, { season, seasonalId });
  const toggle = async (x: SeasonId) => {
    const next = SEASON_ORDER.filter((y) => (y === x ? !item.seasons.includes(x) : item.seasons.includes(y)));
    setBusy(true); try { await onPatch({ seasons: next }); } catch { /* the panel shows the error */ } finally { setBusy(false); }
  };
  return (
    <div role="group" aria-label="Seasons">
      <span className="mb-1 block text-sm font-medium">Seasons</span>
      <div className="flex flex-wrap gap-2">
        {SEASON_ORDER.map((x) => {
          const on = item.seasons.includes(x);
          return <button key={x} type="button" aria-pressed={on} disabled={busy} onClick={() => { void toggle(x); }} data-season-chip={x}
            className={`min-h-11 min-w-11 rounded-full border px-4 text-[15px] font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>{SEASON_NAMES[x]}</button>;
        })}
      </div>
      <p className={`mt-1 text-xs ${st ? 'text-amber-800' : 'text-ink-muted'}`}>
        {st === 'out' ? `Out of season now (it is ${SEASON_NAMES[season].toLowerCase()}): hidden from customers until ${item.seasons.map((x) => SEASON_NAMES[x].toLowerCase()).join(' or ')}.`
          : st === 'none' ? `In the Seasonal section without ${SEASON_NAMES[season]}: not shown there. Pick ${SEASON_NAMES[season]} to show it as a ${SEASON_NAMES[season].toLowerCase()} special.`
          : item.seasons.length ? `Shown in ${item.seasons.map((x) => SEASON_NAMES[x].toLowerCase()).join(', ')} only.` : 'None selected: all year.'}
      </p>
    </div>
  );
}

// The photo (step 2): uploaded from the phone's camera or photos, shrunk on the device first (see upload.ts); one tap
// opens the chooser. A linked photo from the import keeps working and can be replaced or removed the same way.
export function PhotoField({ venueId, photo, alt, onChange }: { venueId: string; photo: PhotoData | null; alt: Bi; onChange: (p: PhotoData | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ms, setMs] = useState<number | null>(null);
  const pick = async (f: File) => {
    setBusy(true); setErr(null); const t0 = Date.now();
    try { const u = await uploadImage(venueId, 'photo', f); await onChange({ url: u.url, key: u.key, width: u.width, height: u.height, alt: photo?.alt ?? alt }); setMs(Date.now() - t0); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-start gap-3" data-photo-field={busy ? 'uploading' : photo ? 'set' : 'empty'}>
      <Photo url={photo?.url} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <label className={`${btnSecondary} cursor-pointer`} aria-busy={busy}><Icon name="image" className="h-4 w-4" />{busy ? 'Uploading…' : photo ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a photo" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} /></label>
          {photo && <button type="button" className={btnDanger} disabled={busy} onClick={() => { setErr(null); void onChange(null).catch((e) => setErr(e.message)); }}>Remove</button>}
        </div>
        {err && <p role="alert" className="mt-1 text-sm text-red-600">{err}</p>}
        <p className="mt-1 text-xs text-ink-muted">{photo?.key ? `Uploaded${photo.width && photo.height ? `, ${photo.width} × ${photo.height} px` : ''}${ms != null ? ` in ${(ms / 1000).toFixed(1)} s` : ''}.` : photo ? 'Linked from the venue\u2019s website.' : 'From the phone\u2019s camera or photos; large photos are shrunk before upload.'}</p>
      </div>
    </div>
  );
}

// Sizes: a row saves once it has a name and a price. "+ Add size" turns the one price into sizes.
function Sizes({ item, onPatch }: { item: EditorItem; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [rows, setRows] = useState<Variant[]>(item.variants);
  const key = JSON.stringify(item.variants);
  useEffect(() => { setRows(JSON.parse(key)); }, [key]);
  const save = (next: Variant[], priceIfNone?: number | null) => {
    setRows(next);
    const complete = next.filter((v) => v.label.en && v.price != null);
    if (!sameJson(complete, item.variants)) void onPatch({ variants: complete, price: complete.length ? null : (item.price ?? priceIfNone ?? null) }).catch(() => setRows(item.variants));
  };
  const set = (i: number, v: Variant) => save(rows.map((r, k) => (k === i ? v : r)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">Sizes</span>{item.fa_draft.includes('variants') && <Badge tone="blue">Persian draft</Badge>}</div>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_5.5rem_2.25rem] items-center gap-1.5">
              <TextField compact value={v.label.en} placeholder="Size" label={`Size ${i + 1}`} onCommit={(x) => set(i, { ...v, label: { ...v.label, en: x } })} />
              <TextField compact value={v.label.fa} placeholder="فارسی" dir="rtl" lang="fa" label={`Size ${i + 1} (Persian)`} onCommit={(x) => set(i, { ...v, label: { ...v.label, fa: x } })} />
              <MoneyField compact value={v.price} label={`Size ${i + 1} price`} onCommit={(x) => set(i, { ...v, price: x })} />
              <button type="button" aria-label={`Remove size ${v.label.en || i + 1}`} onClick={() => save(rows.filter((_, k) => k !== i), v.price)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-fill hover:text-red-600"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className={`${btnGhost} mt-2 min-h-11 px-3 text-sm text-accent-strong`} onClick={() => (rows.length ? setRows([...rows, { label: { en: null, fa: null }, price: null }]) : save([{ label: { en: 'Regular', fa: null }, price: item.price }, { label: { en: null, fa: null }, price: null }]))}><Icon name="plus" className="h-4 w-4" />Add size</button>
      {rows.length > 0 && rows.some((v) => !v.label.en || v.price == null) && <p className="mt-1 text-xs text-ink-muted">A size is saved once it has a name and a price.</p>}
    </div>
  );
}

function AddOns({ item, onPatch }: { item: EditorItem; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [rows, setRows] = useState<AddOn[]>(item.add_ons);
  const key = JSON.stringify(item.add_ons);
  useEffect(() => { setRows(JSON.parse(key)); }, [key]);
  const save = (next: AddOn[]) => { setRows(next); const complete = next.filter((a) => a.label.en); if (!sameJson(complete, item.add_ons)) void onPatch({ add_ons: complete }).catch(() => setRows(item.add_ons)); };
  const set = (i: number, a: AddOn) => save(rows.map((r, k) => (k === i ? a : r)));
  return (
    <div>
      <p className="text-sm font-medium">Add-ons and choices</p>
      <p className="text-xs text-ink-muted">Group (for example “Milk”), choice (for example “Oat milk”), extra price (0 when free).</p>
      <div className="mt-2 space-y-3">
        {rows.map((a, i) => (
          <div key={i} className="rounded-xl bg-fill p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <TextField compact value={a.group.en} placeholder="Group" label={`Add-on ${i + 1} group`} onCommit={(x) => set(i, { ...a, group: { ...a.group, en: x } })} />
              <TextField compact value={a.group.fa} placeholder="گروه" dir="rtl" lang="fa" label={`Add-on ${i + 1} group (Persian)`} onCommit={(x) => set(i, { ...a, group: { ...a.group, fa: x } })} />
              <TextField compact value={a.label.en} placeholder="Choice" label={`Add-on ${i + 1} choice`} onCommit={(x) => set(i, { ...a, label: { ...a.label, en: x } })} />
              <TextField compact value={a.label.fa} placeholder="گزینه" dir="rtl" lang="fa" label={`Add-on ${i + 1} choice (Persian)`} onCommit={(x) => set(i, { ...a, label: { ...a.label, fa: x } })} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <MoneyField compact value={a.price} label={`Add-on ${i + 1} extra price`} className="w-28" onCommit={(x) => set(i, { ...a, price: x ?? 0 })} />
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="check" checked={a.required} onChange={(e) => set(i, { ...a, required: e.target.checked })} />Required</label>
              <button type="button" aria-label={`Remove add-on ${a.label.en || i + 1}`} onClick={() => save(rows.filter((_, k) => k !== i))} className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-white hover:text-red-600"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={`${btnGhost} mt-2 min-h-11 px-3 text-sm text-accent-strong`} onClick={() => setRows([...rows, { group: { en: null, fa: null }, label: { en: null, fa: null }, price: 0, required: false }])}><Icon name="plus" className="h-4 w-4" />Add a choice</button>
    </div>
  );
}

function Parts({ item, onPatch }: { item: EditorItem; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [rows, setRows] = useState<Component[]>(item.components);
  const key = JSON.stringify(item.components);
  useEffect(() => { setRows(JSON.parse(key)); }, [key]);
  const save = (next: Component[]) => { setRows(next); const complete = next.filter((c) => c.label.en); if (!sameJson(complete, item.components)) void onPatch({ components: complete }).catch(() => setRows(item.components)); };
  const set = (i: number, c: Component) => save(rows.map((r, k) => (k === i ? c : r)));
  return (
    <div>
      <p className="text-sm font-medium">Combo parts</p>
      <p className="text-xs text-ink-muted">For platters and mixed dishes: what the dish is made of.</p>
      <div className="mt-2 space-y-1.5">
        {rows.map((c, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_1fr_1fr_2.25rem] items-center gap-1.5">
            <TextField compact value={String(c.qty)} inputMode="numeric" placeholder="Qty" label={`Part ${i + 1} quantity`} onCommit={(x) => set(i, { ...c, qty: Math.max(1, Math.trunc(Number(x) || 1)) })} />
            <TextField compact value={c.label.en} placeholder="Part" label={`Part ${i + 1}`} onCommit={(x) => set(i, { ...c, label: { ...c.label, en: x } })} />
            <TextField compact value={c.label.fa} placeholder="فارسی" dir="rtl" lang="fa" label={`Part ${i + 1} (Persian)`} onCommit={(x) => set(i, { ...c, label: { ...c.label, fa: x } })} />
            <button type="button" aria-label={`Remove part ${c.label.en || i + 1}`} onClick={() => save(rows.filter((_, k) => k !== i))} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-fill hover:text-red-600"><Icon name="close" className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" className={`${btnGhost} mt-2 min-h-11 px-3 text-sm text-accent-strong`} onClick={() => setRows([...rows, { item_id: null, label: { en: null, fa: null }, qty: 1 }])}><Icon name="plus" className="h-4 w-4" />Add a part</button>
    </div>
  );
}

function NotesEditor({ item, onNotes, onConfirm, setErr }: { item: EditorItem; onNotes: (n: Notes) => Promise<void>; onConfirm: () => Promise<void>; setErr: (s: string | null) => void }) {
  const [n, setN] = useState<Notes>(item.notes);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(item.notes);
  useEffect(() => { setN(JSON.parse(key)); }, [key]);
  const save = (next: Notes) => { setN(next); return onNotes(next).catch((e) => { setErr((e as Error).message); setN(item.notes); }); };
  const words = (s: string | null) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const draftA = item.drafts.includes('allergens'), draftD = item.drafts.includes('dietary');
  const confirm = async () => { setBusy(true); try { await onConfirm(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Allergen, dietary and halal notes <span className="font-normal text-ink-muted">(owner and admin)</span></p>
      {(draftA || draftD) && <ResearchDraft notes={n} basis={item.basis} busy={busy} onConfirm={() => { void confirm(); }} />}
      <TextField label="Allergens" value={n.allergens.join(', ')} placeholder="nuts, dairy, gluten" hint="Comma separated." badge={draftA ? <Badge tone="blue">To confirm</Badge> : null} onCommit={(v) => save({ ...n, allergens: words(v) })} />
      <TextField label="Dietary" value={n.dietary.join(', ')} placeholder="vegetarian, vegan" hint="Comma separated." badge={draftD ? <Badge tone="blue">To confirm</Badge> : null} onCommit={(v) => save({ ...n, dietary: words(v) })} />
      <div>
        <span className="mb-1 block text-sm font-medium">Halal</span>
        <div className="grid grid-cols-3 gap-1.5">
          {([['unknown', 'Not set', null], ['yes', 'Yes', true], ['no', 'No', false]] as const).map(([k, label, val]) => (
            <label key={k} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-[15px] has-checked:border-accent has-checked:bg-accent-soft"><input type="radio" className="check" name="halal" value={k} checked={n.halal === val} onChange={() => save({ ...n, halal: val })} />{label}</label>
          ))}
        </div>
      </div>
      <TextField label="Note" value={n.text?.en} onCommit={(v) => save({ ...n, text: { ...(n.text ?? { en: null, fa: null }), en: v } })} />
      <TextField label="Note (فارسی)" value={n.text?.fa} dir="rtl" lang="fa" onCommit={(v) => save({ ...n, text: { ...(n.text ?? { en: null, fa: null }), fa: v } })} />
    </div>
  );
}
// Allergen and dietary notes drafted from research (Kian, 2026-10-12): not on the public page until confirmed. Shows what the draft says,
// what it is based on (the assumed key ingredients and the source for the dish type) and one Confirm; a correction typed in the fields
// below is the owner's own and needs no Confirm.
function ResearchDraft({ notes, basis, busy, onConfirm }: { notes: Notes; basis: Basis | null; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3" data-research-draft="">
      <p className="text-[15px] font-semibold text-sky-950">Suggested from research: customers don’t see it yet</p>
      <p className="mt-1 text-[13px] text-sky-950/80">{notes.allergens.length ? <>Contains: {notes.allergens.join(', ')}.</> : <>No common allergen found in the usual recipe.</>}{notes.dietary.length ? <> {notes.dietary.join(', ')}.</> : null} Check it against your recipe; fix a word below if it is wrong, or tap Confirm if it is right.</p>
      {basis && <p className="mt-1 text-[13px] text-sky-950/80">Based on: {basis.ingredients.join(', ')}{basis.source && <> · <a href={basis.source} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">source</a></>}</p>}
      <button type="button" onClick={onConfirm} disabled={busy} className={`${btnPrimary} mt-3`} aria-label="Confirm the allergens and dietary notes">{busy ? 'Confirming…' : 'Confirm'}</button>
    </div>
  );
}
void fieldCls;
