#!/usr/bin/env node
// Self-test of scripts/network-watch.mjs (the PM's network rules, 2026-10-13), with simulated load-watch readings and a simulated probe,
// so the "invalid: network" path is proven without waiting for a real outage. Each scenario prints PASS or FAIL; exit 1 on any FAIL.
//   node scripts/network-watch-selftest.mjs
import { outagesDuring, retryOnOutage, waitNetwork } from './network-watch.mjs';

const ok = (h) => ({ host: h, status: 206, ms: 5 }), off = (h, e = 'ENOTFOUND') => ({ host: h, status: 0, ms: 5, error: e });
const HOSTS = ['a.example', 'b.example', 'c.example'];
const clean = () => HOSTS.map(ok), outage = () => [ok('a.example'), off('b.example'), off('c.example', 'TimeoutError')];
const reading = (t, net) => ({ at: new Date(t).toISOString(), net });
const judge = ({ r, t0, t1 }) => ({ name: 'step', pass: !!r.pass, outcome: r.known ? 'KNOWN MISS' : r.pass ? 'PASS' : 'FAIL', ms: t1 - t0, note: r.note || '' });
const quiet = () => {}, lines = [], log = (s) => lines.push(s);
const results = [];
const expect = (name, cond, detail) => { results.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a step whose attempts are scripted: each returns { pass, known?, note } and may add readings while it runs (an outage during it) and one
// reading after it (the next 30 s reading)
function scripted(readings, plan) {
  let n = 0;
  return async () => {
    const p = plan[n++] ?? plan[plan.length - 1], t0 = Date.now();
    await sleep(5); if (p.during) readings.push(reading(Date.now(), p.during())); await sleep(5);
    const t1 = Date.now();
    if (p.after !== null) readings.push(reading(t1 + 1, (p.after ?? clean)()));
    return { r: { pass: p.pass, known: p.known, note: p.note ?? (p.pass ? 'ok' : 'failed') }, t0, t1, n };
  };
}
const probeSeq = (seq) => { let i = 0; return async () => { await sleep(3); return (seq[Math.min(i++, seq.length - 1)])(); }; }; // a probe takes time, as a real one does
const opts = { probes: HOSTS.map((h) => ({ host: h, url: `https://${h}/x.jpg` })), log, every: 10, waitMs: 200 };

{ // 1. fails during an outage, the hosts down for two more readings, then the re-run passes with nothing recorded: PASS, both attempts kept
  const readings = []; let calls = 0; const a = scripted(readings, [{ pass: false, during: outage }, { pass: true }]);
  const res = await retryOnOutage({ name: 'one', attempt: async () => { calls++; return a(); }, judge, readings, ...opts, probe: probeSeq([outage, outage, clean]) });
  expect('fails in an outage, re-run passes', res.outcome === 'PASS' && calls === 2 && res.attempts?.[0].outcome === 'INVALID: NETWORK' && res.attempts[1].outcome === 'PASS' && /attempt 1 INVALID: NETWORK/.test(res.note), `${res.outcome}, ${calls} attempts, ${lines.filter((l) => /waiting/.test(l)).length} network waits printed`);
}
{ // 2. the re-run passes but an outage is recorded during it: FAIL
  const readings = []; const a = scripted(readings, [{ pass: false, during: outage }, { pass: true, during: outage }]);
  const res = await retryOnOutage({ name: 'two', attempt: a, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('re-run passes during another outage: does not count', res.outcome === 'FAIL' && res.attempts?.length === 2 && /outage was recorded during the re-run/.test(res.note), res.outcome);
}
{ // 3. fails with no outage: FAIL at once, no re-run
  const readings = [reading(Date.now() - 1000, clean())]; let calls = 0; const a = scripted(readings, [{ pass: false }]);
  const res = await retryOnOutage({ name: 'three', attempt: async () => { calls++; return a(); }, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('fails without an outage: fails, no re-run', res.outcome === 'FAIL' && calls === 1 && !res.attempts, `${res.outcome}, ${calls} attempt`);
}
{ // 4. fails in an outage, the re-run fails too: FAIL with both attempts
  const readings = []; const a = scripted(readings, [{ pass: false, during: outage }, { pass: false, note: 'still failing' }]);
  const res = await retryOnOutage({ name: 'four', attempt: a, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('fails in an outage, re-run fails: fails', res.outcome === 'FAIL' && res.attempts?.[1].outcome === 'FAIL' && /still failing/.test(res.note), res.outcome);
}
{ // 5. a known miss in an outage: left as it is (not a failure)
  const readings = []; let calls = 0; const a = scripted(readings, [{ pass: false, known: true, during: outage }]);
  const res = await retryOnOutage({ name: 'five', attempt: async () => { calls++; return a(); }, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('known miss in an outage: no re-run', res.outcome === 'KNOWN MISS' && calls === 1 && !res.attempts, res.outcome);
}
{ // 6. passes during an outage: PASS, no re-run
  const readings = []; let calls = 0; const a = scripted(readings, [{ pass: true, during: outage }]);
  const res = await retryOnOutage({ name: 'six', attempt: async () => { calls++; return a(); }, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('passes during an outage: passes, no re-run', res.outcome === 'PASS' && calls === 1 && !res.attempts, res.outcome);
}
{ // 7. the outage shows only in the first reading after the step ended: it counts
  const readings = []; let calls = 0; const a = scripted(readings, [{ pass: false, after: outage }, { pass: true }]);
  const res = await retryOnOutage({ name: 'seven', attempt: async () => { calls++; return a(); }, judge, readings, ...opts, probe: probeSeq([clean]) });
  expect('outage in the next reading after the step: re-run', res.outcome === 'PASS' && calls === 2 && res.attempts?.[0].outages.length === 1, `${res.outcome}, ${calls} attempts`);
}
{ // 8. an outage recorded more than 30 s before the step started: not during it
  const t = Date.now(); const readings = [reading(t - 45_000, outage()), reading(t - 15_000, clean())];
  const o = await outagesDuring(readings, t, t + 10, { waitMs: 0 });
  const readings2 = [reading(t - 25_000, outage())];
  const o2 = await outagesDuring(readings2, t, t + 10, { waitMs: 0 });
  expect('the window: 30 s before the start counts, 45 s does not', o.length === 0 && o2.length === 1, `45 s before: ${o.length}, 25 s before: ${o2.length}`);
}
{ // 9. the wait before the build: prints what it waits on, returns when every host answers
  lines.length = 0;
  const w = await waitNetwork({ probes: opts.probes, log, why: 'before the build', every: 10, probe: probeSeq([outage, outage, clean]) });
  expect('the network wait: two waits printed, then on', w.waited.length === 2 && lines.filter((l) => /network: waiting before the build: b\.example ENOTFOUND, c\.example TimeoutError not answering/.test(l)).length === 2 && /answers again/.test(lines[lines.length - 1]), `${w.waited.length} waits; "${lines[0]}"`);
}
void quiet;
const pass = results.every(Boolean);
console.log(`NETWORK WATCH SELFTEST ${pass ? 'PASS' : 'FAIL'} (${results.filter(Boolean).length}/${results.length})`);
process.exit(pass ? 0 : 1);
