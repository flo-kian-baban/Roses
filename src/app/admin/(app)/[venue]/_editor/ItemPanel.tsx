'use client';
// The item editor (Kian, 2026-10-13, rebuilt; the PM's clean-up of 2026-11-04: a calm editor staff understand at a glance, in the
// phone-Settings style of kit.tsx): a side column on laptops, full screen on phones. Top to bottom:
//   the top bar: back to the menu on the left; on the right the live save status (Saving… / Saved / Not saved · Retry, and the states of the
//     pre-go-live audit: Not saved after a refusal, whose reason the toast gives; Page not updated · Retry when the customers' page did not
//     regenerate); Retry sends again what did not go through, as the toast's Try again does;
//   Visibility: Shown on menu (the switch; the price rule still refuses to show an item without a price, its reason under the row) and the
//     season, set here only: All year or any of the four seasons (picking one clears All year, none picked is All year), a one-line caption
//     only when the seasons limit the item (Kian, 2026-10-12: a season chosen hides the item everywhere outside it);
//   Item: the photo (tapped for Change / Remove; without one, an Add photo square), the name and the description in English and Persian,
//     each in full;
//   Price (the price or the sizes, + Add size, + Add choices) and one card per choice group (Choices.tsx);
//   Appears in: the sections, Edit opening the section picker (SectionPicker.tsx);
//   Allergens & diet: owner and admin (staff see one line; the route answers them 403); one card, open while research drafts wait for
//     Confirm, closed otherwise (GoodToKnow.tsx; an item opened from the "Allergens to confirm" filter opens on it);
//   More: combo parts, serves and the note for customers behind one row; Duplicate item; Delete item (confirmed).
// The item's place within a section is set in the Menu list (Reorder items in the section's menu; a laptop also drags). A field drafted at
// import or by research shows "Draft" and "Looks good" on a line under it; Looks good clears that field's flag only. Every field saves
// itself on change; while "Saved · Undo" shows, the scroll area ends above it, so it never covers a control.
import { cloneElement, useEffect, useRef, useState } from 'react';
import type { Bi, Component, EditorItem, EditorSection, Notes, Photo as PhotoData, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES, listingProblem, notesToConfirm, seasonState } from './state';
import { uploadImage } from './upload';
import { retryable } from './api';
import { Switch } from './ui';
import { CellText, DraftLine, Heading, LangTag, cardCls, headingStyle, headingText, segCls, textBtn } from './kit';
import { COUNTS, LIMITS } from '@/lib/rules';
import { Choices, CopyChoicesSheet, PriceOrSizes, groupCount } from './Choices';
import { GoodToKnow, notesCount, notesSummary } from './GoodToKnow';
import { SectionPicker } from './SectionPicker';

// What the top bar says about the item's saves (Editor.tsx keeps it: saves under way, the ones that did not go through, a refusal, the page).
export type SaveStatus = { state: 'saving' | 'saved' | 'failed' | 'refused' | 'unpublished'; retry?: () => void };

export type ItemPanelProps = {
  item: EditorItem; venueId: string; sections: EditorSection[]; items: Record<string, EditorItem>; canNotes: boolean; column?: boolean; season: SeasonId; notesFirst?: boolean;
  selectName?: boolean; toast?: boolean; save: SaveStatus;
  onPatch: (patch: Record<string, unknown>) => Promise<void>; onNotes: (notes: Notes) => Promise<void>; onConfirm: () => Promise<void>; onCopy: (group: string, ids: string[]) => Promise<void>; onDelete: () => void;
  onLooksGood: (field: string) => Promise<void>; onDuplicate: () => Promise<void>; onClose: () => void;
};

