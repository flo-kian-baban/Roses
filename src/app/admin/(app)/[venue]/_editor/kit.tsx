'use client';
// The item editor's kit (the PM's clean-up, 2026-11-04: a calm editor staff understand at a glance, in the phone-Settings style): grouped
// cards with thin dividers between their rows, small grey headings over them, labels on the left and values on the right. One accent colour
// (accent-ink) for actions and selected states, green only on the toggle, red only for Delete (and for a save that did not go through); three
// text sizes (13, 16 and 17 px) and one corner radius (12 px) in the column. Colours are the admin's tokens only, defined in one place
// (src/app/globals.css): this file, ItemPanel, Choices, GoodToKnow and SectionPicker hold no colour literal (suite step editor-colour-literals).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../../_ui/icons';
import { retryable } from './api';
import { useUnsaved } from './ui';
import { parsePrice, priceInput } from '@/lib/rules';

// A card: white on the column's grey, its rows split by hairlines.
export const cardCls = 'rounded-xl bg-canvas divide-y divide-line';
// A field inside a card: no box of its own (the card is the box), 16 px text, 44 px tall.
export const cellCls = 'block w-full min-w-0 bg-transparent px-3 py-2.5 text-base leading-6 text-ink placeholder:text-ink-muted/60 focus:outline-none';
// An action: plain accent text, no border.
export const textBtn = 'inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50';
// A choice that is on or off (an allergen, a diet, halal): grey when off, the accent when on, with a check so it never depends on colour alone.
export const chipCls = (on: boolean) => `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-base ${on ? 'bg-accent-soft font-semibold text-accent-ink' : 'bg-fill text-ink'}`;
// One of a row of equal choices (the seasons): as a chip, in the small text size so five fit on a 360 px phone.
export const segCls = (on: boolean) => `flex h-11 min-w-0 items-center justify-center rounded-xl px-1 text-[13px] ${on ? 'bg-accent-soft font-semibold text-accent-ink' : 'bg-fill text-ink'} disabled:cursor-not-allowed`;
export const OnMark = () => <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />;

// The small grey heading over a card (VISIBILITY, ITEM, PRICE…). `right`: what sits at its other end.
export function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-3 pb-1.5 pt-6">
      <h3 className="text-[13px] uppercase leading-5 text-ink-muted" style={{ fontWeight: 500, letterSpacing: '.04em' }}>{children}</h3>
      {right}
    </div>
  );
}
// The heading's own style, for a heading that is a button (Allergens & diet opens and closes).
export const headingText = 'text-[13px] uppercase leading-5 text-ink-muted';
export const headingStyle = { fontWeight: 500, letterSpacing: '.04em' } as const;

// A field inside a card that saves itself (on leaving it, or Enter on one line; re-synced when the saved value changes, e.g. Undo). `lines`:
// a text box as tall as its text at any width, so a description is read in full, never cut short. A save that did not go through keeps what
// was typed, marked "Not saved", when trying again can help (pre-go-live audit D-02).
export function CellText({ value, onCommit, label, placeholder, dir, lang, required, lines, className = '', inputRef, onFocusChange, maxLength, inputMode, align }: {
  value: string | null | undefined; onCommit: (v: string | null) => void | Promise<void>; label: string; placeholder?: string; dir?: 'rtl' | 'ltr'; lang?: string;
  required?: boolean; lines?: boolean; className?: string; inputRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void; onFocusChange?: (focused: boolean) => void;
  maxLength?: number; inputMode?: 'text' | 'numeric' | 'decimal'; align?: 'right';
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  const unsaved = useUnsaved(value ?? '', setDraft, () => setErr(null));
  const [focused, setFocused] = useState(false);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  // the text box takes its text's height; the editor's scroll position is kept while it is measured
  const fit = () => {
    const el = ta.current; if (!el) return;
    const sc = el.closest('[data-editor-scroll]') as HTMLElement | null, top = sc?.scrollTop ?? 0;
    el.style.height = '0px'; el.style.height = `${Math.max(44, el.scrollHeight)}px`;
    if (sc && sc.scrollTop !== top) sc.scrollTop = top;
  };
  useLayoutEffect(fit, [draft]);
  useEffect(() => { // a new width (the column opening, a turned phone) wraps the text again
    const el = ta.current; if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth; const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; fit(); } }); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { onFocusChange?.(focused); }, [focused]);
  const commit = async () => {
    const v = draft.trim();
    if (v === (value ?? '')) return;
    if (required && !v) { setErr('Required'); setDraft(value ?? ''); return; }
    try { setErr(null); await onCommit(v === '' ? null : v); unsaved.current = null; } catch (e) { const keep = retryable(e); setErr(keep ? `Not saved. ${(e as Error).message}` : (e as Error).message); if (keep) { unsaved.current = v; setDraft(draft); } else setDraft(value ?? ''); }
  };
  const common = { value: draft, placeholder, dir, lang, maxLength, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onFocus: () => setFocused(true), onBlur: () => { setFocused(false); void commit(); } };
  return (
    <span className={`block min-w-0 flex-1 ${className}`}>
      {lines
        ? <textarea {...common} ref={(el) => { ta.current = el; inputRef?.(el); }} rows={1} className={`${cellCls} resize-none overflow-hidden`} style={{ height: 44 }} />
        : <input {...common} ref={inputRef} type="text" inputMode={inputMode} className={`${cellCls} ${align === 'right' ? 'text-right' : ''}`} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />}
      {err && <span role="alert" className="block px-3 pb-2 text-[13px] text-danger">{err}</span>}
    </span>
  );
}

