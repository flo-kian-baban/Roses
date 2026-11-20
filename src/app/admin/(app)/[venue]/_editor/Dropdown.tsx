'use client';
// A dropdown in the admin's look (Kian, 2026-11-15: the Style tab's preview controls as one row of dropdowns, like the Menu tab's search
// row, in place of the rows of segmented chips). The pill shows the current choice and a chevron and keeps the width of its longest
// choice, so nothing in the row moves when a choice changes. A tap opens a card of choices under the pill (above it when it does not fit
// below, as at the foot of the phone's bottom sheet when the sheet is down): 44 px rows, the current one in the accent with a check, a
// grey note on a row ("now") and a line under the rows when the dropdown needs one. A tap on a row chooses it; Escape, a tap anywhere
// else, a tap in the preview (the window loses focus) and Tab close the card. With the keyboard, Enter, Space or an arrow key opens it on
// the current choice and the arrow keys, Home and End move between the rows. The card is rendered into the admin's own wrapper (.admin,
// as the sheets are) at a fixed position that follows the pill, so a row that scrolls sideways (the phone's) cannot cut it off and it
// lies over the sticky bars and the bottom sheet.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../_ui/icons';
import { popover, popoverItem } from '../../../_ui/look';

// pill: a shorter text for the pill than the row's (EN for English); lang: the row's text is Persian; note: a grey word beside it
export type Choice<T extends string> = { id: T; label: string; pill?: string; lang?: 'fa'; note?: string };

export function Dropdown<T extends string>({ kind, label, choices, value, placeholder, footer, onWhite, attr, onPick }: {
  kind: string; label: string; choices: Choice<T>[]; value: T | null; placeholder?: string; footer?: string; onWhite: boolean;
  attr: string; onPick: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = choices.find((c) => c.id === value) ?? null;

  // The card under the pill, or above it when it does not fit below and there is more room above; 8 px inside the screen's edges.
  // While a toast shows under the pill, the room below ends at the strip kept free for it (the toast rule, the PM, 2026-11-19: the
  // card's rows are never under the toast), so a card that would reach it opens above the pill.
  const place = () => {
    const b = btn.current?.getBoundingClientRect(), c = card.current; if (!b || !c) return;
    const h = c.offsetHeight, w = Math.max(c.offsetWidth, b.width);
    const t = document.querySelector('.toast')?.getBoundingClientRect(), floor = t && t.top >= b.bottom ? t.top - 8 : innerHeight;
    const below = floor - b.bottom - 12, above = b.top - 12;
    const left = Math.round(Math.max(8, Math.min(b.left, innerWidth - 8 - w)));
    setPos(h > below && above > below ? { left, minWidth: Math.round(b.width), bottom: Math.round(innerHeight - b.top + 4) } : { left, minWidth: Math.round(b.width), top: Math.round(b.bottom + 4) });
  };
  useLayoutEffect(() => { if (open) place(); else setPos(null); }, [open]);
  useEffect(() => {
    if (!open) return;
    const rows = () => [...(card.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]') ?? [])];
    (rows().find((r) => r.getAttribute('aria-checked') === 'true') ?? rows()[0])?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !card.current?.contains(t)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus({ preventScroll: true }); return; } // this card only, not a sheet behind it
      if (e.key === 'Tab') { setOpen(false); return; }
      const list = rows(), i = list.indexOf(document.activeElement as HTMLButtonElement);
      const to = e.key === 'ArrowDown' ? (i + 1) % list.length : e.key === 'ArrowUp' ? (i - 1 + list.length) % list.length : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
      if (to >= 0) { e.preventDefault(); list[to]?.focus({ preventScroll: true }); }
    };
    let raf = 0; const follow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }; // the pill moved (a scroll, a new size)
    const blur = () => setOpen(false); // a tap in the preview's frame takes the focus out of this window
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', follow, true); window.addEventListener('resize', follow); window.addEventListener('blur', blur);
    // a toast that comes or goes while the card is open changes the room under the pill (the sheet's strip): placed again
    const seen = new MutationObserver((ms) => { if (ms.some((m) => [...m.addedNodes, ...m.removedNodes].some((n) => n instanceof HTMLElement && n.classList.contains('toast')))) follow(); });
    const root = btn.current?.closest('.admin') ?? document.body; seen.observe(root, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow); window.removeEventListener('blur', blur); cancelAnimationFrame(raf); seen.disconnect();
    };
  }, [open]);

  const host = typeof document === 'undefined' ? null : document.querySelector('.admin') ?? document.body;
  return (
    <>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`${label}: ${current ? current.label : placeholder ?? ''}`} title={label}
        data-preview-pick={kind} data-value={value ?? ''} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); } }}
        className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-[var(--pill-px,12px)] text-base font-medium whitespace-nowrap text-ink transition active:scale-[.97] ${onWhite ? 'bg-fill' : 'bg-canvas'} ${open ? 'ring-2 ring-inset ring-accent-ink/40' : ''}`}>
        {/* every choice in one cell, the current one shown: the pill is as wide as its longest choice */}
        <span className="grid text-left" aria-hidden="true">
          {choices.map((c) => <span key={c.id} className={`col-start-1 row-start-1 ${c.id === value ? '' : 'invisible'}`}>{c.pill ?? c.label}</span>)}
          {placeholder && <span className={`col-start-1 row-start-1 text-ink-muted ${current ? 'invisible' : ''}`}>{placeholder}</span>}
        </span>
        <Icon name="down" className={`h-4 w-4 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && host && createPortal(
        // until it is placed (before the first paint) the card waits off the screen, not hidden: a hidden row could not take the focus
        <div ref={card} className={`fixed z-[70] max-w-[calc(100vw-16px)] ${popover}`} style={pos ?? { left: -10000, top: 0 }} data-preview-menu={kind}>
          <div role="menu" id={id} aria-label={label}>
            {choices.map((c) => {
              const on = c.id === value;
              return (
                <button key={c.id} type="button" role="menuitemradio" aria-checked={on} {...{ [attr]: c.id }}
                  onClick={() => { setOpen(false); btn.current?.focus({ preventScroll: true }); onPick(c.id); }}
                  className={`${popoverItem} justify-between whitespace-nowrap ${on ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink'}`}>
                  <span lang={c.lang} dir={c.lang === 'fa' ? 'rtl' : undefined}>{c.label}</span>
                  <span className="flex items-center gap-2">
                    {c.note && <span className="text-[13px] font-normal text-ink-muted">{c.note}</span>}
                    <Icon name="check" className={`h-4 w-4 ${on ? '' : 'invisible'}`} />
                  </span>
                </button>
              );
            })}
          </div>
          {footer && <p className="mx-1 mt-1 max-w-[15rem] border-t border-line px-2 pb-1.5 pt-2 text-[13px] leading-4 text-ink-muted" data-preview-note="">{footer}</p>}
        </div>,
        host,
      )}
    </>
  );
}