export function ItemPanel({ item, venueId, sections, items, canNotes, column, season, notesFirst, selectName, toast, save, onPatch, onNotes, onConfirm, onCopy, onDelete, onLooksGood, onDuplicate, onClose }: ItemPanelProps) {
  const toConfirm = canNotes && notesToConfirm(item), onNotesFirst = !!notesFirst && toConfirm;
  const [allergensOpen, setAllergensOpen] = useState(toConfirm); // open while drafts wait for Confirm (the PM, 2026-10-13); it stays as the person leaves it
  const [otherOpen, setOtherOpen] = useState(false);
  const [copying, setCopying] = useState<string | null>(null); // the choice group being copied to other items
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // Duplicate on its way
  const scroller = useRef<HTMLDivElement>(null), nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const addChoices = useRef<() => void>(() => undefined); // the Price card's "+ Add choices" starts a group in the Choices card
  useEffect(() => { if (onNotesFirst) document.querySelector('[data-group-section="allergens"]')?.scrollIntoView({ block: 'start' }); }, [item.id, onNotesFirst]);
  useEffect(() => { if (selectName) { const el = nameRef.current; if (el) { el.focus(); el.select(); } } }, [selectName]); // a copy opens with its name selected, ready to be typed over
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !copying) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, copying]);
  useEffect(() => { if (!reason) return; const t = setTimeout(() => setReason(null), 6000); return () => clearTimeout(t); }, [reason]);
  // the toast's strip appears under the scroll area: a field being typed in that it now hides is brought back into view
  useEffect(() => { if (!toast) return; const a = document.activeElement as HTMLElement | null, s = scroller.current; if (a && s?.contains(a) && a.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom) a.scrollIntoView({ block: 'nearest' }); }, [toast]);
  const patch = (p: Record<string, unknown>) => onPatch(p); // a failed save: the toast and the top bar say so
  const looksGood = (field: string) => { void onLooksGood(field).catch(() => undefined); };
  const problem = listingProblem(item);
  const faDraft = (f: string) => item.fa_draft.includes(f);
  const seasonalId = sections.find((s) => s.seasonal)?.id ?? null;
  const toggle = (open: boolean, set: (v: boolean) => void, id: string) => { set(!open); if (!open) requestAnimationFrame(() => { const s = scroller.current, g = s?.querySelector(`[data-group-section="${id}"]`); if (s && g && g.getBoundingClientRect().top > s.getBoundingClientRect().top + s.clientHeight * 0.45) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); };
  const parts = item.components.length, note = !!(item.notes.text?.en || item.notes.text?.fa);
  const otherBits = [parts ? `${parts} part${parts === 1 ? '' : 's'}` : null, item.serves ? `Serves ${item.serves}` : null, canNotes && note ? 'Note' : null].filter(Boolean).join(' · ');
  const duplicate = async () => { setBusy(true); try { await onDuplicate(); } catch { setBusy(false); } };
  const waiting = canNotes ? notesCount(item.notes, item.drafts) : 0;

  return (
    <div className={`item-panel panel-in flex flex-col bg-fill ${column ? 'sticky top-14 h-[calc(100dvh-3.5rem)] border-l border-line' : 'fixed inset-0 z-50 lg:inset-auto lg:bottom-0 lg:right-[520px] lg:top-14 lg:w-[440px] lg:border-l lg:border-line lg:shadow-panel'}`} role="dialog" aria-modal={column ? undefined : true} aria-label={`Edit ${item.name.en ?? 'item'}`}>
      {/* the top bar: back on the left, the live save status on the right */}
      <div className="glass flex h-11 shrink-0 items-center gap-2 pl-1 pr-3 shadow-[inset_0_-1px_0_var(--color-line)]">
        <button type="button" data-back="" onClick={onClose} aria-label="Back to the menu" className="flex h-11 shrink-0 items-center gap-0.5 rounded-xl px-2 text-base font-semibold text-accent-ink"><Icon name="back" className="h-5 w-5" strokeWidth={2.2} />Menu</button>
        <span className="flex-1" />
        <SaveState save={save} />
      </div>
      <div ref={scroller} data-editor-scroll="" className="min-h-0 flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom))' }}>
        {/* visibility: shown or hidden, and the season (set here only) */}
        <Heading>Visibility</Heading>
        <div className={cardCls}>
          <div>
            <label data-status="" className="flex min-h-11 cursor-pointer items-center gap-3 px-3">
              <span className="min-w-0 flex-1 text-base">{item.listed ? 'Shown on menu' : 'Hidden from menu'}</span>
              <Switch checked={item.listed} label={item.listed ? 'Shown. Tap to hide' : 'Hidden. Tap to show'} onChange={async (v) => { setReason(null); try { await onPatch({ listed: v }); } catch (e) { setReason((e as Error).message); } }} />
            </label>
            {(reason || (problem && !item.listed)) && <p role={reason ? 'alert' : undefined} className={`px-3 pb-2.5 text-[13px] ${reason ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{reason || `${problem}.`}</p>}
          </div>
          <Seasons item={item} season={season} seasonalId={seasonalId} onPatch={patch} />
        </div>

        {/* the item: photo, name, description */}
        <Heading>Item</Heading>
        <div className={cardCls}>
          <div className="flex">
            <PhotoButton venueId={venueId} photo={item.photo} alt={{ en: item.name.en, fa: item.name.fa }} onChange={(p) => patch({ photo: p })} />
            <div className="min-w-0 flex-1 divide-y divide-line">
              <FieldRow lang="EN"><CellText label="Name" value={item.name.en} required maxLength={LIMITS.name} placeholder="Name" className="[&_input]:text-[17px] [&_input]:font-semibold" inputRef={(el) => { nameRef.current = el; }} onCommit={(v) => patch({ name: { ...item.name, en: v } })} /></FieldRow>
              <FieldRow lang="FA" draft={faDraft('name')} looksGood={() => looksGood('name.fa')} what="the Persian name"><CellText label="Name (فارسی)" maxLength={LIMITS.name} value={item.name.fa} dir="rtl" lang="fa" placeholder="نام فارسی" onCommit={(v) => patch({ name: { ...item.name, fa: v } })} /></FieldRow>
            </div>
          </div>
          <FieldRow lang="EN" draft={item.drafts.includes('description')} looksGood={() => looksGood('description.en')} what="the English description"><CellText lines maxLength={LIMITS.description} label="Description" value={item.description.en} placeholder="Description" onCommit={(v) => patch({ description: { ...item.description, en: v } })} /></FieldRow>
          <FieldRow lang="FA" draft={faDraft('description')} looksGood={() => looksGood('description.fa')} what="the Persian description"><CellText lines maxLength={LIMITS.description} label="Description (فارسی)" value={item.description.fa} dir="rtl" lang="fa" placeholder="توضیح فارسی" onCommit={(v) => patch({ description: { ...item.description, fa: v } })} /></FieldRow>
        </div>

        {/* price & choices */}
        <PriceOrSizes item={item} onPatch={patch} hint={problem && !item.listed && !item.variants.length ? 'Add a price to show this item.' : undefined} onLooksGood={looksGood} onAddChoices={() => addChoices.current()} choicesFull={groupCount(item.add_ons) >= COUNTS.groups} />
        <Choices item={item} onPatch={patch} onCopy={setCopying} onLooksGood={looksGood} addRef={addChoices} />

        {/* where it appears */}
        <div data-where="">
          <Heading>Appears in</Heading>
          <SectionPicker item={item} sections={sections} season={season} onPatch={patch} />
        </div>

        {/* allergens & diet (owner and admin) */}
        {canNotes
          ? <section data-group-section="allergens">
              <button type="button" data-group="allergens" aria-expanded={allergensOpen} onClick={() => toggle(allergensOpen, setAllergensOpen, 'allergens')} className="flex min-h-11 w-full items-end justify-between gap-3 px-3 pb-1.5 pt-6 text-left">
                <span className={headingText} style={headingStyle}>Allergens &amp; diet</span>
                <span className="flex min-w-0 items-center gap-1 text-[13px] leading-5">
                  {waiting ? <span className="font-semibold text-accent-ink">{waiting} to confirm</span> : <span className="min-w-0 text-ink-muted [overflow-wrap:anywhere]">{notesSummary(item.notes)}</span>}
                  <Icon name="down" className={`h-4 w-4 text-ink-muted transition ${allergensOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {allergensOpen && <div className={cardCls}><GoodToKnow item={item} onNotes={onNotes} onConfirm={onConfirm} /></div>}
            </section>
          : <><Heading>Allergens &amp; diet</Heading><div className={cardCls}><p className="px-3 py-2.5 text-base text-ink-muted">These are set by the owner or an admin.</p></div></>}

        {/* more: the rarely used details, Duplicate, Delete */}
        <Heading>More</Heading>
        <div className={cardCls}>
          <section data-group-section="other">
            <button type="button" data-group="other" aria-expanded={otherOpen} onClick={() => toggle(otherOpen, setOtherOpen, 'other')} className="flex min-h-11 w-full items-center gap-3 px-3 text-left">
              <span className="min-w-0 flex-1 text-base">{canNotes ? 'Combo parts, serves, note' : 'Combo parts, serves'}</span>
              {otherBits && <span className="text-[13px] text-ink-muted">{otherBits}</span>}
              <Icon name="down" className={`h-4 w-4 shrink-0 text-ink-muted transition ${otherOpen ? 'rotate-180' : ''}`} />
            </button>
            {otherOpen && (
              <div className="divide-y divide-line border-t border-line">
                <Parts item={item} onPatch={patch} onLooksGood={looksGood} />
                <label className="flex min-h-11 items-center gap-3 pl-3">
                  <span className="text-base">Serves</span>
                  <CellText label="Serves" maxLength={LIMITS.label} value={item.serves} placeholder="2 or 3-4 (platters)" align="right" onCommit={(v) => patch({ serves: v })} />
                </label>
                {canNotes && <NoteFields notes={item.notes} onNotes={onNotes} />}
              </div>
            )}
          </section>
          <button type="button" onClick={() => { void duplicate(); }} disabled={busy} className="flex min-h-11 w-full items-center px-3 text-left text-base text-accent-ink disabled:opacity-50">{busy ? 'Duplicating…' : 'Duplicate item'}</button>
          <button type="button" onClick={onDelete} className="flex min-h-11 w-full items-center px-3 text-left text-base text-danger">Delete item</button>
        </div>
        <p className="px-3 pt-1.5 text-[13px] text-ink-muted">Duplicate makes a hidden copy, “{item.name.en} (copy)”, with the same details.</p>
      </div>
      {toast && <div aria-hidden="true" data-toast-zone="" className="shrink-0 border-t border-line bg-fill" style={{ height: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 64px)' }} />}
      {copying !== null && <CopyChoicesSheet item={item} group={copying} sections={sections} items={items} onCopy={(ids) => onCopy(copying, ids)} onClose={() => setCopying(null)} />}
    </div>
  );
}

// The live save status (the PM's clean-up, 2026-11-04). Not a role=status region (that is the toast's), but read out when it changes.
function SaveState({ save }: { save: SaveStatus }) {
  const text = { saving: 'Saving…', saved: 'Saved', failed: 'Not saved', refused: 'Not saved', unpublished: 'Page not updated' }[save.state];
  const bad = save.state === 'failed' || save.state === 'refused' || save.state === 'unpublished';
  return (
    <span data-save-state={save.state} aria-live="polite" className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] ${bad ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
      {text}
      {save.retry && <>{' '}<span aria-hidden="true" className="text-ink-muted">·</span>{' '}<button type="button" onClick={save.retry} data-save-retry="" className="tap rounded-xl font-semibold text-accent-ink">Retry</button></>}
    </span>
  );
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// One row of a card: the language, the field, and under the field "Draft · Looks good" while it is a draft and not being edited (being
// edited, a person's edit clears the draft flag anyway).
function FieldRow({ lang, draft, looksGood, what, children }: { lang: 'EN' | 'FA'; draft?: boolean; looksGood?: () => void; what?: string; children: React.ReactElement<{ onFocusChange?: (f: boolean) => void }> }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex">
      <LangTag lang={lang} />
      <div className="min-w-0 flex-1">
        {cloneElement(children, { onFocusChange: setEditing })}
        {draft && looksGood && !editing && <DraftLine what={what ?? 'this field'} onLooksGood={looksGood} />}
      </div>
    </div>
  );
}

// Seasons (Kian, 2026-10-12; set in Visibility only since the PM's clean-up of 2026-11-04): All year or any of the four seasons, each tap
// saved; picking a season clears All year, none picked is All year. The caption, only when the seasons limit the item, says what they do
// today: hidden outside them; out of season now; or in the Seasonal section without today's season.
const SEASON_ORDER: SeasonId[] = ['fall', 'winter', 'spring', 'summer'];
const listWords = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
function Seasons({ item, season, seasonalId, onPatch }: { item: EditorItem; season: SeasonId; seasonalId: string | null; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const st = seasonState(item, { season, seasonalId });
  const set = async (next: SeasonId[]) => { setBusy(true); try { await onPatch({ seasons: next }); } catch { /* the toast and the top bar say so */ } finally { setBusy(false); } };
  const toggle = (x: SeasonId) => { void set(SEASON_ORDER.filter((y) => (y === x ? !item.seasons.includes(x) : item.seasons.includes(y)))); };
  const words = listWords(item.seasons.map((x) => SEASON_NAMES[x].toLowerCase())), now = SEASON_NAMES[season];
  const caption = st === 'out' ? `Hidden outside ${words}, so not shown now (it is ${now.toLowerCase()}).`
    : st === 'none' ? `Not in the ${now} Menu until ${now} is picked.`
    : item.seasons.length ? `Hidden outside ${words}.` : null;
  return (
    <div className="px-3 py-2.5" role="group" aria-label="Seasons">
      <p className="mb-2 text-base">Season</p>
      <div className="grid grid-cols-5 gap-1.5">
        <button type="button" aria-pressed={!item.seasons.length} disabled={busy} onClick={() => { if (item.seasons.length) void set([]); }} data-season-chip="all" className={segCls(!item.seasons.length)}>All year</button>
        {SEASON_ORDER.map((x) => { const on = item.seasons.includes(x); return <button key={x} type="button" aria-pressed={on} disabled={busy} onClick={() => toggle(x)} data-season-chip={x} className={segCls(on)}>{SEASON_NAMES[x]}</button>; })}
      </div>
      {caption && <p data-season-caption="" className={`mt-2 text-[13px] ${st ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{caption}</p>}
    </div>
  );
}

// The photo (the PM's clean-up, 2026-11-04): tapped, it offers Change photo (the phone's camera or photos; shrunk on the device first, see
// upload.ts) and Remove photo; without one, an Add photo square opens the chooser at once. A linked photo from the import is replaced the same way.
function PhotoButton({ venueId, photo, alt, onChange }: { venueId: string; photo: PhotoData | null; alt: Bi; onChange: (p: PhotoData | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); } };
    document.addEventListener('mousedown', close); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', key, true); };
  }, [menu]);
  const pick = async (f: File) => {
    setBusy(true); setErr(null); setMenu(false);
    try { const u = await uploadImage(venueId, 'photo', f); await onChange({ url: u.url, key: u.key, width: u.width, height: u.height, alt: photo?.alt ?? alt }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const chooser = (label: string) => <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />;
  return (
    <div ref={ref} className="relative shrink-0 p-3 pr-0" data-photo-field={busy ? 'uploading' : photo ? 'set' : 'empty'}>
      {photo
        ? <button type="button" aria-label="Photo: change or remove" aria-haspopup="menu" aria-expanded={menu} disabled={busy} onClick={() => setMenu((m) => !m)} className="relative block h-16 w-16 overflow-hidden rounded-xl">
            <img src={photo.url} alt="" loading="lazy" decoding="async" className="h-16 w-16 object-cover" />
            {busy && <span className="absolute inset-0 flex items-center justify-center bg-canvas/75 text-[13px] font-semibold">Uploading…</span>}
          </button>
        : <label className="relative flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl bg-fill text-accent-ink" aria-busy={busy}>
            <Icon name="image" className="h-5 w-5" /><span className="text-center text-[13px] font-semibold leading-4">{busy ? '…' : 'Add photo'}</span>
            {chooser('Choose a photo')}
          </label>}
      {menu && photo && (
        <div role="menu" className="absolute left-3 top-[80px] z-40 w-52 rounded-xl bg-canvas p-1 shadow-pop">
          <label role="menuitem" className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-base text-accent-ink">Change photo{chooser('Replace the photo')}</label>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setErr(null); void onChange(null).catch(() => undefined); }} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base text-danger">Remove photo</button>
        </div>
      )}
      {err && <p role="alert" className="mt-1 w-16 text-[13px] text-danger">{err}</p>}
    </div>
  );
}

// The note for customers (owner and admin, with the allergen notes; under More since the clean-up): saved with the notes.
function NoteFields({ notes, onNotes }: { notes: Notes; onNotes: (n: Notes) => Promise<void> }) {
  const save = (text: Bi) => onNotes({ ...notes, text }).catch(() => undefined); // a failed save: the toast and the top bar say so
  const t = notes.text ?? { en: null, fa: null };
  return (
    <div className="divide-y divide-line">
      <p className="px-3 pt-2.5 text-[13px] text-ink-muted">Note for customers</p>
      <FieldRow lang="EN"><CellText lines label="Note for customers" maxLength={LIMITS.note} value={t.en} placeholder="Optional" onCommit={(v) => save({ ...t, en: v })} /></FieldRow>
      <FieldRow lang="FA"><CellText lines label="Note for customers (فارسی)" maxLength={LIMITS.note} value={t.fa} dir="rtl" lang="fa" placeholder="اختیاری" onCommit={(v) => save({ ...t, fa: v })} /></FieldRow>
    </div>
  );
}

function Parts({ item, onPatch, onLooksGood }: { item: EditorItem; onPatch: (p: Record<string, unknown>) => Promise<void>; onLooksGood: (field: string) => void }) {
  const [rows, setRows] = useState<Component[]>(item.components);
  const key = JSON.stringify(item.components);
  useEffect(() => { setRows(JSON.parse(key)); }, [key]);
  const save = (next: Component[]) => { setRows(next); const complete = next.filter((c) => c.label.en); if (!sameJson(complete, item.components)) void onPatch({ components: complete }).catch((e) => { if (!retryable(e)) setRows(item.components); }); }; // the rows stay for Retry (D-02)
  const set = (i: number, c: Component) => save(rows.map((r, k) => (k === i ? c : r)));
  return (
    <div>
      <div className="px-3 pt-2.5">
        <p className="text-base font-semibold">Combo parts</p>
        <p className="text-[13px] text-ink-muted">For platters and mixed dishes: what the dish is made of.</p>
      </div>
      {item.fa_draft.includes('components') && <DraftLine what="the Persian of the combo parts" onLooksGood={() => onLooksGood('components')}>Parts in Persian: draft</DraftLine>}
      <div className="divide-y divide-line">
        {rows.map((c, i) => (
          <div key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center">
            <CellText inputMode="numeric" value={String(c.qty)} placeholder="Qty" label={`Part ${i + 1} quantity`} onCommit={(x) => set(i, { ...c, qty: Math.max(1, Math.trunc(Number(x) || 1)) })} />
            <CellText maxLength={LIMITS.label} value={c.label.en} placeholder="Part" label={`Part ${i + 1}`} onCommit={(x) => set(i, { ...c, label: { ...c.label, en: x } })} />
            <CellText maxLength={LIMITS.label} value={c.label.fa} placeholder="فارسی" dir="rtl" lang="fa" align="right" label={`Part ${i + 1} (Persian)`} onCommit={(x) => set(i, { ...c, label: { ...c.label, fa: x } })} />
            <button type="button" aria-label={`Remove part ${c.label.en || i + 1}`} onClick={() => save(rows.filter((_, k) => k !== i))} className="flex h-11 w-11 items-center justify-center text-ink-muted"><Icon name="close" className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="px-3">
        <button type="button" className={textBtn} disabled={rows.length >= COUNTS.parts} onClick={() => setRows([...rows, { item_id: null, label: { en: null, fa: null }, qty: 1 }])}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />{rows.length >= COUNTS.parts ? `At most ${COUNTS.parts} parts` : 'Add a part'}</button>
      </div>
    </div>
  );
}
