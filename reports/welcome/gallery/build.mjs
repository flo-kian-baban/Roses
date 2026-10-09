// Builds reports/welcome/gallery.html, the picking tool for Kian (our tool, not a public page; one self-contained file: the
// Senso logo is inlined). Usage: node reports/welcome/gallery/build.mjs — prints the gzipped size of every candidate.
//
// Each candidate (F1–F10, W1–W10) is shown large and still, falling on its own, and at the three depth sizes on Senso's welcome
// background; one full-scene demo per season puts all ten on a replica of Senso's welcome screen (the served colours of
// 2026-10-09, the real card markup and CSS) with the motion planned for step 2: three depth layers, fall + pendulum sway + drift +
// 3D flutter per leaf (snow: drift and sway only), every parameter random per load, the scene full on the first frame
// (negative delays), transform and opacity only, at most 20 particles. "Still" shows the reduced-motion composition.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LEAVES, FLAKES, SHARED_DEFS } from './art.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.join(here, '..', 'gallery.html');
const gz = (s) => zlib.gzipSync(Buffer.from(s)).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/brand/senso-logo.png')).toString('base64')}`;
const commit = (() => { try { return fs.readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim(); } catch { return ''; } })();

// Senso's welcome colours as served on 2026-10-09 (the Welcome group's tokens; the snow tint is the Auto rule on the cream).
const COLORS = { bg: '#fff8ee', text: '#1d1d1f', btnBg: '#f2ece2', btnText: '#1d1d1f', activeBg: '#042c7c', activeText: '#ffffff', snow: '#b2becc', leaves: '#cc9434' };

const sizes = [...LEAVES, ...FLAKES].map((c) => ({ no: c.no, name: c.name, raw: (c.defs + c.symbol).length, gz: gz(c.defs + c.symbol) }));
const sharedGz = gz(SHARED_DEFS);

const card = (c, kind) => `<article class="card${kind === 'snow' ? ' snowc' : ''}" id="${c.no}">
  <h3><b>${c.no}</b> ${c.name} <small>${c.note}</small></h3>
  <div class="panes">
    <div class="pane big${kind === 'snow' ? ' senso' : ''}"><svg viewBox="0 0 64 64"><use href="#${c.no}"/></svg><span>large, still</span></div>
    <div class="pane alone senso"><div class="scene" data-alone="${c.no}" data-kind="${kind}"></div><span>falling on its own</span></div>
    <div class="pane sizes senso"><svg viewBox="0 0 64 64" style="width:20px;height:20px"><use href="#${c.no}"/></svg><svg viewBox="0 0 64 64" style="width:34px;height:34px"><use href="#${c.no}"/></svg><svg viewBox="0 0 64 64" style="width:50px;height:50px"><use href="#${c.no}"/></svg><span>far · middle · near, on Senso's background</span></div>
  </div>
  <p class="meta">${kb(sizes.find((s) => s.no === c.no).gz)} gzipped (${kb(sizes.find((s) => s.no === c.no).raw)} raw)</p>
</article>`;

const demo = (season, kind, label) => `<div class="demo" id="demo-${season}">
  <div class="phone"><div class="frame senso" data-demo="${kind}" style="--w:390px;--h:844px">
    <div class="scene"></div>
    <div class="welcome-card">
      <img class="welcome-logo" src="${logo}" width="271" height="143" alt="Senso Café &amp; Bites">
      <p class="welcome-greet"><span lang="en" data-greet></span><span lang="fa" dir="rtl" data-greet-fa></span></p>
      <div class="welcome-buttons"><button type="button" lang="en">English</button><button type="button" lang="fa" dir="rtl">فارسی</button></div>
    </div>
  </div></div>
  <div class="controls">
    <h3>${label}</h3>
    <p>All ten together on Senso's welcome screen (iPhone 13 size), with the motion planned for step 2. Every load is a new random draw.</p>
    <button type="button" data-replay>Replay (new random draw)</button>
    <label><input type="checkbox" data-still> Still (what reduced motion shows)</label>
    <p class="readout" data-readout></p>
  </div>
</div>`;

