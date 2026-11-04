'use client';
// Where the item appears (Kian, 2026-10-13, the item editor rebuild; one row since the PM's clean-up of 2026-11-04): the sections it is in,
// written out ("Appetizer, Fall Menu"; the Seasonal section named as customers see it now), and Edit, which opens the section picker (Kian via
// the PM, 2026-10-13, after the admin audit): a tap on a section moves the item there (out of its other sections; a place in the Seasonal
// section is kept), landing last. "Also show in…" (an item in several sections, the Seasonal section included) lives inside the same sheet.
// Its place within a section is set in the Menu list (Reorder items in the section's menu; a laptop also drags).
import { Fragment, useState } from 'react';
import type { EditorItem, EditorSection, SeasonId } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { SEASON_NAMES } from './state';
import { Sheet } from './ui';
import { cardCls } from './kit';

export function SectionPicker({ item, sections, season, onPatch }: { item: EditorItem; sections: EditorSection[]; season: SeasonId; onPatch: (p: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const inSections = new Set(item.placements.map((p) => p.section_id));
  const regular = sections.filter((s) => !s.seasonal), seasonal = sections.find((s) => s.seasonal) ?? null;
  const mine = regular.filter((s) => inSections.has(s.id));
  const names = [...mine.map((s) => ({ id: s.id, name: s.name.en ?? '' })), ...(seasonal && inSections.has(seasonal.id) ? [{ id: seasonal.id, name: `${SEASON_NAMES[season]} Menu` }] : [])];
  const save = async (p: Record<string, unknown>, close: boolean) => { setBusy(true); setErr(null); try { await onPatch(p); if (close) setOpen(false); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const moveTo = (id: string) => save({ section_ids: [id, ...(seasonal && inSections.has(seasonal.id) ? [seasonal.id] : [])] }, true);
  const nameOf = (s: EditorSection) => (s.seasonal ? `Seasonal (${SEASON_NAMES[season]} Menu)` : s.name.en);
  const hidden = <span className="shrink-0 text-[13px] text-ink-muted">Hidden</span>;
  return (
    <>
      <div className={cardCls}>
        <button type="button" onClick={() => setOpen(true)} data-section-picker="" aria-label={`Appears in ${names.map((c) => c.name).join(', ') || 'no section'}. Edit`}
          className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left">
          <span className="min-w-0 flex-1 text-base leading-6 [overflow-wrap:anywhere]">
            {names.length
              ? names.map((c, i) => <Fragment key={c.id}>{i > 0 && ', '}<span data-section-chip="">{c.name}</span></Fragment>)
              : <span className="text-ink-muted">No section yet: customers can’t see it.</span>}
          </span>
          <span className="flex shrink-0 items-center text-base font-semibold text-accent-ink">Edit<Icon name="down" className="h-4 w-4 -rotate-90" /></span>
        </button>
      </div>
      {open && (
        <Sheet title={`Move “${item.name.en ?? 'item'}” to…`} onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="Section" className="grid gap-1.5">
            {regular.map((s) => {
              const here = inSections.has(s.id) && mine.length === 1;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={here} disabled={busy} data-move-to={s.name.en ?? ''} onClick={() => { if (!here) void moveTo(s.id); }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-base ${here ? 'bg-accent-soft font-semibold text-accent-ink' : 'bg-fill text-ink'}`}>
                  <span className="min-w-0 flex-1 truncate">{s.name.en}</span>{here && <span className="text-[13px]">now</span>}{!s.listed && hidden}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-ink-muted">The item goes to the end of the section you tap. To change its place there, use Reorder items in the section’s menu on the Menu list.</p>
          <details className="mt-4 rounded-xl bg-fill">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-base font-semibold">Also show in another section…</summary>
            <div className="grid gap-1.5 p-2">
              {sections.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-canvas px-3">
                  <input type="checkbox" className="check" checked={inSections.has(s.id)} disabled={busy} onChange={(e) => { const ids = sections.filter((x) => (x.id === s.id ? e.target.checked : inSections.has(x.id))).map((x) => x.id); void save(s.seasonal && e.target.checked && !item.seasons.length ? { section_ids: ids, seasons: [season] } : { section_ids: ids }, false); }} />
                  <span className="min-w-0 flex-1 truncate text-base">{nameOf(s)}</span>{!s.listed && hidden}
                </label>
              ))}
            </div>
          </details>
          {err && <p role="alert" className="mt-3 text-[13px] text-danger">{err}</p>}
        </Sheet>
      )}
    </>
  );
}
