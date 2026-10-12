'use client';
// The customers' real page on an iPhone 17 Pro Max mockup (laptop) or full screen (phone). Two frames are kept: a save loads
// the fresh page into the hidden one, the view (screen, language, season, time of day) and the scroll position (or the item
// just edited, outlined) are set while it is still hidden, then it is faded in. No flash, no jump. The customers' page carries
// no preview code: everything here is attached by the admin after the frame loads.
// The view (Kian, 2026-10-09, the preview control bar; src/app/admin/(app)/[venue]/_editor/view.ts) is owned by the editor and
// flows to both previews; the bar itself sits in the Style tab (Kian, 2026-10-10), not here. The screen (Welcome: the overlay shown
// live with its scene running; Menu; Item popup: the first item's popup; Section list), the language, the season (another season's scene is fetched from the admin API and
// swapped into the frame, since the customers' page carries only the current season; with it, since 2026-10-12, that season's menu: the
// Seasonal section and the items tagged for it, so the admin sees each season's specials before they go live) and the time of day (the greeting), each
// preview-only, plus Replay. After a save the fresh frame is put back on the same screen and position before it is shown.
// Play (the Style tab's Welcome group, 2026-10-10): the venue's transition from the welcome screen into the menu, played in the frame by
// the page's own code (a tap on the language button of the preview's language, which the page answers as it does for customers), in
// the preview's season (another season's transition is fetched with its scene), on demand and as often as asked; it ends on the menu
// (onPlayed). A play asked for while a save reloads the frame waits for the fresh frame, so it plays what was just chosen.
// Style tab (Kian, 2026-10-08): the open group's region is outlined in the frame (the `region` prop, owned by the editor; a new
// `n` re-applies it), a tap on a region reports it to the editor (onPick kind "region"), and a colour being picked (or Compare's
// default colours) is applied live to the frame's CSS variables before it is saved (setVars). The controls on the left are the
// master: the frame only ever follows them; it never changes the open group by itself.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { GroupId } from '@/venues/tokens';
import { slotOf, type Season, type Slot } from '@/lib/welcome';
import { Icon } from '../../../_ui/icons';
import type { PageNow, View } from './view';

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
  venueId: string; reloadKey: number; focus: Focus; view: View; onNow: (now: PageNow) => void;
  frame: boolean; onClose?: () => void; onPick?: (p: Pick) => void; styleMode?: boolean; region?: RegionState; onPlayed?: () => void;
};
export const Preview = forwardRef<PreviewHandle, Props>(function Preview({ venueId, reloadKey, focus, view, onNow, frame, onClose, onPick, styleMode = false, region = NO_REGION, onPlayed }, handle) {
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
  const reloading = useRef(false), playWanted = useRef(false); // a play asked for while the frame reloads waits for the fresh frame
  const seasonP = useRef<Promise<void>>(Promise.resolve()); // the latest season switch in the frame (a play waits for its scene and transition)
  const playedRef = useRef(onPlayed); playedRef.current = onPlayed;
  // A play: the frame's own transition, or (tx) a concept just chosen, put into the frame on screen first (its code from the admin's scene
  // API, as the page will carry it once the save lands), so the frame is not swapped before it plays. While it plays a save's reload
  // waits (deferred) and lands after it, on the menu, where the two frames look alike.
  const playing = useRef(false), deferred = useRef(false);
  const play = (d: Document, fresh = false, tx: string | null = null) => {
    if (playing.current) return; // one play at a time
    playing.current = true;
    const ended = () => { playing.current = false; playedRef.current?.(); if (deferred.current) { deferred.current = false; reload(); } };
    void seasonP.current.then(() => (tx ? putTx(d, venueId, tx) : undefined)).then(() => { if (d === activeDoc() && playTransition(d, viewRef.current.lang, ended, fresh)) return; playing.current = false; if (deferred.current) { deferred.current = false; reload(); } });
  };
  const isOurs = (d: Document | null | undefined): d is Document => !!d && d.location.pathname === `/${venueId}`;
  const activeDoc = () => { const a = activeRef.current; if (a === null) return null; const d = frames[a].current?.contentDocument; return isOurs(d) ? d : null; };

  useImperativeHandle(handle, () => ({
    setVars: (vars) => { varsRef.current = vars; const d = activeDoc(); if (d) applyVars(d, vars); },
  }));
  // The view, applied to the loaded frame as it changes (each part on its own, so a season switch never re-opens a popup).
  useEffect(() => { const d = activeDoc(); if (d) applyScreen(d, view); }, [view.screen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!view.replay) return; const d = activeDoc(); if (d) replayWelcome(d); }, [view.replay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) applyLang(d, view.lang); }, [view.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) applyGreet(d, view.slot); }, [view.slot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const d = activeDoc(); if (d) seasonP.current = applySeason(d, venueId, view.season, () => viewRef.current.season === view.season).then((swapped) => { if (swapped && d === activeDoc()) { applyScreen(d, viewRef.current); if (regionRef.current.region) applyRegion(d, regionRef.current.region, false); } }); }, [view.season]); // eslint-disable-line react-hooks/exhaustive-deps
  // The open group's region (or a re-assertion of it): outlined in the loaded frame, scrolled to when out of view.
  useEffect(() => { const d = activeDoc(); if (d) applyRegion(d, region.region, true); }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  // A save (reloadKey) loads the page into the hidden slot (location.replace: a preview reload never adds a history entry); while a
  // transition plays it waits for the end of the play.
  const reloadKeyRef = useRef(reloadKey); reloadKeyRef.current = reloadKey;
  const reload = () => {
    const next = (activeRef.current === null ? 0 : 1 - activeRef.current) as 0 | 1;
    loadingSlot.current = next;
    const cur = activeRef.current === null ? null : frames[activeRef.current].current;
    scrollRef.current = cur?.contentWindow?.scrollY ?? 0;
    reloading.current = true; setLoading(true);
    const w = frames[next].current?.contentWindow; if (w) w.location.replace(`/${venueId}?preview=${reloadKeyRef.current}.${Date.now()}`);
  };
  useEffect(() => { if (playing.current) { deferred.current = true; return; } reload(); }, [venueId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Play: now, or once the frame being reloaded is in (a transition just chosen is saved, then played from the fresh page). Declared after
  // the reload above, so a save and a play in the same render see the reload first.
  useEffect(() => { if (!view.play) return; const d = activeDoc(); if (reloading.current || !d) { playWanted.current = true; return; } play(d, false, viewRef.current.playTx); }, [view.play]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // With a season of the preview's own, the frame is shown once that season's scene and menu are in (seasonal items, 2026-10-12: no flash of today's menu).
    const finish = () => {
    if (slot !== loadingSlot.current) return; // a newer load took over meanwhile
    if (pickRef.current) attachPick(d, (p) => pickRef.current?.(p), () => styleModeRef.current);
    if (varsRef.current) applyVars(d, varsRef.current);
    applyScreen(d, v); // the same screen as before the save: the welcome screen, the popup or the section list open again
    if (!showFocus(d, focusRef.current)) d.defaultView?.scrollTo({ top: scrollRef.current, behavior: 'auto' }); // the item just edited, or the same position
    if (regionRef.current.region) applyRegion(d, regionRef.current.region, activeRef.current === null); // the first load of this preview (the phone overlay opening) scrolls to the open group's region; a reload after a save keeps its place
    if (playWanted.current) h.classList.add('roses-play-still'); // a transition just chosen plays from this fresh page: its welcome card settled from its first visible frame, as in the frame it replaces (no entrance starting over under the cross-fade)
    activeRef.current = slot; setActive(slot); setLoading(false); reloading.current = false;
    if (playWanted.current) { playWanted.current = false; play(d, true); } // once the preview's season (its scene and transition) is in
    };
    if (v.season) { const want = v.season; seasonP.current = applySeason(d, venueId, want, () => viewRef.current.season === want).then(() => undefined); void seasonP.current.then(finish); }
    else finish();
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
  const status = <span className="text-[13px] font-medium text-ink-muted" aria-live="polite" data-preview-status>{onPick ? (styleMode ? 'Tap a part of the page to colour it' : 'Tap anything to edit it') : 'Customers see'}{loading && <span className="text-neutral-400"> · updating…</span>}</span>;

  if (!frame) {
    return (
      <div className="flex h-full flex-col bg-white">
        {onClose && (
          <div className="glass flex h-11 shrink-0 items-center gap-2 px-2 shadow-[inset_0_-1px_0_var(--color-line)]">
            <button type="button" onClick={onClose} className="flex h-11 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" />Edit</button>
            <span className="flex-1 text-center">{status}</span>
          </div>
        )}
        <div className="relative min-h-0 flex-1" data-preview-area>{iframes}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-11 w-full shrink-0 items-center justify-center border-b border-line px-4"><div className="w-full max-w-[440px]">{status}</div></div>
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
// The screen: the welcome overlay shown or not, the item popup (the first item on the page) and the section list open or closed. Closing uses the dialogs' close() (instant; the customers' slide-out is for them).
function applyScreen(d: Document, v: View) {
  previewStyle(d);
  const h = d.documentElement;
  const sheet = d.getElementById('sheet') as HTMLDialogElement | null, list = d.getElementById('sections-dialog') as HTMLDialogElement | null;
  h.classList.toggle('roses-show-welcome', v.screen === 'welcome');
  if (v.screen !== 'sheet' && sheet?.open) synthetic(d, () => sheet.close());
  if (v.screen !== 'list' && list?.open) synthetic(d, () => list.close());
  if (v.screen === 'sheet' && sheet) {
    const li = d.querySelector('li.item') as HTMLElement | null;
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
    + 'html.roses-show-welcome #welcome{display:grid!important;place-items:center!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}' // place-items as the page's own rule for data-welcome="show" sets it (the frame is "off"): without it the card stretches and the buttons grow tall
    + 'html.roses-play[data-welcome="show"] #welcome,html.roses-play[data-welcome="done"] #welcome{display:grid!important;place-items:center!important}html.roses-play-still .welcome-card *{animation:none!important}' // Play: the page's own states run the transition (still: the card settled, without its entrance)
    + 'html.roses-play .roses-region{outline:none!important}html.roses-play.roses-region-page body{box-shadow:none!important}'; // and nothing of the preview's own on the page while it plays (the open group's outline would snap away with the overlay)
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
// Play the page's transition (Style tab → Welcome → Transition, 2026-10-10), timed as a customer's visit (Kian, 2026-10-10: the preview
// showed the transitions with a jump; they must play exactly as on the public page). The welcome screen is put up through the page's
// own state ("show") and the language button of the preview's language is clicked for the page once the welcome screen is settled and
// has been seen for a moment (BEAT_MS), as a customer taps it: the page applies the language and runs its own transition (w.rosesTx, the
// chosen concept for the frame's season; the 150 ms fade under reduced motion) and puts the menu up at "off", where the preview takes
// its own state back and reports the end. Settled means: a frame fresh from a save shows the card settled from its first visible frame
// (roses-play-still, set in onLoad; the cross-fade from the old frame must end first, CROSSFADE_MS); a welcome screen already up finishes
// its entrance; one that was not up (the menu showing) is put up as a page load shows it, its entrance from the start. While it plays,
// nothing of the preview's own shows on the page (the open group's outline). One play at a time; a new frame stops a play in flight.
const BEAT_MS = 500, CROSSFADE_MS = 220; // the iframes' cross-fade is 200 ms (duration-200)
function playTransition(d: Document, lang: 'en' | 'fa', onEnd: () => void, fresh = false): boolean {
  const h = d.documentElement, w = d.getElementById('welcome'), btn = w?.querySelector<HTMLButtonElement>(`button[data-lang="${lang}"]`);
  if (!w || !btn || h.classList.contains('roses-play')) return false;
  previewStyle(d);
  h.classList.add('roses-play'); if (fresh) h.classList.add('roses-play-still');
  h.dataset.welcome = 'show'; h.classList.remove('roses-show-welcome');
  const card = w.querySelector('.welcome-card');
  const entrance = card ? card.getAnimations({ subtree: true }).filter((a) => a.playState !== 'finished') : []; // (getAnimations flushes the style just changed: an entrance starting now is in it)
  const stop = () => h.classList.remove('roses-play', 'roses-play-still');
  const mo = new MutationObserver(() => { if (h.dataset.welcome === 'off') { mo.disconnect(); stop(); onEnd(); } });
  void Promise.all(entrance.map((a) => a.finished.catch(() => undefined))).then(() => setTimeout(() => {
    if (!btn.isConnected || h.dataset.welcome !== 'show') { stop(); onEnd(); return; }
    mo.observe(h, { attributes: true, attributeFilter: ['data-welcome'] });
    synthetic(d, () => btn.click());
  }, (fresh ? CROSSFADE_MS : 0) + BEAT_MS));
  return true;
}
// A concept just chosen, put into the frame on screen for its season (the scene stays): its style and script as the page will carry them.
async function putTx(d: Document, venueId: string, tx: string) {
  const w = d.getElementById('welcome') as (HTMLElement & { rosesTxKey?: string; rosesTx?: unknown }) | null; if (!w) return;
  const season = w.dataset.season ?? '';
  if (w.rosesTxKey === `${tx}-${season}`) return; // already the one in the frame
  const r = await fetch(`/api/admin/welcome-scene?venue=${encodeURIComponent(venueId)}&season=${season}&transition=${encodeURIComponent(tx)}`).then((x) => x.json() as Promise<{ ok: boolean; tx?: TxPart }>).catch(() => null);
  if (!r?.ok || !w.isConnected) return;
  setTx(d, w, r.tx?.css ?? null, r.tx?.js ?? null, r.tx?.key ?? null);
  if (!r.tx) delete w.rosesTx;
}
// The preview-only season (Kian, 2026-10-09; current season only since the PM's decision of the same day): the customers' page
// carries only today's scene, so another season's scene is fetched from the admin API and swapped into the frame (today's is
// kept and put back when the page's own season is chosen again); the artwork engine's script is run again on the new scene. Nothing is saved.
// The season's transition into the menu comes with its scene (the venue's chosen concept for that season; one per season since
// 2026-10-11): its style replaces the page's, its script redefines the page's w.rosesTx; today's are kept and put back with today's scene.
type TxPart = { key: string; css: string; js: string } | null;
type Kept = { html: string; season: string; tx: unknown; txCss: string | null; txKey: string | null };
async function applySeason(d: Document, venueId: string, season: Season | null, stillWanted: () => boolean): Promise<boolean> {
  const holder = d.querySelector<HTMLElement>('#welcome .welcome-scene'), w = d.getElementById('welcome') as (HTMLElement & { rosesTx?: unknown }) | null;
  if (!holder || !w) { // the welcome screen switched off: the menu only
    if (!season) return seasonMenu(d, 'today');
    const m = await fetch(`/api/admin/welcome-scene?venue=${encodeURIComponent(venueId)}&season=${season}`).then((x) => x.json() as Promise<{ ok: boolean; menu?: string | null }>).catch(() => null);
    return !!m?.ok && stillWanted() && seasonMenu(d, m.menu ?? 'today');
  }
  const kept = holder as HTMLElement & { rosesToday?: Kept };
  if (!season) { if (kept.rosesToday) { const k = kept.rosesToday; holder.innerHTML = k.html; w.dataset.season = k.season; setTx(d, w, k.txCss, null, k.txKey); w.rosesTx = k.tx; delete kept.rosesToday; } return seasonMenu(d, 'today'); }
  if (w.dataset.season === season && !kept.rosesToday) return seasonMenu(d, 'today'); // today's season is already up
  const r = await fetch(`/api/admin/welcome-scene?venue=${encodeURIComponent(venueId)}&season=${season}`).then((x) => x.json() as Promise<{ ok: boolean; html?: string; menu?: string | null; script?: string | null; tx?: TxPart }>).catch(() => null);
  if (!r?.ok || !r.html || !stillWanted() || !holder.isConnected) return false;
  if (!kept.rosesToday) kept.rosesToday = { html: holder.innerHTML, season: w.dataset.season ?? '', tx: w.rosesTx, txCss: d.getElementById('welcome-tx')?.textContent ?? null, txKey: d.getElementById('welcome-tx')?.dataset.tx ?? null };
  holder.innerHTML = r.html; w.dataset.season = season;
  if (r.script) { const s = d.createElement('script'); s.textContent = r.script; holder.appendChild(s); s.remove(); }
  setTx(d, w, r.tx?.css ?? null, r.tx?.js ?? null, r.tx?.key ?? null);
  if (!r.tx) delete w.rosesTx;
  return seasonMenu(d, r.menu ?? 'today');
}
// The season's menu (seasonal items, Kian, 2026-10-12: the preview's season switch shows each season's Seasonal section before it goes
// live). The page's menu is its <main> and what follows it in the page (the item popup, the section list, the kit's script): the
// template's own output. Another season's, rendered by the scene route, replaces it and its scripts run again (the language toggle,
// the kit); today's is kept and put back for today's season. 'today': today's menu (no swap when it is already up). Returns whether
// the frame's menu changed (the caller puts the screen and the outlined region back on it).
type MenuHolder = HTMLElement & { rosesTodayMenu?: ChildNode[] };
function seasonMenu(d: Document, html: string | 'today' | null): boolean {
  const main = d.querySelector('main'), parent = main?.parentElement as MenuHolder | null;
  if (!main || !parent || html === null) return false;
  const current: ChildNode[] = []; for (let n: ChildNode | null = main; n; n = n.nextSibling) current.push(n);
  if (html === 'today') {
    if (!parent.rosesTodayMenu) return false;
    current.forEach((n) => n.remove()); parent.rosesTodayMenu.forEach((n) => parent.appendChild(n)); delete parent.rosesTodayMenu;
  } else {
    if (!parent.rosesTodayMenu) parent.rosesTodayMenu = current;
    current.forEach((n) => n.remove());
    const t = d.createElement('template'); t.innerHTML = html;
    const fresh = [...t.content.childNodes]; fresh.forEach((n) => parent.appendChild(n));
    parent.querySelectorAll('main script, main ~ script').forEach((old) => { const s = d.createElement('script'); s.textContent = old.textContent; old.replaceWith(s); }); // inserted markup does not run its scripts: put fresh copies in their place
  }
  const now = d.querySelector('main'); if (now) now.inert = false; // the admin edits the menu behind the welcome screen
  delete d.documentElement.dataset.rosesSheetItem;
  return true;
}
function setTx(d: Document, w: HTMLElement, css: string | null, js: string | null, key: string | null) {
  let st = d.getElementById('welcome-tx');
  if (css === null) st?.remove();
  else { if (!st) { st = d.createElement('style'); st.id = 'welcome-tx'; w.appendChild(st); } st.textContent = css; if (key) st.dataset.tx = key; }
  if (js) { const s = d.createElement('script'); s.textContent = js; w.appendChild(s); s.remove(); }
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
