// Senso's spring artwork (Kian's picks of 2026-10-11 from reports/welcome/gallery.html, the spring candidates): S1 cherry blossom,
// S2 almond blossom (شکوفه بادام), S3 white trillium (Ontario's flower), S4 hyacinth floret (سنبل, of the Haft-sin), S5 forsythia and
// S9 rosebud (غنچه). The same drawings as the gallery's (reports/welcome/gallery/art.mjs), built here from plain geometry at render time
// as one SVG <symbol> each (64 × 64), used by the spring engine (src/lib/welcome-bloom.ts). Server only: nothing of this module reaches
// the browser but its output. In src/lib, outside the public stylesheet's sources, so no word here can add a rule to that stylesheet.
//
// A blossom: k petals around the heart, each its own smoothed outline (a half-width profile along its length, mirrored with a little
// jitter, sharp corners at the base, the tip and the cherry's notch), one gradient across the flower from the heart out, a highlight
// per petal (each petal its own light from the top left), veins, stamens with anthers, the heart. The petals are kept in the symbol's
// defs and used twice, so the bare shape is never drawn. The rosebud: a closed bud, two outer petals wrapping it, a spiral at the top,
// five sepals, the hip, a short stem with a thorn. Colours: the named artwork palette (src/venues/tokens.ts ARTWORK); this file holds
// no colour literal. Fixed seeds: every build renders the same blossoms. The same small helpers as src/components/welcome-art.ts.
import { ARTWORK } from '@/venues/tokens';

