'use client';
// The preview controls (Kian, 2026-10-09; moved into the Style tab on 2026-10-10: they belong with the styling, not on the phone; one row
// of dropdowns since 2026-11-15, replacing the rows of segmented chips and the line under them): at the top of the Style tab on a laptop
// (it stays in view while the tab scrolls, like the Menu tab's search row) and in the header of the Style tab's bottom sheet on a phone;
// the Menu and Details tabs have no controls and show the menu. Four dropdowns (Dropdown.tsx): the screen (Welcome / Menu / Item popup /
// Section list), the language (English / فارسی, EN / FA on the pill), the season and the time of day; then two buttons: Replay (the
// welcome animation from the start) and Compare (the venue's default colours while the button is held; a toggle with a mouse). Season and
// time of day are preview-only: they change nothing for customers, who get the season and the time of their own visit; each of those two
// dropdowns says so under its choices and marks the page's own as "now". Choosing a season, a time of day or Replay shows the welcome
// screen (that is where they show), so from the Menu tab a phone reaches the welcome screen in Winter, in the evening, in Persian in seven
// taps: Style, then the season, the time of day and the language, two taps each (the dropdown, the choice); four with the chips before.
// On a laptop the controls are white on the page's grey and line up with the cards' edges, the buttons at the right; on a narrow window
// (under 680 px for the row) the two buttons show their icons only, and below 1110 px or so the buttons wrap to a second line. On a
// phone they are grey on the white sheet, 44 px tall, and the row scrolls sideways: the
// control at the screen's edge stays visibly cut so staff can tell it scrolls (the PM, 2026-11-06): where the edge falls depends on the
// phone's width, so the controls' side padding is adjusted by a pixel or two (9–16 px, 12 by default) until at least 14 px of the cut
// one shows and 14 px are hidden (fitCut; measured by the layout drill).
import { useLayoutEffect, useRef } from 'react';
import { SEASONS } from '@/lib/welcome';
import { Icon } from '../../../_ui/icons';
import { Dropdown } from './Dropdown';
import { SCREENS, SLOTS, type PageNow, type View, type ViewPatch } from './view';

export type Compare = { on: boolean; set: (on: boolean) => void } | null;

const LANGS = [{ id: 'en' as const, label: 'English', pill: 'EN' }, { id: 'fa' as const, label: 'فارسی', pill: 'FA', lang: 'fa' as const }];
const NOTE = {
  season: 'Preview only. Customers get the season of their own visit.',
  slot: 'Preview only. Customers get the greeting for the time of their own visit.',
};

// The smaller of what shows and what is hidden of the control under the row's right edge, with the row at its start (0: none there).
const cutOf = (row: HTMLElement) => {
  const edge = row.getBoundingClientRect().right;
  for (const b of row.querySelectorAll(':scope > button')) { const r = b.getBoundingClientRect(); if (r.left < edge && r.right > edge) return Math.min(edge - r.left, r.right - edge); }
  return 0;
};
function fitCut(row: HTMLElement) {
  row.style.removeProperty('--pill-px');
  if (row.scrollWidth <= row.clientWidth + 1) return; // it fits: nothing scrolls, nothing to cut
  const at = row.scrollLeft; row.scrollLeft = 0;
  let best = { px: 12, cut: cutOf(row) };
  for (const px of [11, 13, 10, 14, 9, 15, 16]) {
    if (best.cut >= 14) break;
    row.style.setProperty('--pill-px', `${px}px`);
    const cut = cutOf(row); if (cut > best.cut) best = { px, cut };
  }
  if (best.px === 12) row.style.removeProperty('--pill-px'); else row.style.setProperty('--pill-px', `${best.px}px`);
  row.scrollLeft = at;
}

export function PreviewBar({ view, onView, now, compare, phone = false }: { view: View; onView: (p: ViewPatch) => void; now: PageNow; compare: Compare; phone?: boolean }) {
  const held = useRef(false);
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = row.current; if (!phone || !el) return;
    fitCut(el);
    const ro = new ResizeObserver(() => fitCut(el)); // a new width (rotation, the sheet's size) or a control's (the font arriving): fit again
    ro.observe(el); for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  }, [phone, !!compare]); // Compare's presence changes the row (the object itself is new on every render)
  const surface = phone ? 'bg-fill' : 'bg-canvas'; // grey on the phone's white sheet, white on the laptop's grey page (as the cards)
  const btn = 'flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-[var(--pill-px,12px)] text-base font-medium whitespace-nowrap transition active:scale-[.97]';
  const dropdowns = (
    <>
      <Dropdown kind="screen" label="Preview screen" attr="data-preview-screen" onWhite={phone} choices={SCREENS} value={view.screen} onPick={(screen) => onView({ screen })} />
      <Dropdown kind="lang" label="Preview language" attr="data-preview-lang" onWhite={phone} choices={LANGS} value={view.lang} onPick={(lang) => onView({ lang })} />
      <Dropdown kind="season" label="Season in the preview" placeholder="Season" footer={NOTE.season} attr="data-preview-season" onWhite={phone}
        choices={SEASONS.map((s) => ({ id: s.id, label: s.label, note: s.id === now.season ? 'now' : undefined }))} value={view.season ?? now.season}
        onPick={(season) => onView({ screen: 'welcome', season: season === now.season ? null : season })} />
      <Dropdown kind="slot" label="Time of day in the preview" placeholder="Time" footer={NOTE.slot} attr="data-preview-slot" onWhite={phone}
        choices={SLOTS.map((s) => ({ ...s, note: s.id === now.slot ? 'now' : undefined }))} value={view.slot ?? now.slot}
        onPick={(slot) => onView({ screen: 'welcome', slot: slot === now.slot ? null : slot })} />
    </>
  );
  const word = phone ? '' : '@max-[42.5rem]:hidden'; // a laptop row narrower than its controls: the buttons' icons only (they keep their names)
  const buttons = (
    <>
      <button type="button" className={`${btn} ${surface} text-ink`} data-preview-replay onClick={() => onView({ screen: 'welcome', replay: true })} aria-label="Replay the welcome animation" title="Replay the welcome animation"><Icon name="restore" className="h-4 w-4" /><span className={word}>Replay</span></button>
      {compare && (
        <button type="button" className={`${btn} ${compare.on ? 'bg-accent-soft text-accent-ink' : `${surface} text-ink`}`} data-preview-compare aria-pressed={compare.on}
          onPointerDown={(e) => { if (e.pointerType === 'mouse') return; held.current = true; compare.set(true); }}
          onPointerUp={() => { if (held.current) compare.set(false); }} onPointerCancel={() => { if (held.current) compare.set(false); }} onPointerLeave={() => { if (held.current) compare.set(false); }}
          onClick={() => { if (held.current) { held.current = false; return; } compare.set(!compare.on); }}
          aria-label={phone ? 'Compare with the venue default: hold to see it' : 'Compare with the venue default'} title={phone ? 'Hold to see the venue default colours' : 'Show the venue default colours'}>
          <Icon name="eye" className="h-4 w-4" /><span className={word}>Compare</span>
        </button>
      )}
    </>
  );
  if (phone) {
    return (
      <div className="w-full" data-preview-bar="phone">
        <div ref={row} className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-1" data-scrolls-sideways="">{dropdowns}{buttons}</div>
      </div>
    );
  }
  return (
    <div className="@container w-full" data-preview-bar="laptop">
      <div className="flex flex-wrap items-center gap-2">
        {dropdowns}
        <div className="ml-auto flex items-center gap-2">{buttons}</div>
      </div>
    </div>
  );
}
