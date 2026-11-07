'use client';
// The editor's small kit: fields that save themselves on change, the iOS-style switch, sheets and buttons, in the admin's look
// (../../../_ui/look.ts; the admin-wide clean-up, 2026-11-06).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../_ui/icons';
import { retryable } from './api';
import { dangerBtn, field, popover, popoverItem, primaryBtn, quietBtn } from '../../../_ui/look';

export const btnPrimary = primaryBtn; // the one filled button of a screen
export const btnSecondary = quietBtn; // Cancel, Done and the like
export const btnGhost = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-semibold whitespace-nowrap text-accent-ink disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger = dangerBtn; // the confirmation of a Delete
export const fieldCls = field;

// A short tag (Hidden, Needs price, To confirm…): 13 px text, no box; red only for an error (red marks Delete and errors only).
const TONE = { grey: 'text-ink-muted', red: 'font-semibold text-danger', amber: 'text-ink-muted', blue: 'text-ink-muted', green: 'text-ink-muted' };
export function Badge({ tone = 'grey', children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center text-[13px] whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

// A native checkbox drawn as a toggle (see .switch in globals.css). `onChange` may reject with a one-line reason.
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void | Promise<void>; label: string; disabled?: boolean }) {
  return <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} aria-label={label} title={label} onClick={(e) => e.stopPropagation()} onChange={(e) => { void Promise.resolve(onChange(e.target.checked)).catch(() => undefined); }} />; // a failed save is reported by the editor's toast
}

// A field's text follows the saved value (Undo, another save), except text whose save did not go through (no connection, the server failed):
// that stays in the field, marked "Not saved", until it is saved (pre-go-live audit D-02: before, the field went back to the saved text and
// what was typed was lost). The caller sets `.current` to the unsaved text, and back to null once a save goes through.
// cleared: called when the text that did not go through is saved after all (the toast's Try again), so its "Not saved" goes too.
export function useUnsaved(saved: string, setDraft: (v: string) => void, cleared?: () => void) {
  const unsaved = useRef<string | null>(null);
  useEffect(() => { if (unsaved.current !== null && saved !== unsaved.current) return; if (unsaved.current !== null) cleared?.(); unsaved.current = null; setDraft(saved); }, [saved]);
  return unsaved;
}


// Text that saves itself: commits on blur or Enter when the value changed; re-syncs when the saved value changes (Undo).
// maxLength: the field's limit (pre-go-live audit S2-02, src/lib/rules.ts LIMITS); a longer text saved before the limit stays as it is.
export function TextField({ value, onCommit, label, placeholder, dir, lang, multiline, inputMode, hint, badge, required, autoFocus, className = '', compact, maxLength }: {
  value: string | null | undefined; onCommit: (v: string | null) => void | Promise<void>; label?: string; placeholder?: string; dir?: 'rtl' | 'ltr'; lang?: string; multiline?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'url'; hint?: string; badge?: React.ReactNode; required?: boolean; autoFocus?: boolean; className?: string; compact?: boolean; maxLength?: number;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  const unsaved = useUnsaved(value ?? '', setDraft, () => setErr(null));
  const commit = async () => {
    const v = draft.trim();
    if (v === (value ?? '')) return;
    if (required && !v) { setErr('Required'); setDraft(value ?? ''); return; }
    // a save that did not go through keeps what was typed, marked 'Not saved', when trying again can help (pre-go-live audit D-02)
    try { setErr(null); await onCommit(v === '' ? null : v); unsaved.current = null; } catch (e) { const keep = retryable(e); setErr(keep ? `Not saved. ${(e as Error).message}` : (e as Error).message); if (keep) { unsaved.current = v; setDraft(draft); } else setDraft(value ?? ''); }
  };
  const common = { value: draft, placeholder, dir, lang, autoFocus, maxLength, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onBlur: () => { void commit(); } };
  return (
    <label className={`block ${className}`}>
      {label && !compact && <span className="mb-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">{label}{required && <span>*</span>}{badge}</span>}
      {multiline
        ? <textarea {...common} className={`${fieldCls} min-h-24`} />
        : <input {...common} type="text" inputMode={inputMode} className={fieldCls} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />}
      {(err || hint) && <span className={`mt-1 block text-[13px] ${err ? 'text-danger' : 'text-ink-muted'}`}>{err || hint}</span>}
    </label>
  );
}

// Bottom sheet on phones, a centred card on laptops. Escape and the backdrop close it. Rendered into the admin's own wrapper (.admin,
// so its styles still apply) at the top of the page: a sheet opened from inside the item editor would otherwise paint in the editor's
// layer (on a wide screen the editor is a sticky column, its own stacking context), under the Menu tab's sticky bars and the top bar,
// its title cut off (Kian, 2026-10-14).
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const sheet = (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title} data-sheet="">
      <button type="button" className="backdrop-in absolute inset-0 bg-scrim" onClick={onClose} aria-label="Close" />
      <div className={`sheet-in relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-canvas p-5 shadow-pop sm:rounded-xl ${wide ? 'sm:w-[36rem]' : 'sm:w-[26rem]'}`} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-[17px] font-semibold [overflow-wrap:anywhere]">{title}</h2><button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fill text-ink-muted hover:text-ink" aria-label="Close"><Icon name="close" className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
  const host = typeof document === 'undefined' ? null : document.querySelector('.admin') ?? document.body;
  return host ? createPortal(sheet, host) : sheet;
}

export function ConfirmSheet({ title, body, label, onConfirm, onClose }: { title: string; body: React.ReactNode; label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="text-base text-ink-muted">{body}</div>
      {err && <p role="alert" className="mt-3 text-[13px] text-danger">{err}</p>}
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
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-fill hover:text-ink"><Icon name="more" className="h-5 w-5" /></button>
      {open && (
        <div role="menu" className={`absolute right-0 top-full z-40 mt-1 w-52 ${popover}`}>
          {items.map((it) => <button key={it.text} type="button" role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }} className={`${popoverItem} ${it.danger ? 'text-danger' : ''}`}>{it.text}</button>)}
        </div>
      )}
    </div>
  );
}

export function Photo({ url, className = '' }: { url?: string | null; className?: string }) {
  return url
    ? <img src={url} alt="" loading="lazy" decoding="async" className={`object-cover ${className}`} />
    : <span className={`flex items-center justify-center bg-fill text-ink-muted/40 ${className}`}><Icon name="image" className="h-5 w-5" /></span>;
}

// The item editor's own pieces (cards, cells, tags, headings, chips) are in kit.tsx (the PM's clean-up, 2026-11-04).
