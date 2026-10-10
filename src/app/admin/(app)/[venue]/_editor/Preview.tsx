'use client';
// The customers' real page on an iPhone 17 Pro Max mockup (laptop) or full screen (phone). Two frames are kept: a save loads
// the fresh page into the hidden one, the view (screen, language, season, time of day) and the scroll position (or the item
// just edited, outlined) are set while it is still hidden, then it is faded in. No flash, no jump. The customers' page carries
// no preview code: everything here is attached by the admin after the frame loads.
// The view (Kian, 2026-10-09, the preview control bar; src/app/admin/(app)/[venue]/_editor/view.ts) is owned by the editor and
// flows to both previews: the screen (Welcome: the overlay shown live with its scene running; Menu; Item popup: the first item's
// or the open item's popup; Section list), the language, the season (another season's scene is fetched from the admin API and
// swapped into the frame, since the customers' page carries only the current season) and the time of day (the greeting), each
// preview-only, plus Replay. After a save the fresh frame is put back on the same screen and position before it is shown.
// Style tab (Kian, 2026-10-08): the open group's region is outlined in the frame (the `region` prop, owned by the editor; a new
// `n` re-applies it), a tap on a region reports it to the editor (onPick kind "region"), and a colour being picked (or Compare's
// default colours) is applied live to the frame's CSS variables before it is saved (setVars). The controls on the left are the
// master: the frame only ever follows them; it never changes the open group by itself.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { GroupId } from '@/venues/tokens';
import { slotOf, type Season, type Slot } from '@/lib/welcome';
import { Icon } from '../../../_ui/icons';
import { PreviewBar, type Compare } from './PreviewBar';
import type { PageNow, View, ViewPatch } from './view';

export type Focus = { id: string; alt?: string | null } | null;
export type Region = GroupId;
// What was tapped inside the preview: an item row, a section heading or the page header (Menu tab); a page region (Style tab);
// a language button on the previewed welcome screen (any tab: the preview then opens the menu in that language, as customers get it).
export type Pick = { kind: 'item' | 'section' | 'header'; id?: string } | { kind: 'region'; region: Region } | { kind: 'lang'; lang: 'en' | 'fa' };
export type RegionState = { region: Region | null; n: number };
export const NO_REGION: RegionState = { region: null, n: 0 };
export type PreviewHandle = { setVars: (vars: Record<string, string> | null) => void };
// iPhone 17 Pro Max (Kian, 2026-10-07): 6.9-inch class screen of 440 × 956 points, aluminium rail, black bezel, Dynamic Island,
// status bar with the live time, home indicator. The page itself is laid out at 440 points wide, as on the real phone.
const W = 440, H = 956, RAIL = 5, BEZEL = 13, STATUS = 54, EDGE = RAIL + BEZEL, BTN = 4;

