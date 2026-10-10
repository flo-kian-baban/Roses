'use client';
// A bottom sheet with three detents for the Style tab on a phone (Kian, 2026-10-09): the live preview fills the screen above it and
// the controls live inside. Collapsed shows the handle and the header (the preview control bar); half leaves at least 45 % of the
// viewport to the preview (its height is computed from that: 55 % of the viewport less the space above the preview); full covers
// the preview. While a colour is being edited the sheet is capped at half (`max`), so the live colour stays in view. Drag the handle
// (or the header) to the nearest detent, or tap the handle to step to the next one. Transform and opacity are not needed: the
// height animates, 200 ms, none under reduced motion. Touch target (the PM, 2026-10-09): the handle looks 20 px tall and its tap area reaches
// 24 px above the sheet's edge (over the bottom of the preview, which stays visible), so it meets the finger over 44 px without making the
// header taller: on a small phone every pixel of the header comes out of the controls' room at half.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type Detent = 'collapsed' | 'half' | 'full';
const ORDER: Detent[] = ['collapsed', 'half', 'full'];

export function BottomSheet({ detent, onDetent, max = 'full', top, header, children, label }: { detent: Detent; onDetent: (d: Detent) => void; max?: Detent; top: number; header: React.ReactNode; children: React.ReactNode; label: string }) {
  const headRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(0);
  const [headH, setHeadH] = useState(120);
  const drag = useRef<{ y0: number; h0: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null); // the height while the finger is on the handle
  useLayoutEffect(() => {
    const f = () => { setVh(window.innerHeight); if (headRef.current) setHeadH(headRef.current.offsetHeight); };
    f(); window.addEventListener('resize', f); const ro = headRef.current ? new ResizeObserver(f) : null; if (headRef.current) ro!.observe(headRef.current);
    return () => { window.removeEventListener('resize', f); ro?.disconnect(); };
  }, []);
  const heights: Record<Detent, number> = { collapsed: headH, half: Math.max(headH, Math.floor(vh * 0.55 - top)), full: Math.max(headH, vh - top) };
  const allowed = ORDER.slice(0, ORDER.indexOf(max) + 1);
  useEffect(() => { if (!allowed.includes(detent)) onDetent(max); }, [max]); // eslint-disable-line react-hooks/exhaustive-deps
  const height = dragging ?? heights[allowed.includes(detent) ? detent : max];
  const nearest = (h: number) => allowed.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a));
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { y0: e.clientY, h0: height, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onPointerMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const dy = d.y0 - e.clientY; if (Math.abs(dy) > 4) d.moved = true; if (d.moved) setDragging(Math.max(heights.collapsed, Math.min(heights[max], d.h0 + dy))); };
  const onPointerUp = () => { const d = drag.current; drag.current = null; if (!d) return; if (d.moved && dragging != null) onDetent(nearest(dragging)); else onDetent(allowed[(allowed.indexOf(detent) + 1) % allowed.length]); setDragging(null); };
  return (
    <div role="region" aria-label={label} data-style-sheet={detent} className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[20px] bg-white shadow-[0_-8px_30px_-12px_rgba(0,0,0,.25)]"
      style={{ height, transition: dragging == null ? 'height .2s cubic-bezier(.2,.8,.2,1)' : 'none' }}>
      <div ref={headRef} className="shrink-0 touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <button type="button" className="relative flex h-5 w-full items-center justify-center before:absolute before:inset-x-0 before:-top-6 before:bottom-0 before:content-['']" aria-label={`Controls: ${detent}. Tap to ${detent === 'full' || detent === max ? 'collapse' : 'expand'}`} data-style-sheet-handle><span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden="true" /></button>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line" data-style-sheet-body>{children}</div>
    </div>
  );
}
