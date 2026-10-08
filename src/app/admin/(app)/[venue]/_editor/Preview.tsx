'use client';
// The customers' real page on an iPhone 17 Pro Max mockup (laptop) or full screen (phone). Two frames are kept: a save loads
// the fresh page into the hidden one, the language and the scroll position (or the item just edited, outlined) are
// set while it is still hidden, then it is faded in. No flash, no jump. The customers' page carries no preview code.
// Style tab (Kian, 2026-10-08): the preview and the colour controls point at each other. The open group's region is outlined
// in the frame (the `region` prop, owned by the editor so both previews show the same outline; a new `n` re-applies it), a tap
// on a region reports it to the editor (onPick kind "region"), and a colour being picked is applied live to the frame's CSS
// variables before it is saved (setVars). All of it is attached by the admin after the frame loads. The controls on the left
// are the master: the frame only ever follows them; it never changes the open group by itself.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { GroupId } from '@/venues/tokens';
import { Icon } from '../../../_ui/icons';

export type Focus = { id: string; alt?: string | null } | null;
export type Region = GroupId;
// What was tapped inside the preview: an item row, a section heading or the page header (Menu tab); a page region (Style tab).
export type Pick = { kind: 'item' | 'section' | 'header'; id?: string } | { kind: 'region'; region: Region };
export type RegionState = { region: Region | null; n: number };
export const NO_REGION: RegionState = { region: null, n: 0 };
export type PreviewHandle = { setVars: (vars: Record<string, string> | null) => void };
// iPhone 17 Pro Max (Kian, 2026-10-07): 6.9-inch class screen of 440 × 956 points, aluminium rail, black bezel, Dynamic Island,
// status bar with the live time, home indicator. The page itself is laid out at 440 points wide, as on the real phone.
const W = 440, H = 956, RAIL = 5, BEZEL = 13, STATUS = 54, EDGE = RAIL + BEZEL, BTN = 4;

