// The suite and the network (the PM, 2026-10-13, after check:full runs failed on this machine's internet dropping): the outside photo
// hosts the menus link to are probed with one linked photo each (a 1-byte request); a host that gives no HTTP answer at all (timeout,
// DNS, unreachable: status 0) is down.
//   probeHosts(probes): one probe of every host.
//   waitNetwork({ probes, log, why, every }): before the build and before a step's second attempt, wait (never fail) until every host
//     answers, reading every 30 s and printing what it waits on; answers how long it waited and the readings that found a host down.
//   outagesDuring(readings, t0, t1, { since }): the load watch's readings with a host down, from 30 s before t0 (or from `since`: a
//     second attempt counts from the moment every host was seen answering again, not from the outage that caused it) to the first
//     reading after t1 (waited for, up to 40 s: an outage at the end of a step shows in the next reading).
//   retryOnOutage({ name, attempt, judge, readings, probes, log }): a step that fails while an outage is recorded is marked "invalid:
//     network" and run once more after every host answers again; both attempts are kept and printed; it passes only if the second
//     attempt passes with no outage recorded during it. Any other failure (or a known miss) is left as it is.

export const down = (net) => net.filter((n) => !n.status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const at = (o) => `${o.at.slice(11, 19)}Z ${o.down.join(', ')}`;

export function probeHosts(probes) {
  return Promise.all(probes.map(async (p) => {
    const t = Date.now();
    try { const r = await fetch(p.url, { method: 'GET', headers: { range: 'bytes=0-0' }, signal: AbortSignal.timeout(10_000), cache: 'no-store' }); await r.body?.cancel().catch(() => null); return { host: p.host, status: r.status, ms: Date.now() - t }; }
    catch (e) { return { host: p.host, status: 0, ms: Date.now() - t, error: String(e.cause?.code || e.name || e.message) }; }
  }));
}

export async function waitNetwork({ probes, log, why, every = 30_000, probe = probeHosts }) {
  const t0 = Date.now(), waited = [];
  for (;;) {
    const net = await probe(probes), bad = down(net);
    if (!bad.length) { if (waited.length) log(`network: every photo host answers again (${net.map((n) => `${n.host} ${n.status}`).join(', ')}) after ${Math.round((Date.now() - t0) / 1000)} s`); return { waitedMs: Date.now() - t0, waited }; }
    waited.push({ at: new Date().toISOString(), down: bad.map((n) => `${n.host} ${n.error || 'no answer'}`) });
    log(`network: waiting ${why}: ${bad.map((n) => `${n.host} ${n.error || 'no answer'}`).join(', ')} not answering; reading again in ${every / 1000} s`);
    await sleep(every);
  }
}

export async function outagesDuring(readings, t0, t1, { waitMs = 40_000, since = t0 - 30_000 } = {}) {
  for (let i = 0; i < waitMs / 1000 && !readings.some((w) => Date.parse(w.at) >= t1); i++) await sleep(1000);
  const next = readings.find((w) => Date.parse(w.at) >= t1);
  return readings.filter((w) => Date.parse(w.at) >= since && (Date.parse(w.at) <= t1 || w === next) && down(w.net).length)
    .map((w) => ({ at: w.at, down: down(w.net).map((n) => `${n.host} ${n.error || 'no answer'}`) }));
}

// attempt(): one run of the step → { r, t0, t1 }; judge(a): its outcome (PASS, FAIL or KNOWN MISS, with ms and note)
export async function retryOnOutage({ name, attempt, judge, readings, probes, log, every = 30_000, waitMs = 40_000, probe = probeHosts }) {
  let a = await attempt(), res = judge(a);
  if (res.outcome !== 'FAIL' || !readings.length) return res;
  const o1 = await outagesDuring(readings, a.t0, a.t1, { waitMs });
  if (!o1.length) return res;
  const first = { outcome: 'INVALID: NETWORK', ms: res.ms, note: res.note, outages: o1 };
  log(`   INVALID: NETWORK (attempt 1, ${(res.ms / 1000).toFixed(1)} s): the load watch recorded ${o1.map(at).join('; ')} during it; it failed with: ${res.note}`);
  const w = await waitNetwork({ probes, log, why: `to run "${name.slice(0, 60)}${name.length > 60 ? '…' : ''}" again`, every, probe }), answering = Date.now();
  log(`-- ${name} (attempt 2: run once more, the hosts answering again${w.waited.length ? ` after ${Math.round(w.waitedMs / 1000)} s` : ''})`);
  a = await attempt(); res = judge(a);
  const o2 = await outagesDuring(readings, a.t0, a.t1, { waitMs, since: answering });
  if (o2.length && res.outcome !== 'FAIL') { res.outcome = 'FAIL'; res.pass = false; res.note = `an outage was recorded during the re-run too (${o2.map(at).join('; ')}), so it does not count; ${res.note}`; }
  res.attempts = [first, { outcome: res.outcome, ms: res.ms, note: res.note, outages: o2 }];
  res.note = `attempt 1 INVALID: NETWORK (${o1.map(at).join('; ')}): ${first.note} · attempt 2, after the hosts answered again: ${res.outcome}: ${res.note}`;
  res.ms += first.ms;
  return res;
}
