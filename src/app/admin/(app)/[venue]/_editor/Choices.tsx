'use client';
// Price & choices (Kian, 2026-10-13, the item editor rebuild; the admin audit's proposal 5): the price, or the sizes when the item has
// them, then every choice group with its choices and their prices, all on screen and edited in place. Inline row entry as built after the
// audit (Kian via the PM, 2026-10-13): name, Tab to the price, Enter saves the row and opens the next one with the cursor in its name; a
// new row's price starts empty, never 0; a row is saved once it has a name (a size also needs its price); rows still being typed stay on
// screen through a save. Each row is one line: the English name, the Persian name, the price, Remove (Tab goes from the name to the
// price, so the Persian is a tap away and never in the way). "+ Size" turns the one price into a first size with that price, the cursor
// in its name; "+ Choice group" starts a group with the cursor in its name; each group has "Copy to…" (other items), "+ Add a choice" and
// "Must pick one". The data is unchanged: sizes are the item's variants, choices its add-ons, each row carrying its group.
import { useEffect, useRef, useState } from 'react';
import type { AddOn, EditorItem, EditorSection, Variant } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { Badge, LooksGood, MoneyField, Sheet, Switch, btnGhost, btnPrimary, btnSecondary, cardCls, cellCls } from './ui';

type Patch = (p: Record<string, unknown>) => Promise<void>;
const priceText = (n: number | null | undefined) => (n == null ? '' : String(n));
// What a saved list is, for telling our own save's echo (keep the rows and the cursor) from Undo or another change (re-read them).
const normV = (v: Variant[]) => JSON.stringify(v.map((x) => [x.label.en || null, x.label.fa || null, x.price == null ? null : Number(x.price)]));
const normA = (a: AddOn[]) => JSON.stringify(a.map((x) => [x.group?.en || null, x.group?.fa || null, x.label.en || null, x.label.fa || null, Number(x.price) || 0, !!x.required]));
const UNNAMED = '​'; // a new group's stand-in name until it is named (a zero-width space, which trim() keeps: never saved)
const groupName = (g: string) => (g.startsWith(UNNAMED) ? '' : g.trim());
const priceOf = (t: string): number | null | 'bad' => { const s = t.trim().replace(/^\$/, ''); if (!s) return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : 'bad'; };
// One row: the English name, the Persian name, the price, Remove. In the page the price comes right after the name, so Tab goes there.
const rowCls = 'grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_5.25rem_2.75rem] items-stretch';
const faCellCls = `${cellCls} col-start-2 row-start-1 border-l border-line text-right text-[15px]`;
const removeCls = 'col-start-4 row-start-1 flex h-11 w-11 items-center justify-center border-l border-line text-ink-muted hover:bg-fill hover:text-red-600';

// Focus a field once it is on screen: a row added by Enter or by "+ Add" gets the cursor in its name.
function useFocus() {
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [want, setWant] = useState<string | null>(null);
  useEffect(() => { if (!want) return; const el = refs.current.get(want); if (el) { el.focus(); el.select(); setWant(null); } });
  const ref = (k: string) => (el: HTMLInputElement | null) => { if (el) refs.current.set(k, el); else refs.current.delete(k); };
  return { ref, focus: setWant, el: (k: string) => refs.current.get(k) };
}

// ---- The price, or the sizes ----
type SizeRow = { en: string; fa: string; price: string; key: number };
let seq = 0;
const sizeRows = (v: Variant[]): SizeRow[] => v.map((x) => ({ en: x.label.en ?? '', fa: x.label.fa ?? '', price: priceText(x.price), key: ++seq }));
const sizeDone = (r: SizeRow) => !!r.en.trim() && typeof priceOf(r.price) === 'number';

