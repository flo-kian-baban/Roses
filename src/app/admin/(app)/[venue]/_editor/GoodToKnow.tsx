'use client';
// Allergens & diet (Kian via the PM, 2026-10-13, after the admin audit; one card of the item editor since the PM's clean-up of 2026-11-04,
// open while research drafts wait for Confirm, closed otherwise): the allergen, diet and halal notes as one-tap chips (owner and admin only;
// staff see one line, and the route answers them 403 as before). The allergen chips are Health Canada's priority allergens plus the other
// gluten sources and sulphites, each with its Persian (src/lib/allergens.json, the words the popup shows as "Contains: …" / "حاوی: …"); a
// word an owner typed before that is not one of them stays as a chip of its own, and "+ Other…" adds one. A tap saves at once.
// While notes drafted from research wait (Kian, 2026-10-12: customers see them only once confirmed), the card shows what was suggested as
// chips, the full list one tap away ("All allergens and diet"), one line saying what Confirm does, what the suggestion is based on, and
// Confirm. A tap on a chip is the owner's own choice, so it confirms that list too (the draft flag goes, as for any edit by a person), and the
// card then shows the full list. The note for customers is under More.
import { useEffect, useState } from 'react';
import type { Basis, EditorItem, Notes } from '@/lib/types';
import words from '@/lib/allergens.json';
import { Icon } from '../../../_ui/icons';
import { OnMark, chipCls, textBtn } from './kit';

const ALLERGENS = words.allergens, DIET = words.dietary;
const norm = (w: string) => w.trim().toLowerCase();
const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

// How many suggestions wait for Confirm: each drafted allergen and diet word, and a drafted allergen list with none in it (research
// suggested no allergen, itself something to confirm). Pumpkin Soup, drafted "milk": 1.
export function notesCount(n: Notes, drafts: string[]): number {
  const a = drafts.includes('allergens') ? Math.max(1, n.allergens.length) : 0;
  const d = drafts.includes('dietary') ? n.dietary.length : 0;
  return a + d;
}
// The closed card's line: what the item contains, its diet and halal words.
export function notesSummary(n: Notes): string {
  const parts = [...n.allergens.map(cap), ...n.dietary, ...(n.halal === true ? ['Halal'] : n.halal === false ? ['Not halal'] : [])];
  return parts.length ? parts.join(' · ') : 'None set';
}

