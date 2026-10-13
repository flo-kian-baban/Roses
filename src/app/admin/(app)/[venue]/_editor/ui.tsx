'use client';
// The editor's small kit: fields that save themselves on change, the iOS-style switch, sheets and buttons.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../_ui/icons';

export const btn = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-[linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(238,106,58,.7)]`;
export const btnSecondary = `${btn} border border-line bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:bg-fill`;
export const btnGhost = `${btn} text-ink hover:bg-fill`;
export const btnDanger = `${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`;
export const fieldCls = 'block w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-neutral-400 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20';

const TONE = { grey: 'bg-neutral-100 text-neutral-700', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-900', blue: 'bg-sky-100 text-sky-800', green: 'bg-emerald-100 text-emerald-800' };
export function Badge({ tone = 'grey', children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-medium whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

// A native checkbox drawn as a toggle (see .switch in globals.css). `onChange` may reject with a one-line reason.
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void | Promise<void>; label: string; disabled?: boolean }) {
  return <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} aria-label={label} title={label} onClick={(e) => e.stopPropagation()} onChange={(e) => { void onChange(e.target.checked); }} />;
}

// Text that saves itself: commits on blur or Enter when the value changed; re-syncs when the saved value changes (Undo).
export function TextField({ value, onCommit, label, placeholder, dir, lang, multiline, inputMode, hint, badge, required, autoFocus, className = '', compact }: {
  value: string | null | undefined; onCommit: (v: string | null) => void | Promise<void>; label?: string; placeholder?: string; dir?: 'rtl' | 'ltr'; lang?: string; multiline?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'url'; hint?: string; badge?: React.ReactNode; required?: boolean; autoFocus?: boolean; className?: string; compact?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  const commit = async () => {
    const v = draft.trim();
    if (v === (value ?? '')) return;
    if (required && !v) { setErr('Required'); setDraft(value ?? ''); return; }
    try { setErr(null); await onCommit(v === '' ? null : v); } catch (e) { setErr((e as Error).message); setDraft(value ?? ''); }
  };
  const common = { value: draft, placeholder, dir, lang, autoFocus, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onBlur: () => { void commit(); } };
  return (
    <label className={`block ${className}`}>
      {label && !compact && <span className="mb-1 flex items-center gap-2 text-sm font-medium">{label}{required && <span className="text-ink-muted">*</span>}{badge}</span>}
      {multiline
        ? <textarea {...common} className={`${fieldCls} min-h-24`} />
        : <input {...common} type="text" inputMode={inputMode} className={`${fieldCls} ${compact ? 'py-2' : ''}`} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />}
      {(err || hint) && <span className={`mt-1 block text-xs ${err ? 'text-red-600' : 'text-ink-muted'}`}>{err || hint}</span>}
    </label>
  );
}

// A price that saves itself. Empty means "no price".
// inline: the label to the left of the field on one row (the item editor's price, 2026-10-13).
export function MoneyField({ value, onCommit, label = 'Price', hint, autoFocus, compact, inline, className = '' }: { value: number | null | undefined; onCommit: (v: number | null) => void | Promise<void>; label?: string; hint?: string; autoFocus?: boolean; compact?: boolean; inline?: boolean; className?: string }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  const commit = async () => {
    const t = draft.trim().replace(/^\$/, '');
    const n = t === '' ? null : Number(t);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setErr('Not a price'); return; }
    if (n === (value ?? null)) { setErr(null); return; }
    try { setErr(null); await onCommit(n); } catch (e) { setErr((e as Error).message); setDraft(value == null ? '' : String(value)); }
  };
  return (
    <label className={`${inline ? 'flex flex-wrap items-center gap-x-3' : 'block'} ${className}`}>
      {!compact && <span className={inline ? 'text-[15px] font-medium' : 'mb-1 block text-sm font-medium'}>{label}</span>}
      <span className={`relative block ${inline ? 'w-32' : ''}`}><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-neutral-500">$</span>
        <input type="text" inputMode="decimal" value={draft} placeholder="0.00" aria-label={label} autoFocus={autoFocus} className={`${inline ? fieldCls.replace('py-2.5', 'py-[9px]') : fieldCls} pl-8 tabular-nums ${compact ? 'py-2' : ''}`} onChange={(e) => setDraft(e.target.value)} onBlur={() => { void commit(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} /></span>
      {(err || hint) && <span className={`mt-1 block text-xs ${inline ? 'basis-full' : ''} ${err ? 'text-red-600' : 'text-ink-muted'}`}>{err || hint}</span>}
    </label>
  );
}

// Bottom sheet on phones, a centred card on laptops. Escape and the backdrop close it.
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title} data-sheet="">
      <button type="button" className="backdrop-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className={`sheet-in relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-pop sm:rounded-[24px] ${wide ? 'sm:w-[36rem]' : 'sm:w-[26rem]'}`} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-[19px] font-semibold">{title}</h2><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-ink-muted hover:text-ink" aria-label="Close"><Icon name="close" className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({ title, body, label, onConfirm, onClose }: { title: string; body: React.ReactNode; label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="text-[15px] text-ink-muted">{body}</div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex gap-2">
        <button type="button" className={`${btnDanger} flex-1`} disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { await onConfirm(); } catch (e) { setErr((e as Error).message); setBusy(false); } }}>{label}</button>
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

// A small popover menu anchored to its button; closes on a click outside or Escape.
export function Menu({ label, items }: { label: string; items: { text: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-fill hover:text-ink"><Icon name="more" className="h-5 w-5" /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-2xl border border-black/5 bg-white p-1 shadow-pop">
          {items.map((it) => <button key={it.text} type="button" role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }} className={`block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-[15px] disabled:opacity-40 ${it.danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-fill'}`}>{it.text}</button>)}
        </div>
      )}
    </div>
  );
}

