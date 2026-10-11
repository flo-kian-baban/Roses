// Builds reports/welcome/summer-gallery.html, the picking tool for Kian's summer scene (our tool, not a public page; one
// self-contained file: the Senso logo is inlined). Usage: node reports/welcome/summer/build.mjs — prints each concept's size.
//
// Six concepts (U1–U6, art.mjs), each running live on a replica of Senso's welcome screen at iPhone 13 size (the served colours
// and the real card markup and CSS of 2026-10-09), with the motion that would ship: every parameter random per load, the scene
// full on the first frame (negative delays), transform and opacity only, at most 20 particles, no blur. "Still" shows what a
// phone with reduced motion would get. Under each phone, the concept's designs large, to judge the drawing.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CONCEPTS, DESIGNS, SHARED } from './art.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.join(here, '..', 'summer-gallery.html');
const gz = (s) => zlib.gzipSync(Buffer.from(s)).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/brand/senso-logo.png')).toString('base64')}`;
const head = (() => { try { const h = fs.readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim(); return h.startsWith('ref:') ? h.slice(5).split('/').pop() : h.slice(0, 7); } catch { return ''; } })();

// Senso's welcome colours as served (the Welcome group's tokens of 2026-10-09).
const COLORS = { bg: '#fff8ee', text: '#1d1d1f', btnBg: '#f2ece2', btnText: '#1d1d1f' };

const artOf = (c) => [...c.designs, ...(c.extras || [])].map((d) => DESIGNS[d].symbol).join('') + c.shared.map((s) => SHARED[s]).join('');
const sizes = Object.fromEntries(CONCEPTS.map((c) => [c.no, { raw: artOf(c).length, gz: gz(artOf(c)) }]));

const tile = (d, vb = '0 0 64 64') => `<figure class="tile"><svg viewBox="${vb}"><use href="#${d.no}"/></svg><figcaption><b>${d.no}</b> ${d.name}</figcaption></figure>`;
const butterflyTile = (d) => `<figure class="tile"><span class="bfly still-wings" style="width:96px;height:77px"><span class="wl"><svg viewBox="0 0 40 64"><use href="#${d.no}"/></svg></span><span class="wr"><svg viewBox="0 0 40 64"><use href="#${d.no}"/></svg></span><svg class="bd" viewBox="0 0 12 64"><use href="#Bbody"/></svg></span><figcaption><b>${d.no}</b> ${d.name}</figcaption></figure>`;
const parts = (c) => {
  if (c.mode === 'sun') return `<figure class="tile wide"><span class="sunstill"><svg viewBox="0 0 200 200"><use href="#Uflames"/></svg><svg viewBox="0 0 200 200"><use href="#Urays"/></svg><svg viewBox="0 0 200 200"><use href="#Udisc"/></svg></span><figcaption>the sun: disc, straight rays, flame rays</figcaption></figure><figure class="tile"><svg viewBox="0 0 24 24"><use href="#Uspark"/></svg><figcaption>sparkle</figcaption></figure><figure class="tile"><svg viewBox="0 0 24 24" style="width:40px;height:40px"><use href="#Umote"/></svg><figcaption>mote of light</figcaption></figure>`;
  return [...c.designs, ...(c.extras || [])].map((d) => (c.mode === 'wander' ? butterflyTile(DESIGNS[d]) : tile(DESIGNS[d]))).join('');
};
const concept = (c) => `<section class="concept" id="${c.no}">
  <h2><b>${c.no}</b> ${c.name} <span lang="fa" dir="rtl">${c.fa}</span></h2>
  <div class="phone"><div class="frame senso" data-concept="${c.no}">
    <div class="scene"></div>
    <div class="welcome-card">
      <img class="welcome-logo" src="${logo}" width="271" height="143" alt="Senso Café &amp; Bites">
      <p class="welcome-greet"><span lang="en" data-greet></span><span lang="fa" dir="rtl" data-greet-fa></span></p>
      <div class="welcome-buttons"><button type="button" lang="en">English</button><button type="button" lang="fa" dir="rtl">فارسی</button></div>
    </div>
  </div></div>
  <p class="desc">${c.note}</p>
  <div class="controls"><button type="button" data-replay>Replay (a new random scene)</button><label><input type="checkbox" data-still> Still (reduced motion)</label></div>
  <div class="parts">${parts(c)}</div>
  <p class="meta">Artwork ${kb(sizes[c.no].gz)} gzipped (${kb(sizes[c.no].raw)} raw) · <span data-readout></span></p>
</section>`;

