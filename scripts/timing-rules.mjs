// Two public-page timing checks, judged by the PM's rulings of 2026-10-13 (after check:full runs failed on a single tap or frame):
//   persianTapRule(taps): the Persian tap (transition drill, persian-tap-senso). Each tap is { key, done, ms } (the longest task from
//     the tap to the overlay gone, CPU 4×). Both suites measure 40 taps (check:full one on each of the 40 versions; npm run check 10 on
//     each of the 4 chosen ones, the PM's ruling); it passes when at most 2 of them are over 50 ms, none is over 100 ms, and every tap was
//     measured. All the taps are printed. (It was: none over 50 ms.)
//   FIRST: the season drill's in-page sample of the first frame that shows the welcome card: where each of the scene's particles is drawn
//     (its box), and the animation clocks (information since this ruling); when a clock had not started, the frames until every one ran.
//   firstFrameRule(f): that frame judged by drawn positions (the PM, 2026-10-13): at least 3/4 of the particles inside the screen (by
//     their centre) and particles in at least 3 of the 4 vertical quarters of the screen. A frame whose animations have not started (every
//     particle at its start, above the screen) fails both. The particles above the top edge are counted and printed, not judged (a
//     particle just starting its fall is there in a correct frame); the clocks (a pending clock is the browser's start report racing the
//     card's frame: reports/spring-first-frame/) are printed, never judged.
// Pure: the drills, the evidence scripts and scripts/timing-rules-selftest.mjs call the same functions.

export const TAP_LIMIT = 50, TAP_CEILING = 100;
export function persianTapRule(taps, want = taps.length) {
  const measured = taps.filter((x) => x.done), over = taps.filter((x) => x.done && x.ms > TAP_LIMIT), tooLong = taps.filter((x) => x.done && x.ms > TAP_CEILING);
  const allowed = Math.floor(want / 20); // 2 of the 40 taps both suites measure
  const pass = taps.length === want && measured.length === want && over.length <= allowed && tooLong.length === 0;
  const text = `${measured.length} of ${want} taps measured; over ${TAP_LIMIT} ms: ${over.length} (at most ${allowed} allowed)${over.length ? `: ${over.map((x) => `${x.key} ${x.ms} ms`).join(', ')}` : ''}; over ${TAP_CEILING} ms: ${tooLong.length} (none allowed); every tap's longest task: ${taps.map((x) => `${x.key} ${x.done ? x.ms : '—'}`).join(', ')} ms`;
  return { pass, over: over.length, allowed, tooLong: tooLong.length, worst: Math.max(0, ...measured.map((x) => x.ms || 0)), text };
}

// In the page (serialised by Playwright): resolves on the first animation frame in which the welcome card is in the page.
export const FIRST = () => new Promise((res) => {
  const tick = () => {
    const w = document.getElementById('welcome');
    if (!(w && w.querySelector('button[data-lang]'))) { requestAnimationFrame(tick); return; }
    const s = w.querySelector('.scene'), anims = s ? s.getAnimations({ subtree: true }) : [], W = innerWidth, H = innerHeight;
    const boxes = s ? [...s.querySelectorAll('.p')].map((e) => { const b = e.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, top: b.top, bottom: b.bottom }; }) : [];
    const inside = boxes.filter((b) => b.cx >= 0 && b.cx <= W && b.cy >= 0 && b.cy <= H);
    const quarters = [0, 1, 2, 3].map((q) => inside.filter((b) => Math.min(3, Math.floor((b.cy / H) * 4)) === q).length);
    const r = {
      t: Math.round(performance.now()), w: W, h: H, particles: boxes.length, inside: inside.length, quarters, above: boxes.filter((b) => b.bottom <= 0).length,
      animations: anims.length, notRunning: anims.filter((a) => !(a.currentTime > 0)).length, minCurrent: anims.length ? Math.round(Math.min(...anims.map((a) => a.currentTime || 0))) : null,
      atZero: anims.filter((a) => !(a.currentTime > 0)).slice(0, 4).map((a) => `${a.animationName || a.constructor.name}${a.pending ? ' (pending)' : ''} on ${(a.effect && a.effect.target && (a.effect.target.getAttribute('class') || a.effect.target.tagName)) || '?'}`),
      frames: 0,
    };
    r.midFlight = r.animations > 0 && r.notRunning === 0;
    if (!r.notRunning) { res(r); return; }
    const wait = () => { r.frames++; if (s.getAnimations({ subtree: true }).every((a) => a.currentTime > 0) || r.frames > 60) res(r); else requestAnimationFrame(wait); };
    requestAnimationFrame(wait);
  };
  tick();
});

export function firstFrameRule(f) {
  const needInside = Math.ceil((f.particles * 3) / 4), quartersUsed = f.quarters.filter((n) => n > 0).length;
  const pass = f.particles > 0 && f.inside >= needInside && quartersUsed >= 3;
  const clocks = f.animations ? `${f.notRunning ? `${f.notRunning} of ${f.animations} clocks not started yet (every one running ${f.frames > 60 ? 'not within 60 frames' : `${f.frames} frame(s) later`})` : `all ${f.animations} clocks running`}` : 'no animation';
  const text = `${f.inside} of ${f.particles} particles inside the screen (at least ${needInside}), in ${quartersUsed} of 4 vertical quarters (${f.quarters.join(' / ')}, at least 3), information only: ${f.above} entirely above the top edge, ${clocks}`;
  return { pass, needInside, quartersUsed, text };
}
