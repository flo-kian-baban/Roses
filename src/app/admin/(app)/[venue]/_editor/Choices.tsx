'use client';
// Price & choices (Kian, 2026-10-13, the item editor rebuild; the admin audit's proposal 5; the PM's clean-up of 2026-11-04 in the
// phone-Settings style): the Price card (the price as a row, or the sizes as rows; "+ Add size", "+ Add choices") and one card per choice
// group, all edited in place. Inline row entry as built after the audit (Kian via the PM, 2026-10-13): name, Tab to the price, Enter saves
// the row and opens the next one with the cursor in its name; a new row's price starts empty, never 0; a row is saved once it has a name (a
// size also needs its price); rows still being typed stay on screen through a save. Each row is one line: the English name, the Persian
// name, the price, Remove (Tab goes from the name to the price, so the Persian is a tap away and never in the way). "+ Add size" turns the
// one price into a first size with that price, the cursor in its name; "+ Add choices" starts a group with the cursor in its name; each
// group has "Copy to…" (other items), "+ Add choice" and "Must pick one". The data is unchanged: sizes are the item's variants, choices its
// add-ons, each row carrying its group.
import { useEffect, useRef, useState } from 'react';
import type { AddOn, EditorItem, EditorSection, Variant } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { retryable } from './api';
import { Sheet, Switch, btnPrimary } from './ui';
import { CellMoney, DraftLine, Heading, cardCls, cellCls, textBtn } from './kit';
import { COUNTS, LIMITS, parsePrice, priceInput } from '@/lib/rules';

type Patch = (p: Record<string, unknown>) => Promise<void>;
const priceText = (n: number | null | undefined) => priceInput(n); // two decimals (Part B #11)
// What a saved list is, for telling our own save's echo (keep the rows and the cursor) from Undo or another change (re-read them).
const normV = (v: Variant[]) => JSON.stringify(v.map((x) => [x.label.en || null, x.label.fa || null, x.price == null ? null : Number(x.price)]));
const normA = (a: AddOn[]) => JSON.stringify(a.map((x) => [x.group?.en || null, x.group?.fa || null, x.label.en || null, x.label.fa || null, Number(x.price) || 0, !!x.required]));
const UNNAMED = '​'; // a new group's stand-in name until it is named (a zero-width space, which trim() keeps: never saved)
const groupName = (g: string) => (g.startsWith(UNNAMED) ? '' : g.trim());
// A typed price as the server reads it (pre-go-live audit S2-07, H-14: "1,50" is 1.50; "abc" is not a price and the row says so).
const priceOf = (t: string): number | null | 'bad' => parsePrice(t);
// One row: the English name, the Persian name, the price, Remove, with no box around each field (the card is the box; 2026-11-04). In the
// page the price comes right after the name, so Tab goes there.
const rowCls = 'grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_5.5rem_2.75rem] items-stretch';
const faCellCls = `${cellCls} col-start-2 row-start-1 text-right`;
const removeCls = 'col-start-4 row-start-1 flex h-11 w-11 items-center justify-center text-ink-muted';

// Focus a field once it is on screen: a row added by Enter or by "+ Add" gets the cursor in its name.
function useFocus() {
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [want, setWant] = useState<string | null>(null);
  useEffect(() => { if (!want) return; const el = refs.current.get(want); if (el) { el.focus(); el.select(); setWant(null); } });
  const ref = (k: string) => (el: HTMLInputElement | null) => { if (el) refs.current.set(k, el); else refs.current.delete(k); };
  return { ref, focus: setWant, el: (k: string) => refs.current.get(k) };
}

// ---- The price, or the sizes ----
// kept: the row is one of the item's saved sizes (so an empty price is a size losing its price, not a size still being typed).
type SizeRow = { en: string; fa: string; price: string; key: number; kept?: boolean };
let seq = 0;
const sizeRows = (v: Variant[]): SizeRow[] => v.map((x) => ({ en: x.label.en ?? '', fa: x.label.fa ?? '', price: priceText(x.price), key: ++seq, kept: true }));
const sizeDone = (r: SizeRow) => !!r.en.trim() && typeof priceOf(r.price) === 'number';
// Why a row cannot be saved as it stands (pre-go-live audit): a price that is not one (H-14: before, the row was dropped without a word),
// or a saved size whose price was cleared (D-08: before, the size was deleted at once).
const sizeProblem = (r: SizeRow): string | null => (priceOf(r.price) === 'bad' ? 'Not a price (for example 12.50)' : r.kept && r.en.trim() && priceOf(r.price) === null ? 'A size needs a price' : null);