const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 64px; font: 15px/1.45 system-ui, -apple-system, sans-serif; color: #1d1d1f; background: #fff; }
h1 { font-size: 26px; margin: 0 0 6px; } h2 { font-size: 22px; margin: 40px 0 12px; } h3 { font-size: 17px; margin: 0 0 8px; }
h3 b { display: inline-block; min-width: 2.6em; padding: 1px 8px; margin-right: 6px; border-radius: 999px; background: #1d1d1f; color: #fff; font-size: 15px; text-align: center; }
h3 small { font-weight: 400; color: #6b6b6b; margin-left: 6px; }
p.lead { max-width: 70ch; color: #444; margin: 0 0 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 16px; }
.card { border: 1px solid #e5e5ea; border-radius: 16px; padding: 14px 14px 10px; }
.panes { display: grid; grid-template-columns: 168px 168px 1fr; gap: 10px; }
.pane { position: relative; height: 240px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; border: 1px solid #ececf0; }
.pane > span { position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 8px; font-size: 11px; color: #6b6b6b; text-align: center; background: rgba(255,255,255,.55); }
.pane.big svg { width: 168px; height: 168px; }
/* the Welcome group's tokens, on the root as the page's own <style> sets them (a gradient reads its colour where it is defined, not where it is used) */
:root { --c-welcome-bg: ${COLORS.bg}; --c-welcome-snow: ${COLORS.snow}; --c-welcome-leaves: ${COLORS.leaves}; }
.senso { background: ${COLORS.bg}; }
.snowc svg, [data-demo="snow"] .scene { color: var(--c-welcome-snow); } /* snow is drawn in currentColor: the Winter snow token */
.pane.sizes { grid-auto-flow: column; align-items: center; justify-content: space-evenly; }
.meta { margin: 8px 0 0; font-size: 12px; color: #6b6b6b; }
table { border-collapse: collapse; font-size: 13px; margin: 8px 0 0; } td, th { padding: 3px 10px 3px 0; text-align: left; border-bottom: 1px solid #ececf0; } th { font-weight: 600; }
.demo { display: grid; grid-template-columns: 410px 1fr; gap: 24px; align-items: start; margin-top: 16px; }
.phone { padding: 10px; border-radius: 48px; background: #111; width: 410px; }
.frame { position: relative; width: var(--w); height: var(--h); border-radius: 40px; overflow: hidden; display: grid; place-items: center; color: ${COLORS.text}; }
.controls button { font: inherit; padding: 8px 14px; border-radius: 999px; border: 1px solid #d2d2d7; background: #fff; cursor: pointer; }
.controls label { display: block; margin-top: 10px; }
.readout { font-size: 12px; color: #6b6b6b; white-space: pre-wrap; }
.note { background: #f5f5f7; border-radius: 12px; padding: 12px 14px; max-width: 80ch; }

/* ---- the welcome card, as src/styles/public.css draws it (2026-10-09) ---- */
.welcome-card { position: relative; display: grid; justify-items: center; gap: 24px; width: min(100% - 48px, 340px); padding-bottom: 4vh; text-align: center; }
.welcome-logo { width: min(70%, 280px); height: auto; }
.welcome-greet { display: grid; gap: 6px; margin: 0; }
.welcome-greet > span { display: block; font-size: 26px; font-weight: 600; line-height: 1.2; letter-spacing: -.01em; }
.welcome-greet > span[lang="fa"] { font-size: 24px; letter-spacing: 0; }
.welcome-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
.welcome-buttons button { min-height: 56px; padding: 0 16px; border: 0; border-radius: 9999px; background: ${COLORS.btnBg}; color: ${COLORS.btnText}; font: inherit; font-size: 20px; font-weight: 600; line-height: 1.2; }

/* ---- the scene engine (the step-2 motion, previewed here) ----
   .p places a particle (its start column --x as a fraction of the width, its size --s, its layer opacity --o);
   .y falls (linear, --d long, started --l earlier so the scene is full on the first frame) and drifts sideways by --dr;
   .s swings like a pendulum (--sw wide, --sp per swing, ease-in to the centre, ease-out to the far side, dipping --dip at the centre);
   .w flutters in 3D (rotateX/Y/Z up to --rx/--ry/--rz, --fp per cycle). Snow: no flutter, a slow turn for crystals, none for soft flakes. */
.scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.scene .p { position: absolute; left: calc(var(--x) * 100%); top: 0; width: var(--s); height: var(--s); margin-left: calc(var(--s) * -.5); opacity: var(--o); }
.scene .y, .scene .s, .scene .w { display: block; width: 100%; height: 100%; will-change: transform; }
.scene .y { animation: fall var(--d) linear var(--l) infinite; }
.scene .s { animation: sway var(--sp) var(--l) infinite alternate; }
.scene .w { animation: flutter var(--fp) ease-in-out var(--l) infinite alternate; }
.scene .snow .w { animation: spin var(--fp) linear var(--l) infinite; }
.scene .soft .w { animation: none; }
@keyframes fall { from { transform: translate3d(0, calc(var(--s) * -1.3), 0); } to { transform: translate3d(var(--dr), calc(var(--h) + var(--s) * .4), 0); } }
@keyframes sway { 0% { transform: translate(calc(var(--sw) * -1), 0); animation-timing-function: ease-in; } 50% { transform: translate(0, var(--dip)); animation-timing-function: ease-out; } 100% { transform: translate(var(--sw), 0); } }
@keyframes flutter {
  0% { transform: perspective(260px) rotateX(calc(var(--rx) * -1)) rotateY(calc(var(--ry) * -.5)) rotateZ(calc(var(--rz) * -1)); }
  50% { transform: perspective(260px) rotateX(calc(var(--rx) * .2)) rotateY(calc(var(--ry) * .3)) rotateZ(calc(var(--rz) * .1)); }
  100% { transform: perspective(260px) rotateX(calc(var(--rx) * .6)) rotateY(var(--ry)) rotateZ(var(--rz)); }
}
@keyframes spin { to { transform: rotate(360deg); } }
.scene.still .y, .scene.still .s, .scene.still .w { animation: none; }
.scene.still .p { top: calc(var(--y) * 100%); transform: rotate(var(--rz)); }
@media (prefers-reduced-motion: reduce) { .scene .y, .scene .s, .scene .w { animation: none !important; } }
`;

// The engine. makeScene draws a random scene into a .scene element (its frame's --w/--h give the size); makeStill the resting
// composition. Returns the particle parameters (so two loads can be compared).
const js = `
(function () {
  var LEAF = ${JSON.stringify(LEAVES.map((c) => c.no))}, SNOW = ${JSON.stringify(FLAKES.map((c) => c.no))}, SOFT = ['W8', 'W9', 'W10'];
  var LAYERS = {
    leaves: { base: 44, far: { n: 9, size: [.42, .6], dur: [15, 22], op: [.35, .55], sway: [6, 12], sp: [3.4, 5.2], drift: [-.1, .1], fp: [6, 9] },
              mid: { n: 9, size: [.65, .9], dur: [10, 15], op: [.7, .9], sway: [12, 22], sp: [2.8, 4.2], drift: [-.16, .16], fp: [5, 7.5] },
              near: { n: 2, size: [1, 1.3], dur: [7.5, 10.5], op: [.85, .95], sway: [20, 34], sp: [2.4, 3.6], drift: [-.22, .22], fp: [4.2, 6.5] } },
    snow: { base: 26, far: { n: 9, size: [.45, .65], dur: [14, 20], op: [.4, .6], sway: [4, 8], sp: [3.5, 6], drift: [-.06, .06], fp: [30, 48] },
            mid: { n: 9, size: [.7, .95], dur: [10, 14], op: [.7, .9], sway: [6, 12], sp: [3, 5], drift: [-.1, .1], fp: [24, 40] },
            near: { n: 2, size: [1, 1.3], dur: [8, 11], op: [.85, 1], sway: [8, 16], sp: [2.8, 4.4], drift: [-.14, .14], fp: [20, 32] } }
  };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
  function particle(kind, layer, design, w, h) {
    var K = LAYERS[kind], L = K[layer], size = Math.round(K.base * rnd(L.size[0], L.size[1]) * (SOFT.indexOf(design) >= 0 ? 1.4 : 1)), d = r1(rnd(L.dur[0], L.dur[1]));
    return { design: design, layer: layer, x: r1(rnd(.02, .98) * 100) / 100, s: size, d: d, l: r1(-rnd(0, d)), o: r1(rnd(L.op[0], L.op[1]) * 100) / 100, sw: Math.round(rnd(L.sway[0], L.sway[1])), sp: r1(rnd(L.sp[0], L.sp[1])), dr: Math.round(rnd(L.drift[0], L.drift[1]) * w), rx: Math.round(rnd(10, 28)), ry: Math.round(rnd(15, 40)), rz: Math.round(rnd(5, 16)), fp: r1(rnd(L.fp[0], L.fp[1])), dip: Math.round(rnd(4, 10)) };
  }
  function el(p, kind) {
    var i = document.createElement('i'); i.className = 'p ' + p.layer + (kind === 'snow' ? ' snow' : '') + (SOFT.indexOf(p.design) >= 0 ? ' soft' : '');
    var st = '--x:' + p.x + ';--s:' + p.s + 'px;--d:' + p.d + 's;--l:' + p.l + 's;--o:' + p.o + ';--sw:' + p.sw + 'px;--sp:' + p.sp + 's;--dr:' + p.dr + 'px;--rx:' + p.rx + 'deg;--ry:' + p.ry + 'deg;--rz:' + p.rz + 'deg;--fp:' + p.fp + 's;--dip:' + (kind === 'snow' ? 0 : p.dip) + 'px';
    if (p.y != null) st += ';--y:' + p.y;
    i.setAttribute('style', st);
    i.innerHTML = '<b class="y"><b class="s"><svg class="w" viewBox="0 0 64 64" focusable="false"><use href="#' + p.design + '"/></svg></b></b>';
    return i;
  }
  var size = function (root) { var w = root.clientWidth || 390, h = root.clientHeight || 844; root.style.setProperty('--w', w + 'px'); root.style.setProperty('--h', h + 'px'); return [w, h]; };
  function makeScene(root, kind, designs) {
    var wh = size(root), w = wh[0], h = wh[1], K = LAYERS[kind], out = [];
    root.classList.remove('still'); root.innerHTML = '';
    ['far', 'mid', 'near'].forEach(function (layer) { for (var i = 0; i < K[layer].n; i++) out.push(particle(kind, layer, pick(designs), w, h)); });
    out.forEach(function (p) { root.appendChild(el(p, kind)); });
    return out;
  }
  // Reduced motion: a few designs resting naturally, low on the screen and along the sides, turned a little each.
  function makeStill(root, kind, designs) {
    var w = size(root)[0], out = [];
    root.innerHTML = ''; root.classList.add('still');
    // leaves rest low on the screen and along the sides; snow hangs scattered over the whole screen
    var spots = kind === 'snow' ? [[.1, .08], [.5, .05], [.85, .12], [.25, .25], [.7, .3], [.08, .45], [.92, .5], [.3, .7], [.6, .78], [.15, .9], [.8, .92], [.45, .95]] : [[.08, .86], [.22, .93], [.38, .9], [.56, .95], [.72, .88], [.9, .92], [.05, .3], [.94, .55], [.9, .12], [.12, .6]];
    for (var i = 0; i < (kind === 'snow' ? 12 : 8); i++) { var p = particle(kind, i < 2 ? 'near' : i < 6 ? 'mid' : 'far', pick(designs), w, 0); p.x = spots[i][0] + rnd(-.03, .03); p.y = spots[i][1] + rnd(-.03, .03); p.rz = Math.round(rnd(-60, 60)); out.push(p); root.appendChild(el(p, kind)); }
    return out;
  }
  var greet = function () { var t = new Date().getHours(); return t >= 5 && t < 12 ? ['Good morning', 'صبح بخیر'] : t >= 12 && t < 17 ? ['Good afternoon', 'ظهر بخیر'] : ['Good evening', 'عصر بخیر']; }();
  document.querySelectorAll('[data-greet]').forEach(function (e) { e.textContent = greet[0]; });
  document.querySelectorAll('[data-greet-fa]').forEach(function (e) { e.textContent = greet[1]; });
  // each candidate falling on its own: one near-layer particle, centred
  document.querySelectorAll('.scene[data-alone]').forEach(function (root) {
    var wh = size(root), kind = root.dataset.kind, p = particle(kind, 'near', root.dataset.alone, wh[0], wh[1]); p.x = .5; p.dr = 0; p.l = r1(-p.d * .35); p.o = .95; root.appendChild(el(p, kind));
  });
  // the full demos
  document.querySelectorAll('[data-demo]').forEach(function (frame) {
    var kind = frame.dataset.demo, designs = kind === 'snow' ? SNOW : LEAF, root = frame.querySelector('.scene'), box = frame.closest('.demo'), still = box.querySelector('[data-still]'), readout = box.querySelector('[data-readout]');
    var draw = function () { var ps = still.checked ? makeStill(root, kind, designs) : makeScene(root, kind, designs); readout.textContent = ps.length + ' particles (' + ps.filter(function (p) { return p.layer === 'near'; }).length + ' near, ' + ps.filter(function (p) { return p.layer === 'mid'; }).length + ' middle, ' + ps.filter(function (p) { return p.layer === 'far'; }).length + ' far): ' + ps.map(function (p) { return p.design + '@' + Math.round(p.x * 100) + '%/' + p.s + 'px/' + p.d + 's'; }).join(', '); };
    box.querySelector('[data-replay]').addEventListener('click', draw); still.addEventListener('change', draw); draw();
  });
})();`;

const table = `<table><tr><th>No.</th><th>Design</th><th>gzipped</th><th>raw</th></tr>${sizes.map((s) => `<tr><td>${s.no}</td><td>${s.name}</td><td>${s.gz} B</td><td>${s.raw} B</td></tr>`).join('')}<tr><td></td><td>shared gradients (spots, crease)</td><td>${sharedGz} B</td><td>${SHARED_DEFS.length} B</td></tr><tr><td></td><td><b>all ten leaves</b></td><td><b>${kb(gz(LEAVES.map((c) => c.defs + c.symbol).join('') + SHARED_DEFS))}</b></td><td>${kb(LEAVES.reduce((n, c) => n + (c.defs + c.symbol).length, 0) + SHARED_DEFS.length)}</td></tr><tr><td></td><td><b>all ten snowflakes</b></td><td><b>${kb(gz(FLAKES.map((c) => c.defs + c.symbol).join('')))}</b></td><td>${kb(FLAKES.reduce((n, c) => n + (c.defs + c.symbol).length, 0))}</td></tr><tr><td></td><td>the scene engine (its CSS and script, as previewed here)</td><td>${kb(gz(css.slice(css.indexOf('/* ---- the scene engine')) + js))}</td><td></td></tr></table>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome artwork candidates — Senso</title>
<style>${css}</style>
</head>
<body>
<h1>Welcome artwork candidates — Senso</h1>
<p class="lead">Ten fall leaves (F1–F10) and ten snowflakes (W1–W10), all original inline SVG, each defined once as a symbol. Pick 5 to 7 per season and reply with the numbers. Built ${new Date().toISOString().slice(0, 10)}${commit ? ` from ${commit.slice(0, 7)}` : ''} by <code>reports/welcome/gallery/build.mjs</code> (the artwork in <code>art.mjs</code>). Our tool, not a public page.</p>
<div class="note"><p><b>How to read a card:</b> the design large and still; the same design falling on its own with the step-2 motion (near layer); the design at the far, middle and near sizes on Senso's welcome background (cream <code>${COLORS.bg}</code>). Under each season, the full-scene demo shows all ten together on a replica of Senso's welcome screen; <b>Replay</b> draws a new random scene, <b>Still</b> shows the reduced-motion composition.</p>
<p><b>Colours:</b> the leaves carry their own natural palettes (orange, rust, gold, red, brown, two-tone turning); they are not tinted by the Style tab's "Fall leaves" token (open question in the reply). The snow is drawn in the "Winter snow" token colour, which is <code>${COLORS.snow}</code> on Senso's cream (the Auto rule); W2 and W4 carry white plates.</p>
<p><b>Sizes</b> (each candidate alone, gzipped; the step-2 budget is 15 KB gzipped for everything inline, artwork included):</p>${table}</div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${SHARED_DEFS}${[...LEAVES, ...FLAKES].map((c) => c.defs + c.symbol).join('')}</defs></svg>

<h2 id="fall">Fall — F1 to F10</h2>
<div class="grid">${LEAVES.map((c) => card(c, 'leaves')).join('')}</div>
${demo('fall', 'leaves', 'Fall, all ten together')}

<h2 id="winter">Winter — W1 to W10</h2>
<div class="grid">${FLAKES.map((c) => card(c, 'snow')).join('')}</div>
${demo('winter', 'snow', 'Winter, all ten together')}

<script>${js}</script>
</body>
</html>
`;
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${kb(Buffer.byteLength(html))}, ${kb(gz(html))} gzipped)`);
console.log('candidate | gzipped B | raw B');
for (const s of sizes) console.log(`${s.no.padEnd(4)} ${s.name.padEnd(18)} | ${String(s.gz).padStart(5)} | ${String(s.raw).padStart(5)}`);
console.log(`shared defs ${sharedGz} B gz; all leaves ${kb(gz(LEAVES.map((c) => c.defs + c.symbol).join('') + SHARED_DEFS))} gz; all flakes ${kb(gz(FLAKES.map((c) => c.defs + c.symbol).join('')))} gz; engine ${kb(gz(css.slice(css.indexOf('/* ---- the scene engine')) + js))} gz`);
