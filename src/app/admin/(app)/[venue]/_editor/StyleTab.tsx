'use client';
// The Style tab (Kian, 2026-10-08; owner and admin): the page's colours grouped by the parts customers see, top to bottom
// (src/venues/tokens.ts), then the template's layout options (src/venues/styles.ts). Each token shows its swatch, a plain
// label and where its colour comes from: "Auto" (derived from the background it sits on), "Venue default" (the brand
// record) or "Custom". Tapping a token opens the venue's palette, a native colour picker and a hex field; a colour being
// picked shows live in the preview and saves when chosen, with "Saved · Undo" like everything else. The readability guard
// (WCAG contrast) refuses a colour that would be hard to read, with the ratio, the threshold and a one-tap nearest fix.
// Opening a group switches the preview to the screen where the group is visible and outlines its region (Kian, 2026-10-09:
// the editor maps the group to the screen: Welcome → the welcome screen, Item popup → the first item's popup, the others → the
// menu scrolled to the region); a tap on a region in the preview opens its group here. The controls here are the master
// (Kian, 2026-10-08): a preview tap is acted on once, when it happens; nothing that follows (a save, the data reloading, the
// preview reloading) ever changes the open group or the open colour again.
// Compare (the venue's default colours in the preview while held) sits in the preview bar, which the editor puts at the top of this
// tab (Kian, 2026-10-10; the "What changed" list that was here is removed, same day: not needed). Discard this session's changes,
// at the top of the tab: a snapshot of the venue's style (colours, the
// template's switches) and of every section's layout, taken the first time the Style tab opens and held by the editor for the whole
// visit to the venue's editor (the PM, 2026-10-09: kept across tab switches; a reload, leaving the venue or a Discard starts it
// again); the button restores it in one step (one change record for the style, one per section whose layout changed), with a
// confirmation and an Undo.
// Layout group (Kian, 2026-10-08): the template's switches, then the layout of every section: List or Grid.
// Welcome group (Kian, 2026-10-09, replacing the Intro group): its on/off switch (the kill switch) at the top, then (Senso, 2026-10-10)
// the Transition into the menu, one per season since 2026-10-11 (Kian): four rows, Fall, Winter, Spring and Summer, each with its own
// choice of the ten concepts and Play, which plays that season's version in the preview (the preview switches to that season; choosing
// one saves it like every control here and plays it at once); then the welcome screen's colours as tokens under the readability guard.
// The preview-only season and time of day are in the preview bar; the frame carries the bar's season's own choice.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Brand, EditorSection, SectionLayout, StyleValues } from '@/lib/types';
import { TX_KEYS, type StyleOption } from '@/venues/styles';
import { LEVELS, TRANSITIONS, TRANSITION_BY_ID, type TransitionId } from '@/lib/transitions';
import { SEASONS, type Season } from '@/lib/welcome';
import { GROUPS, baseName, cssVar, isLight, normHex, resolveColors, unreadable, type GroupId, type Resolved, type TokenDef } from '@/venues/tokens';
import { Icon } from '../../../_ui/icons';
import { ApiFail, call, type Resp } from './api';
import type { Region } from './Preview';
import { ConfirmSheet, Switch, btnSecondary, fieldCls } from './ui';

type Data = { template: { id: string; name: string }; groups: typeof GROUPS; tokens: TokenDef[]; palette: { label: string; value: string }[]; layout: StyleOption[]; values: StyleValues; style: StyleValues; brand: Brand | null };
type Fail = { key: string; error: string; suggestion: { key: string; value: string } | null; refused?: string };
export type StyleSnapshot = { style: StyleValues; layouts: Record<string, SectionLayout> };
export type Picked = { region: Region; n: number } | null;
const btnSmall = `${btnSecondary} min-h-11 px-3 text-sm`;
const TX_VALUES = Object.values(TX_KEYS); // the four per-season transition options (shown in the Welcome group, not under Layout)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// How many things differ between two style records: each colour that differs (set, changed or removed) and each other key (the
// template's switches, the pre-token choices).
function countStyleChanges(a: StyleValues, b: StyleValues): number {
  const ca = ((a as Record<string, unknown>).colors ?? {}) as Record<string, string>, cb = ((b as Record<string, unknown>).colors ?? {}) as Record<string, string>;
  let n = 0;
  for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) if (ca[k] !== cb[k]) n++;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (k !== 'colors' && a[k] !== b[k]) n++;
  return n;
}