// The Price card (the PM's clean-up, 2026-11-04): the price as a row ("Price … $7.99"), or the sizes as rows, then "+ Add size" and
// "+ Add choices" as plain accent text (onAddChoices starts a choice group below, in the Choices card).
export function PriceOrSizes({ item, onPatch, hint, onLooksGood, onAddChoices, choicesFull }: { item: EditorItem; onPatch: Patch; hint?: string; onLooksGood: (field: string) => void; onAddChoices: () => void; choicesFull: boolean }) {
  const [rows, setRows] = useState<SizeRow[]>(() => sizeRows(item.variants));
  const [held, setHeld] = useState(false); // a row's problem shown (the save waits for it)
  const f = useFocus();
  const saved = normV(item.variants), mine = useRef(saved);
  // Rows whose save did not go through stay on screen, marked, until they are saved (Retry) or edited again (pre-go-live audit, the
  // residual of D-02: before, the saved sizes came back on screen while Try again held the typed ones).
  const failed = useRef<string | null>(null); const [notSaved, setNotSaved] = useState(false);
  // the saved sizes, plus the rows still being typed (they are not in the item yet); our own save's echo changes nothing on screen
  useEffect(() => {
    if (failed.current !== null) { if (saved !== failed.current) return; failed.current = null; setNotSaved(false); }
    if (saved === mine.current) return; mine.current = saved; setRows((cur) => [...sizeRows(item.variants), ...cur.filter((r) => !sizeDone(r) && !r.kept)]);
  }, [saved]);
  const add = () => {
    if (rows.length >= COUNTS.sizes) return;
    // the first size takes the item's one price, so "+ Add size" is one tap and nothing is typed twice
    const r: SizeRow = { en: '', fa: '', price: rows.length === 0 && item.price != null ? priceText(item.price) : '', key: ++seq };
    setRows((cur) => [...cur, r]); f.focus(`n${r.key}`);
  };
  const save = (next: SizeRow[] = rows, removedPrice?: number | null) => {
    if (next.some(sizeProblem)) { setHeld(true); return; } // nothing is saved while a row has a problem; the row says what it is
    setHeld(false);
    const variants = next.filter(sizeDone).map((r) => ({ label: { en: r.en.trim(), fa: r.fa.trim() || null }, price: priceOf(r.price) as number }));
    if (normV(variants) === normV(item.variants)) return;
    mine.current = normV(variants); failed.current = null; setNotSaved(false);
    const want = normV(variants);
    void onPatch({ variants, price: variants.length ? null : (item.price ?? removedPrice ?? null) }).catch((e) => { if (retryable(e)) { failed.current = want; setNotSaved(true); return; } mine.current = normV(item.variants); setRows(sizeRows(item.variants)); }); // the rows stay for Retry (D-02)
  };
  const set = (k: number, p: Partial<SizeRow>) => setRows((cur) => cur.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const enterPrice = (r: SizeRow) => {
    save();
    if (!sizeDone(r)) return;
    const last = rows[rows.length - 1];
    if (last.key === r.key) add(); else f.focus(`n${rows[rows.findIndex((x) => x.key === r.key) + 1].key}`);
  };
  return (
    <section data-price-choices="">
      <Heading>Price</Heading>
      <div className={cardCls}>
        {/* the one price stays on screen until a size is saved (a size row being typed does not replace it yet) */}
        {item.variants.length === 0 && <CellMoney value={item.price} onCommit={(v) => onPatch({ price: v })} hint={hint} />}
        {rows.length > 0 && (
          <div data-sizes="" className="divide-y divide-line">
            {item.fa_draft.includes('variants') && <DraftLine what="the Persian of the sizes" onLooksGood={() => onLooksGood('variants')}>Sizes in Persian: draft</DraftLine>}
            {notSaved && <p className="px-3 py-2.5 text-[13px] font-semibold text-danger">Not saved: tap Retry at the top.</p>}
            {rows.map((r, i) => (<div key={r.key} data-size-row="">
              <div className={rowCls}>
                <input ref={f.ref(`n${r.key}`)} className={`${cellCls} col-start-1 row-start-1`} value={r.en} maxLength={LIMITS.label} placeholder="e.g. Small" aria-label={`Size ${i + 1}`}
                  onChange={(e) => set(r.key, { en: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`p${r.key}`)?.focus(); } }} />
                <span className="relative col-start-3 row-start-1 block"><span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-base text-ink-muted">$</span>
                  <input ref={f.ref(`p${r.key}`)} className={`${cellCls} pl-5 tabular-nums`} value={r.price} inputMode="decimal" placeholder="Price" aria-label={`Size ${i + 1} price`}
                    onFocus={(e) => e.target.select()} onChange={(e) => set(r.key, { price: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enterPrice(r); } }} /></span>
                <input className={faCellCls} dir="rtl" lang="fa" value={r.fa} maxLength={LIMITS.label} placeholder="فارسی" aria-label={`Size ${i + 1} (Persian)`} onChange={(e) => set(r.key, { fa: e.target.value })} onBlur={() => save()} />
                <button type="button" aria-label={`Remove size ${r.en || i + 1}`} onClick={() => { const next = rows.filter((x) => x.key !== r.key); setRows(next); save(next, priceOf(r.price) === 'bad' ? null : (priceOf(r.price) as number | null)); }} className={removeCls}><Icon name="close" className="h-4 w-4" /></button>
              </div>
              {held && sizeProblem(r) && <p role="alert" className="px-3 pb-2 text-[13px] text-danger" data-row-problem="">{sizeProblem(r)}</p>}
            </div>))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 px-3">
          <button type="button" className={textBtn} onClick={add} disabled={rows.length >= COUNTS.sizes}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />{rows.length >= COUNTS.sizes ? `At most ${COUNTS.sizes} sizes` : 'Add size'}</button>
          <button type="button" className={textBtn} onClick={onAddChoices} disabled={choicesFull}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />{choicesFull ? `At most ${COUNTS.groups} choice groups` : 'Add choices'}</button>
        </div>
      </div>
    </section>
  );
}

// ---- Choices ----
type ChoiceRow = { group: string; groupFa: string; en: string; fa: string; price: string; required: boolean; key: number };
const choiceRows = (a: AddOn[]): ChoiceRow[] => a.map((x) => ({ group: x.group.en ?? '', groupFa: x.group.fa ?? '', en: x.label.en ?? '', fa: x.label.fa ?? '', price: x.price ? priceInput(x.price) : '', required: !!x.required, key: ++seq }));
const choiceDone = (r: ChoiceRow) => !!r.en.trim() && priceOf(r.price) !== 'bad';
// groups in the order they first appear; the rows of a group together (a group's name is its key)
function groupsOf(rows: ChoiceRow[]): { name: string; gkey: number; rows: ChoiceRow[] }[] {
  const out: { name: string; gkey: number; rows: ChoiceRow[] }[] = [];
  for (const r of rows) { const g = out.find((x) => x.name === r.group); if (g) g.rows.push(r); else out.push({ name: r.group, gkey: r.key, rows: [r] }); }
  return out;
}
// How many choice groups an item has (the Price card's "+ Add choices" stops at the limit).
export const groupCount = (a: AddOn[]) => new Set(a.map((x) => x.group.en ?? '')).size;

// The Choices card(s) (the PM's clean-up, 2026-11-04): each group as one card, its name and "Copy to…" on the first row, one row per choice,
// then "+ Add choice" and "Must pick one". addRef: the Price card's "+ Add choices" starts a new group here.
export function Choices({ item, onPatch, onCopy, onLooksGood, addRef }: { item: EditorItem; onPatch: Patch; onCopy: (group: string) => void; onLooksGood: (field: string) => void; addRef: React.MutableRefObject<() => void> }) {
  const [rows, setRows] = useState<ChoiceRow[]>(() => choiceRows(item.add_ons));
  const [held, setHeld] = useState(false); // a choice's price is not a price: shown on its row, nothing saved until it is fixed (H-14)
  const f = useFocus();
  const saved = normA(item.add_ons), mine = useRef(saved);
  const failed = useRef<string | null>(null); const [notSaved, setNotSaved] = useState(false); // as the sizes: typed rows stay until saved
  useEffect(() => {
    if (failed.current !== null) { if (saved !== failed.current) return; failed.current = null; setNotSaved(false); }
    if (saved === mine.current) return; mine.current = saved; setRows((cur) => [...choiceRows(item.add_ons), ...cur.filter((r) => !choiceDone(r))]);
  }, [saved]);
  const flat = (next: ChoiceRow[]) => groupsOf(next).flatMap((g) => g.rows);
  const save = (next: ChoiceRow[] = rows) => {
    if (next.some((r) => r.en.trim() && priceOf(r.price) === 'bad')) { setHeld(true); return; }
    setHeld(false);
    const add_ons: AddOn[] = flat(next).filter(choiceDone).map((r) => ({ group: { en: groupName(r.group) || null, fa: r.groupFa.trim() || null }, label: { en: r.en.trim(), fa: r.fa.trim() || null }, price: (priceOf(r.price) as number | null) ?? 0, required: r.required }));
    if (normA(add_ons) === normA(item.add_ons)) return;
    mine.current = normA(add_ons); failed.current = null; setNotSaved(false);
    const want = normA(add_ons);
    void onPatch({ add_ons }).catch((e) => { if (retryable(e)) { failed.current = want; setNotSaved(true); return; } mine.current = normA(item.add_ons); setRows(choiceRows(item.add_ons)); }); // the rows stay for Retry (D-02)
  };
  const set = (k: number, p: Partial<ChoiceRow>) => setRows((cur) => cur.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const setGroup = (name: string, p: Partial<ChoiceRow>) => setRows((cur) => cur.map((r) => (r.group === name ? { ...r, ...p } : r)));
  const addRow = (g: { name: string; rows: ChoiceRow[] }) => { if (g.rows.length >= COUNTS.options) return; const last = g.rows[g.rows.length - 1]; const r: ChoiceRow = { group: g.name, groupFa: last?.groupFa ?? '', en: '', fa: '', price: '', required: !!last?.required, key: ++seq }; setRows((cur) => { const at = cur.lastIndexOf(last) + 1; return [...cur.slice(0, at), r, ...cur.slice(at)]; }); f.focus(`n${r.key}`); };
  // a new group: its name first (unique while unnamed), then Tab or Enter to its first choice
  const addGroup = () => { if (groupsOf(rows).length >= COUNTS.groups) return; const r: ChoiceRow = { group: `${UNNAMED}${++seq}`, groupFa: '', en: '', fa: '', price: '', required: false, key: ++seq }; setRows((cur) => [...cur, r]); f.focus(`g${r.key}`); };
  useEffect(() => { addRef.current = addGroup; });
  const groups = groupsOf(rows);
  const shown = (name: string) => (name.startsWith(UNNAMED) ? '' : name);
  if (!groups.length) return null;
  return (
    <section data-choices="">
      <Heading>Choices</Heading>
      {item.fa_draft.includes('addOns') && <DraftLine what="the Persian of the choices" onLooksGood={() => onLooksGood('addOns')}>Choices in Persian: draft</DraftLine>}
      {notSaved && <p role="alert" className="px-3 pb-1.5 text-[13px] font-semibold text-danger">Not saved: tap Retry at the top.</p>}
      <div className="space-y-3">
        {groups.map((g, gi) => (
          <div key={g.gkey} className={cardCls} data-choice-group={shown(g.name)}>
            <div className={rowCls}>
              <input ref={f.ref(`g${g.gkey}`)} className={`${cellCls} col-start-1 row-start-1 font-semibold`} value={shown(g.name)} maxLength={LIMITS.label} placeholder="Group, e.g. Milk" aria-label={`Choice group ${gi + 1}`}
                onChange={(e) => { const v = e.target.value; setRows((cur) => cur.map((r) => (r.group === g.name ? { ...r, group: v || `${UNNAMED}${g.gkey}` } : r))); }}
                onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`n${g.rows[0].key}`)?.focus(); } }} />
              <input className={`${faCellCls} font-semibold`} dir="rtl" lang="fa" value={g.rows[0].groupFa} maxLength={LIMITS.label} placeholder="نام گروه" aria-label={`Choice group ${gi + 1} (Persian)`}
                onChange={(e) => setGroup(g.name, { groupFa: e.target.value })} onBlur={() => save()} />
              {g.rows.some(choiceDone) && !g.name.startsWith(UNNAMED)
                ? <button type="button" className={`${textBtn} col-span-2 col-start-3 row-start-1 justify-end pr-3`} aria-label="Copy to other items…" onClick={() => { save(); onCopy(g.name); }}>Copy to…</button>
                : <span className="col-span-2 col-start-3 row-start-1" />}
            </div>
            {g.rows.map((r, i) => (<div key={r.key} data-choice-row="">
              <div className={rowCls}>
                <input ref={f.ref(`n${r.key}`)} className={`${cellCls} col-start-1 row-start-1`} value={r.en} maxLength={LIMITS.label} placeholder="e.g. Oat milk" aria-label={`${shown(g.name) || 'Choice'} ${i + 1}`}
                  onChange={(e) => set(r.key, { en: e.target.value })} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.el(`p${r.key}`)?.focus(); } }} />
                <span className="relative col-start-3 row-start-1 block"><span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-base text-ink-muted">+$</span>
                  <input ref={f.ref(`p${r.key}`)} className={`${cellCls} pl-7 tabular-nums`} value={r.price} inputMode="decimal" placeholder="0" aria-label={`${shown(g.name) || 'Choice'} ${i + 1} extra price`}
                    onFocus={(e) => e.target.select()} onChange={(e) => set(r.key, { price: e.target.value })} onBlur={() => save()}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); if (!r.en.trim()) return; const last = g.rows[g.rows.length - 1]; if (last.key === r.key) addRow(g); else f.focus(`n${g.rows[i + 1].key}`); } }} /></span>
                <input className={faCellCls} dir="rtl" lang="fa" value={r.fa} maxLength={LIMITS.label} placeholder="فارسی" aria-label={`${shown(g.name) || 'Choice'} ${i + 1} (Persian)`} onChange={(e) => set(r.key, { fa: e.target.value })} onBlur={() => save()} />
                <button type="button" aria-label={`Remove add-on ${r.en || i + 1}`} onClick={() => { const next = rows.filter((x) => x.key !== r.key); setRows(next); save(next); }} className={removeCls}><Icon name="close" className="h-4 w-4" /></button>
              </div>
              {held && r.en.trim() && priceOf(r.price) === 'bad' && <p role="alert" className="px-3 pb-2 text-[13px] text-danger" data-row-problem="">Not a price (for example 0.75)</p>}
            </div>))}
            <div className="flex flex-wrap items-center justify-between gap-x-3 px-3">
              <button type="button" className={textBtn} onClick={() => addRow(g)} disabled={g.rows.length >= COUNTS.options}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />{g.rows.length >= COUNTS.options ? `At most ${COUNTS.options}` : 'Add choice'}</button>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">Must pick one<Switch checked={g.rows.every((r) => r.required)} label="Customer must pick one" onChange={(v) => { const next = rows.map((r) => (r.group === g.name ? { ...r, required: v } : r)); setRows(next); save(next); }} /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
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
      <p className="text-base text-ink-muted">Its {n} choice{n === 1 ? '' : 's'} and their prices are added to each item you pick; an item that already has a “{group || 'Options'}” group gets this one instead. One Undo puts them all back.</p>
      <div className="mt-3 max-h-[52dvh] space-y-3 overflow-y-auto">
        {order.map((s) => {
          const ids = s.item_ids.filter((id) => id !== item.id && items[id]);
          if (!ids.length) return null;
          const all = ids.every((id) => picked.has(id));
          return (
            <div key={s.id} data-copy-section={s.name.en ?? ''}>
              <div className="flex items-center justify-between gap-2"><span className="text-base font-semibold">{s.name.en}</span>
                <button type="button" className={textBtn} onClick={() => toggle(ids, !all)}>{all ? 'Clear' : `Select all in ${s.name.en}`}</button></div>
              {ids.map((id) => (
                <label key={id} className="flex min-h-11 items-center gap-3 border-t border-line px-1">
                  <input type="checkbox" className="check" checked={picked.has(id)} onChange={(e) => toggle([id], e.target.checked)} />
                  <span className="min-w-0 flex-1 truncate text-base">{items[id].name.en}</span>{!items[id].listed && <span className="text-[13px] text-ink-muted">Hidden</span>}
                </label>
              ))}
            </div>
          );
        })}
      </div>
      {err && <p role="alert" className="mt-3 text-[13px] text-danger">{err}</p>}
      <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={busy || picked.size === 0} onClick={() => { void copy(); }}>{busy ? 'Copying…' : `Copy to ${picked.size} item${picked.size === 1 ? '' : 's'}`}</button>
    </Sheet>
  );
}
