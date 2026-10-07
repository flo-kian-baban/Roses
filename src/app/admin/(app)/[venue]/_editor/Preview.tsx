'use client';
// The customers' real page in a plain phone frame (laptop) or full screen (phone). The page is loaded as is; this
// component reaches into the frame after each load to set the language and to scroll to the item or section just
// edited. Nothing of this is in the public HTML: the customers' page carries no preview code.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../_ui/icons';

export type Focus = { id: string; alt?: string | null } | null;

export function Preview({ venueId, reloadKey, focus, lang, onLang, frame, onClose, onShown }: { venueId: string; reloadKey: number; focus: Focus; lang: 'en' | 'fa'; onLang: (l: 'en' | 'fa') => void; frame: boolean; onClose?: () => void; onShown?: (n: number) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef(focus); focusRef.current = focus;
  const langRef = useRef(lang); langRef.current = lang;
  const shownRef = useRef(onShown); shownRef.current = onShown;
  const isOurs = (d: Document | null | undefined): d is Document => !!d && d.location.pathname === `/${venueId}`;

  useEffect(() => {
    const f = ref.current; if (!f) return;
    try { localStorage.setItem(`roses-intro-${venueId}`, '1'); } catch { /* storage blocked: the intro plays once in the frame */ }
    setLoading(true);
    f.src = `/${venueId}?preview=${reloadKey}.${Date.now()}`;
  }, [venueId, reloadKey]);

  const onLoad = () => {
    const d = ref.current?.contentDocument;
    if (!isOurs(d)) return;
    applyLang(d, langRef.current);
    showFocus(d, focusRef.current);
    setLoading(false);
    shownRef.current?.(reloadKey);
  };
  useEffect(() => { const d = ref.current?.contentDocument; if (isOurs(d)) applyLang(d, lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const iframe = <iframe ref={ref} title="Preview of the customers' page" onLoad={onLoad} className="block h-full w-full border-0 bg-white" data-preview-frame={venueId} />;
  const spinner = loading && <span className="pointer-events-none absolute right-3 top-3 h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" aria-label="Loading" />;
  const toggle = (
    <div className="flex rounded-full bg-black/[.06] p-0.5" role="group" aria-label="Preview language">
      {(['en', 'fa'] as const).map((l) => <button key={l} type="button" onClick={() => onLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 text-sm font-semibold ${lang === l ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-ink-muted'}`}>{l === 'en' ? 'EN' : 'FA'}</button>)}
    </div>
  );
  if (!frame) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="glass flex h-12 shrink-0 items-center gap-2 border-b border-line px-2">
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold"><Icon name="back" className="h-5 w-5" />Edit</button>
          <span className="flex-1 text-center text-sm font-medium text-ink-muted">Customers see</span>
          {toggle}
        </div>
        <div className="relative min-h-0 flex-1">{iframe}{spinner}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <div className="flex items-center gap-3"><span className="text-sm font-medium text-ink-muted">Customers see</span>{toggle}</div>
      <div className="phone-frame relative">{iframe}{spinner}</div>
    </div>
  );
}

function applyLang(d: Document, lang: 'en' | 'fa') {
  const h = d.documentElement; h.dataset.lang = lang; h.lang = lang; h.dir = lang === 'fa' ? 'rtl' : 'ltr';
}

// Scrolls the frame to the element with that id (the item; or the section when the item is hidden) and outlines it briefly.
function showFocus(d: Document, f: Focus) {
  d.querySelectorAll('.roses-preview-focus').forEach((el) => el.classList.remove('roses-preview-focus'));
  if (!f) return;
  const el = (d.querySelector(`[data-id="${f.id}"]`) ?? (f.alt ? d.querySelector(`[data-id="${f.alt}"]`) : null)) as HTMLElement | null;
  if (!el) return;
  if (!d.getElementById('roses-preview-style')) {
    const st = d.createElement('style'); st.id = 'roses-preview-style';
    st.textContent = '.roses-preview-focus{box-shadow:inset 0 0 0 3px #ee6a3a;border-radius:12px;animation:roses-pf 2.4s ease-out forwards}@keyframes roses-pf{70%{box-shadow:inset 0 0 0 3px #ee6a3a}100%{box-shadow:inset 0 0 0 3px transparent}}';
    d.head.appendChild(st);
  }
  el.classList.add('roses-preview-focus');
  const w = d.defaultView; if (!w) return;
  const r = el.getBoundingClientRect();
  w.scrollTo({ top: Math.max(0, w.scrollY + r.top - Math.max(64, (w.innerHeight - r.height) / 2)), behavior: 'auto' });
}
