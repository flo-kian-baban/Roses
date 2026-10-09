#!/usr/bin/env node
// The welcome scenes as they were before the Senso artwork batch (the PM, 2026-10-09): Kebab Land and the default template keep
// their welcome artwork and motion unchanged until Kian confirms Senso's, so the suite compares what they serve with a fixture
// captured from the previous commit's build. The fixture holds every scene's markup (the four seasons' particle sets, the symbol
// defs they use) from a served page, and the stylesheet rules that move them. The season drill compares the served page's scene
// (one season since the current-season-only decision) and its symbols with the fixture, and the stylesheet rules verbatim.
//   capture: node scripts/welcome-fixture.mjs --from <served.html> --commit <hash> --venue kebab-land [--out scripts/fixtures/welcome-scenes.json]
//   compare: import { extract, compare } from './welcome-fixture.mjs'
import fs from 'node:fs';
import path from 'node:path';

export const MOTION_RULES = [
  '.welcome-scene, .welcome-scene .scene { position: absolute; inset: 0; pointer-events: none; }',
  '.welcome-scene .p { position: absolute; left: 0; top: 0; display: block; opacity: var(--o); transform: translate(var(--x), var(--y)); }',
  '.welcome-scene .y, .welcome-scene .w { display: block; will-change: transform; }',
  '.welcome-scene .y { animation: w-fall var(--d) linear var(--l) infinite; }',
  '.welcome-scene .w { animation: w-sway var(--w) ease-in-out var(--l) infinite alternate; fill: currentColor; }',
  '.scene-fall { color: var(--c-welcome-leaves); }',
  '.scene-winter { color: var(--c-welcome-snow); }',
  '.scene-spring { color: var(--c-welcome-blossoms); }',
  '.scene-summer, #wgrad { color: var(--c-welcome-light); }',
  '.scene-summer .y { animation-name: w-drift; animation-timing-function: ease-in-out; animation-direction: alternate; }',
  '.scene-summer .w { animation-name: w-pulse; }',
  '@keyframes w-fall { from { transform: translate3d(0, calc(-1 * var(--y) - 90px), 0); } to { transform: translate3d(var(--sx), calc(100vh - var(--y) + 90px), 0); } }',
  '@keyframes w-sway { from { transform: translateX(-12px) rotate(calc(-1 * var(--r))); } to { transform: translateX(12px) rotate(var(--r)); } }',
  '@keyframes w-drift { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(var(--sx), -36px, 0); } }',
  '@keyframes w-pulse { from { transform: scale(.85); opacity: .7; } to { transform: scale(1.12); opacity: 1; } }',
  '@media (prefers-reduced-motion: reduce) { #welcome, #welcome * { animation: none !important; transition: none !important; } }',
];

// Every <symbol id> (and the summer gradient) inside the welcome overlay's hidden sheet, and every scene element with its content.
export function extract(html) {
  const start = html.indexOf('<div id="welcome"'), end = html.indexOf('<main', start);
  const overlay = start >= 0 ? html.slice(start, end > start ? end : undefined) : '';
  const symbols = {};
  for (const m of overlay.matchAll(/<symbol id="([^"]+)"[\s\S]*?<\/symbol>/g)) symbols[m[1]] = m[0];
  for (const m of overlay.matchAll(/<radialGradient id="([^"]+)"[\s\S]*?<\/radialGradient>/g)) symbols[m[1]] = m[0];
  const scenes = {};
  for (const m of overlay.matchAll(/<div class="scene scene-(fall|winter|spring|summer)"[^>]*>([\s\S]*?)<\/div>/g)) scenes[m[1]] = { outer: m[0], inner: m[2], attrs: m[0].slice(0, m[0].indexOf('>') + 1) };
  return { symbols, scenes };
}
// Which symbols a scene's particles reference (href="#id"), plus the gradient a symbol references (url(#id)).
export function symbolsUsed(sceneInner, symbols) {
  const ids = new Set([...sceneInner.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]));
  for (const id of [...ids]) for (const m of (symbols[id] || '').matchAll(/url\(#([^)]+)\)/g)) ids.add(m[1]);
  return [...ids];
}
// Compares a served page's scene of `season` with the fixture: the scene element's attributes and content byte for byte, and
// every symbol it uses. Returns { ok, diffs[] }.
export function compare(fixture, html, season) {
  const now = extract(html), diffs = [];
  const want = fixture.scenes[season], got = now.scenes[season];
  if (!want) diffs.push(`fixture has no ${season} scene`);
  if (!got) diffs.push(`served page has no ${season} scene`);
  if (want && got) {
    if (got.inner !== want.inner) diffs.push(`${season} scene content differs (${got.inner.length} B served, ${want.inner.length} B in the fixture)`);
    if (got.attrs !== want.attrs) diffs.push(`${season} scene element differs: served ${got.attrs}, fixture ${want.attrs}`);
    for (const id of symbolsUsed(want.inner, fixture.symbols)) {
      if (!now.symbols[id]) diffs.push(`symbol #${id} missing from the served page`);
      else if (now.symbols[id] !== fixture.symbols[id]) diffs.push(`symbol #${id} differs`);
    }
  }
  const others = Object.keys(now.scenes).filter((s) => s !== season);
  if (others.length) diffs.push(`served page also carries the ${others.join(', ')} scene(s)`);
  return { ok: diffs.length === 0, diffs, particles: got ? (got.inner.match(/<i class="p"/g) || []).length : 0, symbols: want ? symbolsUsed(want.inner, fixture.symbols) : [] };
}
export function compareCss(css) {
  const missing = MOTION_RULES.filter((r) => !css.includes(r));
  return { ok: missing.length === 0, missing };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
  if (!args.from || !args.commit) { console.error('usage: --from <served.html> --commit <hash> --venue <id> [--out file]'); process.exit(2); }
  const html = fs.readFileSync(args.from, 'utf8');
  const { symbols, scenes } = extract(html);
  const out = args.out || 'scripts/fixtures/welcome-scenes.json';
  const fixture = { capturedFrom: { commit: args.commit, venue: args.venue || null, file: path.basename(args.from), at: new Date().toISOString() }, note: 'The welcome scenes of Kebab Land and the default template before the Senso artwork batch (the PM, 2026-10-09): every season\'s particle set and the symbols they use, as served by a production build of the commit named; the season drill compares the served scene of the current season with these, byte for byte, and the stylesheet\'s motion rules (MOTION_RULES in scripts/welcome-fixture.mjs) verbatim.', symbols, scenes: Object.fromEntries(Object.entries(scenes).map(([k, v]) => [k, { attrs: v.attrs, inner: v.inner, particles: (v.inner.match(/<i class="p"/g) || []).length, symbols: symbolsUsed(v.inner, symbols) }])) };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(fixture, null, 1));
  console.log(`wrote ${out}: ${Object.keys(symbols).length} symbols, scenes ${Object.entries(fixture.scenes).map(([k, v]) => `${k} ${v.particles} particles (${v.symbols.join(', ')})`).join('; ')}`);
}
