'use client';
// The item editor: a side panel on laptops, full screen on phones. Basics (always visible: name, price with "+ Sizes" and "+ Choices",
// photo, section, seasons, shown), Good to know (owner and admin: allergen, diet and halal chips), More (one tap: description, sizes,
// order, serves) and Advanced (collapsed: choices, combo parts, delete). Kian via the PM, 2026-10-13, after the admin audit: chips for
// the notes (GoodToKnow.tsx), inline rows for sizes and choices with "Copy to other items…" (Choices.tsx), one section picker
// (SectionPicker.tsx). The single "Price and choices" block of the audit waits for Kian. Every field saves itself on change; there is no Save button. Seasons (Kian, 2026-10-12): four chips in Basics, Fall /
// Winter / Spring / Summer; none selected = all year; a season chosen hides the item everywhere outside it. Research drafts (Kian, 2026-10-12):
// an English description written from research carries a Draft badge (customers see it); allergen and dietary notes written from research
// wait for Confirm (owner and admin) before customers see them; an item opened from the "Allergens to confirm" filter opens on them
// (Advanced open, the draft box in view), any other item opens as before.
import { useEffect, useState } from 'react';
import type { Bi, Component, EditorItem, EditorSection, Notes, Photo as PhotoData, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, listingProblem, notesToConfirm, seasonState } from './state';
import { uploadImage } from './upload';
import { Badge, MoneyField, Photo, Switch, TextField, btnDanger, btnGhost, btnSecondary, fieldCls } from './ui';
import { Choices, CopyChoicesSheet, Sizes } from './Choices';
import { GoodToKnow } from './GoodToKnow';
import { SectionPicker } from './SectionPicker';

export type ItemPanelProps = {
  item: EditorItem; venueId: string; sections: EditorSection[]; items: Record<string, EditorItem>; sectionId: string | null; canNotes: boolean; column?: boolean; season: SeasonId; notesFirst?: boolean; fresh?: boolean;
  onPatch: (patch: Record<string, unknown>) => Promise<void>; onNotes: (notes: Notes) => Promise<void>; onConfirm: () => Promise<void>; onCopy: (group: string, ids: string[]) => Promise<void>; onDelete: () => void;
  onMove: (sectionId: string, id: string, index: number) => Promise<void>; onClose: () => void;
};

export function ItemPanel({ item, venueId, sections, items, sectionId, canNotes, column, season, notesFirst, fresh, onPatch, onNotes, onConfirm, onCopy, onDelete, onMove, onClose }: ItemPanelProps) {
  const [more, setMore] = useState(!!fresh); // an item just added opens with More open: its description and sizes come next
  const [advanced, setAdvanced] = useState(false);
  const [sizeStart, setSizeStart] = useState(0), [choiceStart, setChoiceStart] = useState(0); // "+ Sizes" / "+ Choices" in Basics: open the group and start a row
  const [copying, setCopying] = useState<string | null>(null); // the choice group being copied to other items
  const onNotesFirst = !!notesFirst && canNotes && notesToConfirm(item);
  useEffect(() => { if (onNotesFirst) document.querySelector('[data-good-to-know]')?.scrollIntoView({ block: 'start' }); }, [item.id, onNotesFirst]);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !copying) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, copying]);
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
          <div>
            {item.variants.length === 0
              ? <MoneyField value={item.price} onCommit={(v) => patch({ price: v })} hint={problem && !item.listed ? 'Add a price to show this item.' : undefined} />
              : <div><span className="mb-1 block text-sm font-medium">Price</span><p className="rounded-xl bg-fill px-3.5 py-2.5 text-[15px]">Set by its {item.variants.length} sizes (under More).</p></div>}
            {/* one tap opens the group and starts a row with the cursor in it (Kian via the PM, 2026-10-13) */}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} onClick={() => { setMore(true); setSizeStart((n) => n + 1); }}><Icon name="plus" className="h-4 w-4" />Sizes</button>
              <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} onClick={() => { setAdvanced(true); setChoiceStart((n) => n + 1); }}><Icon name="plus" className="h-4 w-4" />Choices (milk, extras…)</button>
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Photo</span>
            <PhotoField venueId={venueId} photo={item.photo} alt={{ en: item.name.en, fa: item.name.fa }} onChange={(p) => patch({ photo: p })} />
          </div>
          <SectionPicker item={item} sections={sections} season={season} onPatch={patch} />
          <Seasons item={item} season={season} seasonalId={seasonalId} onPatch={patch} />
          <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
            <span><span className="block font-medium">{item.listed ? 'Shown to customers' : 'Hidden from customers'}</span>{reason ? <span className="block text-xs text-red-600">{reason}</span> : problem && !item.listed ? <span className="block text-xs text-ink-muted">{problem}</span> : null}</span>
            <Switch checked={item.listed} label={item.listed ? 'Shown. Tap to hide' : 'Hidden. Tap to show'} onChange={async (v) => { setReason(null); try { await onPatch({ listed: v }); } catch (e) { setReason((e as Error).message); } }} />
          </label>
        </div>

        {/* Good to know: allergens, diet, halal, the note (owner and admin; Kian via the PM, 2026-10-13) */}
        {canNotes && <GoodToKnow item={item} onNotes={onNotes} onConfirm={onConfirm} setErr={setErr} />}

        {/* More */}
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-fill px-4 py-3 text-left font-semibold"><span>More</span><Icon name="down" className={`h-5 w-5 text-ink-muted transition ${more ? 'rotate-180' : ''}`} /></button>
        {more && (
          <div className="mt-4 space-y-5">
            <TextField label="Description" value={item.description.en} multiline badge={item.drafts.includes('description') ? <Badge tone="blue">Draft</Badge> : null} onCommit={(v) => patch({ description: { ...item.description, en: v } })} />
            <TextField label="Description (فارسی)" value={item.description.fa} multiline dir="rtl" lang="fa" badge={draft('description') ? <Badge tone="blue">Persian draft</Badge> : item.description.en && !item.description.fa ? <Badge tone="amber">Missing</Badge> : null} onCommit={(v) => patch({ description: { ...item.description, fa: v } })} />
            <Sizes item={item} onPatch={patch} start={sizeStart} onStarted={() => setSizeStart(0)} />
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
            <Choices item={item} onPatch={patch} start={choiceStart} onStarted={() => setChoiceStart(0)} onCopy={setCopying} />
            <Parts item={item} onPatch={patch} />
            {!canNotes && <p className="text-sm text-ink-muted">Allergen, dietary and halal notes are set by the owner or an admin.</p>}
            <div className="border-t border-line pt-5">
              <button type="button" onClick={onDelete} className={btnDanger}><Icon name="trash" className="h-4 w-4" />Delete this item</button>
            </div>
          </div>
        )}
      </div>
      {copying !== null && <CopyChoicesSheet item={item} group={copying} sections={sections} items={items} onCopy={(ids) => onCopy(copying, ids)} onClose={() => setCopying(null)} />}
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

void fieldCls;
