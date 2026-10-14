#!/usr/bin/env node
// Self-test of scripts/timing-rules.mjs (the PM's rulings of 2026-10-13) on recorded data: the Persian tap rule applied to the 40 taps
// of committed check runs (the pre-fix baseline of 2026-10-12T03-57-29Z, 16 of 40 over, must still fail; today's runs that failed on one
// or two taps must pass), plus a tap over 100 ms; the first-frame rule on samples built from the three ways a frame can look.
// Prints every case; exit 1 on any that does not come out as expected.
//   node scripts/timing-rules-selftest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { firstFrameRule, persianTapRule } from './timing-rules.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const results = [];
const expect = (name, got, want, detail) => { const ok = got === want; results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: the rule says ${got ? 'pass' : 'fail'} (expected ${want ? 'pass' : 'fail'}); ${detail}`); };
// the 40 taps of a run, from its transition drill's printed list ("… the longest task per tap: T1-fall 0, T2-fall 54, … ms" before
// 2026-10-13's rule, "… every tap's longest task: T1-fall 0, … ms" since)
function tapsOf(stamp) {
  const f = path.join(ROOT, 'reports/checks', stamp, 'transition/transition-drill.json');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')).results.find((x) => x.step === 'persian-tap-senso');
  const list = r.text.match(/(?:the longest task per tap|every tap's longest task): (.*?) ms(?:;|$)/)[1].split(', ').map((p) => { const [key, v] = p.split(' '); return { key, done: v !== '—', ms: Number(v) }; });
  return { taps: list, before: r.ok };
}
for (const [stamp, want, why] of [
  ['2026-10-12T03-57-29Z', false, 'the pre-fix baseline (16 of 40 over 50 ms)'],
  ['2026-10-13T14-44-02Z', true, 'failed before on 1 tap at 71 ms'],
  ['2026-10-13T15-39-42Z', true, 'failed before on 1 tap at 62 ms'],
  ['2026-10-13T18-16-10Z', true, 'failed before on 2 taps, 60 and 57 ms'],
  ['2026-10-13T23-43-37Z', true, 'failed before on 1 tap at 51 ms'],
  ['2026-10-13T19-59-35Z', true, 'passed before, 0 over'],
]) {
  const { taps, before } = tapsOf(stamp), r = persianTapRule(taps, 40);
  expect(`Persian tap, run ${stamp} (${why}; the old rule said ${before ? 'pass' : 'fail'})`, r.pass, want, r.text);
}
{ const taps = Array.from({ length: 40 }, (_, i) => ({ key: `T${i}`, done: true, ms: i === 7 ? 120 : 0 })); const r = persianTapRule(taps, 40); expect('Persian tap, one tap at 120 ms and no other over 50', r.pass, false, r.text); }
{ const taps = Array.from({ length: 40 }, (_, i) => ({ key: `T${i}`, done: i !== 3, ms: 0 })); const r = persianTapRule(taps, 40); expect('Persian tap, one tap not measured', r.pass, false, r.text); }
// the fast check (the PM): 40 taps, 10 on each of the 4 chosen transitions, the same rule
{ const taps = Array.from({ length: 40 }, (_, i) => ({ key: `T${(i % 4) + 1}-${['fall', 'winter', 'spring', 'summer'][i % 4]}#${Math.floor(i / 4) + 1}`, done: true, ms: i === 5 || i === 22 ? 58 : 12 })); const r = persianTapRule(taps, 40); expect('Persian tap, a fast run (10 taps on each of 4 transitions), 2 over 50 ms', r.pass, true, r.text); }
{ const base = tapsOf('2026-10-12T03-57-29Z').taps; const taps = base.map((x, i) => ({ ...x, key: `fast#${i + 1}` })); const r = persianTapRule(taps, 40); expect('Persian tap, the pre-fix baseline\'s 40 values as a fast run\'s 40 taps', r.pass, false, r.text); }

// first frame: 20 particles of a 390 × 664 screen
const frame = (cys, extra = {}) => { const W = 390, H = 664; const inside = cys.filter((y) => y >= 0 && y <= H); const quarters = [0, 1, 2, 3].map((q) => inside.filter((y) => Math.min(3, Math.floor((y / H) * 4)) === q).length); return { w: W, h: H, particles: cys.length, inside: inside.length, quarters, above: cys.filter((y) => y < -60).length, animations: 77, notRunning: 77, frames: 1, ...extra }; };
const spread = Array.from({ length: 20 }, (_, i) => -20 + i * 36); // mid-flight: spread from just above the top to the bottom
expect('first frame mid-flight, clocks still pending (the race)', firstFrameRule(frame(spread)).pass, true, firstFrameRule(frame(spread)).text);
expect('first frame not started: every particle stacked above the top edge', firstFrameRule(frame(Array(20).fill(-80))).pass, false, firstFrameRule(frame(Array(20).fill(-80))).text);
const fewInside = [...Array(14).fill(0).map((_, i) => 40 + i * 40), ...Array(6).fill(900)];
expect('first frame with 14 of 20 inside (below 3/4)', firstFrameRule(frame(fewInside)).pass, false, firstFrameRule(frame(fewInside)).text);
const twoQuarters = Array.from({ length: 20 }, (_, i) => 10 + (i % 2) * 200);
expect('first frame with every particle in the top half (2 of 4 quarters)', firstFrameRule(frame(twoQuarters)).pass, false, firstFrameRule(frame(twoQuarters)).text);
const someAbove = [...spread.slice(2), -90, -150];
expect('first frame mid-flight with two particles just starting their fall above the top edge (counted, not judged)', firstFrameRule(frame(someAbove)).pass, true, firstFrameRule(frame(someAbove)).text);

const pass = results.every(Boolean);
console.log(`TIMING RULES SELFTEST ${pass ? 'PASS' : 'FAIL'} (${results.filter(Boolean).length}/${results.length})`);
process.exit(pass ? 0 : 1);