export const Preview = forwardRef<PreviewHandle, { venueId: string; reloadKey: number; focus: Focus; lang: 'en' | 'fa'; onLang: (l: 'en' | 'fa') => void; frame: boolean; onClose?: () => void; onPick?: (p: Pick) => void; styleMode?: boolean; region?: RegionState }>(function Preview({ venueId, reloadKey, focus, lang, onLang, frame, onClose, onPick, styleMode = false, region = NO_REGION }, handle) {
  const refA = useRef<HTMLIFrameElement>(null), refB = useRef<HTMLIFrameElement>(null);
  const frames = [refA, refB];
  const [active, setActive] = useState<0 | 1 | null>(null);
  const activeRef = useRef<0 | 1 | null>(null);
  const loadingSlot = useRef<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef(focus); focusRef.current = focus;
  const langRef = useRef(lang); langRef.current = lang;
  const pickRef = useRef(onPick); pickRef.current = onPick;
  const styleModeRef = useRef(styleMode); styleModeRef.current = styleMode;
  const regionRef = useRef(region); regionRef.current = region;
  const scrollRef = useRef(0);
  const isOurs = (d: Document | null | undefined): d is Document => !!d && d.location.pathname === `/${venueId}`;
  const activeDoc = () => { const a = activeRef.current; if (a === null) return null; const d = frames[a].current?.contentDocument; return isOurs(d) ? d : null; };

  useImperativeHandle(handle, () => ({
    setVars: (vars) => { const d = activeDoc(); if (d) applyVars(d, vars); },
  }));
  // The open group's region (or a re-assertion of it): outlined in the loaded frame, scrolled to when out of view.
  useEffect(() => { const d = activeDoc(); if (d) applyRegion(d, region.region, true); }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  // A save (reloadKey) loads the page into the hidden slot.
  useEffect(() => {
    const next = (activeRef.current === null ? 0 : 1 - activeRef.current) as 0 | 1;
    loadingSlot.current = next;
    const cur = activeRef.current === null ? null : frames[activeRef.current].current;
    scrollRef.current = cur?.contentWindow?.scrollY ?? 0;
    setLoading(true);
    const f = frames[next].current; if (f) f.src = `/${venueId}?preview=${reloadKey}.${Date.now()}`;
  }, [venueId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLoad = (slot: 0 | 1) => () => {
    if (slot !== loadingSlot.current) return;
    const d = frames[slot].current?.contentDocument;
    if (!isOurs(d)) return;
    d.documentElement.dataset.intro = 'done'; // the logo intro and the page entrance play on every load for customers; the preview hides both before the frame is shown (see previewStyle)
    applyLang(d, langRef.current);
    if (pickRef.current) attachPick(d, (p) => pickRef.current?.(p), () => styleModeRef.current);
    if (!showFocus(d, focusRef.current)) d.defaultView?.scrollTo({ top: scrollRef.current, behavior: 'auto' });
    if (regionRef.current.region) applyRegion(d, regionRef.current.region, activeRef.current === null); // the first load of this preview (the phone overlay opening) scrolls to the open group's region; a reload after a save keeps its place
    activeRef.current = slot; setActive(slot); setLoading(false);
  };
  useEffect(() => { const a = activeRef.current; if (a === null) return; const d = frames[a].current?.contentDocument; if (isOurs(d)) applyLang(d, lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const toggle = (
    <div className="flex rounded-full bg-black/[.06] p-0.5" role="group" aria-label="Preview language">
      {(['en', 'fa'] as const).map((l) => <button key={l} type="button" onClick={() => onLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${lang === l ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-ink-muted hover:text-ink'}`}>{l === 'en' ? 'EN' : 'FA'}</button>)}
    </div>
  );
  const status = <span className="text-[13px] font-medium text-ink-muted" aria-live="polite">{onPick ? (styleMode ? 'Tap a part of the page to colour it' : 'Tap anything to edit it') : 'Customers see'}{loading && <span className="text-neutral-400"> · updating…</span>}</span>;

  if (!frame) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="glass flex h-11 shrink-0 items-center gap-2 border-b border-line px-2">
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" />Edit</button>
          <span className="flex-1 text-center">{status}</span>
          {toggle}
        </div>
        <div className="relative min-h-0 flex-1">{iframes}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-11 w-full shrink-0 items-center justify-center border-b border-line px-4"><div className="flex w-full max-w-[440px] items-center justify-between">{status}{toggle}</div></div>
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
              <div className="absolute inset-x-0 bottom-0" style={{ top: STATUS }}>
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

// The admin's own style inside the frame: no intro and no page entrance (the frame is shown only once loaded, as the customers
// see the page after the intro), the outline of the item just edited, the hover marks of tap-to-edit, the Style tab's region
// outline and the frozen intro while the Intro group is open.
function previewStyle(d: Document) {
  if (d.getElementById('roses-preview-style')) return;
  const st = d.createElement('style'); st.id = 'roses-preview-style';
  st.textContent = '#intro{display:none!important}main>header,#tabs,main section h2,li.item{animation:none!important}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}.roses-preview-focus{box-shadow:inset 0 0 0 2px #ee6a3a;border-radius:12px;animation:roses-pf 2.6s ease-out forwards}@keyframes roses-pf{75%{box-shadow:inset 0 0 0 2px #ee6a3a}100%{box-shadow:inset 0 0 0 2px transparent}}'
    + '.roses-pick:not(.roses-style) li.item:hover,.roses-pick:not(.roses-style) main section h2:hover,.roses-pick:not(.roses-style) main>header:hover{outline:2px dashed rgba(238,106,58,.55);outline-offset:3px;border-radius:10px;cursor:pointer}'
    + '.roses-style main>header,.roses-style #tabs,.roses-style main section h2,.roses-style main section ul,.roses-style main footer,.roses-style dialog{cursor:pointer}'
    + '.roses-region{outline:3px solid #ee6a3a!important;outline-offset:-3px;border-radius:10px;transition:outline-color .2s}dialog.roses-region{outline-offset:-3px}'
    + 'html.roses-region-page body{box-shadow:inset 0 0 0 3px #ee6a3a;min-height:100dvh}'
    + 'html.roses-show-intro #intro{display:grid!important;animation:none!important;opacity:1!important;visibility:visible!important}html.roses-show-intro #intro>*,html.roses-show-intro #intro img{animation:none!important;opacity:1!important;transform:none!important}';
  d.head.appendChild(st);
}
// Tap-to-edit: one capture-phase click listener on the loaded document. Menu tab: an item row, a section heading or the
// header is reported to the editor and the page's own handler (the item sheet) does not run. Style tab: every tap reports
// the page region it landed on (the page's own handlers do not run), except the language toggle and the popup's close button.
function attachPick(d: Document, onPick: (p: Pick) => void, styleMode: () => boolean) {
  if (d.documentElement.classList.contains('roses-pick')) return;
  d.documentElement.classList.add('roses-pick');
  if (styleMode()) d.documentElement.classList.add('roses-style');
  d.addEventListener('click', (e) => {
    if (d.documentElement.dataset.rosesSynthetic) return; // the admin itself opening the sheet for the Item popup group
    const t = e.target as Element | null; if (!t || typeof t.closest !== 'function') return;
    if (t.closest('#lang-toggle')) return;
    if (styleMode()) {
      if (t.closest('#sheet-close')) { onPick({ kind: 'region', region: 'sheet' }); return; }
      e.preventDefault(); e.stopPropagation(); onPick({ kind: 'region', region: regionOf(t) }); return;
    }
    if (t.closest('#tabs, dialog')) return;
    const li = t.closest('li.item[data-id]'); const h2 = t.closest('main section[data-id] h2'); const header = t.closest('main > header');
    const pick: Pick | null = li ? { kind: 'item', id: li.getAttribute('data-id') ?? undefined } : h2 ? { kind: 'section', id: h2.closest('section')?.getAttribute('data-id') ?? undefined } : header ? { kind: 'header' } : null;
    if (!pick) return;
    e.preventDefault(); e.stopPropagation(); onPick(pick);
  }, true);
}
function regionOf(t: Element): Region {
  if (t.closest('#intro')) return 'intro';
  if (t.closest('dialog#sheet, dialog#sections-dialog')) return 'sheet';
  if (t.closest('#tabs')) return 'tabs';
  if (t.closest('main > header')) return 'header';
  if (t.closest('main footer')) return 'footer';
  if (t.closest('li.item')) return 'rows';
  if (t.closest('main section h2') || t.closest('main section h2 + p')) return 'headings';
  if (t.closest('main section ul')) return 'rows';
  return 'page';
}
// What each region outlines inside the frame. The popup region opens the first item's sheet (and closes it again when another
// region takes over); the intro region shows the logo overlay frozen at its final state.
const REGION_SEL: Record<Region, string> = { page: '', header: 'main > header', tabs: '#tabs', headings: 'main section h2', rows: 'main section ul', sheet: 'dialog#sheet', footer: 'main footer', intro: '#intro' };
function applyRegion(d: Document, region: Region | null, scroll: boolean) {
  previewStyle(d);
  const h = d.documentElement;
  d.querySelectorAll('.roses-region').forEach((el) => el.classList.remove('roses-region'));
  h.classList.toggle('roses-region-page', region === 'page');
  h.classList.toggle('roses-show-intro', region === 'intro');
  const sheet = d.getElementById('sheet') as HTMLDialogElement | null;
  if (region === 'sheet') {
    if (sheet && !sheet.open) { const li = d.querySelector('li.item') as HTMLElement | null; if (li) { h.dataset.rosesSynthetic = '1'; li.click(); delete h.dataset.rosesSynthetic; } }
  } else if (sheet?.open && h.dataset.rosesSheet) sheet.close();
  if (region === 'sheet') h.dataset.rosesSheet = '1'; else delete h.dataset.rosesSheet;
  if (!region) return;
  const els = region === 'sheet' && sheet?.open ? [sheet] : [...d.querySelectorAll(REGION_SEL[region] || 'nothing')];
  els.forEach((el) => el.classList.add('roses-region'));
  const w = d.defaultView; if (!scroll || !w || region === 'page' || region === 'intro' || region === 'sheet' || !els.length) return;
  const visible = els.some((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < w.innerHeight; });
  if (!visible) (els[0] as HTMLElement).scrollIntoView({ block: region === 'footer' ? 'end' : 'start', behavior: 'auto' });
}
// A colour being picked, applied live to the frame's CSS variables (the page's :root values stay in its own <style>); null takes
// every live value away again (a refused colour). The two rules that carry plain values (::backdrop, the close button's shadow)
// are rewritten in a live <style>.
function applyVars(d: Document, vars: Record<string, string> | null) {
  const h = d.documentElement;
  let live = d.getElementById('roses-live-vars') as HTMLStyleElement | null;
  if (!vars) { for (const k of [...h.style].filter((p) => p.startsWith('--c-'))) h.style.removeProperty(k); live?.remove(); return; }
  for (const [k, v] of Object.entries(vars)) h.style.setProperty(k, v);
  const dim = vars['--c-sheet-dim'];
  if (dim) { if (!live) { live = d.createElement('style'); live.id = 'roses-live-vars'; d.head.appendChild(live); } live.textContent = `dialog.sheet::backdrop,dialog.list::backdrop{background:${dim};opacity:.45}.sheet-close{box-shadow:0 1px 4px ${dim}40}`; }
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