export function Photo({ url, className = '' }: { url?: string | null; className?: string }) {
  return url
    ? <img src={url} alt="" loading="lazy" decoding="async" className={`object-cover ${className}`} />
    : <span className={`flex items-center justify-center bg-fill text-neutral-300 ${className}`}><Icon name="image" className="h-5 w-5" /></span>;
}

// ---- The item editor's cards (Kian, 2026-10-13, the editor rebuild): fields grouped in one bordered card, rows split by hairlines,
// every row at least 44 px tall; the fields inside are borderless and the card shows the focus ring.
export const cardCls = 'overflow-hidden rounded-xl border border-[#d2d2d7] bg-white divide-y divide-line focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20';
export const cellCls = 'block w-full min-w-0 bg-transparent px-3 py-2.5 text-base text-ink placeholder:text-neutral-400 focus:outline-none';

// A field inside a card that saves itself (as TextField: on leaving it, or Enter on one line; re-synced when the saved value changes, e.g.
// Undo). `lines`: a text box that shows its first line while it is not being edited (so the card stays one row tall), grows to its text
// while it is, and marks a longer text with a fade and "…".
export function CellText({ value, onCommit, label, placeholder, dir, lang, required, lines, className = '', inputRef, onFocusChange }: {
  value: string | null | undefined; onCommit: (v: string | null) => void | Promise<void>; label: string; placeholder?: string; dir?: 'rtl' | 'ltr'; lang?: string;
  required?: boolean; lines?: boolean; className?: string; inputRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void; onFocusChange?: (focused: boolean) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [more, setMore] = useState(false); // a longer text than the one line shown
  const ta = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { // the text box: its text's height while edited, its first line otherwise (unwrapped, so no part of a second line shows)
    const el = ta.current; if (!el) return;
    el.style.height = '44px';
    if (focused) el.style.height = `${Math.max(44, el.scrollHeight)}px`;
    setMore(!focused && el.scrollWidth > el.clientWidth + 1);
  }, [draft, focused]);
  useEffect(() => { onFocusChange?.(focused); }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = async () => {
    const v = draft.trim();
    if (v === (value ?? '')) return;
    if (required && !v) { setErr('Required'); setDraft(value ?? ''); return; }
    try { setErr(null); await onCommit(v === '' ? null : v); } catch (e) { setErr((e as Error).message); setDraft(value ?? ''); }
  };
  const common = { value: draft, placeholder, dir, lang, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onFocus: () => setFocused(true), onBlur: () => { setFocused(false); void commit(); } };
  return (
    <span className={`relative block min-w-0 flex-1 ${className}`}>
      {lines
        ? <textarea {...common} ref={(el) => { ta.current = el; inputRef?.(el); }} rows={1} className={`${cellCls} resize-none overflow-hidden leading-6`} style={{ height: 44, whiteSpace: focused ? 'pre-wrap' : 'nowrap' }} />
        : <input {...common} ref={inputRef} type="text" className={cellCls} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />}
      {lines && more && <span aria-hidden="true" className={`pointer-events-none absolute top-0 flex h-11 items-center from-white from-50% to-transparent text-ink-muted ${dir === 'rtl' ? 'left-0 bg-gradient-to-r pl-2 pr-6' : 'right-0 bg-gradient-to-l pl-6 pr-2'}`}>…</span>}
      {err && <span role="alert" className="block px-3 pb-2 text-xs text-red-600">{err}</span>}
    </span>
  );
}

// The language tag of a row (EN / FA); a field drafted at import or by research says so ("FA · Draft"), an empty Persian field shows amber.
export function LangTag({ lang, draft, missing }: { lang: 'EN' | 'FA'; draft?: boolean; missing?: boolean }) {
  return <span aria-hidden="true" className={`ml-3 mt-3 shrink-0 self-start rounded-md px-1.5 text-[11px] font-semibold leading-5 ${draft ? 'bg-sky-100 text-sky-800' : missing ? 'bg-amber-100 text-amber-900' : 'bg-fill text-ink-muted'}`}>{lang}{draft ? ' · Draft' : ''}</span>;
}
// "Looks good" (Kian, 2026-10-13): one tap clears that field's draft flag and nothing else; Undo puts it back.
export function LooksGood({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={`Looks good: ${label}`} className="tap my-1.5 mr-1.5 inline-flex min-h-8 shrink-0 items-center gap-1 self-start rounded-full bg-sky-100 px-2.5 text-[13px] font-semibold text-sky-900 hover:bg-sky-200"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />Looks good</button>;
}

// A named group that opens with one tap; closed, it says in one line what it holds.
export function Group({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="mt-3" data-group-section={id}>
      <button type="button" data-group={id} aria-expanded={open} onClick={onToggle} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-fill px-4 py-1.5 text-left">
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold leading-5">{title}</span><span className="block truncate text-[13px] leading-[18px] text-ink-muted">{summary}</span></span>
        <Icon name="down" className={`h-5 w-5 text-ink-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </section>
  );
}
