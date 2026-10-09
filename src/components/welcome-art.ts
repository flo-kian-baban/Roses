// Senso's welcome artwork (Kian's picks of 2026-10-09 from the candidates in reports/welcome/gallery.html): five fall leaves,
// F1 sugar maple, F2 red oak, F4 trembling aspen, F8 sweetgum, F9 American beech, and five snowflakes, W1 stellar dendrite,
// W3 fernlike dendrite, W5 needle star, W7 twelve-branched, W10 soft round flake with a bright core. All original: every design
// is built here from plain geometry at render time (this module never reaches the customers' browser; only its output does),
// as one SVG <symbol> in a 64 × 64 box, used with <use> by the scene engine in src/components/Welcome.tsx.
//
// A leaf: a smoothed outline (hand-placed points through Catmull-Rom curves, sharp corners kept at tips and teeth; or a sampled
// margin with leaning teeth for the serrated species), filled by a base gradient along the blade, a shading gradient (a highlight
// on one side, a shadow on the other, so the blade reads as curved) and a crease across the midrib, a turning patch where the
// species has one, veins, a petiole, on three of them a curled edge (the pale underside, the fold's shadow) and on three a few
// brown spots. A snowflake: one arm reused six times around a centre plate (six-fold symmetry by construction, round caps and
// joins), drawn in currentColor so the venue's "Winter snow" token colours it; W10 is a soft round flake for depth.
// Colours: the named artwork palette in src/venues/tokens.ts (the PM, 2026-10-09: the only public file with colour literals; this
// file holds none). Styling inside a symbol is by presentation attributes only: a stylesheet class never reaches the content a
// <use> clones. Jitter comes from a fixed seed, so every build renders the same leaf.
import { ARTWORK } from '@/venues/tokens';
import type { Season } from '@/lib/welcome';

export const ARTWORK_TEMPLATES = ['senso'];
export const usesArtwork = (template: string | null | undefined): boolean => ARTWORK_TEMPLATES.includes(template ?? '');
export type ArtScene = { kind: 'leaves' | 'snow'; designs: string[]; defs: string };