const css = `
:root { color-scheme: light; --c-welcome-bg: ${COLORS.bg}; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 64px; font: 15px/1.45 system-ui, -apple-system, sans-serif; color: #1d1d1f; background: #fff; }
h1 { font-size: 26px; margin: 0 0 6px; }
h2 { font-size: 20px; margin: 0 0 10px; } h2 b { display: inline-block; padding: 1px 9px; margin-right: 6px; border-radius: 999px; background: #1d1d1f; color: #fff; font-size: 15px; vertical-align: 2px; }
h2 span { font-weight: 500; color: #6b6b6b; margin-left: 4px; }
p.lead { max-width: 78ch; color: #444; margin: 0 0 8px; }
.note { background: #f5f5f7; border-radius: 12px; padding: 12px 14px; max-width: 86ch; margin-bottom: 24px; }
.concepts { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 32px 24px; }
.concept { min-width: 0; }
.phone { padding: 10px; border-radius: 48px; background: #111; width: 410px; }
.frame { position: relative; width: 390px; height: 844px; border-radius: 40px; overflow: hidden; display: grid; place-items: center; color: ${COLORS.text}; }
.senso { background: ${COLORS.bg}; }
.desc { max-width: 410px; margin: 10px 0 6px; color: #333; }
.controls { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.controls button { font: inherit; padding: 8px 14px; border-radius: 999px; border: 1px solid #d2d2d7; background: #fff; cursor: pointer; }
.parts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; max-width: 430px; }
.tile { margin: 0; width: 132px; border: 1px solid #ececf0; border-radius: 12px; background: ${COLORS.bg}; padding: 8px 6px 6px; display: grid; justify-items: center; gap: 4px; }
.tile.wide { width: 272px; }
.tile > svg { width: 96px; height: 96px; }
.tile figcaption { font-size: 11px; color: #555; text-align: center; line-height: 1.3; } .tile figcaption b { color: #1d1d1f; }
.sunstill { position: relative; display: block; width: 160px; height: 160px; } .sunstill svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.meta { font-size: 12px; color: #6b6b6b; max-width: 430px; }
table { border-collapse: collapse; font-size: 13px; margin: 8px 0 0; } td, th { padding: 3px 12px 3px 0; text-align: left; border-bottom: 1px solid #e5e5ea; } th { font-weight: 600; }

/* ---- the welcome card, as src/styles/public.css draws it ---- */
.welcome-card { position: relative; display: grid; justify-items: center; gap: 24px; width: min(100% - 48px, 340px); padding-bottom: 4vh; text-align: center; }
.welcome-logo { width: min(70%, 280px); height: auto; }
.welcome-greet { display: grid; gap: 6px; margin: 0; }
.welcome-greet > span { display: block; font-size: 26px; font-weight: 600; line-height: 1.2; letter-spacing: -.01em; }
.welcome-greet > span[lang="fa"] { font-size: 24px; letter-spacing: 0; }
.welcome-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 300px; }
.welcome-buttons button { min-height: 48px; padding: 0 16px; border: 0; border-radius: 9999px; background: ${COLORS.btnBg}; color: ${COLORS.btnText}; font: inherit; font-size: 17px; font-weight: 600; line-height: 1.2; }

/* ---- the scene engine ----
   .p is a particle at the frame's top left, --s wide, at its layer's opacity --o; .y carries the journey, .s the swing or bob,
   .w the turn, flutter or wobble. Transform and opacity only. */
.scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.scene .p { position: absolute; left: 0; top: 0; width: var(--s); height: var(--s); opacity: var(--o); }
.scene .y, .scene .s, .scene .w { display: block; width: 100%; height: 100%; will-change: transform; }
.scene svg { display: block; width: 100%; height: 100%; overflow: visible; }
/* fall: U3 fruit, U6 petals (the fall leaves' motion: down, a pendulum swing dipping at its centre, a 3D flutter) */
.scene .m-fall { left: calc(var(--x) * 100%); margin-left: calc(var(--s) * -.5); }
.m-fall .y { animation: fall var(--d) linear var(--l) infinite; }
.m-fall .s { animation: sway var(--sp) var(--l) infinite alternate; }
.m-fall .w { animation: flutter var(--fp) ease-in-out var(--l) infinite alternate; }
@keyframes fall { from { transform: translate3d(0, calc(var(--s) * -1.3), 0); } to { transform: translate3d(var(--dr), calc(var(--h) + var(--s) * .4), 0); } }
@keyframes sway { 0% { transform: translate(calc(var(--sw) * -1), 0); animation-timing-function: ease-in; } 50% { transform: translate(0, var(--dip)); animation-timing-function: ease-out; } 100% { transform: translate(var(--sw), 0); } }
@keyframes flutter {
  0% { transform: perspective(260px) rotateX(calc(var(--rx) * -1)) rotateY(calc(var(--ry) * -.5)) rotateZ(calc(var(--rz) * -1)); }
  50% { transform: perspective(260px) rotateX(calc(var(--rx) * .2)) rotateY(calc(var(--ry) * .3)) rotateZ(calc(var(--rz) * .1)); }
  100% { transform: perspective(260px) rotateX(calc(var(--rx) * .6)) rotateY(var(--ry)) rotateZ(var(--rz)); }
}
/* drift: U1, across from the left on the breeze, rising or sinking a little, bobbing, tilting */
.m-drift .y { animation: breeze var(--d) linear var(--l) infinite; }
@keyframes breeze { from { transform: translate3d(calc(var(--s) * -1.1), var(--y0), 0); } to { transform: translate3d(calc(var(--w) + var(--s) * .2), var(--y1), 0); } }
.m-drift .s { animation: bob var(--sp) ease-in-out var(--l) infinite alternate; }
.m-drift .w { animation: tilt var(--fp) ease-in-out var(--l) infinite alternate; }
@keyframes bob { from { transform: translateY(calc(var(--sw) * -1)); } to { transform: translateY(var(--sw)); } }
@keyframes tilt { from { transform: rotate(calc(var(--rz) * -1)); } to { transform: rotate(var(--rz)); } }
/* rise: U4 bubbles (wobble and a slight squash), lemon and mint among them (a slow tumble), U5 motes */
.scene .m-rise { left: calc(var(--x) * 100%); margin-left: calc(var(--s) * -.5); }
.m-rise .y { animation: rise var(--d) linear var(--l) infinite; }
.m-rise .s { animation: wobble var(--sp) ease-in-out var(--l) infinite alternate; }
.m-rise .w { animation: squash var(--fp) ease-in-out var(--l) infinite alternate; }
.m-rise.x .w { animation: flutter var(--fp) ease-in-out var(--l) infinite alternate; }
@keyframes rise { from { transform: translate3d(0, calc(var(--h) + var(--s) * .3), 0); } to { transform: translate3d(var(--dr), calc(var(--s) * -1.3), 0); } }
@keyframes wobble { from { transform: translateX(calc(var(--sw) * -1)); } to { transform: translateX(var(--sw)); } }
@keyframes squash { from { transform: scale(1.04, .96); } to { transform: scale(.96, 1.04); } }
/* wander: U2, four waypoints (back to the first), easing in and out at each, the body tilting toward its way, bobbing; the
   wings (one symbol, mirrored for the left) flap in 3D about the body with an uneven beat */
.scene .m-wander, .scene .m-still-wander { height: calc(var(--s) * .8); }
.m-wander .y { animation: wander var(--d) ease-in-out var(--l) infinite; }
.m-wander .s { animation: bob var(--sp) ease-in-out var(--l) infinite alternate; }
@keyframes wander {
  0% { transform: translate3d(var(--x0), var(--y0), 0) rotate(var(--a0)); } 25% { transform: translate3d(var(--x1), var(--y1), 0) rotate(var(--a1)); }
  50% { transform: translate3d(var(--x2), var(--y2), 0) rotate(var(--a2)); } 75% { transform: translate3d(var(--x3), var(--y3), 0) rotate(var(--a3)); }
  100% { transform: translate3d(var(--x0), var(--y0), 0) rotate(var(--a0)); }
}
.bfly { position: relative; display: block; width: 100%; height: 100%; }
.bfly .wl, .bfly .wr { position: absolute; top: 0; width: 50%; height: 100%; display: block; }
.bfly .wl { left: 0; transform-origin: right center; animation: flapL var(--fp) linear var(--l) infinite; }
.bfly .wr { right: 0; transform-origin: left center; animation: flapR var(--fp) linear var(--l) infinite; }
.bfly .wl svg { transform: scaleX(-1); }
.bfly .bd { position: absolute; left: 42.5%; top: 0; width: 15%; height: 100%; }
@keyframes flapR { 0%, 100% { transform: perspective(160px) rotateY(-14deg); } 16% { transform: perspective(160px) rotateY(-74deg); } 32% { transform: perspective(160px) rotateY(-10deg); } 50% { transform: perspective(160px) rotateY(-68deg); } 68% { transform: perspective(160px) rotateY(-16deg); } 84% { transform: perspective(160px) rotateY(-24deg); } }
@keyframes flapL { 0%, 100% { transform: perspective(160px) rotateY(14deg); } 16% { transform: perspective(160px) rotateY(74deg); } 32% { transform: perspective(160px) rotateY(10deg); } 50% { transform: perspective(160px) rotateY(68deg); } 68% { transform: perspective(160px) rotateY(16deg); } 84% { transform: perspective(160px) rotateY(24deg); } }
.still-wings .wl { animation: none; transform: perspective(160px) rotateY(28deg); } .still-wings .wr { animation: none; transform: perspective(160px) rotateY(-28deg); }
/* sun: U5, its rays turning one way, its flames the other and breathing; sparkles twinkling */
.sun { position: absolute; width: var(--sz); height: var(--sz); right: calc(var(--sz) * -.3); top: calc(var(--sz) * -.3); }
.sun > * { position: absolute; inset: 0; display: block; }
.sun .rays { animation: turn 140s linear infinite; }
.sun .fl { animation: breathe 7s ease-in-out infinite alternate; } .sun .fl svg { animation: turn 190s linear infinite reverse; }
@keyframes turn { to { transform: rotate(360deg); } }
@keyframes breathe { from { transform: scale(.96); } to { transform: scale(1.04); } }
.m-twinkle .w { animation: twinkle var(--d) ease-in-out var(--l) infinite; }
@keyframes twinkle { 0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; } 45% { transform: scale(1) rotate(45deg); opacity: 1; } 60% { transform: scale(.9) rotate(55deg); opacity: .9; } 85% { transform: scale(0) rotate(90deg); opacity: 0; } }
/* still: the reduced-motion composition */
.scene.still .p { margin: 0 !important; }
.scene.still .y, .scene.still .s, .scene.still .sun *, .scene.still .wl, .scene.still .wr { animation: none !important; }
.scene.still .w { animation: none !important; transform: rotate(var(--rz0, 0deg)) scale(var(--k0, 1)); }
.scene.still .wl { transform: perspective(160px) rotateY(30deg); } .scene.still .wr { transform: perspective(160px) rotateY(-30deg); }
@media (prefers-reduced-motion: reduce) { .scene *, .scene .sun * { animation: none !important; } }
`;

