// Welcome artwork candidates for Senso (Kian's review of 2026-10-09: the leaves were not realistic enough and fell too
// uniformly; the snow close but to be cleaner). Ten fall leaves F1–F10 and ten snowflakes W1–W10, each an SVG <symbol> in a
// 64 × 64 box, all original and built here from plain geometry (no stock, traced or third-party assets).
//
// A leaf: a smoothed outline (Catmull-Rom through hand-placed points → cubic Béziers, sharp corners kept at tips and teeth;
// or a sampled margin with teeth for the serrated species), filled by a base gradient along the blade and a shading gradient
// (a highlight on one side, a shadow on the other, so the blade reads as curved), a turning patch on the two-tone leaves, the
// veins, a petiole, on some a curled edge (the pale underside shows along one margin) and a few brown spots.
// A snowflake: one arm drawn once, reused six times with <use> around a centre plate (six-fold symmetry by construction; round
// caps and joins and a centre plate over the joins keep the geometry clean), plus three soft round flakes for depth.
//
// Styling is by presentation attributes only: a stylesheet class never reaches the content a <use> clones. Snow is drawn in
// currentColor so the venue's "Winter snow" token colours it; the leaves carry their own natural palettes (see the gallery note).
// build.mjs writes the gallery from this module and measures every symbol gzipped.

const f = (n) => String(Math.round(n * 10) / 10);
const P = (x, y, c = false) => ({ x, y, c });
// polar from a centre: angle in degrees clockwise from up
const pol = (cx, cy, a, r) => { const t = (a * Math.PI) / 180; return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) }; };
// mulberry32: deterministic jitter so the same leaf is drawn on every build
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- outline helpers ----
// Catmull-Rom through the points → a closed cubic path; a point flagged c (corner) keeps a sharp tip: both control points of the
// curves meeting there sit on the point. Also returns dense samples along the curve (for curls).
function smooth(pts, tension = 1) {
  const n = pts.length, at = (i) => pts[(i + n) % n];
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1.c ? p1 : { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = p2.c ? p2 : { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    for (let k = 0; k < 8; k++) { const t = k / 8, u = 1 - t; samples.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y }); }
  }
  return { d: d + 'Z', samples };
}
const poly = (pts) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z';
// Mirror a right-half point list (from the apex down to the base) into a full clockwise outline, with a little jitter on the
// left so the two halves never match exactly (no real leaf is symmetric).
function mirror(right, cx, r, jx = 0.9, jy = 0.6) {
  const left = right.slice(1, -1).reverse().map((p) => P(2 * cx - p.x + (r() - 0.5) * 2 * jx, p.y + (r() - 0.5) * 2 * jy, p.c));
  return [...right, ...left];
}
// A simple (unlobed) blade from a half-width profile hw(t) along the midrib, t = 0 at the base, 1 at the apex, with teeth:
// every tooth leans towards the apex; a double-serrate margin (birch, elm) has a smaller second tooth on each; `asym` lowers the
// left half of the base (elm). Returns the polyline outline and the smooth margin samples (for a curl).
function blade({ cx = 32, base = 54, apex = 6, hw, teeth = 0, depth = 1.2, lean = 0.62, dbl = false, asym = 0, wave = 0, waves = 0, bend = 0, r }) {
  const L = base - apex;
  const margin = (t, side) => { // smooth margin point at t on one side (+1 right, −1 left)
    let w = hw(t); if (wave) w += wave * Math.sin(t * waves * Math.PI * 2) * Math.sin(Math.PI * t) ** 0.5;
    const y = base - t * L + (side < 0 ? asym * (1 - t) ** 2 : 0); return { x: cx + bend * Math.sin(Math.PI * t) + side * w, y };
  };
  const side = (s) => {
    const out = [];
    if (!teeth) { for (let i = 0; i <= 40; i++) out.push(margin(i / 40, s)); return out; }
    for (let i = 0; i < teeth; i++) {
      const a = margin(i / teeth, s), b = margin((i + 1) / teeth, s);
      const size = Math.sin(Math.PI * ((i + 0.5) / teeth)) ** 0.45 * depth * (1 + (r() - 0.5) * 0.3);
      const nx = (b.y - a.y) * s, ny = -(b.x - a.x) * s, nl = Math.hypot(nx, ny) || 1; // outward normal of the segment
      out.push(a);
      if (dbl && i > 0 && i < teeth - 1) out.push({ x: a.x + (b.x - a.x) * 0.3 + (nx / nl) * size * 0.45, y: a.y + (b.y - a.y) * 0.3 + (ny / nl) * size * 0.45 });
      out.push({ x: a.x + (b.x - a.x) * lean + (nx / nl) * size, y: a.y + (b.y - a.y) * lean + (ny / nl) * size });
    }
    out.push(margin(1, s));
    return out;
  };
  const right = side(1), left = side(-1).reverse();
  const samples = []; for (let i = 0; i <= 60; i++) samples.push(margin(i / 60, 1)); for (let i = 60; i >= 0; i--) samples.push(margin(i / 60, -1));
  return { d: poly([...right, ...left.slice(1, -1)]), samples, midrib: (t) => ({ x: cx + bend * Math.sin(Math.PI * t), y: base - t * L }), margin };
}
// Profile shapes: t^a (1−t)^b scaled to the half-width; the blade is widest at a / (a + b).
const profile = (W, a, b) => { const tm = a / (a + b), m = tm ** a * (1 - tm) ** b; return (t) => (W / 2) * ((t ** a * (1 - t) ** b) / m); };

