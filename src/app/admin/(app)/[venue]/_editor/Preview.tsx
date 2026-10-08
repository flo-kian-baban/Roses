'use client';
// The customers' real page in a plain phone frame (laptop) or full screen (phone). Two frames are kept: a save loads
// the fresh page into the hidden one, the language and the scroll position (or the item just edited, outlined) are
// set while it is still hidden, then it is faded in. No flash, no jump. The customers' page carries no preview code.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../../_ui/icons';

export type Focus = { id: string; alt?: string | null } | null;
const W = 390, H = 844, BEZEL = 8;

export function Preview({ venueId, reloadKey, focus, lang, onLang, frame, onClose }: { venueId: string; reloadKey: number; focus: Focus; lang: 'en' | 'fa'; onLang: (l: 'en' | 'fa') => void; frame: boolean; onClose?: () => void }) {
  const refA = useRef<HTMLIFrameElement>(null), refB = useRef<HTMLIFrameElement>(null);
  const frames = [refA, refB];
  const [active, setActive] = useState<0 | 1 | null>(null);
  const activeRef = useRef<0 | 1 | null>(null);
  const loadingSlot = useRef<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef(focus); focusRef.current = focus;
  const langRef = useRef(lang); langRef.current = lang;
  const scrollRef = useRef(0);
  const isOurs = (d: Document | null | undefined): d is Document => !!d && d.location.pathname === `/${venueId}`;

  // A save (reloadKey) loads the page into the hidden slot.
  useEffect(() => {
    const next = (activeRef.current === null ? 0 : 1 - activeRef.current) as 0 | 1;
    loadingSlot.current = next;
    const cur = activeRef.current === null ? null : frames[activeRef.current].current;
    scrollRef.current = cur?.contentWindow?.scrollY ?? 0;
    try { localStorage.setItem(`roses-intro-${venueId}`, '1'); } catch { /* storage blocked: the intro plays once */ }
    setLoading(true);
    const f = frames[next].current; if (f) f.src = `/${venueId}?preview=${reloadKey}.${Date.now()}`;
  }, [venueId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLoad = (slot: 0 | 1) => () => {
    if (slot !== loadingSlot.current) return;
    const d = frames[slot].current?.contentDocument;
    if (!isOurs(d)) return;
    applyLang(d, langRef.current);
    if (!showFocus(d, focusRef.current)) d.defaultView?.scrollTo({ top: scrollRef.current, behavior: 'auto' });
    activeRef.current = slot; setActive(slot); setLoading(false);
  };
  useEffect(() => { const a = activeRef.current; if (a === null) return; const d = frames[a].current?.contentDocument; if (isOurs(d)) applyLang(d, lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Laptop: the frame scales down to fit the column (always whole, never cut).
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!frame || !box.current) return;
    const el = box.current;
    const fit = () => { const r = el.getBoundingClientRect(); setScale(Math.max(0.4, Math.min(1, r.height / (H + 2 * BEZEL), r.width / (W + 2 * BEZEL)))); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
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
  const status = <span className="text-[13px] font-medium text-ink-muted" aria-live="polite">Customers see{loading && <span className="text-neutral-400"> · updating…</span>}</span>;

  if (!frame) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="glass flex h-12 shrink-0 items-center gap-2 border-b border-line px-2">
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" />Edit</button>
          <span className="flex-1 text-center">{status}</span>
          {toggle}
        </div>
        <div className="relative min-h-0 flex-1">{iframes}</div>
      </div>
    );
  }
  const outerW = W + 2 * BEZEL, outerH = H + 2 * BEZEL;
  return (
    <div className="flex h-full flex-col items-center px-4 pb-4 pt-3">
      <div className="mb-3 flex w-full max-w-[390px] items-center justify-between">{status}{toggle}</div>
      <div ref={box} className="flex min-h-0 w-full flex-1 items-start justify-center">
        <div style={{ width: outerW * scale, height: outerH * scale }}>
          <div className="phone-frame" style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: 'top left', padding: BEZEL }}>
            <div className="phone-screen relative h-full w-full overflow-hidden bg-white">
              {iframes}
              {active === null && <div className="absolute inset-0 animate-pulse bg-fill" aria-hidden="true" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function applyLang(d: Document, lang: 'en' | 'fa') {
  const h = d.documentElement; h.dataset.lang = lang; h.lang = lang; h.dir = lang === 'fa' ? 'rtl' : 'ltr';
}

// Positions the frame on the element with that id (the item; or the section when the item is hidden) and outlines it briefly. Returns false when neither is on the page.
function showFocus(d: Document, f: Focus): boolean {
  d.querySelectorAll('.roses-preview-focus').forEach((el) => el.classList.remove('roses-preview-focus'));
  if (!f) return false;
  const el = (d.querySelector(`[data-id="${f.id}"]`) ?? (f.alt ? d.querySelector(`[data-id="${f.alt}"]`) : null)) as HTMLElement | null;
  if (!el) return false;
  if (!d.getElementById('roses-preview-style')) {
    const st = d.createElement('style'); st.id = 'roses-preview-style';
    st.textContent = '.roses-preview-focus{box-shadow:inset 0 0 0 2px #ee6a3a;border-radius:12px;animation:roses-pf 2.6s ease-out forwards}@keyframes roses-pf{75%{box-shadow:inset 0 0 0 2px #ee6a3a}100%{box-shadow:inset 0 0 0 2px transparent}}';
    d.head.appendChild(st);
  }
  el.classList.add('roses-preview-focus');
  const w = d.defaultView; if (!w) return true;
  const r = el.getBoundingClientRect();
  w.scrollTo({ top: Math.max(0, w.scrollY + r.top - Math.max(72, (w.innerHeight - r.height) / 2)), behavior: 'auto' });
  return true;
}
