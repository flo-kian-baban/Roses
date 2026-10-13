'use client';
// The item editor (Kian, 2026-10-13, rebuilt for simpler control of an item): a side column on laptops, full screen on phones. Top to
// bottom: the status in the top bar, always in view (the Shown/Hidden switch with the season beside it, "Shown · fall only"; the price
// rule still refuses to show an item without a price, its one-line reason under the bar); the item (the photo, tapped to replace it,
// Remove under it; the name in one card with its EN and FA fields; the description likewise); price & choices (the price or the sizes,
// every choice group with its choices and prices, edited in place: Choices.tsx); where & when (every section the item is in as a chip,
// "Change" opening the section picker, its place in each section, the season chips); then two named groups, each saying in one line what
// it holds: Allergens & diet (owner and admin only; staff 403 unchanged: GoodToKnow.tsx; open from the start while the item has allergen
// or dietary drafts waiting for Confirm, the PM, 2026-10-13, closed otherwise) and Other (closed until tapped: Duplicate, Delete, combo
// parts, serves, the note for customers). A field drafted at import or by research carries a Draft tag with "Looks good",
// which clears that field's flag only. Every field saves itself on change; there is no Save button. While "Saved · Undo" shows, the
// panel keeps the strip under it free (the scroll area ends above it), so it never covers a control.
// Seasons (Kian, 2026-10-12): four chips, none selected = all year; a season chosen hides the item everywhere outside it. Research drafts
// (Kian, 2026-10-12): allergen and dietary notes written from research wait for Confirm (owner and admin) before customers see them; an
// item opened from the "Allergens to confirm" filter opens on them.
import { cloneElement, useEffect, useRef, useState } from 'react';
import type { Bi, Component, EditorItem, EditorSection, Notes, Photo as PhotoData, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, listingProblem, notesToConfirm, seasonState } from './state';
import { uploadImage } from './upload';
import { CellText, Group, LangTag, LooksGood, Photo, Switch, TextField, btnDanger, btnGhost, btnSecondary, cardCls } from './ui';
import { Choices, CopyChoicesSheet, PriceOrSizes } from './Choices';
import { GoodToKnow, notesSummary } from './GoodToKnow';
import { SectionPicker } from './SectionPicker';

export type ItemPanelProps = {
  item: EditorItem; venueId: string; sections: EditorSection[]; items: Record<string, EditorItem>; sectionId: string | null; canNotes: boolean; column?: boolean; season: SeasonId; notesFirst?: boolean;
  selectName?: boolean; toast?: boolean;
  onPatch: (patch: Record<string, unknown>) => Promise<void>; onNotes: (notes: Notes) => Promise<void>; onConfirm: () => Promise<void>; onCopy: (group: string, ids: string[]) => Promise<void>; onDelete: () => void;
  onLooksGood: (field: string) => Promise<void>; onDuplicate: () => Promise<void>;
  onMove: (sectionId: string, id: string, index: number) => Promise<void>; onClose: () => void;
};