export function StyleTab({ venueId, version, onSaved, onApply, onLive, onDefaults, onRegion, onEditing, picked, sections, onLayout, snapshot, onSnapshot, previewSeason, onPlay }: {
  venueId: string; version: number; onSaved: (r: Resp, text?: string) => void; onApply: (r: Resp) => void; onLive: (vars: Record<string, string> | null) => void; onDefaults: (vars: Record<string, string>) => void;
  onRegion: (r: Region | null) => void; onEditing: (editing: boolean) => void; picked: Picked; sections: EditorSection[]; onLayout: (id: string, layout: SectionLayout) => Promise<void>;
  snapshot: StyleSnapshot | null; onSnapshot: React.Dispatch<React.SetStateAction<StyleSnapshot | null>>; // the visit's snapshot, held by the editor
  previewSeason: Season | null; onPlay: (tx?: string, season?: Season) => void; // the preview's season (the bar's, else the page's) and Play for a season's transition (with the concept just chosen)
}) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);
  const [openGroup, setOpenGroup] = useState<GroupId | null>(null);
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const groupRefs = useRef<Partial<Record<GroupId, HTMLElement | null>>>({});
  const handledPick = useRef(0); // the preview tap already acted on (its `n`), so a later data reload never replays it
  const [layoutBusy, setLayoutBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/style?venue=${encodeURIComponent(venueId)}`, { credentials: 'same-origin' })
      .then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) throw new Error(j?.error || `Could not load the style options (${r.status})`); if (live) { setData(j as Data); setErr(null); onSnapshot((s) => s ?? { style: (j as Data).style, layouts: Object.fromEntries(sections.map((x) => [x.id, x.layout])) }); } })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [venueId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 6000); return () => clearTimeout(t); }, [err]);
  useEffect(() => { onEditing(openToken !== null); }, [openToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const venue = useMemo(() => (data ? { template: data.template.id, brand: data.brand, style: data.style } : null), [data]);
  const resolved: Resolved = useMemo(() => (venue ? resolveColors(venue, pending) : {}), [venue, pending]);
  const defaults: Resolved = useMemo(() => (venue ? resolveColors({ template: venue.template, brand: venue.brand, style: {} }) : {}), [venue]); // the venue's default look (what Reset all gives)
  const warnings = useMemo(() => (venue ? unreadable(resolved, venue.template) : []), [venue, resolved]);
  const tokensOfGroup = (g: GroupId) => (data?.tokens ?? []).filter((t) => t.group === g);
  const label = (key: string) => data?.tokens.find((t) => t.key === key)?.label ?? key;
  const varsOf = (res: Resolved) => Object.fromEntries(Object.entries(res).map(([k, r]) => [cssVar(k), r.value]));
  useEffect(() => { if (venue) onDefaults(varsOf(defaults)); }, [defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (g: GroupId | null, token?: string | null) => {
    setOpenGroup(g); setOpenToken(g ? token ?? tokensOfGroup(g)[0]?.key ?? null : null); onRegion(g);
    if (g) requestAnimationFrame(() => { const el = groupRefs.current[g]; if (el && !el.closest('[data-style-sheet-body]')) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); // in the phone's sheet the swatches are revealed instead (below)
  };
  // On a phone (the controls in the bottom sheet), opening a colour scrolls the sheet so its swatches (Auto, the venue's colours, Custom) are in
  // view (the PM, 2026-10-09); the sheet stays at half while a colour is open, so the preview keeps its share. After the sheet's height settles.
  useEffect(() => {
    if (!openToken) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-style-token="${openToken}"] [data-style-swatches]`), box = el?.closest<HTMLElement>('[data-style-sheet-body]');
      if (!el || !box) return;
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = Math.max(0, Math.min(6, (b.height - r.height) / 2)); // a margin only where it still fits (a small phone's sheet has room for the swatches alone)
      const delta = r.bottom + pad > b.bottom ? Math.min(r.bottom + pad - b.bottom, r.top - pad - b.top) : r.top - pad < b.top ? r.top - pad - b.top : 0;
      if (delta) box.scrollTo({ top: box.scrollTop + delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 260);
    return () => clearTimeout(t);
  }, [openToken]);
  // A tap on a region in the preview opens its group here and scrolls to it, once per tap (never again when the data or the
  // preview reload after a save). A tap on the group that is already open only re-outlines it: the open colour stays.
  useEffect(() => {
    if (!picked || !data || picked.n === handledPick.current) return;
    handledPick.current = picked.n;
    if (openGroup === picked.region) { onRegion(picked.region); return; }
    open(picked.region);
  }, [picked, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (r: Resp) => setData((d) => (d ? { ...d, style: r.style as StyleValues, values: r.values as StyleValues, tokens: r.tokens as TokenDef[], palette: r.palette as Data['palette'], brand: r.brand as Brand | null } : d));
  // Live: the colour under the picker shows in the preview before it is saved (every Auto token linked to it follows).
  const live = (key: string, value: string) => { if (!venue) return; const p = { ...pending, [key]: value }; setPending(p); onLive(varsOf(resolveColors(venue, p))); };
  // A refusal stays on screen until the next answer for that token (so its one-tap fix cannot vanish under the finger).
  const setColor = async (key: string, value: string | null, text = 'Saved') => {
    if (!data) return;
    setPending({});
    try { const r = await call('/api/admin/style', { action: 'update', venue: venueId, patch: { colors: { [key]: value } } }); apply(r); setFail((f) => (f?.key === key ? null : f)); onSaved(r, text); }
    catch (e) { onLive(null); const x = e as ApiFail; if (x.extra?.guard) setFail({ key, error: x.message, suggestion: (x.extra.guard as { suggestion: Fail['suggestion'] }).suggestion, refused: value ?? undefined }); else setErr(x.message); }
  };
  const setLayout = async (key: string, value: string | boolean) => {
    if (!data) return;
    const before = data; setData({ ...data, values: { ...data.values, [key]: value } });
    try { const r = await call('/api/admin/style', { action: 'update', venue: venueId, patch: { [key]: value } }); apply(r); onSaved(r); }
    catch (e) { setData(before); setErr((e as Error).message); }
  };
  const setSectionLayout = async (id: string, layout: SectionLayout) => {
    setLayoutBusy(id);
    try { await onLayout(id, layout); } catch (e) { setErr((e as Error).message); } finally { setLayoutBusy(null); }
  };
  const reset = async (group?: GroupId) => {
    setFail(null);
    try { const r = await call('/api/admin/style', { action: 'reset', venue: venueId, ...(group ? { group } : {}) }); apply(r); setConfirmReset(false); onSaved(r, group ? 'Group reset' : 'All colours reset'); }
    catch (e) { setErr((e as Error).message); }
  };
  // Discard this session's changes: the style back to the snapshot in one record, then each section whose layout changed; one
  // "Discarded · Undo" for all of it (the undo route restores every record together). A Discard starts the session again from
  // what it put back.
  const changedLayouts = snapshot ? sections.filter((s) => snapshot.layouts[s.id] && snapshot.layouts[s.id] !== s.layout) : [];
  const sessionChanges = snapshot && data ? countStyleChanges(snapshot.style, data.style) + changedLayouts.length : 0;
  const discard = async () => {
    if (!snapshot || !data) return;
    setFail(null);
    try {
      const revisions: number[] = [];
      let last: Resp | null = null, style = data.style;
      if (!sameJson(snapshot.style, data.style)) { const r = await call('/api/admin/style', { action: 'restore', venue: venueId, style: snapshot.style }); apply(r); revisions.push(...r.revisions); last = r; style = r.style as StyleValues; }
      for (const s of changedLayouts) { const r = await call('/api/admin/section', { action: 'update', id: s.id, patch: { layout: snapshot.layouts[s.id] } }); onApply(r); revisions.push(...r.revisions); last = r; }
      setConfirmDiscard(false);
      onSnapshot({ style, layouts: { ...Object.fromEntries(sections.map((x) => [x.id, x.layout])), ...snapshot.layouts } });
      onSaved({ ...(last ?? { ok: true }), revisions }, 'Discarded');
    } catch (e) { setErr((e as Error).message); }
  };

  if (err && !data) return <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{err}</p>;
  if (!data || !venue) return <p className="mx-auto mt-10 max-w-3xl px-5 text-center text-sm text-ink-muted" aria-busy="true">Loading the style options…</p>;
  const customKeys = Object.keys(((data.style as Record<string, unknown>).colors as Record<string, string> | undefined) ?? {});
  const anyCustom = customKeys.length > 0 || 'accent' in data.style || 'tile' in data.style;
  const groups = data.groups.filter((g) => tokensOfGroup(g.id).length > 0);
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-32 pt-4 sm:px-5" data-style-tab>
      <p className="px-1 text-sm text-ink-muted">Colours by part of the page, top to bottom. Tap a part in the preview, or open a group. Each change saves itself and shows in the preview.</p>
      {err && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{err}</p>}
      {warnings.length > 0 && <p role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900" data-style-warnings>Hard to read: {warnings.map((w) => `${label(w.key)} on the ${baseName(w.on)} (${w.ratio.toFixed(1)}:1, needs ${w.threshold}:1)`).join('; ')}.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <button type="button" className={btnSmall} disabled={sessionChanges === 0} onClick={() => setConfirmDiscard(true)} data-style-discard data-changes={sessionChanges}><Icon name="restore" className="h-4 w-4" />Discard this session&rsquo;s changes</button>
        <span className="text-xs text-ink-muted">{sessionChanges === 0 ? 'Nothing changed since you first opened the Style tab.' : `Back to how it was when you first opened the Style tab (${sessionChanges} change${sessionChanges === 1 ? '' : 's'}).`}</span>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const isOpen = openGroup === g.id; const toks = tokensOfGroup(g.id);
          const groupCustom = toks.some((t) => resolved[t.key]?.state === 'custom');
          return (
            <section key={g.id} ref={(el) => { groupRefs.current[g.id] = el; }} data-style-group={g.id} data-open={isOpen ? '1' : undefined} className={`rounded-2xl border bg-white shadow-card lg:scroll-mt-60 ${isOpen ? 'border-accent/40' : 'border-line'}`} onFocusCapture={() => { if (isOpen) onRegion(g.id); }}>
              <button type="button" aria-expanded={isOpen} aria-label={`${g.label}: ${isOpen ? 'close' : 'open'}`} onClick={() => open(isOpen ? null : g.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{g.label}</span>
                  {isOpen ? <span className="block text-xs text-ink-muted">{g.hint}</span> : <span className="mt-1 flex flex-wrap items-center gap-1" aria-label={`${g.label} colours`} data-style-summary>{toks.map((t) => <span key={t.key} className="h-4 w-4 rounded-full border border-black/10" style={{ background: resolved[t.key]?.value }} title={`${t.label}: ${resolved[t.key]?.value}`} />)}</span>}
                </span>
                <Icon name={isOpen ? 'up' : 'down'} className="h-5 w-5 shrink-0 text-ink-muted" />
              </button>
              {isOpen && (
                <div className="border-t border-line px-1 pb-3 pt-1">
                  {g.id === 'welcome' && <WelcomeControls option={data.layout.find((o) => o.key === 'welcome')} on={data.values.welcome !== false} onSwitch={(v) => setLayout('welcome', v)}
                    transitions={data.layout.filter((o) => TX_VALUES.includes(o.key))} values={data.values} season={previewSeason} onPlay={(sid) => onPlay(undefined, sid)}
                    onChoose={async (sid, id) => { onPlay(id, sid); if (id !== data.values[TX_KEYS[sid]]) await setLayout(TX_KEYS[sid], id); }} />}
                  {toks.map((t) => <TokenRow key={t.key} token={t} res={resolved[t.key]} base={t.on ? resolved[t.on] : null} baseLabel={t.on ? baseName(t.on) : null} open={openToken === t.key} palette={data.palette} fail={fail?.key === t.key ? fail : null}
                    onOpen={() => { setOpenToken(openToken === t.key ? null : t.key); onRegion(g.id); }} onLive={(v) => live(t.key, v)} onSet={(v, text) => setColor(t.key, v, text)} />)}
                  <div className="mt-2 px-3"><button type="button" className={btnSmall} disabled={!groupCustom} onClick={() => reset(g.id)}><Icon name="undo" className="h-4 w-4" />Reset group to venue default</button></div>
                </div>
              )}
            </section>
          );
        })}
        <section data-style-group="layout" className="rounded-2xl border border-line bg-white shadow-card">
          <div className="px-4 pt-3"><h2 className="text-[17px] font-semibold">Layout</h2><p className="text-xs text-ink-muted">What the {data.template.name} template can switch.</p></div>
          <div className="mt-1 divide-y divide-line">
            {data.layout.filter((o) => o.key !== 'welcome' && !TX_VALUES.includes(o.key)).map((o) => (
              <div key={o.key} className="px-4 py-3" data-style-option={o.key}>
                {o.type === 'switch' ? (
                  <label className="flex items-center justify-between gap-4">
                    <span><span className="block font-medium">{o.label}</span>{o.hint && <span className="mt-0.5 block text-xs text-ink-muted">{o.hint}</span>}</span>
                    <Switch checked={data.values[o.key] === true} label={`${o.label}: ${data.values[o.key] === true ? 'on' : 'off'}`} onChange={(v) => setLayout(o.key, v)} />
                  </label>
                ) : (
                  <div>
                    <span className="block font-medium">{o.label}</span>
                    {o.hint && <p className="mt-0.5 text-xs text-ink-muted">{o.hint}</p>}
                    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={o.label}>
                      {o.choices.map((c) => <button key={c.value} type="button" role="radio" aria-checked={data.values[o.key] === c.value} onClick={() => setLayout(o.key, c.value)} className={`min-h-11 rounded-full border px-4 text-[15px] font-medium transition active:scale-[.97] ${data.values[o.key] === c.value ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-fill'}`}>{c.label}</button>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="px-4 py-3" data-style-option="sectionLayout">
              <span className="block font-medium">Section layout</span>
              <p className="mt-0.5 text-xs text-ink-muted">List: full-width rows with a small photo. Grid: two columns with bigger photos, good for juices, desserts and drinks. Tapping an item opens the same popup in both.</p>
              {sections.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No sections yet.</p> : (
                <ul className="mt-2 divide-y divide-line">
                  {sections.map((s) => {
                    const grid = s.layout === 'grid'; const busy = layoutBusy === s.id;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2" data-section-layout={s.id} data-layout={grid ? 'grid' : 'list'}>
                        <span className="min-w-0 flex-1"><span className={`block truncate text-[15px] ${s.listed ? '' : 'text-ink-muted'}`}>{s.name.en}</span><span className="block text-xs text-ink-muted">{s.item_ids.length} item{s.item_ids.length === 1 ? '' : 's'}{s.listed ? '' : ' · hidden'}</span></span>
                        <span className="flex shrink-0 rounded-full bg-fill p-0.5" role="radiogroup" aria-label={`${s.name.en}: layout`}>
                          {(['list', 'grid'] as const).map((v) => {
                            const on = (v === 'grid') === grid;
                            return <button key={v} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => { if (!on) void setSectionLayout(s.id, v); }} className={`flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold transition ${on ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-ink-muted hover:text-ink'}`}><Icon name={v} className="h-4 w-4" />{v === 'grid' ? 'Grid' : 'List'}</button>;
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="mt-4 px-1">
        <button type="button" className={btnSecondary} disabled={!anyCustom} onClick={() => setConfirmReset(true)} data-style-reset-all><Icon name="restore" className="h-4 w-4" />Reset all colours</button>
        <p className="mt-2 text-xs text-ink-muted">Back to the venue&rsquo;s own look: the recorded brand colours (logo, website) stay on file and are the swatches in every group.</p>
      </div>
      {confirmReset && <ConfirmSheet title="Reset all colours?" body={<>Every colour goes back to the venue&rsquo;s default look. You can undo for 10 seconds.</>} label="Reset all colours" onConfirm={() => reset()} onClose={() => setConfirmReset(false)} />}
      {confirmDiscard && <ConfirmSheet title="Discard this session's changes?" body={<>Every colour, switch and section layout goes back to how it was when you first opened the Style tab ({sessionChanges} change{sessionChanges === 1 ? '' : 's'}). You can undo for 10 seconds.</>} label="Discard changes" onConfirm={discard} onClose={() => setConfirmDiscard(false)} />}
    </div>
  );
}

// One token: its swatch, label and origin; opened, the venue's palette, the native picker, the hex field and "Back to auto".
function TokenRow({ token: t, res, base, baseLabel, open, palette, fail, onOpen, onLive, onSet }: { token: TokenDef; res: Resolved[string] | undefined; base: Resolved[string] | null; baseLabel: string | null; open: boolean; palette: { label: string; value: string }[]; fail: Fail | null; onOpen: () => void; onLive: (v: string) => void; onSet: (v: string | null, text?: string) => Promise<void> }) {
  const value = res?.value ?? '#ffffff';
  const [hex, setHex] = useState(value);
  const [hexErr, setHexErr] = useState<string | null>(null);
  useEffect(() => { setHex(value); setHexErr(null); }, [value]);
  // Leaving the field with the colour that was just refused does not send it again (the refusal and its fix stay).
  const commitHex = async () => { const h = normHex(hex); if (!h) { setHexErr('Use #rrggbb'); return; } setHexErr(null); if (h !== value && h !== fail?.refused) await onSet(h); };
  const state = res?.state ?? 'auto';
  const backLabel = t.on ? 'Back to auto' : 'Back to venue default';
  return (
    <div data-style-token={t.key} data-state={state} className={`rounded-2xl ${open ? 'bg-fill/70' : ''}`}>
      <button type="button" aria-expanded={open} aria-label={`${t.label}: ${value}, ${res?.why ?? ''}`} onClick={onOpen} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
        <span className="h-7 w-7 shrink-0 rounded-full border border-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.4)]" style={{ background: value }} aria-hidden="true" data-style-swatch />
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{t.label}</span><span className="block truncate text-xs text-ink-muted" data-style-why>{res?.why}{t.note ? ` · ${t.note}` : ''}</span></span>
        <span className="font-mono text-[12px] uppercase text-ink-muted" data-style-value>{value}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${t.label}: venue colours`} data-style-swatches>
            {t.on && <button type="button" aria-pressed={state === 'auto'} onClick={() => { void onSet(null, 'Back to auto'); }} className={`flex h-11 items-center gap-1.5 rounded-full border px-3 text-[14px] font-medium ${state === 'auto' ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-fill'}`}><Icon name="sparkle" className="h-4 w-4" />Auto</button>}
            {palette.map((p) => {
              const on = value === p.value;
              return <button key={p.value} type="button" onClick={() => { void onSet(p.value); }} aria-label={`${t.label}: ${p.label} ${p.value}`} aria-pressed={on} title={p.label} className={`relative h-11 w-11 rounded-full border border-black/10 transition active:scale-95 ${on ? 'ring-[3px] ring-accent/40 ring-offset-2' : ''}`} style={{ background: p.value, color: isLight(p.value) ? '#000' : '#fff' }}>{on && <Icon name="check" className="absolute inset-0 m-auto h-5 w-5" strokeWidth={2.6} />}</button>;
            })}
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 text-[14px] font-medium hover:bg-fill">
              <input type="color" value={value} aria-label={`${t.label}: custom colour`} onInput={(e) => onLive((e.target as HTMLInputElement).value)} onChange={(e) => { void onSet(e.target.value); }} className="h-6 w-6 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
              Custom
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="text" inputMode="text" value={hex} aria-label={`${t.label}: hex`} spellCheck={false} onChange={(e) => setHex(e.target.value)} onBlur={() => { void commitHex(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commitHex(); } }} className={`${fieldCls} min-h-11 w-32 py-2 font-mono text-[14px] uppercase`} />
            {state === 'custom' && <button type="button" className={btnSmall} onClick={() => { void onSet(null, backLabel); }}><Icon name="undo" className="h-4 w-4" />{backLabel}</button>}
            {base && baseLabel && <span className="text-xs text-ink-muted">Sits on the {baseLabel} ({base.value}).</span>}
          </div>
          {hexErr && <p role="alert" className="mt-1 text-xs text-red-600">{hexErr}</p>}
          {fail && <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-900" data-style-refused>{fail.error}{fail.suggestion && <button type="button" className={`${btnSmall} border-red-300`} onMouseDown={(e) => e.preventDefault()} onClick={() => { void onSet(fail.suggestion!.value); }} data-style-suggestion={fail.suggestion.value}><span className="h-4 w-4 rounded-full border border-black/10" style={{ background: fail.suggestion.value }} />Use {fail.suggestion.value}</button>}</p>}
        </div>
      )}
    </div>
  );
}

// The Welcome group's own controls above its colours: the kill switch, the template's "welcome" option (src/venues/styles.ts), saved
// like the Layout switches with "Saved · Undo". The preview-only season and time of day live in the preview bar (Kian, 2026-10-09).
// Then, where the template has them (Senso), the transitions into the menu, one per season (Kian, 2026-10-11): four rows, Fall, Winter,
// Spring and Summer, each with its own choice of the ten concepts (src/lib/transitions.ts; a native select, named with level and time),
// the chosen one's line for that season, and Play. Choosing plays that season's version in the preview at once (the preview switches to
// that season) and saves it; Play plays it again. The row of the preview's season says so.
const TX_ORDER: Season[] = ['fall', 'winter', 'spring', 'summer'];
function WelcomeControls({ option: o, on, onSwitch, transitions: txs, values, season, onChoose, onPlay }: {
  option: StyleOption | undefined; on: boolean; onSwitch: (v: boolean) => void;
  transitions: StyleOption[]; values: StyleValues; season: Season | null; onChoose: (season: Season, id: string) => Promise<void>; onPlay: (season: Season) => void;
}) {
  const [busy, setBusy] = useState<Season | null>(null);
  if (!o || o.type !== 'switch') return null;
  return (
    <div className="mb-1 border-b border-line px-3">
      <label className="flex min-h-12 items-center justify-between gap-4 py-2.5" data-style-option="welcome">
        <span><span className="block text-[15px] font-medium">{o.label}</span>{o.hint && <span className="mt-0.5 block text-xs text-ink-muted">{o.hint}</span>}<span className="mt-0.5 block text-xs text-ink-muted">Season and time of day for the preview: in the preview bar at the top of these controls.</span></span>
        <Switch checked={on} label={`${o.label}: ${on ? 'on' : 'off'}`} onChange={(v) => onSwitch(v)} />
      </label>
      {txs.length > 0 && (
        <div className="border-t border-line py-3" data-style-option="transitions">
          <span className="block text-[15px] font-medium">Transition</span>
          <span className="mt-0.5 block text-xs text-ink-muted">{on ? 'From the welcome screen into the menu, after a language is tapped; the menu can be scrolled and tapped from the first moment. One for each season: customers get the one of the current season.' : 'The welcome screen is off: the menu opens directly, with no transition.'}</span>
          <div className="mt-2 space-y-2">
            {TX_ORDER.map((sid) => {
              const s = SEASONS.find((x) => x.id === sid)!, opt = txs.find((x) => x.key === TX_KEYS[sid]), chosen = String(values[TX_KEYS[sid]] ?? ''), t = TRANSITION_BY_ID[chosen as TransitionId];
              if (!opt) return null;
              return (
                <div key={sid} className={`rounded-2xl border px-3 py-2.5 ${season === sid ? 'border-ink' : 'border-line'}`} data-transition-season={sid} data-chosen={chosen}>
                  <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{s.label} <span className="font-normal text-ink-muted">· {s.months}{season === sid ? ' · in the preview' : ''}</span></span>
                      <select value={chosen} disabled={!on || busy !== null} data-transition-select={sid} aria-label={`${s.label} transition`}
                        onChange={async (e) => { const id = e.target.value; setBusy(sid); try { await onChoose(sid, id); } finally { setBusy(null); } }}
                        className={`mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] ${busy === sid ? 'opacity-70' : ''}`}>
                        {TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name} · {LEVELS[x.level]} · {(x[sid].ms / 1000).toFixed(2)} s</option>)}
                      </select>
                    </label>
                    <button type="button" className={`${btnSmall} shrink-0`} onClick={() => onPlay(sid)} disabled={!on} data-transition-play={sid} aria-label={`Play the ${s.label.toLowerCase()} transition in the preview`}><Icon name="play" className="h-4 w-4" />Play</button>
                  </div>
                  {t && <p className="mt-1.5 text-[13px] leading-snug text-ink-muted" data-transition-text>{t[sid].text}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