export function GoodToKnow({ item, onNotes, onConfirm }: { item: EditorItem; onNotes: (n: Notes) => Promise<void>; onConfirm: () => Promise<void> }) {
  const [n, setN] = useState<Notes>(item.notes);
  const [other, setOther] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false); // the full list asked for while a suggestion waits
  const key = JSON.stringify(item.notes);
  useEffect(() => { setN(JSON.parse(key)); }, [key]);
  const draftA = item.drafts.includes('allergens'), draftD = item.drafts.includes('dietary'), toConfirm = draftA || draftD;
  const full = all || !toConfirm; // without a suggestion waiting, the card is the full list
  const save = (next: Notes) => { setN(next); return onNotes(next).catch(() => { setN(item.notes); }); }; // a failed save: the toast and the top bar say so
  // the standard words in their order, then the owner's own words as they were
  const ordered = (list: string[]) => [...ALLERGENS.map((a) => a.en).filter((w) => list.some((x) => norm(x) === w)), ...list.filter((x) => !ALLERGENS.some((a) => a.en === norm(x)))];
  const hasA = (w: string) => n.allergens.some((x) => norm(x) === norm(w));
  const toggleA = (w: string) => { void save({ ...n, allergens: ordered(hasA(w) ? n.allergens.filter((x) => norm(x) !== norm(w)) : [...n.allergens, w]) }); };
  const hasD = (w: string) => n.dietary.some((x) => norm(x) === norm(w));
  const toggleD = (w: string) => { void save({ ...n, dietary: hasD(w) ? n.dietary.filter((x) => norm(x) !== norm(w)) : [...DIET.map((d) => d.en).filter((d) => d === w || n.dietary.some((x) => norm(x) === norm(d))), ...n.dietary.filter((x) => !DIET.some((d) => norm(d.en) === norm(x)))] }); };
  const ownWords = n.allergens.filter((x) => !ALLERGENS.some((a) => a.en === norm(x)));
  const ownDiet = n.dietary.filter((x) => !DIET.some((d) => norm(d.en) === norm(x)));
  const confirm = async () => { setBusy(true); try { await onConfirm(); } catch { /* the toast and the top bar say so */ } finally { setBusy(false); } };
  const faOf = (list: { en: string; fa: string }[], w: string) => list.find((x) => norm(x.en) === norm(w))?.fa;
  const allergenChip = (w: string, on: boolean, fa?: string) => <button key={w} type="button" data-allergen={w} aria-pressed={on} className={chipCls(on)} onClick={() => toggleA(w)}>{on && <OnMark />}<span>{cap(w)}</span>{fa && <span lang="fa" className="text-[13px]">{fa}</span>}</button>;
  const dietChip = (w: string, on: boolean, fa?: string) => <button key={w} type="button" data-diet={w} aria-pressed={on} className={chipCls(on)} onClick={() => toggleD(w)}>{on && <OnMark />}<span>{w}</span>{fa && <span lang="fa" className="text-[13px]">{fa}</span>}</button>;
  return (
    <div className="px-3 pb-3 pt-2.5" data-good-to-know="" aria-label="Allergens and diet">
      {full ? (<>
        <div role="group" aria-label="Contains">
          <p className="mb-1.5 text-[13px] text-ink-muted">Contains</p>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => allergenChip(a.en, hasA(a.en), a.fa))}
            {ownWords.map((w) => allergenChip(w, true))}
            {other === null
              ? <button type="button" className={chipCls(false)} onClick={() => setOther('')}><Icon name="plus" className="h-4 w-4" />Other…</button>
              : <input autoFocus className="min-h-11 w-44 rounded-xl bg-fill px-3 text-base text-ink placeholder:text-ink-muted/60 focus:outline-none" value={other} placeholder="Another allergen" aria-label="Another allergen" onChange={(e) => setOther(e.target.value)}
                  onBlur={() => { const w = (other ?? '').trim(); setOther(null); if (w && !hasA(w)) toggleA(w); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setOther(null); }} />}
          </div>
        </div>
        <div role="group" aria-label="Diet" className="mt-3">
          <p className="mb-1.5 text-[13px] text-ink-muted">Diet</p>
          <div className="flex flex-wrap gap-1.5">{DIET.map((d) => dietChip(d.en, hasD(d.en), d.fa))}{ownDiet.map((w) => dietChip(w, true))}</div>
        </div>
        <div role="group" aria-label="Halal" className="mt-3">
          <p className="mb-1.5 text-[13px] text-ink-muted">Halal</p>
          <div className="flex flex-wrap gap-1.5">
            {([['unknown', 'Not set', null], ['yes', 'Halal', true], ['no', 'Not halal', false]] as const).map(([k, label, val]) => (
              <button key={k} type="button" data-halal={k} aria-pressed={n.halal === val} className={chipCls(n.halal === val)} onClick={() => { if (n.halal !== val) void save({ ...n, halal: val }); }}>{n.halal === val && <OnMark />}{label}</button>
            ))}
          </div>
        </div>
        {!toConfirm && <p className="mt-3 text-[13px] text-ink-muted">Customers see these in the item’s popup.</p>}
      </>) : (<>
        {/* what research suggested; the full list one tap away */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested">
          {n.allergens.map((w) => allergenChip(w, true, faOf(ALLERGENS, w)))}
          {/* research suggested none: said as exactly that, never as "allergen-free" (the PM, 2026-11-06) */}
          {draftA && !n.allergens.length && <span className="inline-flex min-h-11 items-center text-base text-ink" data-no-suggestion="">No allergens suggested from the ingredients</span>}
          {n.dietary.map((w) => dietChip(w, true, faOf(DIET, w)))}
        </div>
        <button type="button" className={`${textBtn} mt-1`} onClick={() => setAll(true)} data-all-allergens="">All allergens and diet<Icon name="down" className="h-4 w-4 -rotate-90" /></button>
      </>)}
      {toConfirm && <ResearchDraft basis={item.basis} busy={busy} onConfirm={() => { void confirm(); }} />}
    </div>
  );
}

// Notes drafted from research (Kian, 2026-10-12): not on the public page until confirmed. One line, what they are based on, Confirm.
function ResearchDraft({ basis, busy, onConfirm }: { basis: Basis | null; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="mt-2" data-research-draft="">
      <p className="text-[13px] text-ink-muted">Suggested from the ingredients. Customers see it after you confirm.</p>
      {basis && <p className="mt-1 text-[13px] text-ink-muted">Based on: {basis.ingredients.join(', ')}{basis.source && <> · <a href={basis.source} target="_blank" rel="noreferrer" className="font-semibold text-accent-ink underline underline-offset-2">source</a></>}</p>}
      <button type="button" onClick={onConfirm} disabled={busy} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-ink px-6 text-base font-semibold text-canvas disabled:opacity-50" aria-label="Confirm the allergens and dietary notes">{busy ? 'Confirming…' : 'Confirm'}</button>
    </div>
  );
}