export function ItemPanel({ item, venueId, sections, items, sectionId, canNotes, column, season, notesFirst, selectName, toast, onPatch, onNotes, onConfirm, onCopy, onDelete, onLooksGood, onDuplicate, onMove, onClose }: ItemPanelProps) {
  const toConfirm = canNotes && notesToConfirm(item), onNotesFirst = !!notesFirst && toConfirm;
  const [allergensOpen, setAllergensOpen] = useState(toConfirm); // open while drafts wait for Confirm (the PM, 2026-10-13); it stays as the person leaves it
  const [otherOpen, setOtherOpen] = useState(false);
  const [copying, setCopying] = useState<string | null>(null); // the choice group being copied to other items
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // Duplicate on its way
  const scroller = useRef<HTMLDivElement>(null), nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => { if (onNotesFirst) document.querySelector('[data-group-section="allergens"]')?.scrollIntoView({ block: 'start' }); }, [item.id, onNotesFirst]);
  useEffect(() => { if (selectName) { const el = nameRef.current; if (el) { el.focus(); el.select(); } } }, [selectName]); // a copy opens with its name selected, ready to be typed over
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !copying) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, copying]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 6000); return () => clearTimeout(t); }, [err]);
  useEffect(() => { if (!reason) return; const t = setTimeout(() => setReason(null), 6000); return () => clearTimeout(t); }, [reason]);
  // the toast's strip appears under the scroll area: a field being typed in that it now hides is brought back into view
  useEffect(() => { if (!toast) return; const a = document.activeElement as HTMLElement | null, s = scroller.current; if (a && s?.contains(a) && a.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom) a.scrollIntoView({ block: 'nearest' }); }, [toast]);
  const patch = async (p: Record<string, unknown>) => { try { setErr(null); await onPatch(p); } catch (e) { setErr((e as Error).message); throw e; } };
  const looksGood = (field: string) => { void onLooksGood(field).catch((e) => setErr((e as Error).message)); };
  const problem = listingProblem(item);
  const faDraft = (f: string) => item.fa_draft.includes(f);
  const inSections = new Set(item.placements.map((p) => p.section_id));
  const orderIn = sections.filter((s) => inSections.has(s.id));
  const seasonalId = sections.find((s) => s.seasonal)?.id ?? null;
  const st = seasonState(item, { season, seasonalId });
  const when = item.seasons.length ? `${item.seasons.map((x) => SEASON_NAMES[x].toLowerCase()).join(', ')} only` : 'all year';
  const status = !item.listed ? { main: 'Hidden', sub: item.seasons.length ? when : null } : st === 'out' ? { main: 'Out of season', sub: when } : { main: 'Shown', sub: when };
  const toggle = (open: boolean, set: (v: boolean) => void, id: string) => { set(!open); if (!open) requestAnimationFrame(() => { const s = scroller.current, g = s?.querySelector(`[data-group-section="${id}"]`); if (s && g && g.getBoundingClientRect().top > s.getBoundingClientRect().top + s.clientHeight * 0.45) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); };
  const parts = item.components.length, note = !!(item.notes.text?.en || item.notes.text?.fa);
  const otherBits = [parts ? `${parts} combo part${parts === 1 ? '' : 's'}` : null, item.serves ? `Serves ${item.serves}` : null, canNotes && note ? 'Note for customers' : null].filter(Boolean);
  const otherSummary = otherBits.length ? `${otherBits.join(' · ')} · Duplicate, delete` : `Combo parts, serves${canNotes ? ', note' : ''}, duplicate, delete`;
  const duplicate = async () => { setBusy(true); try { await onDuplicate(); } catch (e) { setErr((e as Error).message); setBusy(false); } };

  return (
    <div className={`item-panel panel-in flex flex-col bg-white ${column ? 'sticky top-14 h-[calc(100dvh-3.5rem)] border-l border-line' : 'fixed inset-0 z-50 lg:inset-auto lg:bottom-0 lg:right-[520px] lg:top-14 lg:w-[440px] lg:border-l lg:border-line lg:shadow-[-12px_0_32px_-24px_rgba(0,0,0,.3)]'}`} role="dialog" aria-modal={column ? undefined : true} aria-label={`Edit ${item.name.en ?? 'item'}`}>
      {/* the status: always in view */}
      <div className="glass flex h-11 shrink-0 items-center gap-1 pl-1 pr-3 shadow-[inset_0_-1px_0_var(--color-line)]">
        <button type="button" onClick={onClose} className="flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" /><span className="lg:hidden">Done</span><span className="hidden lg:inline">Close</span></button>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-ink-muted sm:block">Saves as you go</span>
        <label data-status="" className="ml-auto flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 pl-2">
          <span className={`min-w-0 truncate text-right text-[15px] ${st === 'out' && item.listed ? 'text-amber-800' : ''}`}><span className="font-semibold">{status.main}</span>{status.sub && <span className="text-ink-muted"> · {status.sub}</span>}</span>
          <Switch checked={item.listed} label={item.listed ? 'Shown. Tap to hide' : 'Hidden. Tap to show'} onChange={async (v) => { setReason(null); try { await onPatch({ listed: v }); } catch (e) { setReason((e as Error).message); } }} />
        </label>
      </div>
      {(reason || (problem && !item.listed)) && <p role={reason ? 'alert' : undefined} className={`shrink-0 px-4 py-1.5 text-[13px] ${reason ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-900'}`}>{reason || `${problem}.`}</p>}
      {err && <p role="alert" className="mx-4 mt-2 shrink-0 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pt-2" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
        {/* the item */}
        <div className="flex gap-3">
          <PhotoThumb venueId={venueId} photo={item.photo} alt={{ en: item.name.en, fa: item.name.fa }} onChange={(p) => patch({ photo: p })} />
          <div className={`${cardCls} min-w-0 flex-1 self-start`}>
            <FieldRow lang="EN"><CellText label="Name" value={item.name.en} required placeholder="Name" className="[&_input]:text-[17px] [&_input]:font-semibold" inputRef={(el) => { nameRef.current = el; }} onCommit={(v) => patch({ name: { ...item.name, en: v } })} /></FieldRow>
            <FieldRow lang="FA" draft={faDraft('name')} missing={!item.name.fa} looksGood={() => looksGood('name.fa')} what="the Persian name"><CellText label="Name (فارسی)" value={item.name.fa} dir="rtl" lang="fa" placeholder="نام فارسی" onCommit={(v) => patch({ name: { ...item.name, fa: v } })} /></FieldRow>
          </div>
        </div>
        <div className={`${cardCls} mt-2`} role="group" aria-label="Description">
          <FieldRow lang="EN" draft={item.drafts.includes('description')} looksGood={() => looksGood('description.en')} what="the English description"><CellText lines label="Description" value={item.description.en} placeholder="Description" onCommit={(v) => patch({ description: { ...item.description, en: v } })} /></FieldRow>
          <FieldRow lang="FA" draft={faDraft('description')} missing={!!item.description.en && !item.description.fa} looksGood={() => looksGood('description.fa')} what="the Persian description"><CellText lines label="Description (فارسی)" value={item.description.fa} dir="rtl" lang="fa" placeholder="توضیح فارسی" onCommit={(v) => patch({ description: { ...item.description, fa: v } })} /></FieldRow>
        </div>

        {/* price & choices */}
        <div className="mt-3 space-y-2" data-price-choices="">
          <PriceOrSizes item={item} onPatch={patch} hint={problem && !item.listed && !item.variants.length ? 'Add a price to show this item.' : undefined} onLooksGood={looksGood} />
          <Choices item={item} onPatch={patch} onCopy={setCopying} onLooksGood={looksGood} />
        </div>

        {/* where & when */}
        <div className="mt-5 space-y-2" data-where="">
          <p className="text-[13px] font-semibold text-ink-muted">Where &amp; when</p>
          <SectionPicker item={item} sections={sections} season={season} onPatch={patch} />
          {/* its place in each section: Move up and Move down (phones; a laptop also drags the rows in the Menu tab) */}
          {orderIn.map((s) => {
            const i = s.item_ids.indexOf(item.id), name = s.seasonal ? `${SEASON_NAMES[season]} Menu` : s.name.en;
            return (
              <div key={s.id} className="flex items-center gap-1" data-place={name ?? ''}>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink-muted">{name}: <span className="tabular-nums text-ink">{i + 1} of {s.item_ids.length}</span></span>
                <button type="button" className={`${btnSecondary} h-11 w-11 px-0`} aria-label={`Move up in ${name}`} disabled={i <= 0} onClick={() => { void onMove(s.id, item.id, i - 1).catch((e) => setErr(e.message)); }}><Icon name="up" className="h-5 w-5" /></button>
                <button type="button" className={`${btnSecondary} h-11 w-11 px-0`} aria-label={`Move down in ${name}`} disabled={i < 0 || i >= s.item_ids.length - 1} onClick={() => { void onMove(s.id, item.id, i + 1).catch((e) => setErr(e.message)); }}><Icon name="down" className="h-5 w-5" /></button>
              </div>
            );
          })}
          <Seasons item={item} season={season} seasonalId={seasonalId} onPatch={patch} />
        </div>

        {/* allergens & diet (owner and admin), other */}
        {canNotes
          ? <Group id="allergens" title="Allergens & diet" summary={notesSummary(item.notes, item.drafts)} open={allergensOpen} onToggle={() => toggle(allergensOpen, setAllergensOpen, 'allergens')}><GoodToKnow item={item} onNotes={onNotes} onConfirm={onConfirm} setErr={setErr} /></Group>
          : <p className="mt-4 text-[13px] text-ink-muted">Allergens and diet: set by the owner or an admin.</p>}
        <Group id="other" title="Other" summary={otherSummary} open={otherOpen} onToggle={() => toggle(otherOpen, setOtherOpen, 'other')}>
          <div className="space-y-4">
            {/* the two actions first, right under the group's name */}
            <div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { void duplicate(); }} disabled={busy} className={btnSecondary}><Icon name="layers" className="h-4 w-4" />{busy ? 'Duplicating…' : 'Duplicate'}</button>
                <button type="button" onClick={onDelete} className={btnDanger}><Icon name="trash" className="h-4 w-4" />Delete this item</button>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">Duplicate makes a hidden copy, “{item.name.en} (copy)”, in the same sections, with the same prices, choices, description, photo and allergens.</p>
            </div>
            <div className="space-y-4 border-t border-line pt-4">
              <Parts item={item} onPatch={patch} onLooksGood={looksGood} />
              <TextField label="Serves" value={item.serves} placeholder="2 or 3-4 (for platters)" onCommit={(v) => patch({ serves: v })} />
              {canNotes && <NoteFields notes={item.notes} onNotes={onNotes} setErr={setErr} />}
            </div>
          </div>
        </Group>
        <p className="mt-6 text-center text-xs text-ink-muted sm:hidden">Every change saves as you go.</p>
      </div>
      {toast && <div aria-hidden="true" data-toast-zone="" className="shrink-0 border-t border-line bg-white" style={{ height: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 64px)' }} />}
      {copying !== null && <CopyChoicesSheet item={item} group={copying} sections={sections} items={items} onCopy={(ids) => onCopy(copying, ids)} onClose={() => setCopying(null)} />}
    </div>
  );
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// One row of a card: the language tag (with "Draft" when the field is a draft), the field, and "Looks good" while it is not being
// edited (being edited, the field takes the whole row; a person's edit clears the draft flag anyway).
function FieldRow({ lang, draft, missing, looksGood, what, children }: { lang: 'EN' | 'FA'; draft?: boolean; missing?: boolean; looksGood?: () => void; what?: string; children: React.ReactElement<{ onFocusChange?: (f: boolean) => void }> }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex">
      <LangTag lang={lang} draft={draft} missing={missing} />
      {cloneElement(children, { onFocusChange: setEditing })}
      {draft && looksGood && !editing && <LooksGood label={what ?? 'this field'} onClick={looksGood} />}
    </div>
  );
}

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
    <div role="group" aria-label="Seasons" className="pt-1">
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
          : item.seasons.length ? `Seasons: shown in ${item.seasons.map((x) => SEASON_NAMES[x].toLowerCase()).join(', ')} only.` : 'Seasons: none selected, so all year.'}
      </p>
    </div>
  );
}

