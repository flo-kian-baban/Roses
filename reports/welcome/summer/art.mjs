// Summer welcome candidates for Senso (Kian, 2026-10-10: the summer scene of 2026-10-09, soft blurred orbs of light, is not
// liked; the other seasons are). Six whole-scene concepts, S1–S6, each built from the symbols below and shown behind a replica
// of Senso's welcome card by build.mjs. Every symbol is original, built here from plain geometry (no stock, traced or
// third-party assets), crisp: no blur filter and no soft glow anywhere.
//
//   S1 Dandelion seeds (قاصدک: in Persian a dandelion seed is the bringer of good news) carried across on a breeze;
//   S2 Butterflies: four North American summer species, wings flapping in 3D on a wandering flight;
//   S3 Summer fruit: orange, lemon and lime wheels, cherries, strawberries, a watermelon wedge and mint, tumbling down;
//   S4 Sparkling lemonade: bubbles rising and wobbling, with a few lemon wheels and mint leaves;
//   S5 Persian sun (خورشید): an ornamental sun of straight and flame rays in a top corner, turning slowly, with twinkles;
//   S6 Rose petals (for the Roses name): red, pink and blush petals, some curled, tumbling down.
//
// Styling is by presentation attributes only: a stylesheet class never reaches the content a <use> clones (Chromium). Each
// symbol's gradients carry its own id prefix. The colours are natural palettes for the gallery; a picked design's palette moves
// into src/venues/tokens.ts (ARTWORK) when it is built, like the fall leaves.

const f = (n) => String(Math.round(n * 10) / 10);
const P = (x, y, c = false) => ({ x, y, c });
// polar from a centre: angle in degrees clockwise from up
const pol = (cx, cy, a, r) => { const t = (a * Math.PI) / 180; return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) }; };
const pt = (p) => `${f(p.x)} ${f(p.y)}`;
// mulberry32: deterministic jitter, so the same design is drawn on every build
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Catmull-Rom through the points → a closed cubic path; a point flagged c keeps a sharp corner. Also dense samples along it.
function smooth(pts, tension = 1) {
  const n = pts.length, at = (i) => pts[(i + n) % n];
  let d = `M${pt(pts[0])}`; const samples = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = p1.c ? p1 : { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = p2.c ? p2 : { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
    for (let k = 0; k < 8; k++) { const t = k / 8, u = 1 - t; samples.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y }); }
  }
  return { d: d + 'Z', samples };
}
const lin = (id, x1, y1, x2, y2, stops) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, cx, cy, r, stops, extra = '') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${extra}>${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const sym = (id, vb, body) => `<symbol id="${id}" viewBox="${vb}">${body}</symbol>`;
// a quadratic's point and direction (degrees clockwise from up) at t
const qAt = (a, c, e, t) => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * e.x, y: u * u * a.y + 2 * u * t * c.y + t * t * e.y }; };
const qDir = (a, c, e, t) => { const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (e.x - c.x), dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (e.y - c.y); return (Math.atan2(dx, -dy) * 180) / Math.PI; };

