# Check suite — 2026-10-13 22:32:09Z (aborted)

**Suite: full** (`npm run check:full`) on commit cc89a0d, started 22:32:09Z.

**ABORTED** on the PM's instruction: stopped at about 22:56Z (a first signal at 22:55:05Z did not reach the processes, a shell-quoting slip on my side; the second did; the load watch's last reading is the one just before).

Cause: aborted: superseded by fa7d3db; not a merge gate.

The run was stopped before its report: the suite and every process it had started that was still running were signalled, the performance fixture's server it had started at 22:55:21Z (left without a parent) was stopped, and its scratch databases (roses_check_20261013t223209z and its _perf copy) were dropped by hand. The suite's console log as far as it got is `suite-console.log`; the load watch, `load-watch.txt`.

Steps finished before the stop (17): migrations on the scratch copy: PASS (0.1 s); production build: PASS (3.8 s); performance fixture 2026-10-12: verified against its committed pointer, restored into roses_check_20261013t223209z_perf, migrations, its uploads copied, its own production build: PASS (3.4 s); colour literals in the public templates, the menu kit and the public stylesheet: PASS (0.0 s); servers on 63274 and 63275: PASS (0.7 s); temporary venue on the default template: PASS (0.4 s); public page checks: senso: PASS (85.5 s); public page checks: kebab-land: PASS (66.0 s); public page checks: drill-default-venue: PASS (12.9 s); brand words in the built pages and the temporary venue's page: PASS (0.0 s); no runtime JavaScript: drill-default-venue: PASS (0.0 s); photo links: senso: PASS (1.8 s); photo links: kebab-land: PASS (1.9 s); welcome screen drill: PASS (30.2 s); season drill: PASS (106.4 s); transition drill, full: all 40 versions: FAIL (985.9 s); the performance fixture's server on 63278: PASS (1.1 s).

Step running when stopped: Lighthouse mobile ×3 on the performance fixture 2026-10-12: senso (from 2026-10-13T22:55:22.262Z).

Load watch: 44 readings; a photo host not answering in 0 of them.

The transition drill's FAIL (272 of 274, at 22:55:21Z after 986 s) is the stop's doing, not a result: its two failures are "page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:63277/senso" (its server on port 63277, the first process stopped) and "could not put Senso's style back" in the scratch copy, which was then dropped (the working database is never touched by the suite). Every step that finished before it passed. Nothing here is evidence for or against fa7d3db.