// The engine: makeScene draws a random scene of a concept into its frame; makeStill the resting composition. Both return the
// particles' parameters (shown under the phone, so two loads can be compared).
const js = `
(function () {
  var CONCEPTS = ${JSON.stringify(Object.fromEntries(CONCEPTS.map((c) => [c.no, { mode: c.mode, designs: c.designs, extras: c.extras || [] }])))};
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
  var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  // layers per mode: count, size factor of the base size, duration, opacity, swing, swing period, drift, flutter period
  var MODES = {
    fall: { base: 44, far: { n: 9, size: [.5, .68], dur: [16, 23], op: [.4, .6], sway: [6, 12], sp: [3.4, 5.2], drift: [-.1, .1], fp: [6, 9] },
            mid: { n: 9, size: [.72, .95], dur: [11, 16], op: [.75, .9], sway: [12, 22], sp: [2.8, 4.2], drift: [-.16, .16], fp: [5, 7.5] },
            near: { n: 2, size: [1.1, 1.35], dur: [8, 11], op: [.9, 1], sway: [20, 34], sp: [2.4, 3.6], drift: [-.22, .22], fp: [4.2, 6.5] } },
    drift: { base: 64, far: { n: 8, size: [.48, .62], dur: [26, 36], op: [.45, .6], sway: [5, 10], sp: [3.5, 5.5], fp: [5, 8] },
             mid: { n: 8, size: [.72, .9], dur: [19, 26], op: [.7, .85], sway: [8, 14], sp: [3, 4.5], fp: [4, 6.5] },
             near: { n: 2, size: [1.1, 1.35], dur: [13, 17], op: [.85, .95], sway: [10, 18], sp: [2.6, 3.8], fp: [3.5, 5.5] } },
    rise: { base: 34, far: { n: 8, size: [.4, .62], dur: [13, 18], op: [.5, .7], sway: [2, 5], sp: [1.2, 2], drift: [-.04, .04], fp: [1.4, 2.2] },
            mid: { n: 8, size: [.7, 1], dur: [9, 13], op: [.75, .9], sway: [3, 7], sp: [1, 1.7], drift: [-.06, .06], fp: [1.2, 2] },
            near: { n: 2, size: [1.3, 1.7], dur: [7, 9], op: [.85, .95], sway: [5, 9], sp: [.9, 1.5], drift: [-.08, .08], fp: [1, 1.8] } },
    wander: { base: 66, far: { n: 2, size: [.5, .6], dur: [20, 28], op: [.6, .7], sway: [3, 5], sp: [.7, 1], fp: [.9, 1.3] },
              mid: { n: 3, size: [.75, .9], dur: [17, 24], op: [.85, .95], sway: [4, 7], sp: [.6, .9], fp: [.75, 1.05] },
              near: { n: 1, size: [1.05, 1.2], dur: [15, 20], op: [1, 1], sway: [5, 8], sp: [.55, .8], fp: [.65, .9] } }
  };
  var size = function (frame) { var w = frame.clientWidth || 390, h = frame.clientHeight || 844; frame.style.setProperty('--w', w + 'px'); frame.style.setProperty('--h', h + 'px'); return [w, h]; };
  function wrap(design, mode, extra) {
    if (mode === 'wander') return '<b class="y"><b class="s"><span class="bfly"><span class="wl"><svg viewBox="0 0 40 64"><use href="#' + design + '"/></svg></span><span class="wr"><svg viewBox="0 0 40 64"><use href="#' + design + '"/></svg></span><svg class="bd" viewBox="0 0 12 64"><use href="#Bbody"/></svg></span></b></b>';
    var vb = mode === 'twinkle' || design === 'Umote' ? '0 0 24 24' : '0 0 64 64';
    return '<b class="y"><b class="s"><svg class="w" viewBox="' + vb + '"><use href="#' + design + '"/></svg></b></b>';
  }
  function add(scene, p, cls) {
    var i = document.createElement('i'); i.className = 'p ' + cls;
    i.setAttribute('style', Object.keys(p.v).map(function (k) { return k + ':' + p.v[k]; }).join(';'));
    i.innerHTML = wrap(p.design, p.mode, p.extra); scene.appendChild(i); return p;
  }
  function particle(mode, layer, design, w, h, extra) {
    var M = MODES[mode], L = M[layer], s = Math.round(M.base * rnd(L.size[0], L.size[1]) * (extra ? 1.15 : 1)), d = r1(rnd(L.dur[0], L.dur[1]) * (extra ? 1.25 : 1)), l = r1(-rnd(0, d));
    var v = { '--s': s + 'px', '--d': d + 's', '--l': l + 's', '--o': r1(rnd(L.op[0], L.op[1]) * 100) / 100, '--sw': Math.round(rnd(L.sway[0], L.sway[1])) + 'px', '--sp': r1(rnd(L.sp[0], L.sp[1])) + 's', '--fp': r1(rnd(L.fp[0], L.fp[1])) + 's' };
    if (mode === 'fall' || mode === 'rise') { v['--x'] = r1(rnd(.03, .97) * 100) / 100; v['--dr'] = Math.round(rnd(L.drift[0], L.drift[1]) * w) + 'px'; v['--rx'] = Math.round(rnd(10, 28)) + 'deg'; v['--ry'] = Math.round(rnd(15, 40)) + 'deg'; v['--rz'] = Math.round(rnd(5, 16)) + 'deg'; v['--dip'] = Math.round(rnd(4, 10)) + 'px'; }
    if (mode === 'drift') { var y0 = rnd(.04, .92) * h; v['--y0'] = Math.round(y0) + 'px'; v['--y1'] = Math.round(y0 - rnd(-.06, .22) * h) + 'px'; v['--rz'] = Math.round(rnd(6, 18)) + 'deg'; }
    if (mode === 'wander') {
      var bw = s, bh = s * .8, pts = [];
      for (var k = 0; k < 4; k++) pts.push([rnd(.02, .98) * (w - bw), rnd(.03, .97) * (h - bh)]);
      for (k = 0; k < 4; k++) { var a = pts[k], b = pts[(k + 1) % 4], dist = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; v['--x' + k] = Math.round(a[0]) + 'px'; v['--y' + k] = Math.round(a[1]) + 'px'; v['--a' + k] = Math.round((b[0] - a[0]) / dist * 34) + 'deg'; }
    }
    return { design: design, mode: mode, layer: layer, s: s, d: d, extra: extra, v: v };
  }
  function makeScene(frame, no) {
    var C = CONCEPTS[no], scene = frame.querySelector('.scene'), wh = size(frame), w = wh[0], h = wh[1], out = [];
    scene.className = 'scene'; scene.innerHTML = '';
    if (C.mode === 'sun') {
      var sz = Math.round(w * rnd(.72, .8)), sun = document.createElement('div'); sun.className = 'sun'; sun.style.setProperty('--sz', sz + 'px');
      sun.innerHTML = '<span class="fl"><svg viewBox="0 0 200 200"><use href="#Uflames"/></svg></span><svg class="rays" viewBox="0 0 200 200"><use href="#Urays"/></svg><svg viewBox="0 0 200 200"><use href="#Udisc"/></svg>';
      scene.appendChild(sun); out.push({ design: 'sun', s: sz, d: 140 });
      for (var i = 0; i < 12; i++) { // sparkles: half near the sun, half anywhere
        var near = i < 6, s = Math.round(rnd(near ? 13 : 11, near ? 22 : 20)), d = r1(rnd(2.6, 5.2)), x = near ? rnd(.42, .95) * w : rnd(.04, .92) * w, y = near ? rnd(.02, .32) * h : rnd(.05, .95) * h;
        out.push(add(scene, { design: 'Uspark', mode: 'twinkle', s: s, d: d, v: { '--s': s + 'px', '--d': d + 's', '--l': r1(-rnd(0, d)) + 's', '--o': r1(rnd(.7, 1) * 100) / 100, left: Math.round(x) + 'px', top: Math.round(y) + 'px' } }, 'm-twinkle'));
      }
      for (i = 0; i < 6; i++) { var m = particle('rise', i < 4 ? 'far' : 'mid', 'Umote', w, h); m.v['--s'] = Math.round(rnd(5, 10)) + 'px'; m.v['--d'] = r1(rnd(14, 22)) + 's'; m.v['--l'] = r1(-rnd(0, 14)) + 's'; out.push(add(scene, m, 'm-rise far')); }
      return out;
    }
    var M = MODES[C.mode];
    ['far', 'mid', 'near'].forEach(function (layer) {
      var n = M[layer].n, list = C.mode === 'wander' ? shuffle(C.designs.slice()) : null;
      for (var i = 0; i < n; i++) {
        var extra = C.extras.length && layer !== 'far' && i < 2 && C.mode === 'rise', design = extra ? C.extras[i % C.extras.length] : list ? list[i % list.length] : pick(C.designs);
        out.push(add(scene, particle(C.mode, layer, design, w, h, extra), 'm-' + C.mode + ' ' + layer + (extra ? ' x' : '')));
      }
    });
    return out;
  }
  // Reduced motion: a resting composition, kept off the card's middle band.
  var SPOTS = {
    fall: [[.08, .88], [.24, .94], [.4, .9], [.58, .95], [.74, .89], [.9, .93], [.06, .2], [.93, .55], [.88, .1], [.1, .64]],
    drift: [[.1, .1], [.32, .05], [.62, .12], [.86, .07], [.08, .82], [.3, .9], [.58, .85], [.84, .92], [.92, .4], [.04, .45]],
    rise: [[.12, .9], [.3, .84], [.5, .94], [.68, .86], [.88, .92], [.08, .74], [.92, .72], [.2, .12], [.8, .16], [.55, .06], [.4, .78], [.94, .3]],
    wander: [[.12, .1], [.7, .84], [.8, .14]]
  };
  function makeStill(frame, no) {
    var C = CONCEPTS[no], scene = frame.querySelector('.scene'), wh = size(frame), w = wh[0], h = wh[1], out = [];
    if (C.mode === 'sun') { out = makeScene(frame, no); scene.classList.add('still'); scene.querySelectorAll('.m-twinkle .w').forEach(function (e, i) { e.style.setProperty('--k0', i % 3 ? .7 : 1); e.style.setProperty('--rz0', (i * 17) + 'deg'); }); scene.querySelectorAll('.m-rise').forEach(function (e) { e.remove(); }); return out; }
    scene.className = 'scene still'; scene.innerHTML = '';
    var spots = SPOTS[C.mode], list = C.designs.concat(C.extras);
    spots.forEach(function (sp, i) {
      var p = particle(C.mode, i < 2 ? 'near' : i < 6 ? 'mid' : 'far', C.mode === 'wander' ? C.designs[i % C.designs.length] : list[i % list.length], w, h, C.mode === 'rise' && C.extras.indexOf(list[i % list.length]) >= 0);
      p.v.left = Math.round(sp[0] * w - p.s / 2) + 'px'; p.v.top = Math.round(sp[1] * h - p.s / 2) + 'px'; p.v['--rz0'] = (C.mode === 'wander' ? Math.round(rnd(-25, 25)) : Math.round(rnd(-70, 70))) + 'deg';
      if (C.mode === 'fall' || C.mode === 'rise') { delete p.v['--x']; }
      out.push(add(scene, p, 'm-still-' + C.mode + ' ' + p.layer));
    });
    return out;
  }
  var greet = function () { var t = new Date().getHours(); return t >= 5 && t < 12 ? ['Good morning', 'صبح بخیر'] : t >= 12 && t < 17 ? ['Good afternoon', 'ظهر بخیر'] : ['Good evening', 'عصر بخیر']; }();
  document.querySelectorAll('[data-greet]').forEach(function (e) { e.textContent = greet[0]; });
  document.querySelectorAll('[data-greet-fa]').forEach(function (e) { e.textContent = greet[1]; });
  document.querySelectorAll('[data-concept]').forEach(function (frame) {
    var no = frame.dataset.concept, box = frame.closest('.concept'), still = box.querySelector('[data-still]'), readout = box.querySelector('[data-readout]');
    var draw = function () {
      var ps = still.checked ? makeStill(frame, no) : makeScene(frame, no);
      readout.textContent = ps.length + ' elements: ' + ps.map(function (p) { return p.design + ' ' + p.s + 'px'; }).join(', ');
    };
    box.querySelector('[data-replay]').addEventListener('click', function () { still.checked = false; draw(); });
    still.addEventListener('change', draw); draw();
  });
})();`;