type Pt = { x: number; y: number; c?: boolean };
const f = (n: number) => String(Math.round(n * 10) / 10);
const P = (x: number, y: number, c = false): Pt => ({ x, y, c });
// polar from a centre: angle in degrees clockwise from up
const pol = (cx: number, cy: number, a: number, r: number): Pt => { const t = (a * Math.PI) / 180; return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) }; };
// mulberry32: deterministic jitter
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- outline helpers ----
// Catmull-Rom through the points → a closed cubic path; a point flagged c (corner) keeps a sharp tip. Also returns dense samples.
function smooth(pts: Pt[], tension = 1): { d: string; samples: Pt[] } {
  const n = pts.length, at = (i: number) => pts[(i + n) % n];
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const samples: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1.c ? p1 : { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = p2.c ? p2 : { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    for (let k = 0; k < 8; k++) { const t = k / 8, u = 1 - t; samples.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y }); }
  }
  return { d: d + 'Z', samples };
}
const poly = (pts: Pt[]) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z';
// Mirror a right-half point list (apex down to the base) into a full clockwise outline, with jitter on the left so the halves never match.
function mirror(right: Pt[], cx: number, r: () => number, jx = 0.9, jy = 0.6): Pt[] {
  const left = right.slice(1, -1).reverse().map((p) => P(2 * cx - p.x + (r() - 0.5) * 2 * jx, p.y + (r() - 0.5) * 2 * jy, p.c));
  return [...right, ...left];
}
type Blade = { d: string; samples: Pt[]; midrib: (t: number) => Pt; margin: (t: number, side: number) => Pt };
// A simple (unlobed) blade from a half-width profile hw(t) along the midrib (t = 0 base, 1 apex) with leaning teeth and a wavy margin.
function blade({ cx = 32, base = 54, apex = 6, hw, teeth = 0, depth = 1.2, lean = 0.62, wave = 0, waves = 0, bend = 0, r }: { cx?: number; base?: number; apex?: number; hw: (t: number) => number; teeth?: number; depth?: number; lean?: number; wave?: number; waves?: number; bend?: number; r: () => number }): Blade {
  const L = base - apex;
  const margin = (t: number, side: number): Pt => { let w = hw(t); if (wave) w += wave * Math.sin(t * waves * Math.PI * 2) * Math.sin(Math.PI * t) ** 0.5; return { x: cx + bend * Math.sin(Math.PI * t) + side * w, y: base - t * L }; };
  const side = (s: number): Pt[] => {
    const o: Pt[] = [];
    if (!teeth) { for (let i = 0; i <= 40; i++) o.push(margin(i / 40, s)); return o; }
    for (let i = 0; i < teeth; i++) {
      const a = margin(i / teeth, s), b = margin((i + 1) / teeth, s);
      const size = Math.sin(Math.PI * ((i + 0.5) / teeth)) ** 0.45 * depth * (1 + (r() - 0.5) * 0.3);
      const nx = (b.y - a.y) * s, ny = -(b.x - a.x) * s, nl = Math.hypot(nx, ny) || 1;
      o.push(a, { x: a.x + (b.x - a.x) * lean + (nx / nl) * size, y: a.y + (b.y - a.y) * lean + (ny / nl) * size });
    }
    o.push(margin(1, s));
    return o;
  };
  const right = side(1), left = side(-1).reverse();
  const samples: Pt[] = []; for (let i = 0; i <= 60; i++) samples.push(margin(i / 60, 1)); for (let i = 60; i >= 0; i--) samples.push(margin(i / 60, -1));
  return { d: poly([...right, ...left.slice(1, -1)]), samples, midrib: (t) => ({ x: cx + bend * Math.sin(Math.PI * t), y: base - t * L }), margin };
}
const profile = (W: number, a: number, b: number) => { const tm = a / (a + b), m = tm ** a * (1 - tm) ** b; return (t: number) => (W / 2) * ((t ** a * (1 - t) ** b) / m); };

