'use client';
// The preview control bar (Kian, 2026-10-09): above the iPhone on a laptop, in the phone preview's top rows, and in the header of
// the Style tab's bottom sheet on a phone. Screen (Welcome / Menu / Item popup / Section list), language (EN / FA), season and time
// of day, Replay (the welcome animation from the start) and, on the Style tab, Compare (the venue's default colours while the
// button is held; a toggle with a mouse). Season and time of day are preview-only: they change nothing for customers, who get the
// season and the time of their own visit, and the bar says so in one line. Choosing a season, a time of day or Replay shows the
// welcome screen (that is where they show), so from the Menu tab a phone reaches the welcome screen in Winter, in the evening, in
// Persian in four taps: Preview, Winter, Evening, FA.
import { useRef } from 'react';
import { SEASONS } from '@/lib/welcome';
import { Icon } from '../../../_ui/icons';
import { SCREENS, SLOTS, type PageNow, type View, type ViewPatch } from './view';

export type Compare = { on: boolean; set: (on: boolean) => void } | null;

function Seg<T extends string>({ label, items, value, onPick, attr, phone }: { label: string; items: { id: T; label: string }[]; value: T | null; onPick: (id: T) => void; attr: string; phone: boolean }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full bg-black/[.06] p-0.5">
      {items.map((i) => <button key={i.id} type="button" aria-pressed={value === i.id} {...{ [attr]: i.id }} onClick={() => onPick(i.id)} className={`${phone ? 'h-9 px-3 text-[13px]' : 'h-7 px-2.5 text-[12px]'} rounded-full font-semibold whitespace-nowrap transition ${value === i.id ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-ink-muted hover:text-ink'}`}>{i.label}</button>)}
    </div>
  );
}

export function PreviewBar({ view, onView, now, compare, status, phone = false }: { view: View; onView: (p: ViewPatch) => void; now: PageNow; compare: Compare; status?: React.ReactNode; phone?: boolean }) {
  const held = useRef(false);
  const btn = `flex shrink-0 items-center gap-1 rounded-full border border-line bg-white font-semibold whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,.04)] transition active:scale-[.97] ${phone ? 'h-9 px-3 text-[13px]' : 'h-7 px-2.5 text-[12px]'}`;
  const groups = (
    <>
      <Seg label="Preview screen" attr="data-preview-screen" phone={phone} items={SCREENS} value={view.screen} onPick={(screen) => onView({ screen })} />
      <Seg label="Preview language" attr="data-preview-lang" phone={phone} items={[{ id: 'en' as const, label: 'EN' }, { id: 'fa' as const, label: 'FA' }]} value={view.lang} onPick={(lang) => onView({ lang })} />
      <button type="button" className={btn} data-preview-replay onClick={() => onView({ screen: 'welcome', replay: true })} aria-label="Replay the welcome animation" title="Replay the welcome animation"><Icon name="restore" className="h-4 w-4" />Replay</button>
      {compare && (
        <button type="button" className={`${btn} ${compare.on ? 'border-ink bg-ink text-white' : ''}`} data-preview-compare aria-pressed={compare.on}
          onPointerDown={(e) => { if (e.pointerType === 'mouse') return; held.current = true; compare.set(true); }}
          onPointerUp={() => { if (held.current) compare.set(false); }} onPointerCancel={() => { if (held.current) compare.set(false); }} onPointerLeave={() => { if (held.current) compare.set(false); }}
          onClick={() => { if (held.current) { held.current = false; return; } compare.set(!compare.on); }}
          aria-label={phone ? 'Compare with the venue default: hold to see it' : 'Compare with the venue default'} title={phone ? 'Hold to see the venue default colours' : 'Show the venue default colours'}>
          <Icon name="eye" className="h-4 w-4" />Compare
        </button>
      )}
      <Seg label="Season in the preview" attr="data-preview-season" phone={phone} items={SEASONS.map((s) => ({ id: s.id, label: s.label }))} value={view.season ?? now.season} onPick={(season) => onView({ screen: 'welcome', season: season === now.season ? null : season })} />
      <Seg label="Time of day in the preview" attr="data-preview-slot" phone={phone} items={SLOTS} value={view.slot ?? now.slot} onPick={(slot) => onView({ screen: 'welcome', slot: slot === now.slot ? null : slot })} />
    </>
  );
  const note = <p className="text-[11px] leading-4 text-ink-muted" data-preview-note>Season and time of day change this preview only. Customers get the season and the time of their own visit.</p>;
  if (phone) {
    return (
      <div className="w-full" data-preview-bar="phone">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 py-1.5">{groups}</div>
        <div className="flex items-center justify-between gap-2 px-3 pb-1.5">{note}{status}</div>
      </div>
    );
  }
  return (
    <div className="w-full border-b border-line px-3 py-2" data-preview-bar="laptop">
      <div className="flex flex-wrap items-center gap-1.5">{groups}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">{note}{status}</div>
    </div>
  );
}
