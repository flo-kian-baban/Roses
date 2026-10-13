'use client';
// Good to know (Kian via the PM, 2026-10-13, after the admin audit): the allergen, diet and halal notes as one-tap chips, right under the
// item's basics (owner and admin only; staff see nothing here, and the route answers them 403 as before). The allergen chips are Health
// Canada's priority allergens plus the other gluten sources and sulphites, each with its Persian (src/lib/allergens.json, the words the
// popup shows as "Contains: …" / "حاوی: …"); a word an owner typed before that is not one of them stays as a chip of its own, and
// "Other…" adds one. A tap saves at once. Notes drafted from research show as suggested (blue) with what they are based on and Confirm;
// a tap on a chip is the owner's own choice, so it confirms that list too (the draft flag goes, as for any edit by a person).
import { useEffect, useState } from 'react';
import type { Basis, EditorItem, Notes } from '@/lib/types';
import words from '@/lib/allergens.json';
import { Badge, TextField, btnPrimary, fieldCls } from './ui';

const ALLERGENS = words.allergens, DIET = words.dietary;
const chipCls = (on: boolean, draft: boolean) => `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium ${on ? (draft ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-ink bg-ink text-white') : 'border-line bg-white text-ink'}`;
const norm = (w: string) => w.trim().toLowerCase();