// ---- surface helpers ----
// The curled edge: the pale underside between the margin (samples i0..i1) and the same stretch pushed toward the blade's centre,
// the fold's shadow on the blade behind it, and the fold line.
function curl(samples: Pt[], i0: number, i1: number, depth: number, under: string, fold: string, centre: Pt): string {
  const seg = samples.slice(i0, i1 + 1), n = seg.length;
  const push = (p: Pt, i: number, k: number): Pt => { const dx = p.x - centre.x, dy = p.y - centre.y, l = Math.hypot(dx, dy) || 1; const m = Math.sin((Math.PI * i) / (n - 1)) ** 0.6 * k; return { x: p.x - (dx / l) * m, y: p.y - (dy / l) * m }; };
  const inner = seg.map((p, i) => push(p, i, depth)), deeper = seg.map((p, i) => push(p, i, depth * 1.9));
  const rim = poly([...seg, ...inner.slice().reverse()]), shadow = poly([...inner, ...deeper.slice().reverse()]);
  const line = 'M' + inner.map((p) => `${f(p.x)} ${f(p.y)}`).join('L');
  return `<path d="${shadow}" fill="${fold}" fill-opacity=".28"/><path d="${rim}" fill="${under}" fill-opacity=".92"/><path d="${line}" fill="none" stroke="${fold}" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round"/>`;
}
const stroked = (d: string, col: string, w: number, op: number) => `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;
// Pinnate veins from the midrib to the margin, slightly curved.
function pinnate(mid: (t: number) => Pt, margin: (t: number, s: number) => Pt, n: number, { from = 0.08, to = 0.86, up = 0.14, inset = 0.9, col, w = 0.8, op = 0.5 }: { from?: number; to?: number; up?: number; inset?: number; col: string; w?: number; op?: number }): string {
  let d = `M${f(mid(from * 0.5).x)} ${f(mid(from * 0.5).y)}L${f(mid(1).x)} ${f(mid(1).y)}`;
  for (let i = 0; i < n; i++) for (const s of [1, -1]) {
    const t = from + ((to - from) * i) / (n - 1) + (s < 0 ? (to - from) / (2 * n) : 0); if (t > to + 0.02) continue;
    const a = mid(t), e0 = margin(Math.min(t + up, 0.98), s), e = { x: a.x + (e0.x - a.x) * inset, y: a.y + (e0.y - a.y) * inset };
    const c = { x: a.x + (e.x - a.x) * 0.5 - s * 0.6, y: a.y + (e.y - a.y) * 0.5 + 1.2 };
    d += `M${f(a.x)} ${f(a.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
  }
  return stroked(d, col, w, op);
}
// Veins of a pinnately lobed leaf: the midrib and one vein into each lobe tip (the right-half tips, mirrored).
function lobeVeins(cx: number, top: number, bottom: number, tips: [number, number][], col: string, k = 0.82): string {
  let d = `M${cx} ${f(bottom)}L${cx} ${f(top)}`;
  for (const [y, dx] of tips) for (const s of [1, -1]) { const y0 = y + 4.5, e = { x: cx + s * dx * k, y: y0 + (y - y0) * k }; d += `M${cx} ${f(y0)}Q${f(cx + s * dx * 0.4)} ${f(y0 - (y0 - y) * 0.25)} ${f(e.x)} ${f(e.y)}`; }
  return stroked(d, col, 0.85, 0.45);
}
// Palmate veins: from the base point to each lobe tip, with two short branches each.
function palmate(base: Pt, tips: Pt[], col: string, k = 0.9): string {
  let d = '';
  for (const t of tips) {
    const e = { x: base.x + (t.x - base.x) * k, y: base.y + (t.y - base.y) * k };
    const c = { x: base.x + (e.x - base.x) * 0.5 + (t.x - base.x) * 0.06, y: base.y + (e.y - base.y) * 0.5 };
    d += `M${f(base.x)} ${f(base.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
    for (const s of [1, -1]) { const q = { x: base.x + (e.x - base.x) * 0.5, y: base.y + (e.y - base.y) * 0.5 }, dx = e.x - base.x, dy = e.y - base.y, l = Math.hypot(dx, dy) || 1; const b = { x: q.x + (dx / l) * 5 + (-dy / l) * s * 4.5, y: q.y + (dy / l) * 5 + (dx / l) * s * 4.5 }; d += `M${f(q.x)} ${f(q.y)}L${f(b.x)} ${f(b.y)}`; }
  }
  return stroked(d, col, 0.9, 0.45);
}
const petiole = (x0: number, y0: number, x1: number, y1: number, col: string, w = 1.7) => `<path d="M${f(x0)} ${f(y0)}Q${f((x0 + x1) / 2 + 1.5)} ${f((y0 + y1) / 2)} ${f(x1)} ${f(y1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
const spots = (list: [number, number, number][]) => list.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#spot)"/>`).join('');
type Stop = [number, string, number?];
const stopsOf = (stops: Stop[]) => stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id: string, stops: Stop[], x1 = 0.25, y1 = 0, x2 = 0.75, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`;
const rad = (id: string, stops: Stop[], cx: number, cy: number, r: number, style = '') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${style ? ` style="${style}"` : ''}>${stopsOf(stops)}</radialGradient>`;
const shade = (id: string, dark: string, cx = 0.3, cy = 0.25, r = 0.95, hi = 0.3, lo = 0.48) => rad(id, [[0, ARTWORK.white, hi], [0.45, ARTWORK.white, 0], [1, dark, lo]], cx, cy, r);
// A leaf symbol: the outline used for the base gradient, the shade, the crease and an optional patch, then the details.
function leaf(id: string, { d, base, dark, patch, details, shadeAt }: { d: string; base: Stop[]; dark: string; patch?: { stops: Stop[]; cx: number; cy: number; r: number }; details: string; shadeAt?: [number, number, number, number, number] }): string {
  const defs = lin(`${id}g`, base) + shade(`${id}s`, dark, ...(shadeAt ?? [])) + (patch ? rad(`${id}p`, patch.stops, patch.cx, patch.cy, patch.r) : '');
  return `${defs}<symbol id="${id}" viewBox="0 0 64 64"><path id="${id}o" d="${d}"/><use href="#${id}o" fill="url(#${id}g)" stroke="${dark}" stroke-opacity=".3" stroke-width=".4" stroke-linejoin="round"/>${patch ? `<use href="#${id}o" fill="url(#${id}p)"/>` : ''}<use href="#${id}o" fill="url(#${id}s)"/><use href="#${id}o" fill="url(#crease)"/>${details}</symbol>`;
}
// shared: the brown spot gradient and the crease across the midrib (one half of the blade a touch lighter, the other darker)
const SHARED = rad('spot', [[0, ARTWORK.spot, 0.6], [0.6, ARTWORK.spot, 0.25], [1, ARTWORK.spot, 0]], 0.5, 0.5, 0.5) + lin('crease', [[0, ARTWORK.white, 0], [0.47, ARTWORK.white, 0.12], [0.53, ARTWORK.black, 0.13], [1, ARTWORK.black, 0]], 0, 0, 1, 0);

// ---- the five leaves ----
function sugarMaple(): string { // F1: five lobes, rounded sinuses, a few big teeth, orange turning to red; the left lower lobe curls
  const r = rng(1), C = { x: 32, y: 40 }, k = ARTWORK.maple;
  const spec: [number, number, number?][] = [[0, 36, 1], [6, 30], [10, 28, 1], [12.5, 25, 1], [17.5, 24.5, 1], [21, 21, 1], [28, 15.5], [35, 20, 1], [38, 18.5, 1], [45, 24, 1], [48, 22.5, 1], [57, 31, 1], [66, 22, 1], [70, 23.5, 1], [78, 19, 1], [91, 13.5], [103, 17, 1], [107, 15.5, 1], [124, 23, 1], [136, 16, 1], [140, 17, 1], [151, 12], [164, 8], [180, 4]];
  const right = spec.map(([a, rr, c]) => { const p = pol(C.x, C.y, a, rr); return P(p.x, p.y, !!c); });
  const { d, samples } = smooth(mirror(right, 32, r, 1.2, 0.8), 1);
  const tips = ([[0, 36], [57, 31], [124, 23], [-57, 31], [-124, 23]] as [number, number][]).map(([a, rr]) => pol(C.x, C.y, a, rr));
  const details = curl(samples, Math.round(samples.length * 0.63), Math.round(samples.length * 0.72), 3, k.under, k.fold, { x: 32, y: 34 }) + palmate({ x: 32, y: 43 }, tips, k.vein) + spots([[27, 30, 2.2], [38, 36, 1.6]]) + petiole(32, 44, 30, 62, k.stem);
  return leaf('F1', { d, base: [[0, k.tip], [0.45, k.mid], [1, k.base]], dark: k.dark, details });
}
function redOak(): string { // F2: a long blade, seven bristle-tipped lobes pointing up and out, rust and brown with a gold edge, a curled tip
  const r = rng(2), cx = 32, k = ARTWORK.redOak;
  const R = (y: number, dx: number, c?: number) => P(cx + dx, y, !!c);
  const right = [R(4, 0, 1), R(8, 3), R(10.5, 8.5), R(11.5, 12.5, 1), R(15.5, 9.5), R(20, 4.5), R(22, 9.5), R(23.5, 16.5, 1), R(28.5, 13), R(33, 4.8), R(35, 10), R(36.5, 16, 1), R(41.5, 12.5), R(46, 4.8), R(47.5, 8.5), R(49, 12, 1), R(53, 8), R(56, 2.5), R(58, 0)];
  const { d, samples } = smooth(mirror(right, cx, r, 1, 0.7), 0.9);
  const details = lobeVeins(cx, 7, 58, [[11.5, 12.5], [23.5, 16.5], [36.5, 16], [49, 12]], k.vein) + curl(samples, Math.round(samples.length * 0.1), Math.round(samples.length * 0.18), 2.2, k.under, k.fold, { x: 32, y: 32 }) + petiole(32, 58, 31, 63, k.stem, 1.6);
  return leaf('F2', { d, base: [[0, k.tip], [0.35, k.mid], [1, k.base]], dark: k.dark, details, shadeAt: [0.35, 0.2, 0.95, 0.2, 0.45] });
}
function aspen(): string { // F4: nearly round, finely crenate, bright gold with a blush of orange at the edge, a long flat petiole
  const r = rng(4), C = { x: 32, y: 30 }, k = ARTWORK.aspen;
  const pts: Pt[] = [];
  for (let i = 0; i < 44; i++) { const a = (i / 44) * 360, bump = i % 2 ? 0.9 : -0.5, rr = a < 8 || a > 352 ? 23.5 : 21 + (1 - Math.abs(Math.cos((a * Math.PI) / 180))) * 1.2 + bump + (r() - 0.5) * 0.5; const p = pol(C.x, C.y, a, rr); pts.push(P(p.x, p.y, a === 0)); }
  const { d } = smooth(pts, 0.8);
  const mid = (t: number): Pt => ({ x: 32, y: 52 - t * 45 }), margin = (t: number, s: number): Pt => ({ x: 32 + s * 21 * Math.sin(Math.PI * t) ** 0.7, y: 52 - t * 45 });
  const details = pinnate(mid, margin, 6, { from: 0.12, to: 0.78, up: 0.16, inset: 0.9, col: k.vein, w: 0.8, op: 0.45 }) + spots([[25, 36, 1.8], [38, 24, 1.3]]) + petiole(32, 52, 30, 63, k.stem, 1.5);
  return leaf('F4', { d, base: [[0, k.tip], [0.6, k.mid], [1, k.base]], dark: k.dark, patch: { stops: [[0, k.blush, 0], [0.75, k.blush, 0], [1, k.blushEdge, 0.55]], cx: 0.5, cy: 0.5, r: 0.55 }, details });
}
function sweetgum(): string { // F8: a five-pointed star with teeth along the points, crimson deepening to wine, orange at the tips
  const r = rng(8), C = { x: 32, y: 36 }, k = ARTWORK.sweetgum;
  const spec: [number, number, number?][] = [[0, 33, 1], [5, 25], [8.5, 22, 1], [10, 19.5], [13, 17, 1], [18, 13.5], [30, 11.5], [40, 14.5], [52, 19.5, 1], [57, 20.5], [60, 23, 1], [63, 24.5], [72, 30, 1], [84, 20, 1], [89, 18.5], [96, 15, 1], [106, 10.5], [118, 10.5], [126, 15, 1], [134, 19.5, 1], [140, 24, 1], [154, 14], [166, 8], [180, 4.5]];
  const right = spec.map(([a, rr, c]) => { const p = pol(C.x, C.y, a, rr); return P(p.x, p.y, !!c); });
  const { d } = smooth(mirror(right, 32, r, 1, 0.7), 0.9);
  const tips = ([[0, 33], [72, 30], [140, 24], [-72, 30], [-140, 24]] as [number, number][]).map(([a, rr]) => pol(C.x, C.y, a, rr));
  const details = palmate({ x: 32, y: 40 }, tips, k.vein, 0.88) + spots([[36, 28, 1.6]]) + petiole(32, 40.5, 33, 62, k.stem, 1.6);
  return leaf('F8', { d, base: [[0, k.tip], [0.3, k.mid], [1, k.base]], dark: k.dark, details, shadeAt: [0.32, 0.28, 0.95, 0.2, 0.42] });
}
function beech(): string { // F9: elliptical with a wavy, finely toothed margin and straight parallel veins, copper and bronze, a curled edge
  const r = rng(9), k = ARTWORK.beech;
  const b = blade({ base: 52, apex: 5, hw: profile(26, 0.9, 1.35), teeth: 13, depth: 0.9, lean: 0.58, bend: 1, wave: 0.6, waves: 6.5, r });
  const details = pinnate(b.midrib, b.margin, 11, { from: 0.08, to: 0.86, up: 0.09, inset: 0.95, col: k.vein, w: 0.75, op: 0.55 }) + curl(b.samples, 70, 86, 2.2, k.under, k.fold, { x: 32, y: 30 }) + petiole(32, 52, 31, 61, k.stem, 1.4);
  return leaf('F9', { d: b.d, base: [[0, k.tip], [0.5, k.mid], [1, k.base]], dark: k.dark, details });
}

// ---- the five snowflakes: one arm pointing up from the centre (32, 32), reused six times; strokes in currentColor ----
const hexagon = (cx: number, cy: number, r: number, rot = 0) => poly(Array.from({ length: 6 }, (_, i) => pol(cx, cy, rot + i * 60, r)));
function flake(id: string, arm: string, { w = 2, centre = '', fill = 'none' }: { w?: number; centre?: string; fill?: string } = {}): string {
  return `<symbol id="${id}" viewBox="0 0 64 64"><g id="${id}a" fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${arm}</g>${[60, 120, 180, 240, 300].map((a) => `<use href="#${id}a" transform="rotate(${a} 32 32)"/>`).join('')}${centre}</symbol>`;
}
const W1 = () => flake('W1', '<path d="M32 32V7M32 24l-6-3.5M32 24l6-3.5M32 16l-4.5-2.6M32 16l4.5-2.6M32 9l-2.5-1.4M32 9l2.5-1.4"/>', { w: 2, centre: `<path d="${hexagon(32, 32, 4.2)}" fill="currentColor"/>` }); // stellar dendrite
const W3 = () => flake('W3', '<path d="M32 32V5M32 27l-7-4M32 27l7-4M32 22l-6-3.5M32 22l6-3.5M32 17l-5-2.9M32 17l5-2.9M32 12l-3.5-2M32 12l3.5-2M32 8l-2-1.2M32 8l2-1.2"/>', { w: 1.3, centre: '<circle cx="32" cy="32" r="2.6" fill="currentColor"/>' }); // fernlike dendrite
const W5 = () => flake('W5', '<path d="M32 32 29.2 20 32 5l2.8 15Z" stroke-width="1"/>', { fill: 'currentColor', w: 1, centre: '<circle cx="32" cy="32" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="32" cy="32" r="1.8" fill="currentColor"/>' }); // needle star
const W7 = () => flake('W7', '<path d="M32 32V6M32 14l-3.5-2M32 14l3.5-2"/><path d="M32 32 24 18.1M26.5 22.4l-4.2-.7M26.5 22.4l-.7-4.2" transform="rotate(30 32 32)" stroke-width="1.3"/>', { w: 1.8, centre: '<circle cx="32" cy="32" r="3.5" fill="currentColor"/>' }); // twelve-branched
// W10 soft round flake with a bright core: its gradient reads its colour from its own element, the Winter snow token
const W10 = () => rad('W10g', [[0, ARTWORK.white, 1], [0.3, 'currentColor', 0.9], [0.7, 'currentColor', 0.35], [1, 'currentColor', 0]], 0.5, 0.5, 0.5, 'color:var(--c-welcome-snow)') + '<symbol id="W10" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="url(#W10g)"/></symbol>';

// Built once per process; the markup is the same on every build (fixed seeds).
export const ART_SCENES: Partial<Record<Season, ArtScene>> = {
  fall: { kind: 'leaves', designs: ['F1', 'F2', 'F4', 'F8', 'F9'], defs: SHARED + sugarMaple() + redOak() + aspen() + sweetgum() + beech() },
  winter: { kind: 'snow', designs: ['W1', 'W3', 'W5', 'W7', 'W10'], defs: W1() + W3() + W5() + W7() + W10() },
};
export const artScene = (season: Season, art: boolean): ArtScene | undefined => (art ? ART_SCENES[season] : undefined);