export function PriceOrSizes({ item, onPatch, hint, onLooksGood }: { item: EditorItem; onPatch: Patch; hint?: string; onLooksGood: (field: string) => void }) {
  const [rows, setRows] = useState<SizeRow[]>(() => sizeRows(item.variants));
  const f = useFocus();
  const saved = normV(item.variants), mine = useRef(saved);
  // the saved sizes, plus the rows still being typed (they are not in the item yet); our own save's echo changes nothing on screen
  useEffect(() => { if (saved === mine.current) return; mine.current = saved; setRows((cur) => [...sizeRows(item.variants), ...cur.filter((r) => !sizeDone(r))]); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = () => {
    // the first size takes the item's one price, so "+ Size" is one tap and nothing is typed twice
    const r: SizeRow = { en: '', fa: '', price: rows.length === 0 && item.price != null ? priceText(item.price) : '', key: ++seq };
    setRows((cur) => [...cur, r]); f.focus(`n${r.key}`);
  };
  const save = (next: SizeRow[] = rows, removedPrice?: number | null) => {
    const variants = next.filter(sizeDone).map((r) => ({ label: { en: r.en.trim(), fa: r.fa.trim() || null }, price: priceOf(r.price) as number }));
    if (normV(variants) === normV(item.variants)) return;
    mine.current = normV(variants);
    void onPatch({ variants, price: variants.length ? null : (item.price ?? removedPrice ?? null) }).catch(() => { mine.current = normV(item.variants); setRows(sizeRows(item.variants)); });
  };
  const set = (k: number, p: Partial<SizeRow>) => setRows((cur) => cur.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const enterPrice = (r: SizeRow) => {
    save();
    if (!sizeDone(r)) return;
    const last = rows[rows.length - 1];
    if (last.key === r.key) add(); else f.focus(`n${rows[rows.findIndex((x) => x.key === r.key) + 1].key}`);
  };
  const plus = (ghost: boolean) => <button type="button" className={`${ghost ? `${btnGhost} text-accent-strong` : btnSecondary} min-h-11 px-3 text-sm`} onClick={add}><Icon name="plus" className="h-4 w-4" />Size</button>;
  // the one price stays on screen until a size is saved (a size row being typed does not replace it yet)
  const priceRow = item.variants.length === 0 && (
    <div className="flex items-start gap-2" data-price-row="">
      <MoneyField inline value={item.price} onCommit={(v) => onPatch({ price: v })} hint={hint} className="min-w-0 flex-1" />
      {rows.length === 0 && plus(false)}
    </div>
  );
  if (rows.length === 0) return priceRow;
  return (<>{priceRow}
    <div className={cardCls} data-sizes="">
      <div className="flex min-h-11 items-center gap-2 bg-fill/70 pl-3"><span className="flex-1 text-[15px] font-semibold">Sizes</span>{item.fa_draft.includes('variants') && <><Badge tone="blue">FA · Draft</Badge><LooksGood label="the Persian of the sizes" onClick={() => onLooksGood('variants')} /></>}</div>
      {rows.map((r, i) => (
        <div key={r.key} className={rowCls}>
          <input ref={f.ref(`n${r.key}`)} className={`${cellCls} col-start-1 row-start-1`} value={r.en} placeholder="e.g. Small" aria-label={`Size ${i + 1}`}
            onChange={(e) => set(r.key, { en: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`p${r.key}`)?.focus(); } }} />
          <span className="relative col-start-3 row-start-1 block border-l border-line"><span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-500">$</span>
            <input ref={f.ref(`p${r.key}`)} className={`${cellCls} pl-6 tabular-nums`} value={r.price} inputMode="decimal" placeholder="Price" aria-label={`Size ${i + 1} price`}
              onFocus={(e) => e.target.select()} onChange={(e) => set(r.key, { price: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enterPrice(r); } }} /></span>
          <input className={faCellCls} dir="rtl" lang="fa" value={r.fa} placeholder="فارسی" aria-label={`Size ${i + 1} (Persian)`} onChange={(e) => set(r.key, { fa: e.target.value })} onBlur={() => save()} />
          <button type="button" aria-label={`Remove size ${r.en || i + 1}`} onClick={() => { const next = rows.filter((x) => x.key !== r.key); setRows(next); save(next, priceOf(r.price) === 'bad' ? null : (priceOf(r.price) as number | null)); }} className={removeCls}><Icon name="close" className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex min-h-11 items-center px-1">{plus(true)}<span className="ml-auto pr-3 text-xs text-ink-muted">Name, Tab, price, Enter</span></div>
    </div>
  </>);
}

// ---- Choices ----
type ChoiceRow = { group: string; groupFa: string; en: string; fa: string; price: string; required: boolean; key: number };
const choiceRows = (a: AddOn[]): ChoiceRow[] => a.map((x) => ({ group: x.group.en ?? '', groupFa: x.group.fa ?? '', en: x.label.en ?? '', fa: x.label.fa ?? '', price: x.price ? String(x.price) : '', required: !!x.required, key: ++seq }));
const choiceDone = (r: ChoiceRow) => !!r.en.trim() && priceOf(r.price) !== 'bad';
// groups in the order they first appear; the rows of a group together (a group's name is its key)
function groupsOf(rows: ChoiceRow[]): { name: string; gkey: number; rows: ChoiceRow[] }[] {
  const out: { name: string; gkey: number; rows: ChoiceRow[] }[] = [];
  for (const r of rows) { const g = out.find((x) => x.name === r.group); if (g) g.rows.push(r); else out.push({ name: r.group, gkey: r.key, rows: [r] }); }
  return out;
}

export function Choices({ item, onPatch, onCopy, onLooksGood }: { item: EditorItem; onPatch: Patch; onCopy: (group: string) => void; onLooksGood: (field: string) => void }) {
  const [rows, setRows] = useState<ChoiceRow[]>(() => choiceRows(item.add_ons));
  const f = useFocus();
  const saved = normA(item.add_ons), mine = useRef(saved);
  useEffect(() => { if (saved === mine.current) return; mine.current = saved; setRows((cur) => [...choiceRows(item.add_ons), ...cur.filter((r) => !choiceDone(r))]); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = (next: ChoiceRow[]) => groupsOf(next).flatMap((g) => g.rows);
  const save = (next: ChoiceRow[] = rows) => {
    const add_ons: AddOn[] = flat(next).filter(choiceDone).map((r) => ({ group: { en: groupName(r.group) || null, fa: r.groupFa.trim() || null }, label: { en: r.en.trim(), fa: r.fa.trim() || null }, price: (priceOf(r.price) as number | null) ?? 0, required: r.required }));
    if (normA(add_ons) === normA(item.add_ons)) return;
    mine.current = normA(add_ons);
    void onPatch({ add_ons }).catch(() => { mine.current = normA(item.add_ons); setRows(choiceRows(item.add_ons)); });
  };
  const set = (k: number, p: Partial<ChoiceRow>) => setRows((cur) => cur.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const setGroup = (name: string, p: Partial<ChoiceRow>) => setRows((cur) => cur.map((r) => (r.group === name ? { ...r, ...p } : r)));
  const addRow = (g: { name: string; rows: ChoiceRow[] }) => { const last = g.rows[g.rows.length - 1]; const r: ChoiceRow = { group: g.name, groupFa: last?.groupFa ?? '', en: '', fa: '', price: '', required: !!last?.required, key: ++seq }; setRows((cur) => { const at = cur.lastIndexOf(last) + 1; return [...cur.slice(0, at), r, ...cur.slice(at)]; }); f.focus(`n${r.key}`); };
  // a new group: its name first (unique while unnamed), then Tab or Enter to its first choice
  const addGroup = () => { const r: ChoiceRow = { group: `${UNNAMED}${++seq}`, groupFa: '', en: '', fa: '', price: '', required: false, key: ++seq }; setRows((cur) => [...cur, r]); f.focus(`g${r.key}`); };
  const groups = groupsOf(rows);
  const shown = (name: string) => (name.startsWith(UNNAMED) ? '' : name);
  return (
    <div data-choices="" className="space-y-2">
      {item.fa_draft.includes('addOns') && <div className="flex min-h-11 items-center gap-2 rounded-xl bg-sky-50 pl-3"><span className="flex-1 text-[13px] text-sky-950">The Persian of the choices is a draft.</span><LooksGood label="the Persian of the choices" onClick={() => onLooksGood('addOns')} /></div>}
      {groups.map((g, gi) => (
        <div key={g.gkey} className={cardCls} data-choice-group={shown(g.name)}>
          <div className={`${rowCls} bg-fill/70`}>
            <input ref={f.ref(`g${g.gkey}`)} className={`${cellCls} col-start-1 row-start-1 font-semibold`} value={shown(g.name)} placeholder="Group, e.g. Milk" aria-label={`Choice group ${gi + 1}`}
              onChange={(e) => { const v = e.target.value; setRows((cur) => cur.map((r) => (r.group === g.name ? { ...r, group: v || `${UNNAMED}${g.gkey}` } : r))); }}
              onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`n${g.rows[0].key}`)?.focus(); } }} />
            <input className={faCellCls} dir="rtl" lang="fa" value={g.rows[0].groupFa} placeholder="نام گروه" aria-label={`Choice group ${gi + 1} (Persian)`}
              onChange={(e) => setGroup(g.name, { groupFa: e.target.value })} onBlur={() => save()} />
            {g.rows.some(choiceDone) && !g.name.startsWith(UNNAMED)
              ? <button type="button" className="col-span-2 col-start-3 row-start-1 flex min-h-11 items-center justify-center gap-1 border-l border-line px-2 text-sm font-semibold text-accent-strong hover:bg-white" aria-label="Copy to other items…" onClick={() => { save(); onCopy(g.name); }}><Icon name="layers" className="h-4 w-4" />Copy to…</button>
              : <span className="col-span-2 col-start-3 row-start-1 border-l border-line" />}
          </div>
          {g.rows.map((r, i) => (
            <div key={r.key} className={rowCls}>
              <input ref={f.ref(`n${r.key}`)} className={`${cellCls} col-start-1 row-start-1`} value={r.en} placeholder="e.g. Oat milk" aria-label={`${shown(g.name) || 'Choice'} ${i + 1}`}
                onChange={(e) => set(r.key, { en: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`p${r.key}`)?.focus(); } }} />
              <span className="relative col-start-3 row-start-1 block border-l border-line"><span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-500">+$</span>
                <input ref={f.ref(`p${r.key}`)} className={`${cellCls} pl-8 tabular-nums`} value={r.price} inputMode="decimal" placeholder="0" aria-label={`${shown(g.name) || 'Choice'} ${i + 1} extra price`}
                  onFocus={(e) => e.target.select()} onChange={(e) => set(r.key, { price: e.target.value })} onBlur={() => save()}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); if (!r.en.trim()) return; const last = g.rows[g.rows.length - 1]; if (last.key === r.key) addRow(g); else f.focus(`n${g.rows[i + 1].key}`); } }} /></span>
              <input className={faCellCls} dir="rtl" lang="fa" value={r.fa} placeholder="فارسی" aria-label={`${shown(g.name) || 'Choice'} ${i + 1} (Persian)`} onChange={(e) => set(r.key, { fa: e.target.value })} onBlur={() => save()} />
              <button type="button" aria-label={`Remove add-on ${r.en || i + 1}`} onClick={() => { const next = rows.filter((x) => x.key !== r.key); setRows(next); save(next); }} className={removeCls}><Icon name="close" className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 px-1">
            <button type="button" className={`${btnGhost} min-h-11 px-3 text-sm text-accent-strong`} onClick={() => addRow(g)}><Icon name="plus" className="h-4 w-4" />Add a choice</button>
            <label className="flex min-h-11 items-center gap-2 pr-2 text-sm"><Switch checked={g.rows.every((r) => r.required)} label="Customer must pick one" onChange={(v) => { const next = rows.map((r) => (r.group === g.name ? { ...r, required: v } : r)); setRows(next); save(next); }} />Must pick one</label>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} onClick={addGroup}><Icon name="plus" className="h-4 w-4" />Choice group</button>
        {!groups.length && <span className="text-xs text-ink-muted">Milk, extras, sauces…</span>}
      </div>
    </div>
  );
}

// ---- Copy to other items ----
// The section's items (and every other section's), grouped by section, each with "Select all"; the item itself is left out; hidden items
// show their badge. Copy writes them all in one go; the toast's Undo puts every one back.
export function CopyChoicesSheet({ item, group, sections, items, onCopy, onClose }: { item: EditorItem; group: string; sections: EditorSection[]; items: Record<string, EditorItem>; onCopy: (ids: string[]) => Promise<void>; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const n = item.add_ons.filter((a) => (a.group.en ?? '') === group).length;
  const home = item.placements.map((p) => p.section_id);
  const order = [...sections.filter((s) => !s.seasonal && home.includes(s.id)), ...sections.filter((s) => !s.seasonal && !home.includes(s.id))];
  const toggle = (ids: string[], on: boolean) => setPicked((cur) => { const next = new Set(cur); for (const id of ids) { if (on) next.add(id); else next.delete(id); } return next; });
  const copy = async () => { setBusy(true); setErr(null); try { await onCopy([...picked]); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); } };
  return (
    <Sheet title={`Copy “${group || 'Options'}” to other items`} onClose={onClose} wide>
      <p className="text-[15px] text-ink-muted">Its {n} choice{n === 1 ? '' : 's'} and their prices are added to each item you pick; an item that already has a “{group || 'Options'}” group gets this one instead. One Undo puts them all back.</p>
      <div className="mt-3 max-h-[52dvh] space-y-3 overflow-y-auto">
        {order.map((s) => {
          const ids = s.item_ids.filter((id) => id !== item.id && items[id]);
          if (!ids.length) return null;
          const all = ids.every((id) => picked.has(id));
          return (
            <div key={s.id} data-copy-section={s.name.en ?? ''}>
              <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold">{s.name.en}</span>
                <button type="button" className={`${btnGhost} min-h-11 px-3 text-sm text-accent-strong`} onClick={() => toggle(ids, !all)}>{all ? 'Clear' : `Select all in ${s.name.en}`}</button></div>
              {ids.map((id) => (
                <label key={id} className="flex min-h-11 items-center gap-3 border-t border-line px-1">
                  <input type="checkbox" className="check" checked={picked.has(id)} onChange={(e) => toggle([id], e.target.checked)} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{items[id].name.en}</span>{!items[id].listed && <Badge>Hidden</Badge>}
                </label>
              ))}
            </div>
          );
        })}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={busy || picked.size === 0} onClick={() => { void copy(); }}>{busy ? 'Copying…' : `Copy to ${picked.size} item${picked.size === 1 ? '' : 's'}`}</button>
    </Sheet>
  );
}