export function GoodToKnow({ item, onNotes, onConfirm, setErr }: { item: EditorItem; onNotes: (n: Notes) => Promise<void>; onConfirm: () => Promise<void>; setErr: (s: string | null) => void }) {
  const [n, setN] = useState<Notes>(item.notes);
  const [other, setOther] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(item.notes);
  useEffect(() => { setN(JSON.parse(key)); }, [key]);
  const draftA = item.drafts.includes('allergens'), draftD = item.drafts.includes('dietary');
  const save = (next: Notes) => { setN(next); return onNotes(next).catch((e) => { setErr((e as Error).message); setN(item.notes); }); };
  // the standard words in their order, then the owner's own words as they were
  const ordered = (list: string[]) => [...ALLERGENS.map((a) => a.en).filter((w) => list.some((x) => norm(x) === w)), ...list.filter((x) => !ALLERGENS.some((a) => a.en === norm(x)))];
  const hasA = (w: string) => n.allergens.some((x) => norm(x) === norm(w));
  const toggleA = (w: string) => { void save({ ...n, allergens: ordered(hasA(w) ? n.allergens.filter((x) => norm(x) !== norm(w)) : [...n.allergens, w]) }); };
  const hasD = (w: string) => n.dietary.some((x) => norm(x) === norm(w));
  const toggleD = (w: string) => { void save({ ...n, dietary: hasD(w) ? n.dietary.filter((x) => norm(x) !== norm(w)) : [...DIET.map((d) => d.en).filter((d) => d === w || n.dietary.some((x) => norm(x) === norm(d))), ...n.dietary.filter((x) => !DIET.some((d) => norm(d.en) === norm(x)))] }); };
  const ownWords = n.allergens.filter((x) => !ALLERGENS.some((a) => a.en === norm(x)));
  const ownDiet = n.dietary.filter((x) => !DIET.some((d) => norm(d.en) === norm(x)));
  const confirm = async () => { setBusy(true); try { await onConfirm(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <section className="mt-6 space-y-3" data-good-to-know="" aria-label="Good to know">
      <p className="text-sm font-medium">Good to know <span className="font-normal text-ink-muted">· customers see these in the item</span></p>
      {(draftA || draftD) && <ResearchDraft notes={n} basis={item.basis} busy={busy} onConfirm={() => { void confirm(); }} />}
      <div role="group" aria-label="Contains">
        <span className="mb-1 flex items-center gap-2 text-sm font-medium">Contains{draftA && <Badge tone="blue">To confirm</Badge>}</span>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => <button key={a.en} type="button" data-allergen={a.en} aria-pressed={hasA(a.en)} className={chipCls(hasA(a.en), draftA)} onClick={() => toggleA(a.en)}><span>{a.en[0].toUpperCase() + a.en.slice(1)}</span><span lang="fa" className="text-[12px] opacity-75">{a.fa}</span></button>)}
          {ownWords.map((w) => <button key={w} type="button" data-allergen={w} aria-pressed className={chipCls(true, draftA)} onClick={() => toggleA(w)}>{w}<span aria-hidden="true">×</span></button>)}
          {other === null
            ? <button type="button" className={`${chipCls(false, false)} border-dashed`} onClick={() => setOther('')}>+ Other…</button>
            : <input autoFocus className={`${fieldCls} w-44`} value={other} placeholder="Another allergen" aria-label="Another allergen" onChange={(e) => setOther(e.target.value)}
                onBlur={() => { const w = (other ?? '').trim(); setOther(null); if (w && !hasA(w)) toggleA(w); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setOther(null); }} />}
        </div>
      </div>
      <div role="group" aria-label="Diet">
        <span className="mb-1 flex items-center gap-2 text-sm font-medium">Diet{draftD && <Badge tone="blue">To confirm</Badge>}</span>
        <div className="flex flex-wrap gap-2">
          {DIET.map((d) => <button key={d.en} type="button" data-diet={d.en} aria-pressed={hasD(d.en)} className={chipCls(hasD(d.en), draftD)} onClick={() => toggleD(d.en)}><span>{d.en}</span><span lang="fa" className="text-[12px] opacity-75">{d.fa}</span></button>)}
          {ownDiet.map((w) => <button key={w} type="button" data-diet={w} aria-pressed className={chipCls(true, draftD)} onClick={() => toggleD(w)}>{w}<span aria-hidden="true">×</span></button>)}
        </div>
      </div>
      <div role="group" aria-label="Halal">
        <span className="mb-1 block text-sm font-medium">Halal</span>
        <div className="flex flex-wrap gap-2">
          {([['unknown', 'Not set', null], ['yes', 'Halal', true], ['no', 'Not halal', false]] as const).map(([k, label, val]) => (
            <button key={k} type="button" data-halal={k} aria-pressed={n.halal === val} className={chipCls(n.halal === val, false)} onClick={() => { if (n.halal !== val) void save({ ...n, halal: val }); }}>{label}</button>
          ))}
        </div>
      </div>
      <TextField label="Note for customers" value={n.text?.en} onCommit={(v) => save({ ...n, text: { ...(n.text ?? { en: null, fa: null }), en: v } })} />
      <TextField label="Note for customers (فارسی)" value={n.text?.fa} dir="rtl" lang="fa" onCommit={(v) => save({ ...n, text: { ...(n.text ?? { en: null, fa: null }), fa: v } })} />
    </section>
  );
}

// Notes drafted from research (Kian, 2026-10-12): not on the public page until confirmed. What the draft says, what it is based on, Confirm.
function ResearchDraft({ notes, basis, busy, onConfirm }: { notes: Notes; basis: Basis | null; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3" data-research-draft="">
      <p className="text-[15px] font-semibold text-sky-950">Suggested from research: customers don’t see it yet</p>
      <p className="mt-1 text-[13px] text-sky-950/80">{notes.allergens.length ? <>Contains: {notes.allergens.join(', ')}.</> : <>No common allergen found in the usual recipe.</>}{notes.dietary.length ? <> {notes.dietary.join(', ')}.</> : null} Check it against your recipe: tap a chip to change it, or Confirm if it is right.</p>
      {basis && <p className="mt-1 text-[13px] text-sky-950/80">Based on: {basis.ingredients.join(', ')}{basis.source && <> · <a href={basis.source} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">source</a></>}</p>}
      <button type="button" onClick={onConfirm} disabled={busy} className={`${btnPrimary} mt-3`} aria-label="Confirm the allergens and dietary notes">{busy ? 'Confirming…' : 'Confirm'}</button>
    </div>
  );
}