// The price of an item without sizes, as a row: "Price" on the left, the amount on the right with its "$" beside it (the field is as wide as
// what is typed in it). Empty means no price. The server's reading of a price (pre-go-live audit S2-07): "1,50" is 1.50, "1e3" is not one.
export function CellMoney({ value, onCommit, label = 'Price', hint }: { value: number | null | undefined; onCommit: (v: number | null) => void | Promise<void>; label?: string; hint?: string }) {
  const [draft, setDraft] = useState(priceInput(value));
  const [err, setErr] = useState<string | null>(null);
  const unsaved = useUnsaved(priceInput(value), setDraft, () => setErr(null));
  const commit = async () => {
    const n = parsePrice(draft);
    if (n === 'bad') { setErr('Not a price (for example 12.50)'); return; }
    if (n === (value ?? null)) { setErr(null); return; }
    try { setErr(null); await onCommit(n); unsaved.current = null; } catch (e) { const keep = retryable(e); setErr(keep ? `Not saved. ${(e as Error).message}` : (e as Error).message); if (keep) { unsaved.current = priceInput(n); setDraft(draft); } else setDraft(priceInput(value)); }
  };
  return (
    <div data-price-row="">
      <label className="flex min-h-11 cursor-text items-center gap-3 pl-3">
        <span className="flex-1 text-base">{label}</span>
        <span className="flex items-center pr-3 text-base tabular-nums">
          <span className="text-ink-muted">$</span>
          {/* the hidden copy gives the field its width: the amount stays next to its "$" */}
          <span className="inline-grid">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre py-2.5 pl-0.5">{draft || '0.00'}</span>
            <input type="text" inputMode="decimal" size={1} value={draft} placeholder="0.00" aria-label={label} className="col-start-1 row-start-1 w-full min-w-0 bg-transparent py-2.5 pl-0.5 text-base leading-6 text-ink placeholder:text-ink-muted/60 focus:outline-none"
              onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => { void commit(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
          </span>
        </span>
      </label>
      {(err || hint) && <p role={err ? 'alert' : undefined} className={`px-3 pb-2.5 text-[13px] ${err ? 'text-danger' : 'text-ink-muted'}`}>{err || hint}</p>}
    </div>
  );
}

// The language of a row (EN / FA), in the small grey text.
export function LangTag({ lang }: { lang: 'EN' | 'FA' }) {
  return <span aria-hidden="true" className="w-10 shrink-0 self-start pl-3 pt-3 text-[13px] leading-5 text-ink-muted">{lang}</span>;
}
// "Looks good" (Kian, 2026-10-13): one tap clears that field's draft flag and nothing else; Undo puts it back.
export function LooksGood({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={`Looks good: ${label}`} className={`${textBtn} shrink-0 px-1`}><OnMark />Looks good</button>;
}
// A field drafted at import or by research: "Draft" and "Looks good" on a line of their own under the field, so the field keeps its width.
export function DraftLine({ what, onLooksGood, children }: { what: string; onLooksGood: () => void; children?: React.ReactNode }) {
  return <div className="flex min-h-11 flex-wrap items-center gap-x-3 px-3" data-draft=""><span className="text-[13px] text-ink-muted">{children ?? 'Draft'}</span><LooksGood label={what} onClick={onLooksGood} /></div>;
}