type Props = {
  venueId: string; reloadKey: number; focus: Focus; view: View; onView: (p: ViewPatch) => void; onNow: (now: PageNow) => void; now: PageNow;
  frame: boolean; bar?: boolean; onClose?: () => void; onPick?: (p: Pick) => void; styleMode?: boolean; region?: RegionState; compare?: Compare;
};
export const Preview = forwardRef<PreviewHandle, Props>(function Preview({ venueId, reloadKey, focus, view, onView, onNow, now, frame, bar = true, onClose, onPick, styleMode = false, region = NO_REGION, compare = null }, handle) {
  const refA = useRef<HTMLIFrameElement>(null), refB = useRef<HTMLIFrameElement>(null);
  const frames = [refA, refB];
  const [active, setActive] = useState<0 | 1 | null>(null);
  const activeRef = useRef<0 | 1 | null>(null);
  const loadingSlot = useRef<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef(focus); focusRef.current = focus;
  const viewRef = useRef(view); viewRef.current = view;
  const pickRef = useRef(onPick); pickRef.current = onPick;
  const nowRef = useRef(onNow); nowRef.current = onNow;
  const styleModeRef = useRef(styleMode); styleModeRef.current = styleMode;
  const regionRef = useRef(region); regionRef.current = region;
  const varsRef = useRef<Record<string, string> | null>(null); // the live colours (a colour being picked, or Compare), re-applied to a fresh frame
  const scrollRef = useRef(0);
  const isOurs = (d: Document | null | undefined): d is Document => !!d && d.location.pathname === `/${venueId}`;
  const activeDoc = () => { const a = activeRef.current; if (a === null) return null; const d = frames[a].current?.contentDocument; return isOurs(d) ? d : null; };

  useImperativeHandle(handle, () => ({
    setVars: (vars) => { varsRef.current = vars; const d = activeDoc(); if (d) applyVars(d, vars); },
  }));
  // The view, applied to the loaded frame as it changes (each part on its own, so a season switch never re-opens a popup).
  useEffect(() => { const d = activeDoc(); if (d) applyScreen(d, view); }, [view.screen, view.item]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!view.replay) return; const d = activeDoc(); if (d) replayWelcome(d); }, [view.replay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) applyLang(d, view.lang); }, [view.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) applyGreet(d, view.slot); }, [view.slot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) void applySeason(d, venueId, view.season, () => viewRef.current.season === view.season); }, [view.season]); // eslint-disable-line react-hooks/exhaustive-deps
  // The open group's region (or a re-assertion of it): outlined in the loaded frame, scrolled to when out of view.
  useEffect(() => { const d = activeDoc(); if (d) applyRegion(d, region.region, true); }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  // A save (reloadKey) loads the page into the hidden slot (location.replace: a preview reload never adds a history entry).
  useEffect(() => {
    const next = (activeRef.current === null ? 0 : 1 - activeRef.current) as 0 | 1;
    loadingSlot.current = next;
    const cur = activeRef.current === null ? null : frames[activeRef.current].current;
    scrollRef.current = cur?.contentWindow?.scrollY ?? 0;
    setLoading(true);
    const w = frames[next].current?.contentWindow; if (w) w.location.replace(`/${venueId}?preview=${reloadKey}.${Date.now()}`);
  }, [venueId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLoad = (slot: 0 | 1) => () => {
    if (slot !== loadingSlot.current) return;
    const d = frames[slot].current?.contentDocument;
    if (!isOurs(d)) return;
    const h = d.documentElement, v = viewRef.current;
    // the page's own season and greeting (what customers get right now), before the preview's overrides
    nowRef.current({ season: (d.getElementById('welcome')?.dataset.season as Season | undefined) ?? null, slot: (h.dataset.greet as Slot | undefined) ?? null });
    h.dataset.welcome = 'off'; // the welcome screen shows on every load for customers; the preview switches it off and shows it only on the Welcome screen (applyScreen)
    const main = d.querySelector('main'); if (main) main.inert = false; // the page's script made the menu inert behind the overlay; the admin edits it
    previewStyle(d);
    applyLang(d, v.lang); applyGreet(d, v.slot);
    if (v.season) { const want = v.season; void applySeason(d, venueId, want, () => viewRef.current.season === want); }
    if (pickRef.current) attachPick(d, (p) => pickRef.current?.(p), () => styleModeRef.current);
    if (varsRef.current) applyVars(d, varsRef.current);
    applyScreen(d, v); // the same screen as before the save: the welcome screen, the popup or the section list open again
    if (!showFocus(d, focusRef.current)) d.defaultView?.scrollTo({ top: scrollRef.current, behavior: 'auto' }); // the item just edited, or the same position
    if (regionRef.current.region) applyRegion(d, regionRef.current.region, activeRef.current === null); // the first load of this preview (the phone overlay opening) scrolls to the open group's region; a reload after a save keeps its place
    activeRef.current = slot; setActive(slot); setLoading(false);
  };

  // Laptop: the phone scales down to fit the column (always whole, never cut).
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const outerW = W + 2 * EDGE + 2 * BTN, outerH = H + 2 * EDGE;
  useLayoutEffect(() => {
    if (!frame || !box.current) return;
    const el = box.current;
    const fit = () => { const cs = getComputedStyle(el); const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); setScale(Math.max(0.4, Math.min(1, h / outerH, w / outerW))); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [frame]); // eslint-disable-line react-hooks/exhaustive-deps
  const [time, setTime] = useState('');
  useEffect(() => {
    if (!frame) return;
    const tick = () => setTime(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date()).replace(/\s?[AP]M$/i, ''));
    tick(); const id = setInterval(tick, 15000); return () => clearInterval(id);
  }, [frame]);

  const iframes = ([0, 1] as const).map((slot) => (
    <iframe key={slot} ref={frames[slot]} title={slot === active ? "Preview of the customers' page" : 'Loading preview'} onLoad={onLoad(slot)} aria-hidden={active !== slot}
      className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-200 ${active === slot ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      data-preview-frame={active === slot ? venueId : undefined} data-preview-slot={slot} />
  ));
  const status = <span className="shrink-0 text-[11px] font-medium text-ink-muted" aria-live="polite" data-preview-status>{onPick ? (styleMode ? 'Tap a part of the page to colour it' : 'Tap anything to edit it') : 'Customers see'}{loading && <span className="text-neutral-400"> · updating…</span>}</span>;
  const controls = bar ? <PreviewBar view={view} onView={onView} now={now} compare={compare} status={status} phone={!frame} /> : null;

  if (!frame) {
    return (
      <div className="flex h-full flex-col bg-white">
        {onClose && (
          <div className="glass flex h-11 shrink-0 items-center gap-2 px-2 shadow-[inset_0_-1px_0_var(--color-line)]">
            <button type="button" onClick={onClose} className="flex h-11 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" />Edit</button>
            <span className="flex-1 text-center text-[13px] font-medium text-ink-muted">Preview</span>
          </div>
        )}
        {controls && <div className="shrink-0 border-b border-line">{controls}</div>}
        <div className="relative min-h-0 flex-1" data-preview-area>{iframes}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center">
      {controls}
      <div ref={box} className="flex min-h-0 w-full flex-1 items-start justify-center p-4">
        <div style={{ width: outerW * scale, height: outerH * scale }}>
          <div className="iphone" style={{ width: W, height: H, padding: EDGE, margin: `0 ${BTN}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }} aria-label="iPhone 17 Pro Max preview">
            <span className="iphone-btn iphone-btn-action" aria-hidden="true" /><span className="iphone-btn iphone-btn-volup" aria-hidden="true" /><span className="iphone-btn iphone-btn-voldown" aria-hidden="true" />
            <span className="iphone-btn iphone-btn-power" aria-hidden="true" /><span className="iphone-btn iphone-btn-camera" aria-hidden="true" />
            <div className="iphone-bezel"><div className="iphone-screen">
              <div className="iphone-status" aria-hidden="true">
                <span className="iphone-time">{time}</span>
                <span className="iphone-icons"><Cellular /><Wifi /><Battery /></span>
              </div>
              <div className="iphone-island" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0" style={{ top: STATUS }} data-preview-area>
                {iframes}
                {active === null && <div className="absolute inset-0 animate-pulse bg-fill" aria-hidden="true" />}
              </div>
              <span className="iphone-home" aria-hidden="true" />
            </div></div>
          </div>
        </div>
      </div>
    </div>
  );
});

const Cellular = () => <svg width="20" height="12" viewBox="0 0 20 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3.5" height="4" rx="1" /><rect x="5.5" y="5.5" width="3.5" height="6.5" rx="1" /><rect x="11" y="3" width="3.5" height="9" rx="1" /><rect x="16.5" y="0" width="3.5" height="12" rx="1" /></svg>;
const Wifi = () => <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M1.5 4.2a10.5 10.5 0 0 1 14 0" /><path d="M4.3 7a6.5 6.5 0 0 1 8.4 0" /><path d="M7 9.8a2.6 2.6 0 0 1 3 0" /><circle cx="8.5" cy="11" r=".6" fill="currentColor" /></svg>;
const Battery = () => <svg width="28" height="13" viewBox="0 0 28 13" aria-hidden="true"><rect x="0.5" y="0.5" width="24" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".4" /><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor" /><path d="M26 4.5v4a2 2 0 0 0 0-4Z" fill="currentColor" fillOpacity=".4" /></svg>;

function applyLang(d: Document, lang: 'en' | 'fa') {
  const h = d.documentElement; h.dataset.lang = lang; h.lang = lang; h.dir = lang === 'fa' ? 'rtl' : 'ltr';
}
// The greeting: the preview's time of day, or the device clock's (what the page's own head script decided; the same rule, src/lib/welcome.ts).
function applyGreet(d: Document, slot: Slot | null) {
  d.documentElement.dataset.greet = slot ?? slotOf(new Date().getHours());
}
// The page's own handlers must not see a click the admin makes inside the frame (opening the popup or the list for a screen).
function synthetic(d: Document, fn: () => void) { const h = d.documentElement; h.dataset.rosesSynthetic = '1'; try { fn(); } finally { delete h.dataset.rosesSynthetic; } }
// The screen: the welcome overlay shown or not, the item popup (the asked item, else the first on the page) and the section list
// open or closed. Closing uses the dialogs' close() (instant; the customers' slide-out is for them).
function applyScreen(d: Document, v: View) {
  previewStyle(d);
  const h = d.documentElement;
  const sheet = d.getElementById('sheet') as HTMLDialogElement | null, list = d.getElementById('sections-dialog') as HTMLDialogElement | null;
  h.classList.toggle('roses-show-welcome', v.screen === 'welcome');
  if (v.screen !== 'sheet' && sheet?.open) synthetic(d, () => sheet.close());
  if (v.screen !== 'list' && list?.open) synthetic(d, () => list.close());
  if (v.screen === 'sheet' && sheet) {
    const li = ((v.item && d.querySelector(`li.item[data-id="${v.item}"]`)) || d.querySelector('li.item')) as HTMLElement | null;
    if (li && (!sheet.open || h.dataset.rosesSheetItem !== li.dataset.id)) { synthetic(d, () => li.click()); h.dataset.rosesSheetItem = li.dataset.id ?? ''; }
  }
  if (v.screen === 'list' && list && !list.open) { const btn = d.getElementById('tabs-list'); if (btn) synthetic(d, () => btn.click()); }
}
// Replay: the welcome screen hidden and shown again (its CSS entrance animations start over), the artwork engine run again (a fresh
// scene, as a new load draws one), so the person sees the whole entrance from the start.
function replayWelcome(d: Document) {
  const h = d.documentElement, w = d.getElementById('welcome'); if (!w) return;
  h.classList.remove('roses-show-welcome');
  void w.offsetWidth;
  const engine = [...w.querySelectorAll('script')].map((s) => s.textContent ?? '').find((t) => t.includes('data-designs'));
  const holder = w.querySelector('.welcome-scene');
  if (engine && holder && w.querySelector('.scene[data-engine]')) { const s = d.createElement('script'); s.textContent = engine; holder.appendChild(s); s.remove(); }
  h.classList.add('roses-show-welcome');
}

// The admin's own style inside the frame: no welcome screen unless the Welcome screen is the preview's screen (the frame is shown
// only once loaded, as the customers see the page after their choice), the outline of the item just edited, the hover marks of
// tap-to-edit, the Style tab's region outline.
function previewStyle(d: Document) {
  if (d.getElementById('roses-preview-style')) return;
  const st = d.createElement('style'); st.id = 'roses-preview-style';
  st.textContent = '#welcome{display:none!important}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}.roses-preview-focus{box-shadow:inset 0 0 0 2px #ee6a3a;border-radius:12px;animation:roses-pf 2.6s ease-out forwards}@keyframes roses-pf{75%{box-shadow:inset 0 0 0 2px #ee6a3a}100%{box-shadow:inset 0 0 0 2px transparent}}'
    + '.roses-pick:not(.roses-style) li.item:hover,.roses-pick:not(.roses-style) main section h2:hover,.roses-pick:not(.roses-style) main>header:hover{outline:2px dashed rgba(238,106,58,.55);outline-offset:3px;border-radius:10px;cursor:pointer}'
    + '.roses-style main>header,.roses-style #tabs,.roses-style main section h2,.roses-style main section ul,.roses-style main footer,.roses-style dialog,.roses-style #welcome{cursor:pointer}'
    + '.roses-region{outline:3px solid #ee6a3a!important;outline-offset:-3px;border-radius:10px;transition:outline-color .2s}dialog.roses-region{outline-offset:-3px}'
    + 'html.roses-region-page body{box-shadow:inset 0 0 0 3px #ee6a3a;min-height:100dvh}'
    + 'html.roses-show-welcome #welcome{display:grid!important;place-items:center!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}'; // place-items as the page's own rule for data-welcome="show" sets it (the frame is "off"): without it the card stretches and the buttons grow tall
  d.head.appendChild(st);
}
// Tap-to-edit: one capture-phase click listener on the loaded document. Menu tab: an item row, a section heading or the
// header is reported to the editor and the page's own handler (the item sheet) does not run. Style tab: every tap reports
// the page region it landed on (the page's own handlers do not run), except the language toggle and the popup's close button.
// Any tab: a language button on the previewed welcome screen is reported as a language choice (the page's own handler would
// also hide the overlay underneath the preview's class and store the choice; the editor does the equivalent instead).
function attachPick(d: Document, onPick: (p: Pick) => void, styleMode: () => boolean) {
  if (d.documentElement.classList.contains('roses-pick')) return;
  d.documentElement.classList.add('roses-pick');
  if (styleMode()) d.documentElement.classList.add('roses-style');
  d.addEventListener('click', (e) => {
    if (d.documentElement.dataset.rosesSynthetic) return; // the admin itself opening the popup or the list for a screen
    const t = e.target as Element | null; if (!t || typeof t.closest !== 'function') return;
    if (t.closest('#lang-toggle')) return;
    const wl = t.closest('#welcome button[data-lang]');
    if (wl) { e.preventDefault(); e.stopPropagation(); onPick({ kind: 'lang', lang: wl.getAttribute('data-lang') === 'fa' ? 'fa' : 'en' }); return; }
    if (styleMode()) {
      if (t.closest('#sheet-close, #list-close')) { onPick({ kind: 'region', region: 'sheet' }); return; }
      e.preventDefault(); e.stopPropagation(); onPick({ kind: 'region', region: regionOf(t) }); return;
    }
    if (t.closest('#tabs, dialog, #welcome')) return;
    const li = t.closest('li.item[data-id]'); const h2 = t.closest('main section[data-id] h2'); const header = t.closest('main > header');
    const pick: Pick | null = li ? { kind: 'item', id: li.getAttribute('data-id') ?? undefined } : h2 ? { kind: 'section', id: h2.closest('section')?.getAttribute('data-id') ?? undefined } : header ? { kind: 'header' } : null;
    if (!pick) return;
    e.preventDefault(); e.stopPropagation(); onPick(pick);
  }, true);
}
function regionOf(t: Element): Region {
  if (t.closest('#welcome')) return 'welcome';
  if (t.closest('dialog#sheet, dialog#sections-dialog')) return 'sheet';
  if (t.closest('#tabs')) return 'tabs';
  if (t.closest('main > header')) return 'header';
  if (t.closest('main footer')) return 'footer';
  if (t.closest('li.item')) return 'rows';
  if (t.closest('main section h2') || t.closest('main section h2 + p')) return 'headings';
  if (t.closest('main section ul')) return 'rows';
  return 'page';
}
// What each region outlines inside the frame. The screen itself (the popup open, the welcome screen shown) is the view's business
// (the editor switches the screen when a group opens); here only the outline, and a scroll to it when it is out of view.
const REGION_SEL: Record<Region, string> = { page: '', header: 'main > header', tabs: '#tabs', headings: 'main section h2', rows: 'main section ul', sheet: 'dialog[open]', footer: 'main footer', welcome: '#welcome' };
function applyRegion(d: Document, region: Region | null, scroll: boolean) {
  previewStyle(d);
  const h = d.documentElement;
  d.querySelectorAll('.roses-region').forEach((el) => el.classList.remove('roses-region'));
  h.classList.toggle('roses-region-page', region === 'page');
  if (!region) return;
  const els = [...d.querySelectorAll(REGION_SEL[region] || 'nothing')];
  els.forEach((el) => el.classList.add('roses-region'));
  const w = d.defaultView; if (!scroll || !w || region === 'page' || region === 'welcome' || region === 'sheet' || !els.length) return;
  const visible = els.some((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < w.innerHeight; });
  if (!visible) (els[0] as HTMLElement).scrollIntoView({ block: region === 'footer' ? 'end' : 'start', behavior: 'auto' });
}
// The preview-only season (Kian, 2026-10-09; current season only since the PM's decision of the same day): the customers' page
// carries only today's scene, so another season's scene is fetched from the admin API and swapped into the frame (today's is
// kept and put back when the page's own season is chosen again); the artwork engine's script is run again on the new scene. Nothing is saved.
async function applySeason(d: Document, venueId: string, season: Season | null, stillWanted: () => boolean) {
  const holder = d.querySelector<HTMLElement>('#welcome .welcome-scene'), w = d.getElementById('welcome');
  if (!holder || !w) return;
  const kept = holder as HTMLElement & { rosesToday?: { html: string; season: string } };
  if (!season) { if (kept.rosesToday) { holder.innerHTML = kept.rosesToday.html; w.dataset.season = kept.rosesToday.season; delete kept.rosesToday; } return; }
  if (w.dataset.season === season && !kept.rosesToday) return; // today's season is already up
  const r = await fetch(`/api/admin/welcome-scene?venue=${encodeURIComponent(venueId)}&season=${season}`).then((x) => x.json() as Promise<{ ok: boolean; html?: string; script?: string | null }>).catch(() => null);
  if (!r?.ok || !r.html || !stillWanted() || !holder.isConnected) return;
  if (!kept.rosesToday) kept.rosesToday = { html: holder.innerHTML, season: w.dataset.season ?? '' };
  holder.innerHTML = r.html; w.dataset.season = season;
  if (r.script) { const s = d.createElement('script'); s.textContent = r.script; holder.appendChild(s); s.remove(); }
}
// Live colours, applied to the frame's CSS variables (the page's :root values stay in its own <style>): a colour being picked, or
// the venue's default colours while Compare is held; null takes every live value away again. The two rules that carry plain values
// (::backdrop, the close button's shadow) are rewritten in a live <style>.
function applyVars(d: Document, vars: Record<string, string> | null) {
  const h = d.documentElement;
  let live = d.getElementById('roses-live-vars') as HTMLStyleElement | null;
  for (const k of [...h.style].filter((p) => p.startsWith('--c-'))) h.style.removeProperty(k);
  if (!vars) { live?.remove(); return; }
  for (const [k, v] of Object.entries(vars)) h.style.setProperty(k, v);
  const dim = vars['--c-sheet-dim'];
  if (dim) { if (!live) { live = d.createElement('style'); live.id = 'roses-live-vars'; d.head.appendChild(live); } live.textContent = `dialog.sheet::backdrop,dialog.list::backdrop{background:${dim};opacity:.45}.sheet-close{box-shadow:0 1px 4px ${dim}40}`; }
  else live?.remove();
}
// Positions the frame on the element with that id (the item; or the section when the item is hidden) and outlines it briefly. Returns false when neither is on the page.
function showFocus(d: Document, f: Focus): boolean {
  previewStyle(d);
  d.querySelectorAll('.roses-preview-focus').forEach((el) => el.classList.remove('roses-preview-focus'));
  if (!f) return false;
  const el = (d.querySelector(`[data-id="${f.id}"]`) ?? (f.alt ? d.querySelector(`[data-id="${f.alt}"]`) : null)) as HTMLElement | null;
  if (!el) return false;
  el.classList.add('roses-preview-focus');
  const w = d.defaultView; if (!w) return true;
  const r = el.getBoundingClientRect();
  w.scrollTo({ top: Math.max(0, w.scrollY + r.top - Math.max(72, (w.innerHeight - r.height) / 2)), behavior: 'auto' });
  return true;
}