// The photo in the editor (Kian, 2026-10-13): the thumbnail is the button (one tap opens the phone's camera or photos; the photo is shrunk
// on the device first, see upload.ts), Remove a small link under it. A linked photo from the import keeps working and is replaced the same way.
function PhotoThumb({ venueId, photo, alt, onChange }: { venueId: string; photo: PhotoData | null; alt: Bi; onChange: (p: PhotoData | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const pick = async (f: File) => {
    setBusy(true); setErr(null);
    try { const u = await uploadImage(venueId, 'photo', f); await onChange({ url: u.url, key: u.key, width: u.width, height: u.height, alt: photo?.alt ?? alt }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="w-16 shrink-0" data-photo-field={busy ? 'uploading' : photo ? 'set' : 'empty'}>
      <label className="relative block h-16 w-16 cursor-pointer overflow-hidden rounded-xl" aria-busy={busy}>
        <Photo url={photo?.url} className="h-16 w-16 rounded-xl" />
        {!photo && !busy && <span className="absolute inset-x-0 bottom-1 text-center text-[11px] font-semibold text-ink-muted">Add photo</span>}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-[11px] font-semibold">Uploading…</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={photo ? 'Replace the photo' : 'Choose a photo'} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />
      </label>
      {photo && <button type="button" className="tap block h-6 w-16 text-center text-[13px] font-medium text-red-600" disabled={busy} onClick={() => { setErr(null); void onChange(null).catch((e) => setErr(e.message)); }}>Remove</button>}
      {err && <p role="alert" className="mt-1 w-40 text-xs text-red-600">{err}</p>}
    </div>
  );
}

// The photo in the "+ Add item" sheet (step 2): uploaded from the phone's camera or photos, shrunk on the device first (see upload.ts).
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
        <p className="mt-1 text-xs text-ink-muted">{photo?.key ? `Uploaded${ms != null ? ` in ${(ms / 1000).toFixed(1)} s` : ''}.` : photo ? 'Linked from the venue’s website.' : 'From the phone’s camera or photos; large photos are shrunk before upload.'}</p>
      </div>
    </div>
  );
}

// The note for customers (owner and admin, with the allergen notes; under Other since 2026-10-13): saved with the notes.
function NoteFields({ notes, onNotes, setErr }: { notes: Notes; onNotes: (n: Notes) => Promise<void>; setErr: (s: string | null) => void }) {
  const save = (text: Bi) => onNotes({ ...notes, text }).catch((e) => { setErr((e as Error).message); });
  const t = notes.text ?? { en: null, fa: null };
  return (
    <div className="space-y-2">
      <TextField label="Note for customers" value={t.en} onCommit={(v) => save({ ...t, en: v })} />
      <TextField label="Note for customers (فارسی)" value={t.fa} dir="rtl" lang="fa" onCommit={(v) => save({ ...t, fa: v })} />
    </div>
  );
}

function Parts({ item, onPatch, onLooksGood }: { item: EditorItem; onPatch: (p: Record<string, unknown>) => Promise<void>; onLooksGood: (field: string) => void }) {
  const [rows, setRows] = useState<Component[]>(item.components);
  const key = JSON.stringify(item.components);
  useEffect(() => { setRows(JSON.parse(key)); }, [key]);
  const save = (next: Component[]) => { setRows(next); const complete = next.filter((c) => c.label.en); if (!sameJson(complete, item.components)) void onPatch({ components: complete }).catch(() => setRows(item.components)); };
  const set = (i: number, c: Component) => save(rows.map((r, k) => (k === i ? c : r)));
  return (
    <div>
      <div className="flex items-center gap-2"><p className="flex-1 text-sm font-medium">Combo parts</p>{item.fa_draft.includes('components') && <LooksGood label="the Persian of the combo parts" onClick={() => onLooksGood('components')} />}</div>
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
