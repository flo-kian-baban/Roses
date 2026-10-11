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

// ---- spring (2026-10-11): ten candidates S1–S10 for Senso, natural palettes like the leaves. Blossoms S1–S5 (whole flowers,
// each petal its own smoothed outline around the heart, one gradient across the flower from the heart out, a highlight per petal,
// veins, stamens), petals S6–S8 (one petal large, drawn like a leaf blade: base gradient, shading, a soft crease, a curled edge
// on two), buds S9–S10. `motion` names how the gallery's demo moves each (flower: twirls as it falls; petal: flips and floats;
// bud: heavier, drops straighter); `scale` its size against a whole blossom. ----
export const SPRING = [];
const rotP = (p, a, c) => { const t = (a * Math.PI) / 180, s = Math.sin(t), k = Math.cos(t); return P(c.x + p.x * k - p.y * s, c.y + p.x * s + p.y * k, p.c); };
const radU = (id, stops, cx, cy, r) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
// Petal outlines in local coordinates, the base at the origin, pointing up: a half-width profile [t along the length, fraction of
// the half-width], mirrored with a little jitter so no petal is symmetric; `notch` cuts the cherry's notch into the tip, `point`
// and `bud` keep a sharp tip.
const PROFILES = {
  round: [[0.12, 0.42], [0.35, 0.84], [0.6, 1], [0.82, 0.88], [0.95, 0.52]],
  notch: [[0.14, 0.36], [0.4, 0.8], [0.66, 1], [0.86, 0.94], [0.97, 0.62], [1, 0.26]],
  point: [[0.14, 0.48], [0.38, 0.94], [0.58, 1], [0.78, 0.72], [0.92, 0.32]],
  strap: [[0.1, 0.62], [0.32, 0.96], [0.6, 1], [0.84, 0.9], [0.96, 0.5]],
  spoon: [[0.1, 0.34], [0.3, 0.68], [0.55, 0.95], [0.72, 1], [0.86, 0.9], [0.96, 0.56]],
  ovate: [[0.08, 0.52], [0.25, 0.86], [0.5, 1], [0.72, 0.94], [0.88, 0.66], [0.97, 0.28]],
  bud: [[0.06, 0.62], [0.25, 0.96], [0.45, 1], [0.68, 0.84], [0.88, 0.44]],
};
function petalPts(shape, L, W, r, { notch = 0.1, j = 0.5 } = {}) {
  const h = W / 2, jit = () => (r() - 0.5) * 2 * j, prof = PROFILES[shape];
  const right = prof.map(([t, w]) => P(w * h + jit() * 0.6, -t * L + jit()));
  const left = prof.map(([t, w]) => P(-w * h + jit() * 0.6, -t * L + jit())).reverse();
  const tip = shape === 'notch' ? [P(jit() * 0.3, -L * (1 - notch), true)] : [P(jit() * 0.4, -L, shape === 'point' || shape === 'bud')];
  return [P(0, 0, true), ...right, ...tip, ...left];
}
// A whole flower: k petals around the heart C, each turned and a little different in size; returns the petal paths (to be used
// twice: the colour, then the highlight per petal) and its veins (offsets across the petal, from the base toward the tip).
function flower({ k, shape, L, W, at = 0, off = 2, notch, C = { x: 32, y: 32 }, seed, veins = [], vlen = 0.8, jitA = 6, jitS = 0.1 }) {
  const r = rng(seed); let paths = '', vd = '';
  for (let i = 0; i < k; i++) {
    const a = at + (360 / k) * i + (r() - 0.5) * 2 * jitA, s = 1 + (r() - 0.5) * 2 * jitS, base = pol(C.x, C.y, a, off);
    paths += `<path d="${smooth(petalPts(shape, L * s, W * s, r, { notch }).map((p) => rotP(p, a, base)), 1).d}"/>`;
    for (const v of veins) { const q = [P(0, -L * s * 0.1), P(v * W * s * 0.16, -L * s * 0.45), P(v * W * s * 0.3, -L * s * vlen)].map((p) => rotP(p, a, base)); vd += `M${f(q[0].x)} ${f(q[0].y)}Q${f(q[1].x)} ${f(q[1].y)} ${f(q[2].x)} ${f(q[2].y)}`; }
  }
  return { paths, vd };
}
const veinPath = (d, col, op, w = 0.4) => (d ? `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>` : '');
// Stamens: n slightly curved filaments from the heart, each with an anther.
function stamens(C, n, r0, r1, col, anther, seed, { w = 0.4, ar = 0.7, spread = 0.3 } = {}) {
  const r = rng(seed); let d = '', dots = '';
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + (r() - 0.5) * 22, len = r1 * (1 - spread / 2 + r() * spread), p0 = pol(C.x, C.y, a, r0), p1 = pol(C.x, C.y, a + (r() - 0.5) * 10, len), m = pol(C.x, C.y, a - 5, (r0 + len) / 2);
    d += `M${f(p0.x)} ${f(p0.y)}Q${f(m.x)} ${f(m.y)} ${f(p1.x)} ${f(p1.y)}`; dots += `<circle cx="${f(p1.x)}" cy="${f(p1.y)}" r="${ar}"/>`;
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/><g fill="${anther}">${dots}</g>`;
}
// A blossom symbol: the petals (kept in the symbol's defs, so the shape itself is never drawn bare) used for the colour with a
// thin edge, then for a highlight per petal (objectBoundingBox: each petal gets its own light from the top left).
const petalsUse = (id, sub, edge, so = 0.45, sw = 0.4) => `<use href="#${id}${sub}" fill="url(#${id}${sub}g)" stroke="${edge}" stroke-opacity="${so}" stroke-width="${sw}" stroke-linejoin="round"/><use href="#${id}${sub}" fill="url(#${id}s)"/>`;
const addS = (no, name, fa, note, motion, scale, art) => SPRING.push({ no, name, fa, note, motion, scale, ...art });

// ---- S1 cherry blossom: five notched petals, pale pink deepening to a pink heart, yellow-tipped stamens ----
{
  const C = { x: 32, y: 32 }, fl = flower({ k: 5, shape: 'notch', L: 24, W: 20, at: -8, off: 1.5, notch: 0.12, C, seed: 21, veins: [-0.45, 0, 0.45] });
  const defs = radU('S1pg', [[0, '#d94d7a'], [0.16, '#ec84a4'], [0.5, '#f8c4d3'], [1, '#fde9f0']], 32, 32, 27) + shade('S1s', '#a33a62', 0.35, 0.3, 0.95, 0.3, 0.22);
  const symbol = `<symbol id="S1" viewBox="0 0 64 64"><defs><g id="S1p">${fl.paths}</g></defs>${petalsUse('S1', 'p', '#c4527a')}${veinPath(fl.vd, '#cf4f7b', 0.28, 0.35)}${stamens(C, 14, 2, 9.5, '#c8406e', '#f0c040', 22, { ar: 0.75 })}<circle cx="32" cy="32" r="2.3" fill="#b8305e"/></symbol>`;
  addS('S1', 'Cherry blossom', '', 'pale pink, five notched petals, a deep pink heart', 'flower', 1, { defs, symbol });
}
// ---- S2 almond blossom (شکوفه بادام, the first blossom of the Persian spring): five round white petals blushing to a red heart,
// long red stamens with gold anthers ----
{
  const C = { x: 32, y: 32 }, fl = flower({ k: 5, shape: 'round', L: 23, W: 22, at: 20, off: 1.5, C, seed: 23, veins: [-0.5, -0.2, 0.2, 0.5], vlen: 0.7 });
  const defs = radU('S2pg', [[0, '#a81c40'], [0.13, '#d6506e'], [0.28, '#f2b0c2'], [0.52, '#fde9ef'], [1, '#ffffff']], 32, 32, 26) + shade('S2s', '#8a4a5e', 0.32, 0.28, 0.95, 0.35, 0.2);
  const symbol = `<symbol id="S2" viewBox="0 0 64 64"><defs><g id="S2p">${fl.paths}</g></defs>${petalsUse('S2', 'p', '#b47a8c', 0.6, 0.45)}${veinPath(fl.vd, '#d68ea2', 0.35, 0.35)}${stamens(C, 18, 2.4, 11.5, '#b02848', '#e8b048', 24, { w: 0.45, ar: 0.8 })}<circle cx="32" cy="32" r="2.6" fill="#8c1a38"/></symbol>`;
  addS('S2', 'Almond blossom', 'شکوفه بادام', 'white blushing to a red heart, long red stamens', 'flower', 1, { defs, symbol });
}
// ---- S3 white trillium (Ontario's flower): three broad pointed white petals with fine veins, three green sepals between them,
// a pale green heart with yellow stamens; the petal tips just turning pink ----
{
  const C = { x: 32, y: 33 }, sep = flower({ k: 3, shape: 'point', L: 26, W: 7.5, at: 60, off: 0, C, seed: 25, jitA: 4 });
  const fl = flower({ k: 3, shape: 'point', L: 27, W: 22, at: 0, off: 1, C, seed: 26, veins: [-0.62, -0.32, 0, 0.32, 0.62], vlen: 0.86, jitA: 4 });
  const defs = radU('S3kg', [[0, '#3f6a22'], [1, '#86b04e']], 32, 33, 27) + radU('S3pg', [[0, '#dfe8b0'], [0.22, '#f3f6e0'], [0.62, '#ffffff'], [1, '#fbe6ee']], 32, 33, 28) + shade('S3s', '#7a7a5a', 0.3, 0.28, 0.95, 0.3, 0.24);
  const symbol = `<symbol id="S3" viewBox="0 0 64 64"><defs><g id="S3k">${sep.paths}</g><g id="S3p">${fl.paths}</g></defs><use href="#S3k" fill="url(#S3kg)" stroke="#2e5418" stroke-opacity=".4" stroke-width=".4" stroke-linejoin="round"/>${petalsUse('S3', 'p', '#9c977a', 0.75, 0.5)}${veinPath(fl.vd, '#b8b28e', 0.6, 0.35)}${stamens(C, 6, 2, 6.5, '#d4bc3e', '#f0cc3a', 27, { w: 0.6, ar: 0.95, spread: 0.1 })}<circle cx="32" cy="33" r="2.6" fill="#cfe08a" stroke="#8aa04a" stroke-width=".4"/></symbol>`;
  addS('S3', 'White trillium', '', "Ontario's flower: three white petals, green sepals", 'flower', 1.05, { defs, symbol });
}
// ---- S4 hyacinth floret (سنبل, of the Haft-sin): a six-pointed star, violet-blue deepening to the throat, a darker stripe down
// each petal, pale stamens ----
{
  const C = { x: 32, y: 32 }, fl = flower({ k: 6, shape: 'point', L: 22, W: 11.5, at: 0, off: 3, C, seed: 28, veins: [0], vlen: 0.78 });
  const defs = radU('S4pg', [[0, '#2e2270'], [0.22, '#4a3aa0'], [0.56, '#7c6cd4'], [1, '#b8adf0']], 32, 32, 26) + shade('S4s', '#2a1e6a', 0.3, 0.28, 0.95, 0.32, 0.22);
  const symbol = `<symbol id="S4" viewBox="0 0 64 64"><defs><g id="S4p">${fl.paths}</g></defs>${petalsUse('S4', 'p', '#3e3090', 0.4)}${veinPath(fl.vd, '#3a2c8a', 0.45, 0.8)}<circle cx="32" cy="32" r="3.8" fill="#2a1e66"/>${stamens(C, 6, 1.4, 3.4, '#ece6bc', '#f4eec8', 29, { w: 0.5, ar: 0.65, spread: 0.1 })}</symbol>`;
  addS('S4', 'Hyacinth floret', 'سنبل', 'violet-blue star, a dark stripe on each petal', 'flower', 0.85, { defs, symbol });
}
// ---- S5 forsythia: four long strap petals, a little uneven, gold deepening to amber at the throat ----
{
  const C = { x: 32, y: 32 }, fl = flower({ k: 4, shape: 'strap', L: 25, W: 11, at: 18, off: 0.8, C, seed: 31, veins: [0], vlen: 0.85, jitA: 12, jitS: 0.12 });
  const defs = radU('S5pg', [[0, '#cf880c'], [0.24, '#edb01e'], [0.6, '#f8cf34'], [1, '#ffe46c']], 32, 32, 27) + shade('S5s', '#9a6a08', 0.3, 0.28, 0.95, 0.35, 0.3);
  const symbol = `<symbol id="S5" viewBox="0 0 64 64"><defs><g id="S5p">${fl.paths}</g></defs>${petalsUse('S5', 'p', '#a8740c', 0.5)}${veinPath(fl.vd, '#c48a0e', 0.5, 0.5)}<circle cx="32" cy="32" r="2.4" fill="#b0901e"/>${stamens(C, 2, 0.8, 3.2, '#d89a10', '#e0a814', 32, { w: 0.55, ar: 0.55, spread: 0.05 })}</symbol>`;
  addS('S5', 'Forsythia', '', 'bright gold, four long uneven petals', 'flower', 0.95, { defs, symbol });
}
// ---- the single petals, drawn like a leaf blade (base gradient, shading, a patch) but with a softer crease of their own (the
// leaves' shared crease is too strong for a petal) and the outline kept in the symbol's defs ----
function petalSym(id, { d, base, shadeDark, patch, details, shadeAt, crease = 0.06 }) {
  const defs = lin(`${id}g`, base) + shade(`${id}s`, shadeDark, ...(shadeAt ?? [])) + (patch ? rad(`${id}p`, patch.stops, patch.cx, patch.cy, patch.r) : '') + lin(`${id}c`, [[0, '#fff', 0], [0.47, '#fff', crease], [0.53, '#000', crease], [1, '#000', 0]], 0, 0, 1, 0);
  return { defs, symbol: `<symbol id="${id}" viewBox="0 0 64 64"><defs><path id="${id}o" d="${d}"/></defs><use href="#${id}o" fill="url(#${id}g)" stroke="${shadeDark}" stroke-opacity=".3" stroke-width=".4" stroke-linejoin="round"/>${patch ? `<use href="#${id}o" fill="url(#${id}p)"/>` : ''}<use href="#${id}o" fill="url(#${id}s)"/><use href="#${id}o" fill="url(#${id}c)"/>${details}</symbol>` };
}
const onePetal = (shape, L, W, at, base, seed, o) => { const r = rng(seed); const pts = petalPts(shape, L, W, r, o).map((p) => rotP(p, at, base)); return smooth(pts, 1); };
const fan = (base, at, L, W, offs, len = 0.85) => offs.map((v) => [P(0, -L * 0.06), P(v * W * 0.2, -L * 0.45), P(v * W * 0.4, -L * len)].map((p) => rotP(p, at, base))).map((q) => `M${f(q[0].x)} ${f(q[0].y)}Q${f(q[1].x)} ${f(q[1].y)} ${f(q[2].x)} ${f(q[2].y)}`).join('');
// ---- S6 cherry petal: one notched petal, pink at the base fading to blush, a curled edge ----
{
  const base = { x: 33, y: 60 }, at = -6, { d, samples } = onePetal('notch', 50, 40, at, base, 33, { notch: 0.09, j: 0.6 });
  const details = veinPath(fan(base, at, 50, 40, [-0.7, -0.35, 0, 0.35, 0.7]), '#d65a84', 0.3, 0.5) + curl(samples, 34, 50, 2.2, '#fff4f7', '#b04a70', { x: 32, y: 32 });
  addS('S6', 'Cherry petal', '', 'one notched petal, pink at the base, a curled edge', 'petal', 0.62, petalSym('S6', { d, base: [[0, '#fde7ee'], [0.5, '#f9bccd'], [1, '#e46890']], shadeDark: '#9a2c55', details }));
}
// ---- S7 magnolia petal: long and cupped, cream at the tip flushing to purple-pink at the base, its cupped edge showing ----
{
  const base = { x: 32, y: 61 }, at = 5, { d, samples } = onePetal('spoon', 54, 30, at, base, 35, { j: 0.5 });
  const details = veinPath(fan(base, at, 54, 30, [-0.55, -0.2, 0.2, 0.55], 0.9), '#b0608e', 0.2, 0.45) + curl(samples, 17, 36, 2.2, '#fffdfb', '#7a2a5a', { x: 30, y: 36 });
  addS('S7', 'Magnolia petal', '', 'long and cupped, cream flushing to purple-pink, one edge rolled in', 'petal', 0.95, petalSym('S7', { d, base: [[0, '#fffaf6'], [0.4, '#f9e2ec'], [0.75, '#dc8cb8'], [1, '#9c3474']], shadeDark: '#5a1a40', details, shadeAt: [0.3, 0.3, 0.95, 0.32, 0.5] }));
}
// ---- S8 tulip petal (لاله): broad and glossy, scarlet, with the dark heart at the base ringed in gold (داغ لاله of the poems) ----
{
  const base = { x: 32, y: 60 }, at = -3, { d } = onePetal('ovate', 52, 40, at, base, 37, { j: 0.5 });
  const details = veinPath(fan(base, at, 52, 40, [-0.6, -0.3, 0, 0.3, 0.6], 0.88), '#7a0a18', 0.22, 0.45);
  addS('S8', 'Tulip petal', 'لاله', 'scarlet, the dark heart at its base ringed in gold', 'petal', 0.8, petalSym('S8', { d, base: [[0, '#f04a3a'], [0.35, '#e02430'], [0.8, '#c0162c'], [1, '#a8102a']], shadeDark: '#4a0410', shadeAt: [0.3, 0.25, 0.95, 0.38, 0.45], patch: { stops: [[0, '#1a0408', 0.95], [0.5, '#2a0610', 0.88], [0.66, '#f2b632', 0.85], [0.84, '#f2b632', 0.25], [1, '#f2b632', 0]], cx: 0.5, cy: 0.97, r: 0.21 }, details }));
}
// ---- S9 rosebud (غنچه, for the Roses name): a closed bud in Senso's rose, two outer petals wrapping it, five sepals, a short stem ----
{
  const bud = smooth([P(32, 7, true), P(37.5, 12), P(41.5, 21), P(41.6, 31), P(37.6, 39), P(32, 42.4), P(26.4, 39), P(22.4, 31), P(22.5, 21), P(26.5, 12)], 1).d;
  const wrapL = smooth([P(32, 43, true), P(25.5, 39.4), P(21.9, 30), P(22.6, 20), P(26.8, 12.4), P(30.6, 10.2, true), P(29, 17.5), P(28.6, 26.5), P(30.2, 35.5)], 1).d;
  const wrapR = smooth([P(32, 43, true), P(38.6, 39.6), P(42.1, 31), P(41.7, 22), P(38.6, 14.8), P(34.6, 12.6, true), P(35.8, 20), P(35.6, 29), P(34.2, 37)], 1).d;
  const sepal = (x0, y0, x1, y1, bend, w) => { const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny), ox = (nx / nl) * w, oy = (ny / nl) * w, mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2; return smooth([P(x0 + ox, y0 + oy), P(mx + ox * 0.55, my + oy * 0.55), P(x1, y1, true), P(mx - ox * 0.55, my - oy * 0.55), P(x0 - ox, y0 - oy)], 1).d; };
  const sepals = [sepal(29.5, 44, 17.5, 25, -2.5, 2.2), sepal(34.5, 44, 46.5, 27, 2.5, 2.2), sepal(30.5, 45, 25.5, 33.5, -1, 1.8), sepal(33.5, 45, 39, 32, 1, 1.8), sepal(32, 45.5, 32.6, 35.5, 0.4, 1.5)].map((d) => `<path d="${d}"/>`).join('');
  const defs = lin('S9g', [[0, '#f590aa'], [0.45, '#cc3366'], [1, '#98163f']], 0.4, 0, 0.6, 1) + lin('S9l', [[0, '#c42a58'], [1, '#8e1238']], 0.3, 0, 0.7, 1) + lin('S9r', [[0, '#e65a82'], [1, '#b02656']], 0.3, 0, 0.7, 1) + lin('S9k', [[0, '#86b04e'], [1, '#3e6a22']], 0.5, 0, 0.5, 1) + rad('S9h', [[0, '#8cb850'], [1, '#4a7428']], 0.4, 0.35, 0.7) + shade('S9s', '#5a0a26', 0.32, 0.25, 0.95, 0.35, 0.35);
  const symbol = `<symbol id="S9" viewBox="0 0 64 64"><path d="M32 48Q30.6 56 33 63" fill="none" stroke="#4a7428" stroke-width="2.4" stroke-linecap="round"/><path d="M31.6 54.6l-3.6-1.4 3.2 3.4Z" fill="#6a6a2a"/><path d="${bud}" fill="url(#S9g)"/><path d="${wrapL}" fill="url(#S9l)"/><path d="${wrapR}" fill="url(#S9r)"/><path d="${bud}" fill="url(#S9s)"/><path d="M30.6 10.2Q28.6 22 30.2 35.5M34.6 12.6Q36.2 24 34.2 37" fill="none" stroke="#ffc2d2" stroke-opacity=".7" stroke-width=".6" stroke-linecap="round"/><path d="M32 9.6Q34.6 11.6 33.8 14.2Q32.6 16.2 30.8 15" fill="none" stroke="#7e1034" stroke-opacity=".35" stroke-width=".5" stroke-linecap="round"/><g fill="url(#S9k)" stroke="#2e5418" stroke-opacity=".35" stroke-width=".35">${sepals}</g><ellipse cx="32" cy="45.6" rx="4.6" ry="3.8" fill="url(#S9h)"/></symbol>`;
  addS('S9', 'Rosebud', 'غنچه', "a closed bud in Senso's rose, green sepals, a short stem", 'bud', 0.85, { defs, symbol });
}
// ---- S10 cherry buds: a short twig with two plump pink buds (one opening) on green stalks, brown bud scales and a new leaf ----
{
  const r = rng(39), budShape = (L, W) => smooth(petalPts('bud', L, W, r, { j: 0.3 }), 1).d;
  const cup = 'M-3.4 .4Q0 3.8 3.4 .4L2.2-2.2.9-.4 0-2.8-.9-.4-2.2-2.2Z';
  const leafD = smooth(petalPts('point', 15, 7.5, r, { j: 0.3 }).map((p) => rotP(p, 104, { x: 32, y: 44.5 })), 1).d;
  const defs = lin('S10a', [[0, '#fcc4d2'], [0.55, '#f084a2'], [1, '#d8507a']], 0.3, 0, 0.7, 1) + lin('S10b', [[0, '#fde0e8'], [0.5, '#f7aac0'], [1, '#e66a90']], 0.3, 0, 0.7, 1) + lin('S10l', [[0, '#b2d866'], [1, '#5f9a2c']], 0, 0, 1, 0.4) + shade('S10s', '#9a2c55', 0.3, 0.25, 0.95, 0.45, 0.25);
  const bud1D = budShape(16, 12);
  const bud1 = `<g transform="translate(21.5 30) rotate(-28)"><path d="${bud1D}" fill="url(#S10a)"/><path d="${bud1D}" fill="url(#S10s)"/><path d="${cup}" fill="#7f9e3c"/></g>`;
  const bud2D = budShape(19, 15);
  const bud2 = `<g transform="translate(41.5 26.5) rotate(20)"><path d="${bud2D}" fill="url(#S10b)"/><path d="${bud2D}" fill="url(#S10s)"/><path d="M0-18.6Q-2.6-12-1.2-5M.4-18.6Q3.4-11 2.2-4.4" fill="none" stroke="#d8507a" stroke-opacity=".45" stroke-width=".5" stroke-linecap="round"/><path d="${cup}" fill="#7f9e3c" transform="scale(1.15)"/></g>`;
  const symbol = `<symbol id="S10" viewBox="0 0 64 64"><path d="M5 60C13 54.5 21.5 49.5 30 45.2S44 38.6 51 36.4" fill="none" stroke="#6b4630" stroke-width="3.2" stroke-linecap="round"/><path d="M7.4 58C14.6 53 21.6 48.6 29.6 44.2" fill="none" stroke="#a47e5c" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/><path d="M30.2 43.6Q26.6 37 22.4 31.6M31 43.4Q36.6 35 40.8 28.4" fill="none" stroke="#7a9a3a" stroke-width="1.3" stroke-linecap="round"/><path d="${leafD}" fill="url(#S10l)" stroke="#3e6a22" stroke-opacity=".4" stroke-width=".35"/><ellipse cx="30.4" cy="44.6" rx="3.4" ry="2.5" transform="rotate(-30 30.4 44.6)" fill="#8a5a3a"/><ellipse cx="31.6" cy="43.6" rx="2" ry="1.5" transform="rotate(-30 31.6 43.6)" fill="#b07a4e"/>${bud1}${bud2}</symbol>`;
  addS('S10', 'Cherry buds', '', 'two plump pink buds on a twig, one opening, a new leaf', 'bud', 0.9, { defs, symbol });
}