const table = `<table><tr><th>Concept</th><th>Artwork gzipped</th><th>raw</th></tr>${CONCEPTS.map((c) => `<tr><td>${c.no} ${c.name}</td><td>${kb(sizes[c.no].gz)}</td><td>${kb(sizes[c.no].raw)}</td></tr>`).join('')}<tr><td>the engine previewed here (its CSS and script, all six modes)</td><td>${kb(gz(css.slice(css.indexOf('/* ---- the scene engine')) + js))}</td><td></td></tr></table>`;
const defs = [...new Set(CONCEPTS.flatMap((c) => [...c.designs, ...(c.extras || [])]))].map((d) => DESIGNS[d].symbol).join('') + Object.values(SHARED).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Summer welcome candidates — Senso</title>
<style>${css}</style>
</head>
<body>
<h1>Summer welcome candidates — Senso</h1>
<p class="lead">Six ideas for the summer scene behind the welcome card, replacing the soft blurred light of 2026-10-09. Each phone runs live; pick one (or name a mix, for example U3's fruit with U4's bubbles) and reply with its number. Built ${new Date().toISOString().slice(0, 10)}${head ? ` on ${head}` : ''} by <code>reports/welcome/summer/build.mjs</code> (the artwork in <code>art.mjs</code>). Our tool, not a public page. <b>Renumbered U1–U6 on 2026-10-11</b> (they were S1–S6), so that S means spring in the main gallery; Kian's pick of 2026-10-10 is unchanged: U5, the Persian sun, with a few of U1's dandelion seeds, built into Senso's summer.</p>
<div class="note"><p><b>Same rules as fall and winter:</b> original drawings (inline SVG, nothing traced or stock), at most 20 moving elements, a new random scene on every load and on <b>Replay</b>, already in motion on the first frame, movement on transform and opacity only, no blur anywhere. <b>Still</b> shows what a phone with reduced motion gets. Senso's cream background and card, as served.</p>
<p><b>Scope:</b> Senso only, as with the leaves and snow; Kebab Land and the default template keep their summer scene until you confirm Senso's, then each gets its own in its own brand. Nothing on the customers' pages changes until you pick.</p>
${table}</div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>
<div class="concepts">${CONCEPTS.map(concept).join('')}</div>
<script>${js}</script>
</body>
</html>
`;
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${kb(Buffer.byteLength(html))}, ${kb(gz(html))} gzipped)`);
for (const c of CONCEPTS) console.log(`${c.no} ${c.name.padEnd(20)} artwork ${kb(sizes[c.no].gz)} gz (${kb(sizes[c.no].raw)} raw)`);
console.log(`engine ${kb(gz(css.slice(css.indexOf('/* ---- the scene engine')) + js))} gz`);