// ---------------------------------------------------------------- S1 dandelion seeds
// A seed (achene) with its beak and the pappus: fine filaments radiating like an umbrella from the beak's tip, the outer ones
// drooping, each with tiny barbs on its outer half. A lopsided seed has lost a few filaments on one side.
function dandelion(no, name, seed, { n, spread, len, tilt = 0, gap = null, lean = 0 }) {
  const r = rng(seed), ax = 32 + lean, ay = 19;
  const fil = [], barbs = [];
  for (let i = 0; i < n; i++) {
    const a = -spread / 2 + (spread * i) / (n - 1) + (r() - 0.5) * 7 + tilt;
    if (gap && a > gap[0] && a < gap[1]) continue;
    const L = len[0] + r() * (len[1] - len[0]);
    const A = { x: ax, y: ay }, e = pol(ax, ay, a, L), c = pol(ax, ay, a * 0.72, L * 0.52);
    e.y += Math.max(0, Math.abs(a) - 52) * 0.07; // the outer filaments droop
    fil.push(`M${pt(A)}Q${pt(c)} ${pt(e)}`);
    for (let k = 0; k < 3; k++) {
      const t = 0.56 + k * 0.14, p = qAt(A, c, e, t), dir = qDir(A, c, e, t);
      for (const s of [-1, 1]) barbs.push(`M${pt(p)}L${pt(pol(p.x, p.y, dir + s * 30, 1.4 + r() * 1.1))}`);
    }
  }
  const beakC = { x: 32 + lean * 0.4 + (r() - 0.5) * 2, y: 32 };
  const body = [
    lin(`${no}a`, 0, 0, 1, 0, [[0, '#5d432c'], [0.5, '#a07c55'], [1, '#6a4d33']]),
    `<path d="M32 45Q${pt(beakC)} ${pt({ x: ax, y: ay + 1 })}" fill="none" stroke="#b8aa8e" stroke-width=".7" stroke-linecap="round"/>`,
    `<path d="M32 44.2C33.4 47.4 33.5 52.2 32 58C30.5 52.2 30.6 47.4 32 44.2Z" fill="url(#${no}a)"/>`,
    `<path d="M31.4 47.5 32 50.5 32.6 47.5M31.3 51.5 32 54.5 32.7 51.5" fill="none" stroke="#4e3825" stroke-width=".35" stroke-opacity=".55"/>`,
    `<path d="${fil.join('')}" fill="none" stroke="#968a75" stroke-width=".45" stroke-linecap="round" stroke-opacity=".9"/>`,
    `<path d="${barbs.join('')}" fill="none" stroke="#a89c86" stroke-width=".3" stroke-linecap="round" stroke-opacity=".75"/>`,
    `<circle cx="${f(ax)}" cy="${f(ay)}" r=".9" fill="#968a75"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}

// ---------------------------------------------------------------- S2 butterflies
// One symbol per species for the right wing pair (fore and hind wing, root on x = 0, viewBox 40 × 64), mirrored for the left
// wing, so each wing can flap in 3D about the body; one shared body (viewBox 12 × 64): head, thorax, abdomen and clubbed antennae.
const FORE = [P(1, 27), P(6, 17), P(14, 9.5), P(24, 4.5), P(35.5, 4.5, true), P(38, 10), P(35, 20), P(30, 27.5), P(21, 31.5), P(11, 32.5), P(2, 32, true)];
const HIND = [P(2, 32.5, true), P(12, 33), P(23.5, 35.5), P(30.5, 41.5), P(30, 50.5), P(24, 56.5), P(15, 58.5), P(8, 55), P(3.5, 46), P(1.2, 38)];
const HIND_TAIL = [P(2, 32.5, true), P(12, 33), P(24, 35.5), P(31, 41), P(30.5, 49), P(26, 54), P(23.5, 62.5, true), P(20, 56.5), P(13, 58), P(7, 54), P(3.2, 45.5), P(1.2, 38)];
const veins = (root, ends) => ends.map((e) => `M${pt(root)}Q${pt({ x: (root.x + e.x) / 2 + 1.5, y: (root.y + e.y) / 2 - 1 })} ${pt(e)}`).join('');
const along = (samples, every, inset, centre, r0) => { const out = []; for (let i = 0; i < samples.length; i += every) { const s = samples[i], dx = centre.x - s.x, dy = centre.y - s.y, l = Math.hypot(dx, dy) || 1; out.push(`<circle cx="${f(s.x + (dx / l) * inset)}" cy="${f(s.y + (dy / l) * inset)}" r="${r0}"/>`); } return out.join(''); };
function butterfly(no, name, kind) {
  const fore = smooth(FORE), hind = smooth(kind === 'swallowtail' ? HIND_TAIL : HIND);
  const FV = veins(P(1.5, 29), [P(14, 9.5), P(24, 5), P(33, 6), P(36.5, 13), P(33, 22), P(27, 29), P(18, 32)]);
  const HV = veins(P(2, 34), [P(14, 33.5), P(25, 37), P(30.5, 45), P(27, 54), P(19, 58), P(10, 56.5)]);
  const g = (s) => `${no}${s}`;
  let body;
  if (kind === 'monarch') {
    body = [
      lin(g('f'), 0, 0, 1, 0.3, [[0, '#f7b24a'], [0.55, '#ef8a1f'], [1, '#d96a0c']]),
      `<path d="${hind.d}" fill="url(#${g('f')})"/>`, `<path d="${fore.d}" fill="url(#${g('f')})"/>`,
      `<path d="${FV}${HV}" fill="none" stroke="#1e1612" stroke-width="1.05" stroke-linecap="round"/>`,
      `<path d="M24 4.5 35.5 4.5 38 10 35 20C31.5 17 27.5 11 24 4.5Z" fill="#1e1612"/>`,
      `<path d="${hind.d}${fore.d}" fill="none" stroke="#1e1612" stroke-width="3.2" stroke-linejoin="round"/>`,
      `<g fill="#fff6e8">${along(fore.samples.slice(26, 72), 5, 0.4, P(16, 20), 0.55)}${along(hind.samples.slice(12, 66), 5, 0.4, P(14, 44), 0.55)}<circle cx="31" cy="8.5" r=".9"/><circle cx="33.5" cy="11.5" r=".75"/><circle cx="30" cy="12.5" r=".7"/></g>`,
      `<g fill="#f7b24a"><circle cx="34" cy="15.5" r=".8"/><circle cx="31.5" cy="16.5" r=".7"/></g>`,
    ].join('');
  } else if (kind === 'swallowtail') {
    body = [
      lin(g('f'), 0, 0, 1, 0.2, [[0, '#fbe27a'], [1, '#f2c531']]),
      `<path d="${hind.d}" fill="url(#${g('f')})"/>`, `<path d="${fore.d}" fill="url(#${g('f')})"/>`,
      // the tiger stripes across the forewing from its leading edge, and one on the hindwing
      `<path d="M3.5 21 8.5 13.5C9.5 20 10 26 9.6 31.8L5.5 32.3C5.5 28 4.8 24 3.5 21ZM12.2 10.6 16.2 8.2C16.8 14 16.6 20 15.8 25.5L13.6 26C13.6 20 13.2 15 12.2 10.6ZM19.8 6.4 23.2 5.1C23.4 10 23 14.5 22 18.5L20.6 18.8C20.8 14.5 20.6 10 19.8 6.4ZM27.2 4.7 30 4.6C30 8 29.6 10.8 28.9 12.8L28 12.9C28 10 27.8 7 27.2 4.7ZM2.5 35 8 33.6C7.5 39 6.8 44 5.6 49L3.6 45C3 41 2.6 38 2.5 35Z" fill="#20180f"/>`,
      `<path d="${FV}${HV}" fill="none" stroke="#20180f" stroke-width=".7" stroke-linecap="round"/>`,
      `<path d="${hind.d}" fill="none" stroke="#20180f" stroke-width="5" stroke-linejoin="round"/>`,
      `<path d="${fore.d}" fill="none" stroke="#20180f" stroke-width="3.6" stroke-linejoin="round"/>`,
      `<g fill="#fbe27a">${along(fore.samples.slice(30, 70), 6, 1.2, P(16, 20), 0.7)}${along(hind.samples.slice(16, 50), 5, 1.3, P(14, 44), 0.8)}</g>`,
      `<g fill="#5b80d6">${along(hind.samples.slice(22, 46), 6, 3.4, P(14, 44), 1)}</g><circle cx="22.5" cy="54.5" r="1.4" fill="#f08a2b"/>`,
    ].join('');
  } else if (kind === 'azure') {
    body = [
      rad(g('f'), 0.05, 0.5, 1, [[0, '#a9c2f5'], [0.6, '#7d9fe6'], [1, '#5878cf']]),
      `<path d="${hind.d}${fore.d}" fill="none" stroke="#fffaf2" stroke-width="2.4" stroke-linejoin="round"/>`,
      `<path d="${hind.d}" fill="url(#${g('f')})"/>`, `<path d="${fore.d}" fill="url(#${g('f')})"/>`,
      `<path d="${FV}${HV}" fill="none" stroke="#4a64ad" stroke-width=".5" stroke-opacity=".7" stroke-linecap="round"/>`,
      `<path d="${hind.d}${fore.d}" fill="none" stroke="#34405e" stroke-width="1.3" stroke-linejoin="round"/>`,
      `<g fill="#34405e" fill-opacity=".55">${along(hind.samples.slice(14, 60), 7, 2.4, P(14, 44), 0.6)}</g>`,
    ].join('');
  } else { // painted lady
    body = [
      lin(g('f'), 0, 0, 1, 0.2, [[0, '#f6b77c'], [0.6, '#ef8d4c'], [1, '#e2733a']]),
      `<path d="${hind.d}" fill="url(#${g('f')})"/>`, `<path d="${fore.d}" fill="url(#${g('f')})"/>`,
      `<path d="M21 5.5 35.5 4.5 38 10 35 20 30 27.5 26 26C28 20 26 13 21 5.5Z" fill="#2a1f19"/>`,
      `<path d="M14 21C17 18 21 19 22 23 20 27 15 27 14 21ZM9 13C11 11.5 13.5 12.5 13 15 11 16.5 9 15.5 9 13Z" fill="#2a1f19"/>`,
      `<g fill="#fff6ea"><circle cx="31" cy="8" r="1.4"/><circle cx="34.2" cy="11.8" r="1"/><circle cx="29.5" cy="13" r="1.2"/><circle cx="32.5" cy="17" r=".9"/><path d="M24.5 9C26.5 9 28 11 27 13 25 13.5 23.5 11 24.5 9Z"/></g>`,
      `<path d="${FV}${HV}" fill="none" stroke="#7a3d1c" stroke-width=".5" stroke-opacity=".7" stroke-linecap="round"/>`,
      `<g fill="#2a1f19">${along(hind.samples.slice(16, 62), 6, 3.6, P(14, 44), 1.1)}</g>`,
      `<g fill="#6f8fd8">${along(hind.samples.slice(22, 50), 12, 3.6, P(14, 44), 0.5)}</g>`,
      `<path d="${hind.d}${fore.d}" fill="none" stroke="#2a1f19" stroke-width="1.4" stroke-linejoin="round"/>`,
    ].join('');
  }
  return { no, name, symbol: sym(no, '0 0 40 64', body) };
}
const BODY = sym('Bbody', '0 0 12 64', [
  lin('Bbg', 0, 0, 1, 0, [[0, '#18120e'], [0.5, '#4a3b30'], [1, '#18120e']]),
  `<path d="M5.2 21.5C4 15.5 2.6 11.5 1.2 7.5M6.8 21.5C8 15.5 9.4 11.5 10.8 7.5" fill="none" stroke="#1e1612" stroke-width=".55" stroke-linecap="round"/>`,
  `<circle cx="1.2" cy="7.3" r=".95" fill="#1e1612"/><circle cx="10.8" cy="7.3" r=".95" fill="#1e1612"/>`,
  `<ellipse cx="6" cy="43.5" rx="1.75" ry="9.5" fill="url(#Bbg)"/><ellipse cx="6" cy="29" rx="2.4" ry="5.6" fill="url(#Bbg)"/><circle cx="6" cy="22.4" r="2" fill="#1e1612"/>`,
  `<path d="M5.3 26.5V31.5" stroke="#cdbfa8" stroke-width=".45" stroke-opacity=".6" stroke-linecap="round"/>`,
].join(''));

// ---------------------------------------------------------------- S3 / S4 summer fruit and mint
// A citrus wheel: rind, pith, juicy segments separated by pale membranes, vesicle streaks, a centre and a light on the rind.
function citrus(no, name, C, segs = 10) {
  const r = rng(no.charCodeAt(0) * 31 + no.length), g = (s) => `${no}${s}`, ri = 3.8, ro = 23, gap = 3.4;
  const seg = [], ves = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i * 360) / segs + gap / 2 + (r() - 0.5) * 2, a1 = ((i + 1) * 360) / segs - gap / 2 + (r() - 0.5) * 2, m = (a0 + a1) / 2;
    seg.push(`M${pt(pol(32, 32, m, ri))}L${pt(pol(32, 32, a0 + 1.2, ro * 0.9))}Q${pt(pol(32, 32, a0, ro))} ${pt(pol(32, 32, a0 + 4, ro))}A${ro} ${ro} 0 0 1 ${pt(pol(32, 32, a1 - 4, ro))}Q${pt(pol(32, 32, a1, ro))} ${pt(pol(32, 32, a1 - 1.2, ro * 0.9))}Z`);
    for (let k = 0; k < 3; k++) { const aa = m + (k - 1) * (a1 - a0) * 0.26 + (r() - 0.5) * 2, r0 = 8 + r() * 4; ves.push(`M${pt(pol(32, 32, aa, r0))}L${pt(pol(32, 32, aa + (r() - 0.5) * 2, r0 + 6 + r() * 6))}`); }
  }
  const body = [
    rad(g('r'), 0.4, 0.35, 0.7, [[0, C.rind1], [0.85, C.rind2], [1, C.rind3]]),
    rad(g('f'), 0.5, 0.5, 0.5, [[0, C.flesh1], [0.65, C.flesh2], [1, C.flesh3]]),
    `<circle cx="32" cy="32" r="28.5" fill="url(#${g('r')})"/><circle cx="32" cy="32" r="28.5" fill="none" stroke="${C.rind3}" stroke-width=".7"/>`,
    `<circle cx="32" cy="32" r="25.4" fill="${C.pith}"/>`,
    `<path d="${seg.join('')}" fill="url(#${g('f')})"/>`,
    `<path d="${ves.join('')}" fill="none" stroke="${C.ves}" stroke-width="1" stroke-linecap="round" stroke-opacity=".55"/>`,
    `<circle cx="32" cy="32" r="3.2" fill="${C.pith}"/>`,
    `<path d="M12.5 21A22.5 22.5 0 0 1 26 8.3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-opacity=".45"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}
const ORANGE = { rind1: '#ffb347', rind2: '#f28a1c', rind3: '#d9700f', pith: '#fdf0d8', flesh1: '#ffc070', flesh2: '#ff9a2e', flesh3: '#f27f14', ves: '#ffe0b0' };
const LEMON = { rind1: '#fff07a', rind2: '#f5d72a', rind3: '#d8b512', pith: '#fdf8de', flesh1: '#fff6a8', flesh2: '#fbe45c', flesh3: '#efcf2c', ves: '#fffbe0' };
const LIME = { rind1: '#9ccf55', rind2: '#5c9e2a', rind3: '#40801c', pith: '#eef6d6', flesh1: '#d7ef93', flesh2: '#b4dc5e', flesh3: '#93c83c', ves: '#f2fbd8' };
function cherries(no, name) {
  const g = (s) => `${no}${s}`;
  const one = (cx, cy, rr) => `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="url(#${g('c')})"/><path d="M${cx - rr * 0.55} ${cy - rr * 0.35}A${rr * 0.7} ${rr * 0.7} 0 0 1 ${cx - rr * 0.05} ${cy - rr * 0.68}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".6"/><circle cx="${cx - rr * 0.38}" cy="${cy - rr * 0.45}" r="${rr * 0.09}" fill="#fff" fill-opacity=".8"/><path d="M${cx - 1.6} ${cy - rr + 0.8}Q${cx} ${cy - rr + 2.2} ${cx + 1.6} ${cy - rr + 0.8}" fill="none" stroke="#5a0614" stroke-width=".8" stroke-opacity=".6"/>`;
  const body = [
    rad(g('c'), 0.38, 0.35, 0.7, [[0, '#e8394f'], [0.55, '#b5122d'], [1, '#6e0518']]),
    lin(g('l'), 0, 0, 1, 1, [[0, '#8cc152'], [1, '#4f8a2b']]),
    `<path d="M21 34C23 23 30 13 37 7.5M43 38C42 26 40 15 37 7.5" fill="none" stroke="#6b7f2e" stroke-width="1.5" stroke-linecap="round"/>`,
    `<path d="M37 7.5C42 3 51 3 57 7 51 12.5 43 13 37 7.5Z" fill="url(#${g('l')})"/><path d="M37.5 7.6C43 6.5 49 6.8 55.5 7" fill="none" stroke="#3f6f22" stroke-width=".6"/>`,
    one(20, 44, 11), one(43, 48, 11.5),
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}
function strawberry(no, name) {
  const g = (s) => `${no}${s}`, r = rng(97);
  const shape = smooth([P(32, 60, true), P(22, 51), P(13.5, 37), P(12, 24), P(19, 15.5), P(32, 13.5), P(45, 15.5), P(52, 24), P(50.5, 37), P(42, 51)]);
  const seeds = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const y = 20 + row * 6.4 + (col % 2) * 3.2, half = (30 - (y - 20) * 0.62) * (y < 26 ? 0.86 : 1), x = 32 + ((col - 3) / 3) * half * 0.86 + (r() - 0.5) * 1.2;
    if (y > 54 || Math.abs(x - 32) > half - 1.5) continue;
    seeds.push(`<path d="M${f(x)} ${f(y - 1.3)}C${f(x + 0.9)} ${f(y - 0.4)} ${f(x + 0.7)} ${f(y + 1.1)} ${f(x)} ${f(y + 1.3)}C${f(x - 0.7)} ${f(y + 1.1)} ${f(x - 0.9)} ${f(y - 0.4)} ${f(x)} ${f(y - 1.3)}Z"/>`);
  }
  const calyx = []; for (let i = 0; i < 7; i++) { const a = -90 + (i * 180) / 6 + (r() - 0.5) * 8, L = 9 + r() * 4; const tip = pol(32, 14.5, a, L), l = pol(32, 14.5, a - 14, L * 0.45), rr = pol(32, 14.5, a + 14, L * 0.45); calyx.push(`M32 14.5Q${pt(l)} ${pt(tip)}Q${pt(rr)} 32 14.5Z`); }
  const body = [
    rad(g('b'), 0.4, 0.38, 0.75, [[0, '#ff5a5f'], [0.6, '#d9232f'], [1, '#97101d']]),
    `<path d="${shape.d}" fill="url(#${g('b')})"/>`,
    `<clipPath id="${g('k')}"><path d="${shape.d}"/></clipPath><g clip-path="url(#${g('k')})" fill="#f6d77a" stroke="#b5481f" stroke-width=".25">${seeds.join('')}</g>`,
    `<path d="M19 24C20 20 23.5 18 26.5 18" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-opacity=".45"/>`,
    `<path d="${calyx.join('')}" fill="#4f9a33"/><path d="M32 14.5C32.5 10 34 7 36.5 4.5" fill="none" stroke="#3f7f27" stroke-width="1.8" stroke-linecap="round"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}
function watermelon(no, name) {
  const g = (s) => `${no}${s}`;
  // a wedge: the tip up, the rind along the bottom arc
  const arc = (rr) => `M${pt(pol(32, 4, 148, rr))}A${rr} ${rr} 0 0 1 ${pt(pol(32, 4, 212, rr))}`;
  const wedge = (rr) => `M32 4L${pt(pol(32, 4, 148, rr))}A${rr} ${rr} 0 0 1 ${pt(pol(32, 4, 212, rr))}Z`;
  const stripes = [-26, -17, -8, 1, 10, 19, 28].map((d) => { const a = 180 + d; return `M${pt(pol(32, 4, a - 2, 55.5))}L${pt(pol(32, 4, a + 2, 58.6))}`; }).join('');
  const seeds = [[180, 32], [168, 40], [192, 40], [174, 24], [186, 24], [180, 46], [163, 30], [197, 30]].map(([a, rr]) => { const c = pol(32, 4, a, rr), tip = pol(c.x, c.y, a + 180, 1.9), base = pol(c.x, c.y, a, 1.6); return `<path d="M${pt(tip)}C${f(c.x - 1.2)} ${f(c.y)} ${f(base.x - 0.9)} ${f(base.y)} ${pt(base)}C${f(base.x + 0.9)} ${f(base.y)} ${f(c.x + 1.2)} ${f(c.y)} ${pt(tip)}Z"/>`; }).join('');
  const body = [
    lin(g('f'), 0, 0, 0, 1, [[0, '#ff6b74'], [0.75, '#f24452'], [1, '#e9707a']]),
    `<path d="${wedge(59)}" fill="#2f7a2e"/><path d="${stripes}" fill="none" stroke="#1d5a20" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="${wedge(54.5)}" fill="#e8f5cf"/><path d="${wedge(52.5)}" fill="url(#${g('f')})"/>`,
    `<g fill="#2a1a12">${seeds}</g><g fill="#fff" fill-opacity=".5">${[[180, 32], [168, 40], [192, 40]].map(([a, rr]) => { const c = pol(32, 4, a, rr); return `<circle cx="${f(c.x - 0.4)}" cy="${f(c.y - 0.6)}" r=".35"/>`; }).join('')}</g>`,
    `<path d="${arc(59)}" fill="none" stroke="#1d5a20" stroke-width=".7"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}
function mint(no, name, seed) {
  const g = (s) => `${no}${s}`, r = rng(seed), pts = [];
  // an ovate leaf with a serrated margin, tip up
  const hw = (t) => 15.5 * Math.pow(t, 0.55) * Math.pow(1 - t, 0.85) * 2.1;
  const teeth = 9, side = (s) => { const out = []; for (let i = 0; i <= teeth; i++) { const t = 0.04 + (i / teeth) * 0.93, y = 56 - t * 50, w = hw(t); out.push(P(32 + s * w, y)); if (i < teeth) { const t2 = t + 0.07, w2 = hw(t2) + 1.6 + r() * 0.6; out.push(P(32 + s * w2, 56 - t2 * 50, true)); } } return out; };
  const right = side(1), left = side(-1).reverse();
  const outline = smooth([P(32, 57, true), ...right, P(32, 5, true), ...left], 0.8);
  const vein = []; for (let i = 1; i <= 5; i++) { const y = 52 - i * 7.8, w = hw((56 - y) / 50) * 0.8; vein.push(`M32 ${f(y + 3)}Q${f(32 + w * 0.5)} ${f(y)} ${f(32 + w)} ${f(y - 4)}M32 ${f(y + 3)}Q${f(32 - w * 0.5)} ${f(y)} ${f(32 - w)} ${f(y - 4)}`); }
  const body = [
    lin(g('f'), 0, 0, 1, 1, [[0, '#7cc35a'], [0.55, '#4f9a3f'], [1, '#2f7a32']]),
    `<path d="M32 57V62" stroke="#3f7f2c" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="${outline.d}" fill="url(#${g('f')})"/>`,
    `<path d="${vein.join('')}" fill="none" stroke="#2a6a2b" stroke-width="1.1" stroke-linecap="round" stroke-opacity=".55"/>`,
    `<path d="${vein.join('')}" fill="none" stroke="#b9e39a" stroke-width=".5" stroke-linecap="round" stroke-opacity=".55" transform="translate(.5 -.6)"/>`,
    `<path d="M32 56V8" fill="none" stroke="#c8ecab" stroke-width=".8" stroke-opacity=".7"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}

// ---------------------------------------------------------------- S4 bubbles
// A bubble: nearly clear inside, a thin warm rim, an inner reflection ring, a bright crescent and a point of light, a faint
// reflection low on the other side. Q3 is two bubbles stuck together.
function bubble(no, name, parts) {
  const g = (s) => `${no}${s}`;
  const one = ([cx, cy, rr]) => [
    `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="url(#${g('i')})"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#a5865a" stroke-width="${f(rr * 0.1)}" stroke-opacity=".75"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${f(rr * 0.84)}" fill="none" stroke="#fff" stroke-width="${f(rr * 0.07)}" stroke-opacity=".8"/>`,
    `<path d="M${f(cx - rr * 0.64)} ${f(cy - rr * 0.16)}A${f(rr * 0.66)} ${f(rr * 0.66)} 0 0 1 ${f(cx - rr * 0.1)} ${f(cy - rr * 0.65)}" fill="none" stroke="#fff" stroke-width="${f(rr * 0.15)}" stroke-linecap="round"/>`,
    `<circle cx="${f(cx - rr * 0.28)}" cy="${f(cy - rr * 0.44)}" r="${f(rr * 0.09)}" fill="#fff"/>`,
    `<path d="M${f(cx + rr * 0.58)} ${f(cy + rr * 0.3)}A${f(rr * 0.66)} ${f(rr * 0.66)} 0 0 1 ${f(cx + rr * 0.14)} ${f(cy + rr * 0.64)}" fill="none" stroke="#a5865a" stroke-width="${f(rr * 0.08)}" stroke-linecap="round" stroke-opacity=".5"/>`,
  ].join('');
  const body = [rad(g('i'), 0.5, 0.5, 0.5, [[0, '#ffffff', 0.1], [0.75, '#ffffff', 0.3], [1, '#e2d1b2', 0.6]]), ...parts.map(one)].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}

// ---------------------------------------------------------------- S5 Persian sun
// Three layers, so each can turn at its own speed: the disc (a crisp gradient, a fine ring and a dotted ring), twelve straight
// tapered rays, twelve flame rays between them (an S curve, the Persian khorshid ornament; no face). Gold of Senso's logo.
const SUN_DISC = sym('Udisc', '0 0 200 200', [
  rad('Udg', 0.42, 0.4, 0.62, [[0, '#ffe08a'], [0.7, '#f6bf45'], [1, '#e9a531']]),
  `<circle cx="100" cy="100" r="40" fill="url(#Udg)"/><circle cx="100" cy="100" r="44" fill="none" stroke="#d99a2b" stroke-width="1.6"/>`,
  `<circle cx="100" cy="100" r="34" fill="none" stroke="#fff3cf" stroke-width="1.2" stroke-dasharray="1.5 4.8" stroke-linecap="round"/>`,
  `<path d="M74 84A30 30 0 0 1 96 70" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".45"/>`,
].join(''));
const SUN_RAYS = sym('Urays', '0 0 200 200', `<path d="${Array.from({ length: 12 }, (_, i) => { const a = i * 30; return `M${pt(pol(100, 100, a - 4.2, 50))}L${pt(pol(100, 100, a, 96))}L${pt(pol(100, 100, a + 4.2, 50))}Z`; }).join('')}" fill="#e9a93a"/><path d="${Array.from({ length: 12 }, (_, i) => { const a = i * 30; return `M${pt(pol(100, 100, a, 54))}L${pt(pol(100, 100, a, 88))}`; }).join('')}" stroke="#fbe3a0" stroke-width="1" stroke-linecap="round"/>`);
const SUN_FLAMES = sym('Uflames', '0 0 200 200', `<path d="${Array.from({ length: 12 }, (_, i) => {
  const a = i * 30 + 15, L = [], R = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, c = pol(100, 100, a + 5.5 * Math.sin(t * Math.PI * 2.2), 49 + 34 * t), n = pol(0, 0, a + 5.5 * Math.sin(t * Math.PI * 2.2) + 90, 1), w = 3.6 * Math.pow(1 - t, 0.9) + 0.2;
    L.push({ x: c.x + n.x * w, y: c.y + n.y * w }); R.push({ x: c.x - n.x * w, y: c.y - n.y * w });
  }
  return `M${L.map(pt).join('L')}L${R.reverse().map(pt).join('L')}Z`;
}).join('')}" fill="#f2c14e" stroke="#f2c14e" stroke-width=".6" stroke-linejoin="round"/>`);
const SPARK = sym('Uspark', '0 0 24 24', `<path d="M12 1.5C12.6 8.5 15.5 11.4 22.5 12 15.5 12.6 12.6 15.5 12 22.5 11.4 15.5 8.5 12.6 1.5 12 8.5 11.4 11.4 8.5 12 1.5Z" fill="#e2a334"/><path d="M12 6.5C12.3 10.2 13.8 11.7 17.5 12 13.8 12.3 12.3 13.8 12 17.5 11.7 13.8 10.2 12.3 6.5 12 10.2 11.7 11.7 10.2 12 6.5Z" fill="#fff6d6"/>`);
const MOTE = sym('Umote', '0 0 24 24', `<circle cx="12" cy="12" r="5" fill="#e8b552"/><circle cx="10.5" cy="10.5" r="1.6" fill="#fff4cf"/>`);

// ---------------------------------------------------------------- S6 rose petals
// A rose petal: a broad rounded blade with a slight dip at the top and a narrow pale base, coloured from the pale base into the
// petal's colour and darker at the rim; a soft light on one side (it is cupped), fine veins fanning from the base, and on some a
// curled edge showing the lighter back of the petal along one margin.
function petal(no, name, C, { curl = 0, seed = 1, w = 1 } = {}) {
  const r = rng(seed), g = (s) => `${no}${s}`, X = (x) => 32 + (x - 32) * w;
  const pts = [P(32, 58.5), P(X(28), 56), P(X(20), 47), P(X(12.5), 35), P(X(9.5), 23), P(X(12), 13.5), P(X(19.5), 7.5), P(X(26), 6.2), P(X(32), 7), P(X(38.5), 5.8), P(X(45), 7.2), P(X(51.5), 12.5), P(X(54.5), 22), P(X(52), 34.5), P(X(44.5), 47), P(X(36), 56)].map((p, i) => (i ? P(p.x + (r() - 0.5) * 2.6, p.y + (r() - 0.5) * 2) : p));
  const blade = smooth(pts);
  const veins = Array.from({ length: 7 }, (_, i) => { const a = -36 + i * 12 + (r() - 0.5) * 4, e = pol(32, 57, a, 30 + r() * 12), c = pol(32, 57, a * 0.6, 18); return `M32 56Q${pt(c)} ${pt(e)}`; }).join('');
  let curlPart = '';
  if (curl) { // the back of the petal shows along the upper left margin
    const s = blade.samples, seg = s.slice(curl > 0 ? 64 : 34, curl > 0 ? 92 : 58), inner = seg.map((p, i) => { const k = Math.sin((Math.PI * i) / (seg.length - 1)) * 5.5; const dx = 32 - p.x, dy = 30 - p.y, l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * k, y: p.y + (dy / l) * k }; });
    curlPart = `<path d="M${seg.map(pt).join('L')}L${inner.reverse().map(pt).join('L')}Z" fill="${C.back}"/><path d="M${inner.map(pt).join('L')}" fill="none" stroke="${C.rim}" stroke-width=".7" stroke-opacity=".5"/>`;
  }
  const body = [
    lin(g('f'), 0, 1, 0, 0, [[0, C.base], [0.22, C.mid1], [0.75, C.mid2], [1, C.rim]]),
    rad(g('h'), 0.3, 0.35, 0.6, [[0, '#ffffff', 0.32], [1, '#ffffff', 0]]),
    rad(g('s'), 0.85, 0.6, 0.6, [[0, C.rim, 0.35], [1, C.rim, 0]]),
    `<path d="${blade.d}" fill="url(#${g('f')})"/><path d="${blade.d}" fill="url(#${g('h')})"/><path d="${blade.d}" fill="url(#${g('s')})"/>`,
    `<path d="${veins}" fill="none" stroke="${C.vein}" stroke-width=".45" stroke-linecap="round" stroke-opacity=".2"/>`,
    curlPart,
    `<path d="${blade.d}" fill="none" stroke="${C.rim}" stroke-width=".6" stroke-opacity=".5"/>`,
  ].join('');
  return { no, name, symbol: sym(no, '0 0 64 64', body) };
}
const RED = { base: '#f6dccf', mid1: '#d8344c', mid2: '#bd1a35', rim: '#8e0f27', vein: '#7a0c20', back: '#e2617a' };
const PINK = { base: '#fbe7e4', mid1: '#ee8aa3', mid2: '#e26e8d', rim: '#c04a6c', vein: '#a33a59', back: '#f6b6c7' };
const BLUSH = { base: '#fff2e6', mid1: '#f7c1b5', mid2: '#f0a597', rim: '#d97c6c', vein: '#c06a5c', back: '#fbd8cf' };

// ---------------------------------------------------------------- the six concepts
export const DESIGNS = {
  D1: dandelion('D1', 'full seed', 3, { n: 19, spread: 158, len: [15, 18.5] }),
  D2: dandelion('D2', 'lopsided seed', 5, { n: 17, spread: 150, len: [14, 18], tilt: 10, gap: [28, 52], lean: 1.5 }),
  D3: dandelion('D3', 'young seed', 9, { n: 23, spread: 140, len: [12, 15] }),
  B1: butterfly('B1', 'monarch', 'monarch'),
  B2: butterfly('B2', 'tiger swallowtail', 'swallowtail'),
  B3: butterfly('B3', 'spring azure', 'azure'),
  B4: butterfly('B4', 'painted lady', 'lady'),
  O1: citrus('O1', 'orange wheel', ORANGE, 10),
  O2: citrus('O2', 'lemon wheel', LEMON, 9),
  O3: citrus('O3', 'lime wheel', LIME, 9),
  O4: cherries('O4', 'cherries (گیلاس)'),
  O5: strawberry('O5', 'strawberry'),
  O6: watermelon('O6', 'watermelon wedge (هندوانه)'),
  O7: mint('O7', 'mint leaf', 41),
  Q1: bubble('Q1', 'bubble', [[32, 32, 27]]),
  Q2: bubble('Q2', 'three small bubbles', [[22, 40, 13.5], [42, 45, 10], [36, 22, 9.5]]),
  Q3: bubble('Q3', 'double bubble', [[25, 36, 17], [42, 22, 12]]),
  R1: petal('R1', 'red petal', RED, { seed: 3 }),
  R2: petal('R2', 'red petal, curled', RED, { seed: 7, curl: 1, w: 0.92 }),
  R3: petal('R3', 'pink petal', PINK, { seed: 11, w: 1.05 }),
  R4: petal('R4', 'pink petal, curled', PINK, { seed: 13, curl: -1, w: 0.9 }),
  R5: petal('R5', 'blush petal', BLUSH, { seed: 17, w: 0.95 }),
};
export const SHARED = { BODY, SUN_DISC, SUN_RAYS, SUN_FLAMES, SPARK, MOTE };
export const CONCEPTS = [
  { no: 'S1', name: 'Dandelion seeds', fa: 'قاصدک', mode: 'drift', designs: ['D1', 'D2', 'D3'], shared: [],
    note: 'Seeds carried across from left to right on a light breeze, bobbing and turning slowly; three depths. In Persian a dandelion seed, ghasedak, is the bringer of good news, a welcome in itself.' },
  { no: 'S2', name: 'Butterflies', fa: 'پروانه', mode: 'wander', designs: ['B1', 'B2', 'B3', 'B4'], shared: ['BODY'],
    note: 'Six butterflies of four Ontario summer species (monarch, tiger swallowtail, spring azure, painted lady), each on its own wandering path, wings flapping in 3D about the body with an uneven beat.' },
  { no: 'S3', name: 'Summer fruit', fa: 'میوه‌های تابستانی', mode: 'fall', designs: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'], shared: [],
    note: 'Orange, lemon and lime wheels, cherries, strawberries, a watermelon wedge and mint leaves tumbling down like the fall leaves; Senso\'s juices and ice cream.' },
  { no: 'S4', name: 'Sparkling lemonade', fa: 'شربت گازدار', mode: 'rise', designs: ['Q1', 'Q2', 'Q3'], extras: ['O2', 'O7'], shared: [],
    note: 'Bubbles rising from the bottom, wobbling as they go, with a few lemon wheels and mint leaves drifting up among them, as in a glass of lemonade or a mojito.' },
  { no: 'S5', name: 'Persian sun', fa: 'خورشید', mode: 'sun', designs: [], shared: ['SUN_DISC', 'SUN_RAYS', 'SUN_FLAMES', 'SPARK', 'MOTE'],
    note: 'An ornamental sun in the top corner, after the khorshid of Persian tiles (straight rays and flame rays; no face), in the gold of Senso\'s logo: its two rings of rays turn slowly in opposite directions; small sparkles twinkle and a few motes of light float up. Crisp, no glow.' },
  { no: 'S6', name: 'Rose petals', fa: 'گلبرگ رز', mode: 'fall', designs: ['R1', 'R2', 'R3', 'R4', 'R5'], shared: [],
    note: 'Red, pink and blush rose petals, some curled, tumbling down slowly; a nod to the Roses name. If picked, spring (today pink blossoms) would get a different motif in its own batch.' },
];