type Pt = { x: number; y: number; c?: boolean };
type Stop = [number, string, number?];
const f = (n: number) => String(Math.round(n * 10) / 10);
const P = (x: number, y: number, c = false): Pt => ({ x, y, c });
const pol = (cx: number, cy: number, a: number, r: number): Pt => { const t = (a * Math.PI) / 180; return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) }; };
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function smooth(pts: Pt[], tension = 1): string {
  const n = pts.length, at = (i: number) => pts[(i + n) % n];
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1.c ? p1 : { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = p2.c ? p2 : { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}
const stopsOf = (stops: Stop[]) => stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id: string, stops: Stop[], x1 = 0.25, y1 = 0, x2 = 0.75, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`;
const rad = (id: string, stops: Stop[], cx: number, cy: number, r: number) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsOf(stops)}</radialGradient>`;
const radU = (id: string, stops: Stop[], cx: number, cy: number, r: number) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}">${stopsOf(stops)}</radialGradient>`;
const shade = (id: string, dark: string, cx = 0.3, cy = 0.25, r = 0.95, hi = 0.3, lo = 0.48) => rad(id, [[0, ARTWORK.white, hi], [0.45, ARTWORK.white, 0], [1, dark, lo]], cx, cy, r);
const rotP = (p: Pt, a: number, c: Pt): Pt => { const t = (a * Math.PI) / 180, s = Math.sin(t), k = Math.cos(t); return P(c.x + p.x * k - p.y * s, c.y + p.x * s + p.y * k, p.c); };

// Petal outlines (local: the base at the origin, pointing up): [t along the length, fraction of the half-width].
const PROFILES = {
  round: [[0.12, 0.42], [0.35, 0.84], [0.6, 1], [0.82, 0.88], [0.95, 0.52]],
  notch: [[0.14, 0.36], [0.4, 0.8], [0.66, 1], [0.86, 0.94], [0.97, 0.62], [1, 0.26]],
  point: [[0.14, 0.48], [0.38, 0.94], [0.58, 1], [0.78, 0.72], [0.92, 0.32]],
  strap: [[0.1, 0.62], [0.32, 0.96], [0.6, 1], [0.84, 0.9], [0.96, 0.5]],
} as const;
type Shape = keyof typeof PROFILES;
function petalPts(shape: Shape, L: number, W: number, r: () => number, notch = 0.1): Pt[] {
  const h = W / 2, jit = () => (r() - 0.5) * 2 * 0.5, prof = PROFILES[shape];
  const right = prof.map(([t, w]) => P(w * h + jit() * 0.6, -t * L + jit()));
  const left = prof.map(([t, w]) => P(-w * h + jit() * 0.6, -t * L + jit())).reverse();
  const tip = shape === 'notch' ? [P(jit() * 0.3, -L * (1 - notch), true)] : [P(jit() * 0.4, -L, shape === 'point')];
  return [P(0, 0, true), ...right, ...tip, ...left];
}
// k petals around the heart C; the petal paths and their veins (offsets across the petal, base toward the tip).
function flower({ k, shape, L, W, at = 0, off = 2, notch, C, seed, veins = [], vlen = 0.8, jitA = 6, jitS = 0.1 }: { k: number; shape: Shape; L: number; W: number; at?: number; off?: number; notch?: number; C: Pt; seed: number; veins?: number[]; vlen?: number; jitA?: number; jitS?: number }) {
  const r = rng(seed); let paths = '', vd = '';
  for (let i = 0; i < k; i++) {
    const a = at + (360 / k) * i + (r() - 0.5) * 2 * jitA, s = 1 + (r() - 0.5) * 2 * jitS, base = pol(C.x, C.y, a, off);
    paths += `<path d="${smooth(petalPts(shape, L * s, W * s, r, notch).map((p) => rotP(p, a, base)), 1)}"/>`;
    for (const v of veins) { const q = [P(0, -L * s * 0.1), P(v * W * s * 0.16, -L * s * 0.45), P(v * W * s * 0.3, -L * s * vlen)].map((p) => rotP(p, a, base)); vd += `M${f(q[0].x)} ${f(q[0].y)}Q${f(q[1].x)} ${f(q[1].y)} ${f(q[2].x)} ${f(q[2].y)}`; }
  }
  return { paths, vd };
}
const veinPath = (d: string, col: string, op: number, w = 0.4) => (d ? `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>` : '');
function stamens(C: Pt, n: number, r0: number, r1: number, col: string, anther: string, seed: number, { w = 0.4, ar = 0.7, spread = 0.3 } = {}): string {
  const r = rng(seed); let d = '', dots = '';
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + (r() - 0.5) * 22, len = r1 * (1 - spread / 2 + r() * spread), p0 = pol(C.x, C.y, a, r0), p1 = pol(C.x, C.y, a + (r() - 0.5) * 10, len), m = pol(C.x, C.y, a - 5, (r0 + len) / 2);
    d += `M${f(p0.x)} ${f(p0.y)}Q${f(m.x)} ${f(m.y)} ${f(p1.x)} ${f(p1.y)}`; dots += `<circle cx="${f(p1.x)}" cy="${f(p1.y)}" r="${ar}"/>`;
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/><g fill="${anther}">${dots}</g>`;
}
// The petals used twice: the colour with a thin edge, then a highlight per petal.
const petalsUse = (id: string, sub: string, edge: string, so = 0.45, sw = 0.4) => `<use href="#${id}${sub}" fill="url(#${id}${sub}g)" stroke="${edge}" stroke-opacity="${so}" stroke-width="${sw}" stroke-linejoin="round"/><use href="#${id}${sub}" fill="url(#${id}s)"/>`;
const sym = (id: string, inner: string) => `<symbol id="${id}" viewBox="0 0 64 64">${inner}</symbol>`;

function cherry(): string { // S1: five notched petals, pale pink deepening to a pink heart, gold-tipped stamens
  const k = ARTWORK.cherry, C = P(32, 32), fl = flower({ k: 5, shape: 'notch', L: 24, W: 20, at: -8, off: 1.5, notch: 0.12, C, seed: 21, veins: [-0.45, 0, 0.45] });
  return radU('S1pg', [[0, k.g0], [0.16, k.g1], [0.5, k.g2], [1, k.g3]], 32, 32, 27) + shade('S1s', k.dark, 0.35, 0.3, 0.95, 0.3, 0.22)
    + sym('S1', `<defs><g id="S1p">${fl.paths}</g></defs>${petalsUse('S1', 'p', k.edge)}${veinPath(fl.vd, k.vein, 0.28, 0.35)}${stamens(C, 14, 2, 9.5, k.stamen, k.anther, 22, { ar: 0.75 })}<circle cx="32" cy="32" r="2.3" fill="${k.heart}"/>`);
}
function almond(): string { // S2: five round white petals blushing to a red heart, long red stamens with gold anthers
  const k = ARTWORK.almond, C = P(32, 32), fl = flower({ k: 5, shape: 'round', L: 23, W: 22, at: 20, off: 1.5, C, seed: 23, veins: [-0.5, -0.2, 0.2, 0.5], vlen: 0.7 });
  return radU('S2pg', [[0, k.g0], [0.13, k.g1], [0.28, k.g2], [0.52, k.g3], [1, ARTWORK.white]], 32, 32, 26) + shade('S2s', k.dark, 0.32, 0.28, 0.95, 0.35, 0.2)
    + sym('S2', `<defs><g id="S2p">${fl.paths}</g></defs>${petalsUse('S2', 'p', k.edge, 0.6, 0.45)}${veinPath(fl.vd, k.vein, 0.35, 0.35)}${stamens(C, 18, 2.4, 11.5, k.stamen, k.anther, 24, { w: 0.45, ar: 0.8 })}<circle cx="32" cy="32" r="2.6" fill="${k.heart}"/>`);
}
function trillium(): string { // S3: three broad white petals with fine veins, the tips turning pink, three green sepals between them
  const k = ARTWORK.trillium, C = P(32, 33), sep = flower({ k: 3, shape: 'point', L: 26, W: 7.5, at: 60, off: 0, C, seed: 25, jitA: 4 });
  const fl = flower({ k: 3, shape: 'point', L: 27, W: 22, at: 0, off: 1, C, seed: 26, veins: [-0.62, -0.32, 0, 0.32, 0.62], vlen: 0.86, jitA: 4 });
  return radU('S3kg', [[0, k.sepal0], [1, k.sepal1]], 32, 33, 27) + radU('S3pg', [[0, k.g0], [0.22, k.g1], [0.62, ARTWORK.white], [1, k.g3]], 32, 33, 28) + shade('S3s', k.dark, 0.3, 0.28, 0.95, 0.3, 0.24)
    + sym('S3', `<defs><g id="S3k">${sep.paths}</g><g id="S3p">${fl.paths}</g></defs><use href="#S3k" fill="url(#S3kg)" stroke="${k.sepalEdge}" stroke-opacity=".4" stroke-width=".4" stroke-linejoin="round"/>${petalsUse('S3', 'p', k.edge, 0.75, 0.5)}${veinPath(fl.vd, k.vein, 0.6, 0.35)}${stamens(C, 6, 2, 6.5, k.stamen, k.anther, 27, { w: 0.6, ar: 0.95, spread: 0.1 })}<circle cx="32" cy="33" r="2.6" fill="${k.heart}" stroke="${k.heartEdge}" stroke-width=".4"/>`);
}
function hyacinth(): string { // S4: a six-pointed star, violet-blue deepening to the throat, a darker stripe down each petal
  const k = ARTWORK.hyacinth, C = P(32, 32), fl = flower({ k: 6, shape: 'point', L: 22, W: 11.5, at: 0, off: 3, C, seed: 28, veins: [0], vlen: 0.78 });
  return radU('S4pg', [[0, k.g0], [0.22, k.g1], [0.56, k.g2], [1, k.g3]], 32, 32, 26) + shade('S4s', k.dark, 0.3, 0.28, 0.95, 0.32, 0.22)
    + sym('S4', `<defs><g id="S4p">${fl.paths}</g></defs>${petalsUse('S4', 'p', k.edge, 0.4)}${veinPath(fl.vd, k.vein, 0.45, 0.8)}<circle cx="32" cy="32" r="3.8" fill="${k.heart}"/>${stamens(C, 6, 1.4, 3.4, k.stamen, k.anther, 29, { w: 0.5, ar: 0.65, spread: 0.1 })}`);
}
function forsythia(): string { // S5: four long strap petals, a little uneven, gold deepening to amber at the throat
  const k = ARTWORK.forsythia, C = P(32, 32), fl = flower({ k: 4, shape: 'strap', L: 25, W: 11, at: 18, off: 0.8, C, seed: 31, veins: [0], vlen: 0.85, jitA: 12, jitS: 0.12 });
  return radU('S5pg', [[0, k.g0], [0.24, k.g1], [0.6, k.g2], [1, k.g3]], 32, 32, 27) + shade('S5s', k.dark, 0.3, 0.28, 0.95, 0.35, 0.3)
    + sym('S5', `<defs><g id="S5p">${fl.paths}</g></defs>${petalsUse('S5', 'p', k.edge, 0.5)}${veinPath(fl.vd, k.vein, 0.5, 0.5)}<circle cx="32" cy="32" r="2.4" fill="${k.heart}"/>${stamens(C, 2, 0.8, 3.2, k.stamen, k.anther, 32, { w: 0.55, ar: 0.55, spread: 0.05 })}`);
}
function rosebud(): string { // S9: a closed bud in Senso's rose, two outer petals wrapping it, a spiral, five sepals, the hip, a short stem
  const k = ARTWORK.rosebud;
  const bud = smooth([P(32, 7, true), P(37.5, 12), P(41.5, 21), P(41.6, 31), P(37.6, 39), P(32, 42.4), P(26.4, 39), P(22.4, 31), P(22.5, 21), P(26.5, 12)], 1);
  const wrapL = smooth([P(32, 43, true), P(25.5, 39.4), P(21.9, 30), P(22.6, 20), P(26.8, 12.4), P(30.6, 10.2, true), P(29, 17.5), P(28.6, 26.5), P(30.2, 35.5)], 1);
  const wrapR = smooth([P(32, 43, true), P(38.6, 39.6), P(42.1, 31), P(41.7, 22), P(38.6, 14.8), P(34.6, 12.6, true), P(35.8, 20), P(35.6, 29), P(34.2, 37)], 1);
  const sepal = (x0: number, y0: number, x1: number, y1: number, bend: number, w: number) => { const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny), ox = (nx / nl) * w, oy = (ny / nl) * w, mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2; return smooth([P(x0 + ox, y0 + oy), P(mx + ox * 0.55, my + oy * 0.55), P(x1, y1, true), P(mx - ox * 0.55, my - oy * 0.55), P(x0 - ox, y0 - oy)], 1); };
  const sepals = [sepal(29.5, 44, 17.5, 25, -2.5, 2.2), sepal(34.5, 44, 46.5, 27, 2.5, 2.2), sepal(30.5, 45, 25.5, 33.5, -1, 1.8), sepal(33.5, 45, 39, 32, 1, 1.8), sepal(32, 45.5, 32.6, 35.5, 0.4, 1.5)].map((d) => `<path d="${d}"/>`).join('');
  return lin('S9g', [[0, k.tip], [0.45, k.mid], [1, k.base]], 0.4, 0, 0.6, 1) + lin('S9l', [[0, k.wrapL0], [1, k.wrapL1]], 0.3, 0, 0.7, 1) + lin('S9r', [[0, k.wrapR0], [1, k.wrapR1]], 0.3, 0, 0.7, 1) + lin('S9k', [[0, k.sepal0], [1, k.sepal1]], 0.5, 0, 0.5, 1) + rad('S9h', [[0, k.hip0], [1, k.hip1]], 0.4, 0.35, 0.7) + shade('S9s', k.dark, 0.32, 0.25, 0.95, 0.35, 0.35)
    + sym('S9', `<path d="M32 48Q30.6 56 33 63" fill="none" stroke="${k.stem}" stroke-width="2.4" stroke-linecap="round"/><path d="M31.6 54.6l-3.6-1.4 3.2 3.4Z" fill="${k.thorn}"/><path d="${bud}" fill="url(#S9g)"/><path d="${wrapL}" fill="url(#S9l)"/><path d="${wrapR}" fill="url(#S9r)"/><path d="${bud}" fill="url(#S9s)"/><path d="M30.6 10.2Q28.6 22 30.2 35.5M34.6 12.6Q36.2 24 34.2 37" fill="none" stroke="${k.rim}" stroke-opacity=".7" stroke-width=".6" stroke-linecap="round"/><path d="M32 9.6Q34.6 11.6 33.8 14.2Q32.6 16.2 30.8 15" fill="none" stroke="${k.spiral}" stroke-opacity=".35" stroke-width=".5" stroke-linecap="round"/><g fill="url(#S9k)" stroke="${k.sepalEdge}" stroke-opacity=".35" stroke-width=".35">${sepals}</g><ellipse cx="32" cy="45.6" rx="4.6" ry="3.8" fill="url(#S9h)"/>`);
}

// The picked designs, in the gallery's numbering; the engine picks among them at random. `buds`: the designs that fall like a bud.
export const SPRING_DESIGNS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S9'];
export const SPRING_BUDS = ['S9'];
export const springDefs = (): string => cherry() + almond() + trillium() + hyacinth() + forsythia() + rosebud();
