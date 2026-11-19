# Senso's load-time baseline (the PM, 2026-11-19)

**Where it stands:** the limit is **9,419 ms** again (the PM's second ruling of 2026-11-19): the baseline of 2026-10-12, median 8563 ms, with its tolerance of 10 %. The three quiet-machine readings below (7959 / 7055 / 8561 ms) are kept as evidence; they are not the baseline. **To do: set the baseline again after the photo storage batch.**

## The two rulings

1. With "Goes well with", item 4: "Senso load time: after the upgrade, measure it 3 times on a quiet machine and set its baseline to that median plus 10 %." Done as described below: median 7959 ms, so a limit of 8754 ms. One suite run was judged against it (2026-11-19T17-18-31Z: 8561 / 5182 / 8567 ms, median 8561 ms; it passed by 193 ms).
2. After the reply that reported those readings: "put Senso's load-time limit back to 9,419 ms. The quiet readings (7,055–8,561 ms) show this check swings by about 1.5 s, so a 190 ms margin would trip on noise. Re-baseline it after the photo storage batch." Done: `reports/checks/known-misses.json` carries the baseline of 2026-10-12 again, unchanged (run 2026-10-12T17-36-33Z: 8563 / 8565 / 8563 ms, median 8563 ms, tolerance 10 %, so up to 9419 ms), with both rulings in its notes. The first suite run judged against it again is the merge gate of "Goes well with".

The swing in numbers: the three quiet readings are 1506 ms apart (7055 to 8561 ms); over all five sets of that day, 15 readings, the lowest is 5181 ms and the highest 8569 ms.

The check is the known miss "Senso LCP with uploaded photos" (`lighthouse-senso-lcp` in `reports/checks/known-misses.json`): Lighthouse mobile on `/senso` of the performance fixture (frozen content of 2026-10-12), three runs, judged on the median. Its baseline is a median; the ratchet fails a run whose median is more than 10 % above it.

## What was measured

Lighthouse mobile on `/senso` of the performance fixture, three runs a set, on 2026-11-19 (Node v22.23.4, Next 16.4.6); the page is 244,204 B and names 33 uploaded photos.

| Set | Started | LCP, three runs (ms) | Median (ms) | TBT (ms) | Load while it ran (read every 5 s; limit 50 % CPU) | |
|---|---|---|---|---|---|---|
| 1 | 17:06:12Z | 5181 / 8563 / 8568 | 8563 | 0 / 0 / 0 | 10 readings, the busiest other process: Google Chrome Helper (Aperitif Renderer) 100 % | not counted: 17:06:12Z Cursor Helper (Renderer) (PID 65093) 73 %; 17:06:52Z Google Chrome Helper (Aperitif Renderer) (PID 86682) 100 %; 17:06:57Z Google Chrome Helper (Aperitif) (PID 1557) 71 % |
| 2 | 17:08:59Z | 8562 / 8561 / 8563 | 8562 | 0 / 0 / 0 | 9 readings, the busiest other process: Claude Helper (Renderer) 100 % | not counted: 17:09:04Z mds_stores (PID 793) 54 %; 17:09:14Z Google Chrome Helper (Aperitif Renderer) (PID 42837) 96 %; 17:09:19Z mds_stores (PID 793) 91 % … |
| 3 | 17:11:07Z | 8562 / 8562 / 8561 | 8562 | 0 / 0 / 0 | 9 readings, the busiest other process: contactsd 124 % | not counted: 17:11:27Z Google Chrome Helper (Aperitif Renderer) (PID 42837) 67 %; 17:11:32Z contactsd (PID 15384) 124 %; 17:11:42Z contactsd (PID 15384) 54 % … |
| 4 | 17:13:17Z | 8569 / 5182 / 8566 | 8566 | 0 / 0 / 0 | 10 readings, the busiest other process: Antigravity IDE Helper 168 % | not counted: 17:13:22Z Antigravity IDE Helper (Plugin) (PID 99053) 107 %; 17:13:27Z com.apple.appkit.xpc.openAndSavePanelService (PID 151) 152 %; 17:13:32Z npm exec firebase-tools@latest mcp (PID 304) 90 % … |
| 5 | 17:16:35Z | 7959 / 7055 / 8561 | 7959 | 0 / 0 / 0 | 9 readings, the busiest other process: WindowServer 36 % | **counted** |

**The quiet set's median: 7959 ms**, the median of 7959 / 7055 / 8561 ms (set 5, the first set during which no other process was above 50 % CPU). As a baseline with the tolerance of 10 % it passes a run whose median is at most 8754 ms. The LCP element in every run is the welcome screen's logo (/brand/senso-logo.png); the target itself (LCP ≤ 2500 ms) is still missed, as listed.

It was the baseline from the first ruling to the second, in place of the baseline of 2026-10-12 (run 2026-10-12T17-36-33Z: 8563 / 8565 / 8563 ms, median 8563, up to 9419 ms), which is in force again.

## What the same check has read before, on the same content

Until today every reading of this check had been one of three values, whatever the code of the last weeks: about 5185, 6532 or about 8565 ms (Lighthouse simulates the phone's network from the requests it saw; which photos it counts on the way to the logo decides the value). The quiet set added two more, 7055 and 7959 ms; the four sets taken with another process busy read the old values.

What that meant for the limit of 8754 ms: a run whose median is the usual 8561 to 8573 ms passed by about 190 ms (2 %), less than the check's own swing, which is why the PM put the limit back. The limit of 9419 ms leaves about 850 ms above the usual median.

| When | Readings (ms) | Median |
|---|---|---|
| 2026-10-12, run 17-36-33Z (the old baseline) | 8563 / 8565 / 8563 | 8563 |
| 2026-10-12, by hand, two builds | 5191 / 8564 / 8562 and 8573 / 8561 / 8564 | 8562 and 8564 |
| 2026-11-18, run 23-55-51Z (Next 16.4.3, the feature branch) | 6532 / 8565 / 5182 | 6532 |
| 2026-11-19, run 15-59-51Z (Next 16.4.6, main; mediaanalysisd at 131–154 % CPU during the step) | 8569 / 6532 / 8566 | 8566 |

## How

- The code: `main` after the Next.js upgrade (2dfe04f, Next 16.4.6), without "Goes well with", so the feature's own gate is judged against it.
- The content: the performance fixture `2026-10-12` (verified against `scripts/fixtures/perf-fixture.json`), restored into a scratch database of its own, with its uploads copied, a production build made on it and a scratch server started on it, as the suite's `perf-fixture` and `perf-server` steps do:

```sh
node scripts/perf-fixture.mjs verify
docker exec roses-db psql -U roses -d postgres -c 'create database roses_perf_hand'
docker exec -i roses-db pg_restore -U roses -d roses_perf_hand --no-owner --no-privileges --exit-on-error < <main checkout>/perf-fixture/2026-10-12/db.dump
DATABASE_URL=<…/roses_perf_hand> node scripts/db-migrate.mjs
cp -Rp <main checkout>/perf-fixture/2026-10-12/uploads <scratch folder>/perf-uploads
NEXT_DIST_DIR=.next-perf DATABASE_URL=<…/roses_perf_hand> UPLOAD_DIR=<scratch folder>/perf-uploads npx next build
NEXT_DIST_DIR=.next-perf DATABASE_URL=<…/roses_perf_hand> UPLOAD_DIR=<scratch folder>/perf-uploads ROSES_CHECK_SUITE=1 SESSION_SECRET=<32+ random characters> node node_modules/next/dist/bin/next start -p <a free port> -H 127.0.0.1
```

- The measurement: `node scripts/quiet-lighthouse.mjs http://127.0.0.1:<that port>/senso --out reports/senso-load-baseline/2026-11-19 --sets 8`. It fetches the page and each of its 33 uploaded photos once, waits until no process other than itself and the server has been above 50 % CPU for 30 s (the suite's pre-flight wait), runs `scripts/check-lighthouse.mjs --runs 3` (the suite's own Lighthouse step) and reads the load every 5 s while the runs go. A set during which another process was above 50 % CPU is not counted and is taken again; every set is in `quiet-lighthouse.json` and in the transcript `quiet-lighthouse.txt`.
- Afterwards the scratch database is dropped and the scratch folder removed.

## Files

- `2026-11-19/quiet-lighthouse.json`: every set (its three readings, the load readings, whether it counted).
- `2026-11-19/quiet-lighthouse.txt`: the transcript.
- `2026-11-19/set-N/lighthouse-summary.json`: the three runs of each set. The full Lighthouse reports stay on disk only.
