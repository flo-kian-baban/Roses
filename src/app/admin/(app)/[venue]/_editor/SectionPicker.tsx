'use client';
// One section picker (Kian via the PM, 2026-10-13, after the admin audit): the item's section in Basics; a tap opens the list of sections
// and a tap on one moves the item there (out of its other sections; a place in the Seasonal section is kept), landing last. "Also show in…"
// (an item in several sections, the Seasonal section included) lives inside the same sheet, as it was in More.
import { useState } from 'react';
import type { EditorItem, EditorSection, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { Badge, Sheet } from './ui';

export function SectionPicker({ item, sections, season, onPatch }: { item: EditorItem; sections: EditorSection[]; season: SeasonId; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const inSections = new Set(item.placements.map((p) => p.section_id));
  const regular = sections.filter((s) => !s.seasonal), seasonal = sections.find((s) => s.seasonal) ?? null;
  const mine = regular.filter((s) => inSections.has(s.id));
  const label = mine.length ? mine.map((s) => s.name.en).join(' + ') : 'No section: customers can’t see it';
  const save = async (p: Record<string, unknown>, close: boolean) => { setBusy(true); setErr(null); try { await onPatch(p); if (close) setOpen(false); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const moveTo = (id: string) => save({ section_ids: [id, ...(seasonal && inSections.has(seasonal.id) ? [seasonal.id] : [])] }, true);
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">Section</span>
      <button type="button" onClick={() => setOpen(true)} data-section-picker="" aria-label={`Section: ${label}. Tap to move`}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-left text-[15px] ${mine.length ? '' : 'text-amber-800'}`}>
        <span className="min-w-0 truncate">{label}</span><span className="flex shrink-0 items-center gap-1 text-sm text-ink-muted">Move<Icon name="down" className="h-4 w-4 -rotate-90" /></span>
      </button>
      {open && (
        <Sheet title={`Move “${item.name.en ?? 'item'}” to…`} onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="Section" className="grid gap-1.5">
            {regular.map((s) => {
              const here = inSections.has(s.id) && mine.length === 1;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={here} disabled={busy} data-move-to={s.name.en ?? ''} onClick={() => { if (!here) void moveTo(s.id); }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-[15px] ${here ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                  <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${here ? 'border-[6px] border-accent' : 'border-neutral-300'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{s.name.en}</span>{here && <span className="text-sm text-ink-muted">now</span>}{!s.listed && <Badge>Hidden</Badge>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-muted">The item goes to the end of the section you tap; Move up and Move down (under More) set its place.</p>
          <details className="mt-4 rounded-xl border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[15px] font-medium">Also show in another section…</summary>
            <div className="grid gap-1.5 p-2">
              {sections.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
                  <input type="checkbox" className="check" checked={inSections.has(s.id)} disabled={busy} onChange={(e) => { const ids = sections.filter((x) => (x.id === s.id ? e.target.checked : inSections.has(x.id))).map((x) => x.id); void save(s.seasonal && e.target.checked && !item.seasons.length ? { section_ids: ids, seasons: [season] } : { section_ids: ids }, false); }} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{s.name.en}</span>{!s.listed && <Badge>Hidden</Badge>}
                </label>
              ))}
            </div>
          </details>
          {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
        </Sheet>
      )}
    </div>
  );
}