// ---- surface helpers ----
// The curled edge: a crescent between the margin (samples i0..i1) and the same stretch pushed inward, filled by the pale underside
// colour, with a fold line along its inner edge.
function curl(samples, i0, i1, depth, under, fold, centre = { x: 32, y: 30 }) {
  const seg = samples.slice(i0, i1 + 1), n = seg.length;
  const push = (p, i, k) => { const dx = p.x - centre.x, dy = p.y - centre.y, l = Math.hypot(dx, dy) || 1; const m = Math.sin((Math.PI * i) / (n - 1)) ** 0.6 * k; return { x: p.x - (dx / l) * m, y: p.y - (dy / l) * m }; };
  const inner = seg.map((p, i) => push(p, i, depth)), deeper = seg.map((p, i) => push(p, i, depth * 1.9));
  const rim = poly([...seg, ...inner.slice().reverse()]), shadow = poly([...inner, ...deeper.slice().reverse()]);
  const line = 'M' + inner.map((p) => `${f(p.x)} ${f(p.y)}`).join('L');
  return `<path d="${shadow}" fill="${fold}" fill-opacity=".28"/><path d="${rim}" fill="${under}" fill-opacity=".92"/><path d="${line}" fill="none" stroke="${fold}" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round"/>`;
}
// Veins of a pinnately lobed leaf: the midrib and one vein into each lobe tip (the right-half tip list, mirrored).
function lobeVeins(cx, top, bottom, tips, { col, w = 0.85, op = 0.45, k = 0.82 } = {}) {
  let d = `M${cx} ${f(bottom)}L${cx} ${f(top)}`;
  for (const [y, dx] of tips) for (const s of [1, -1]) { const y0 = y + 4.5, e = { x: cx + s * dx * k, y: y0 + (y - y0) * k }; d += `M${cx} ${f(y0)}Q${f(cx + s * dx * 0.4)} ${f(y0 - (y0 - y) * 0.25)} ${f(e.x)} ${f(e.y)}`; }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;
}
// Pinnate veins from the midrib to the margin, slightly curved, thinning toward the apex.
function pinnate(mid, margin, n, { from = 0.08, to = 0.86, up = 0.14, inset = 0.9, col, w = 0.8, op = 0.5 } = {}) {
  let d = `M${f(mid(from * 0.5).x)} ${f(mid(from * 0.5).y)}L${f(mid(1).x)} ${f(mid(1).y)}`;
  for (let i = 0; i < n; i++) for (const s of [1, -1]) {
    const t = from + ((to - from) * i) / (n - 1) + (s < 0 ? (to - from) / (2 * n) : 0); if (t > to + 0.02) continue;
    const a = mid(t), e0 = margin(Math.min(t + up, 0.98), s), e = { x: a.x + (e0.x - a.x) * inset, y: a.y + (e0.y - a.y) * inset };
    const c = { x: a.x + (e.x - a.x) * 0.5 - s * 0.6, y: a.y + (e.y - a.y) * 0.5 + 1.2 };
    d += `M${f(a.x)} ${f(a.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;
}
// Palmate veins: from the base point to each lobe tip, with two short branches each.
function palmate(base, tips, { col, w = 0.9, op = 0.5, k = 0.9, branches = true } = {}) {
  let d = '';
  for (const t of tips) {
    const e = { x: base.x + (t.x - base.x) * k, y: base.y + (t.y - base.y) * k };
    const c = { x: base.x + (e.x - base.x) * 0.5 + (t.x - base.x) * 0.06, y: base.y + (e.y - base.y) * 0.5 };
    d += `M${f(base.x)} ${f(base.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
    if (branches) for (const s of [1, -1]) { const q = { x: base.x + (e.x - base.x) * 0.5, y: base.y + (e.y - base.y) * 0.5 }, dx = e.x - base.x, dy = e.y - base.y, l = Math.hypot(dx, dy) || 1; const b = { x: q.x + (dx / l) * 5 + (-dy / l) * s * 4.5, y: q.y + (dy / l) * 5 + (dx / l) * s * 4.5 }; d += `M${f(q.x)} ${f(q.y)}L${f(b.x)} ${f(b.y)}`; }
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;
}
const petiole = (x0, y0, x1, y1, col, w = 1.7) => `<path d="M${f(x0)} ${f(y0)}Q${f((x0 + x1) / 2 + 1.5)} ${f((y0 + y1) / 2)} ${f(x1)} ${f(y1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
const spots = (list) => list.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#spot)"/>`).join('');
// gradients: base along the blade (apex → base, a little diagonal), the shade (highlight top-left, shadow bottom-right), a patch
const lin = (id, stops, x1 = 0.25, y1 = 0, x2 = 0.75, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx, cy, r, color) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${color ? ` style="color:${color}"` : ''}>${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const shade = (id, dark, cx = 0.3, cy = 0.25, r = 0.95, hi = 0.3, lo = 0.48) => rad(id, [[0, '#fff', hi], [0.45, '#fff', 0], [1, dark, lo]], cx, cy, r);

// A leaf symbol: the outline used twice (base gradient, shade gradient) and once more for a patch, then the details.
function leaf(id, { d, base, shadeDark, patch, details, shadeAt }) {
  const defs = lin(`${id}g`, base) + shade(`${id}s`, shadeDark, ...(shadeAt ?? [])) + (patch ? rad(`${id}p`, patch.stops, patch.cx, patch.cy, patch.r) : '');
  const body = `<path id="${id}o" d="${d}"/>`;
  return { defs, symbol: `<symbol id="${id}" viewBox="0 0 64 64">${body}<use href="#${id}o" fill="url(#${id}g)" stroke="${shadeDark}" stroke-opacity=".3" stroke-width=".4" stroke-linejoin="round"/>${patch ? `<use href="#${id}o" fill="url(#${id}p)"/>` : ''}<use href="#${id}o" fill="url(#${id}s)"/><use href="#${id}o" fill="url(#crease)"/>${details}</symbol>` };
}

export const LEAVES = [];
export const FLAKES = [];
const add = (list, no, name, note, art) => list.push({ no, name, note, ...art });

// ---- F1 sugar maple: five lobes, rounded sinuses, a few big teeth, orange turning to red; the left lower lobe curls ----
{
  const r = rng(1), C = { x: 32, y: 40 };
  const right = [[0, 36, 1], [6, 30], [10, 28, 1], [12.5, 25, 1], [17.5, 24.5, 1], [21, 21, 1], [28, 15.5], [35, 20, 1], [38, 18.5, 1], [45, 24, 1], [48, 22.5, 1], [57, 31, 1], [66, 22, 1], [70, 23.5, 1], [78, 19, 1], [91, 13.5], [103, 17, 1], [107, 15.5, 1], [124, 23, 1], [136, 16, 1], [140, 17, 1], [151, 12], [164, 8], [180, 4]].map(([a, rr, c]) => { const p = pol(C.x, C.y, a, rr); return P(p.x, p.y, !!c); });
  const pts = mirror(right, 32, r, 1.2, 0.8);
  const { d, samples } = smooth(pts, 1);
  const base = { x: 32, y: 43 }, tips = [[0, 36], [57, 31], [124, 23], [-57, 31], [-124, 23]].map(([a, rr]) => pol(C.x, C.y, a, rr));
  const details = curl(samples, Math.round(samples.length * 0.63), Math.round(samples.length * 0.72), 3, '#f6c58a', '#8a2a12', { x: 32, y: 34 }) + palmate(base, tips, { col: '#8c2714', op: 0.45 }) + spots([[27, 30, 2.2], [38, 36, 1.6]]) + petiole(32, 44, 30, 62, '#8c3a1c');
  add(LEAVES, 'F1', 'Sugar maple', 'orange turning to red, one lobe curled', leaf('F1', { d, base: [[0, '#f4b43e'], [0.45, '#ec7a2c'], [1, '#c43a1c']], shadeDark: '#7a1e0c', details }));
}
// ---- F2 red oak: long blade, seven bristle-tipped lobes, rust and brown with a gold edge ----
{
  const r = rng(2), cx = 32;
  const R = (y, dx, c) => P(cx + dx, y, c);
  const right = [R(4, 0, 1), R(8, 3), R(10.5, 8.5), R(11.5, 12.5, 1), R(15.5, 9.5), R(20, 4.5), R(22, 9.5), R(23.5, 16.5, 1), R(28.5, 13), R(33, 4.8), R(35, 10), R(36.5, 16, 1), R(41.5, 12.5), R(46, 4.8), R(47.5, 8.5), R(49, 12, 1), R(53, 8), R(56, 2.5), R(58, 0)];
  const pts = mirror(right, cx, r, 1, 0.7);
  const { d, samples } = smooth(pts, 0.9);
  const details = lobeVeins(cx, 7, 58, [[11.5, 12.5], [23.5, 16.5], [36.5, 16], [49, 12]], { col: '#4a1a0a' }) + curl(samples, Math.round(samples.length * 0.1), Math.round(samples.length * 0.18), 2.2, '#e8b878', '#4a1a0a', { x: 32, y: 32 }) + petiole(32, 58, 31, 63, '#5a2a12', 1.6);
  add(LEAVES, 'F2', 'Red oak', 'rust and brown, a gold edge, a curled tip', leaf('F2', { d, base: [[0, '#d98a3a'], [0.35, '#b5461f'], [1, '#7a2c14']], shadeDark: '#3a1208', details, shadeAt: [0.35, 0.2, 0.95, 0.2, 0.45] }));
}
// ---- F3 paper birch: triangular ovate, double-serrate, gold with a green base and brown spots ----
{
  const r = rng(3);
  const b = blade({ base: 50, apex: 6, hw: profile(30, 0.5, 1.7), teeth: 11, depth: 1.7, lean: 0.6, dbl: true, bend: 1.2, r });
  const details = pinnate(b.midrib, b.margin, 8, { from: 0.1, to: 0.8, up: 0.13, inset: 0.92, col: '#9a6a12', op: 0.5 }) + spots([[27, 22, 2], [36, 34, 1.5], [30, 40, 1.2]]) + petiole(32, 50, 33, 62, '#8a5a14');
  add(LEAVES, 'F3', 'Paper birch', 'gold, still green at the base, brown spots', leaf('F3', { d: b.d, base: [[0, '#f5cf4a'], [0.55, '#eab227'], [1, '#d99a1e']], shadeDark: '#7a4a0a', patch: { stops: [[0, '#8fa83a', 0.9], [1, '#8fa83a', 0]], cx: 0.5, cy: 0.9, r: 0.42 }, details }));
}
// ---- F4 trembling aspen: nearly round, finely crenate, bright gold with a blush of orange, a long flat petiole ----
{
  const r = rng(4), C = { x: 32, y: 30 };
  const pts = [];
  for (let i = 0; i < 44; i++) { const a = (i / 44) * 360, bump = i % 2 ? 0.9 : -0.5, rr = (a < 8 || a > 352 ? 23.5 : 21 + (1 - Math.abs(Math.cos((a * Math.PI) / 180))) * 1.2 + bump + (r() - 0.5) * 0.5); const p = pol(C.x, C.y, a, rr); pts.push(P(p.x, p.y, a === 0)); }
  const { d } = smooth(pts, 0.8);
  const mid = (t) => ({ x: 32, y: 52 - t * 45 });
  const margin = (t, s) => ({ x: 32 + s * 21 * Math.sin(Math.PI * t) ** 0.7, y: 52 - t * 45 });
  const details = pinnate(mid, margin, 6, { from: 0.12, to: 0.78, up: 0.16, inset: 0.9, col: '#a8720f', w: 0.8, op: 0.45 }) + spots([[25, 36, 1.8], [38, 24, 1.3]]) + petiole(32, 52, 30, 63, '#a06a16', 1.5);
  add(LEAVES, 'F4', 'Trembling aspen', 'bright gold, a blush of orange at the edge', leaf('F4', { d, base: [[0, '#fbd54a'], [0.6, '#f3b92a'], [1, '#e89a22']], shadeDark: '#9a4a0a', patch: { stops: [[0, '#f28a2c', 0], [0.75, '#f28a2c', 0], [1, '#e8702a', 0.55]], cx: 0.5, cy: 0.5, r: 0.55 }, details }));
}
// ---- F5 American elm: oval, double-serrate, the base lopsided, half turned (yellow over green) ----
{
  const r = rng(5);
  const b = blade({ base: 52, apex: 5, hw: profile(28, 0.8, 1.6), teeth: 12, depth: 1.5, lean: 0.64, dbl: true, asym: 3.5, bend: -1.5, r });
  const details = pinnate(b.midrib, b.margin, 10, { from: 0.08, to: 0.86, up: 0.1, inset: 0.93, col: '#6f6a14', w: 0.7, op: 0.5 }) + petiole(32, 52, 33, 60, '#7a6a1a', 1.5);
  add(LEAVES, 'F5', 'American elm', 'yellow over green, lopsided base', leaf('F5', { d: b.d, base: [[0, '#e9c93a'], [0.5, '#d9b52c'], [1, '#c9a52a']], shadeDark: '#5a4a0a', patch: { stops: [[0, '#8fae3c', 0.95], [0.55, '#9ab23c', 0.6], [1, '#9ab23c', 0]], cx: 0.68, cy: 0.62, r: 0.62 }, details }));
}
// ---- F6 ginkgo: a fan with a central notch and wavy rim, butter yellow with a green heart, forking veins ----
{
  const r = rng(6), S = { x: 32, y: 56 };
  const rim = [];
  for (let a = -60; a <= 60; a += 6) { const w = 35 + Math.sin(a * 0.42) * 1.6 + (r() - 0.5) * 1.2; const rr = Math.abs(a) < 7 ? 29 + Math.abs(a) * 0.5 : w - (Math.abs(a) > 48 ? (Math.abs(a) - 48) * 0.55 : 0); const p = pol(S.x, S.y, a, rr); rim.push(P(p.x, p.y, a === 0)); }
  const pts = [...rim, P(S.x + 3, S.y - 1), P(S.x, S.y, true), P(S.x - 3, S.y - 1)];
  const { d } = smooth(pts, 0.9);
  let v = '';
  for (let a = -54; a <= 54; a += 6) { const p = pol(S.x, S.y - 2, a, 31 - Math.abs(a) * 0.08); const q = pol(S.x, S.y - 2, a + (a % 12 ? 2 : -2), 18); v += `M${f(S.x)} ${f(S.y - 2)}Q${f(q.x)} ${f(q.y)} ${f(p.x)} ${f(p.y)}`; }
  const details = `<path d="${v}" fill="none" stroke="#b08a1c" stroke-opacity=".5" stroke-width=".6" stroke-linecap="round"/>` + petiole(32, 56, 31, 63, '#9a7a1e', 1.4);
  add(LEAVES, 'F6', 'Ginkgo', 'butter yellow fan, green at the heart', leaf('F6', { d, base: [[0, '#f8df6a'], [0.6, '#f2cc3e'], [1, '#e6b52a']], shadeDark: '#8a5a0a', patch: { stops: [[0, '#a7c04a', 0.85], [1, '#a7c04a', 0]], cx: 0.5, cy: 0.92, r: 0.4 }, details, shadeAt: [0.28, 0.3, 0.9, 0.2, 0.35] }));
}
// ---- F7 white oak: rounded lobes and deep rounded sinuses, tan and brown with a red flush ----
{
  const r = rng(7), cx = 32;
  const R = (y, dx) => P(cx + dx, y);
  const right = [R(4, 0), R(7, 4.5), R(10, 8.5), R(13, 10), R(16, 8.5), R(19, 4.5), R(21.5, 9), R(24, 14), R(27, 14.5), R(30, 10), R(32, 4.5), R(34.5, 9.5), R(37, 15), R(40, 15), R(43, 10), R(45, 4.5), R(47, 8), R(49.5, 12), R(52, 11), R(54.5, 6), R(57, 2), R(58, 0)];
  const pts = mirror(right, cx, r, 0.7, 0.5);
  const { d, samples } = smooth(pts, 1);
  const details = lobeVeins(cx, 7, 58, [[13, 10], [25.5, 14.5], [38.5, 15], [50.5, 12]], { col: '#4a2a10' }) + curl(samples, Math.round(samples.length * 0.6), Math.round(samples.length * 0.68), 2.4, '#dcb27a', '#4a2a10', { x: 32, y: 32 }) + petiole(32, 57, 33, 63, '#5a3a18', 1.6);
  add(LEAVES, 'F7', 'White oak', 'tan and brown, a red flush, a curled lobe', leaf('F7', { d, base: [[0, '#c48a44'], [0.5, '#a8632c'], [1, '#7e4a22']], shadeDark: '#3a1c08', patch: { stops: [[0, '#b5402a', 0.5], [1, '#b5402a', 0]], cx: 0.62, cy: 0.3, r: 0.3 }, details }));
}
// ---- F8 sweetgum: a five-pointed star with fine teeth, crimson deepening to wine, orange at the points ----
{
  const r = rng(8), C = { x: 32, y: 36 };
  const spec = [[0, 33, 1], [5, 25], [8.5, 22, 1], [10, 19.5], [13, 17, 1], [18, 13.5], [30, 11.5], [40, 14.5], [52, 19.5, 1], [57, 20.5], [60, 23, 1], [63, 24.5], [72, 30, 1], [84, 20, 1], [89, 18.5], [96, 15, 1], [106, 10.5], [118, 10.5], [126, 15, 1], [134, 19.5, 1], [140, 24, 1], [154, 14], [166, 8], [180, 4.5]];
  const right = spec.map(([a, rr, c]) => { const p = pol(C.x, C.y, a, rr); return P(p.x, p.y, !!c); });
  const pts = mirror(right, 32, r, 1, 0.7);
  const { d } = smooth(pts, 0.9);
  const base = { x: 32, y: 40 }, tips = [[0, 33], [72, 30], [140, 24], [-72, 30], [-140, 24]].map(([a, rr]) => pol(C.x, C.y, a, rr));
  const details = palmate(base, tips, { col: '#4a0a1a', op: 0.45, k: 0.88 }) + spots([[36, 28, 1.6]]) + petiole(32, 40.5, 33, 62, '#5a1a22', 1.6);
  add(LEAVES, 'F8', 'Sweetgum', 'crimson to wine, orange at the points', leaf('F8', { d, base: [[0, '#ef8a2a'], [0.3, '#d8402c'], [1, '#7c1a3a']], shadeDark: '#3a0410', details, shadeAt: [0.32, 0.28, 0.95, 0.2, 0.42] }));
}
// ---- F9 American beech: elliptical with a wavy, finely toothed margin and straight parallel veins, copper and bronze ----
{
  const r = rng(9);
  const b = blade({ base: 52, apex: 5, hw: profile(26, 0.9, 1.35), teeth: 13, depth: 0.9, lean: 0.58, bend: 1, wave: 0.6, waves: 6.5, r });
  const details = pinnate(b.midrib, b.margin, 11, { from: 0.08, to: 0.86, up: 0.09, inset: 0.95, col: '#5a2e0a', w: 0.75, op: 0.55 }) + curl(b.samples, 70, 86, 2.2, '#e8c08a', '#5a2e0a', { x: 32, y: 30 }) + petiole(32, 52, 31, 61, '#6b3a12', 1.4);
  add(LEAVES, 'F9', 'American beech', 'copper and bronze, parallel veins, a curled edge', leaf('F9', { d: b.d, base: [[0, '#d99a3c'], [0.5, '#c27a2a'], [1, '#9a5a1e']], shadeDark: '#4a2208', details }));
}
// ---- F10 sassafras: the mitten (one thumb lobe), smooth margin, salmon orange with yellow at the base ----
{
  const r = rng(10), cx = 30;
  const pts = [P(cx + 1, 6), P(cx + 7, 8.5), P(cx + 11.5, 14), P(cx + 13.5, 22), P(cx + 12.5, 29), P(cx + 11, 33.5), P(cx + 15.5, 35.5), P(cx + 20.5, 40), P(cx + 21, 45.5), P(cx + 16.5, 48), P(cx + 11, 46.5), P(cx + 6, 50), P(cx + 2, 54), P(cx, 55, true), P(cx - 3, 53), P(cx - 7.5, 47), P(cx - 12, 38), P(cx - 13.5, 28), P(cx - 12, 18), P(cx - 8, 10), P(cx - 4, 6.5)];
  const { d, samples } = smooth(pts.map((p) => P(p.x + (r() - 0.5) * 0.6, p.y + (r() - 0.5) * 0.6, p.c)), 1);
  const mid = (t) => ({ x: cx + 0.5 * Math.sin(Math.PI * t), y: 55 - t * 49 });
  const margin = (t, s) => ({ x: cx + s * (12.5 * Math.sin(Math.PI * t) ** 0.75) + (s > 0 && t > 0.2 && t < 0.5 ? 6 * Math.sin(((t - 0.2) / 0.3) * Math.PI) : 0), y: 55 - t * 49 });
  const details = pinnate(mid, margin, 6, { from: 0.1, to: 0.8, up: 0.14, inset: 0.86, col: '#9a3a1a', w: 0.8, op: 0.45 }) + `<path d="M${cx + 2} 40Q${cx + 10} 38 ${cx + 18} 43" fill="none" stroke="#9a3a1a" stroke-opacity=".45" stroke-width=".8" stroke-linecap="round"/>` + curl(samples, 18, 30, 2.4, '#f8d2a0', '#9a3a1a', { x: 30, y: 32 }) + petiole(cx, 55, cx + 3, 63, '#a8481e', 1.6);
  add(LEAVES, 'F10', 'Sassafras', 'the mitten: salmon orange, yellow at the base', leaf('F10', { d, base: [[0, '#ef8a4a'], [0.5, '#e86a3c'], [1, '#f0b84a']], shadeDark: '#8a2a10', details, shadeAt: [0.3, 0.25, 0.95, 0.22, 0.38] }));
}

// ---- snowflakes: one arm (pointing up from the centre at 32,32) reused six times; strokes in currentColor, round caps and
// joins; a centre plate covers the joins. W8–W10 are the soft round flakes for depth. ----
const hex = (cx, cy, r, rot = 0) => poly(Array.from({ length: 6 }, (_, i) => pol(cx, cy, rot + i * 60, r)));
function flake(id, arm, { w = 2, centre = '', plates = '', fill = 'none', cap = 'round' } = {}) {
  const sym = `<symbol id="${id}" viewBox="0 0 64 64"><g id="${id}a" fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round">${arm}</g>${[60, 120, 180, 240, 300].map((a) => `<use href="#${id}a" transform="rotate(${a} 32 32)"/>`).join('')}${plates}${centre}</symbol>`;
  return { defs: '', symbol: sym };
}
// W1 stellar dendrite: a spine with two pairs of 60° branches and a forked tip
add(FLAKES, 'W1', 'Stellar dendrite', 'the classic six-armed star, branched', flake('W1', '<path d="M32 32V7M32 24l-6-3.5M32 24l6-3.5M32 16l-4.5-2.6M32 16l4.5-2.6M32 9l-2.5-1.4M32 9l2.5-1.4"/>', { w: 2, centre: `<path d="${hex(32, 32, 4.2)}" fill="currentColor"/>` }));
// W2 sectored plate: a broad hexagonal plate with ridges and an inner hexagon
add(FLAKES, 'W2', 'Sectored plate', 'a hexagonal plate with six ridges', flake('W2', '<path d="M32 32V10M32 18l-4-2.3M32 18l4-2.3"/>', { w: 1.7, plates: `<path d="${hex(32, 32, 22, 30)}" fill="#fff" fill-opacity=".55" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="${hex(32, 32, 11, 30)}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` }));
// W3 fernlike dendrite: fine, many branches shortening toward the tip
add(FLAKES, 'W3', 'Fernlike dendrite', 'feathery, many fine branches', flake('W3', '<path d="M32 32V5M32 27l-7-4M32 27l7-4M32 22l-6-3.5M32 22l6-3.5M32 17l-5-2.9M32 17l5-2.9M32 12l-3.5-2M32 12l3.5-2M32 8l-2-1.2M32 8l2-1.2"/>', { w: 1.3, centre: `<circle cx="32" cy="32" r="2.6" fill="currentColor"/>` }));
// W4 stellar plate: short arms ending in small hexagonal plates, a hexagon at the heart
add(FLAKES, 'W4', 'Stellar plate', 'six small plates on short arms', flake('W4', `<path d="M32 32V16"/><path d="${hex(32, 11, 5, 30)}" fill="#fff" fill-opacity=".6" stroke-width="1.6"/>`, { w: 1.9, centre: `<path d="${hex(32, 32, 7, 30)}" fill="#fff" fill-opacity=".6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` }));
// W5 needle star: six slim crystal needles (filled rhombi) and a ring
add(FLAKES, 'W5', 'Needle star', 'six slim filled needles', flake('W5', '<path d="M32 32 29.2 20 32 5l2.8 15Z" stroke-width="1"/>', { fill: 'currentColor', w: 1, centre: `<circle cx="32" cy="32" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="32" cy="32" r="1.8" fill="currentColor"/>` }));
// W6 broad branching: thick arms with chevron tips and a hexagon ring
add(FLAKES, 'W6', 'Broad branches', 'thick arms, chevron tips, an open centre', flake('W6', '<path d="M32 32V8M32 20l-6.5-3.8M32 20l6.5-3.8M26 9.6l6-3.4 6 3.4"/>', { w: 2.4, centre: `<path d="${hex(32, 32, 6, 0)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>` }));
// W7 twelve-branched: a long star and a short one turned 30°
add(FLAKES, 'W7', 'Twelve-branched', 'two stars, one turned 30°', flake('W7', '<path d="M32 32V6M32 14l-3.5-2M32 14l3.5-2"/><path d="M32 32 24 18.1M26.5 22.4l-4.2-.7M26.5 22.4l-.7-4.2" transform="rotate(30 32 32)" stroke-width="1.3"/>', { w: 1.8, centre: `<circle cx="32" cy="32" r="3.5" fill="currentColor"/>` }));
// W8 soft plate: a far-away hexagonal plate, barely sharp
FLAKES.push({ no: 'W8', name: 'Soft plate', note: 'a far hexagonal plate for depth', defs: rad('W8g', [[0, 'currentColor', 0.85], [0.6, 'currentColor', 0.55], [1, 'currentColor', 0]], 0.5, 0.5, 0.5, 'var(--c-welcome-snow)'), symbol: `<symbol id="W8" viewBox="0 0 64 64"><path d="${hex(32, 32, 24, 30)}" fill="url(#W8g)"/></symbol>` });
// W9 soft round flake: a round flake out of focus
FLAKES.push({ no: 'W9', name: 'Soft round', note: 'a round flake out of focus', defs: rad('W9g', [[0, 'currentColor', 0.95], [0.45, 'currentColor', 0.6], [1, 'currentColor', 0]], 0.5, 0.5, 0.5, 'var(--c-welcome-snow)'), symbol: `<symbol id="W9" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="url(#W9g)"/></symbol>` });
// W10 soft round with a bright core: nearer, a little sharper
FLAKES.push({ no: 'W10', name: 'Soft core', note: 'a round flake with a bright core', defs: rad('W10g', [[0, '#fff', 1], [0.3, 'currentColor', 0.9], [0.7, 'currentColor', 0.35], [1, 'currentColor', 0]], 0.5, 0.5, 0.5, 'var(--c-welcome-snow)'), symbol: `<symbol id="W10" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="url(#W10g)"/></symbol>` });

// shared: the brown spot gradient
// shared: the brown spot gradient and the crease across the midrib (one half of the blade a touch lighter, the other darker)
export const SHARED_DEFS = rad('spot', [[0, '#5a2d0c', 0.6], [0.6, '#5a2d0c', 0.25], [1, '#5a2d0c', 0]], 0.5, 0.5, 0.5) + lin('crease', [[0, '#fff', 0], [0.47, '#fff', 0.12], [0.53, '#000', 0.13], [1, '#000', 0]], 0, 0, 1, 0);
