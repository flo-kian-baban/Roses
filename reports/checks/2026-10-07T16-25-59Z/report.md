# Check suite — 2026-10-07 16:25:59Z

Commit a6bad82 · Node v20.19.2 · Next 16.4.0 · build dir .next-check · servers 3100 and 3101 · total 113 s

**PASS** — 13 of 13 checks passed.

| Check | Result | Time | Evidence | Notes |
| --- | --- | --- | --- | --- |
| production build (.next-check) | PASS | 4.0 s | `build.log` | next build ok |
| servers on 3100 and 3101 (TRUST_PROXY=1) | PASS | 0.6 s | `server-3100.log`, `server-3101.log` | both answer 200 on /senso |
| public page checks: senso (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 14.1 s | `senso/senso-checks.json`, `senso/senso-en.jpg`, `senso/senso-fa.jpg`, `senso/check-page.log` | toggle dir=rtl, Persian headings 15; intro gone at 1384 ms; images 124/124 |
| public page checks: kebab-land (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 8.9 s | `kebab-land/kebab-land-checks.json`, `kebab-land/kebab-land-en.jpg`, `kebab-land/kebab-land-fa.jpg`, `kebab-land/check-page.log` | toggle dir=rtl, Persian headings 17; intro gone at 1341 ms; images 47/47 |
| brand words in both built pages | PASS | 0.0 s | `brand-words.txt` | no "Mealsy" or "Flo" in visible text or metadata |
| photo links: senso | PASS | 4.3 s | `senso/photo-links.md`, `senso/photo-links.json` | 135 URLs, 0 not 200/206 |
| photo links: kebab-land | PASS | 3.2 s | `kebab-land/photo-links.md`, `kebab-land/photo-links.json` | 46 URLs, 0 not 200/206 |
| Lighthouse mobile ×3: senso | PASS | 31.4 s | `senso/lighthouse-summary.json`, `senso/lighthouse.log` | LCP 1353 / 1355 / 1354 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| Lighthouse mobile ×3: kebab-land | PASS | 28.5 s | `kebab-land/lighthouse-summary.json`, `kebab-land/lighthouse.log` | LCP 1203 / 1353 / 1352 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| admin drill (sign-ins, cookie, PINs, listing rule, sections, notes, edits + restore, delete + restore, venue details) | PASS | 10.6 s | `admin/admin-drill.txt`, `admin/admin-drill.json`, `admin/*.jpg` | ADMIN DRILL PASS (30/30) |
| lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN | PASS | 2.7 s | `lockout-drill.txt` | LOCKOUT DRILL PASS |
| revalidation: admin save reaches the public page within 10 s | PASS | 1.3 s | `revalidation-log.txt` | 108 ms after Save |
| backup and restore drill (pg_dump, scratch restore, equal counts, item recovered) | PASS | 3.6 s | `backup-drill.txt` | 12 table comparisons equal, 0 different; item recovered: true |

Every path is relative to this folder. Screenshots, full Lighthouse JSON and the first HTML responses stay on the machine that ran the suite (gitignored); report.md, summary.json, the check JSON files and the text logs are committed. Drill data changes are reversible and reversed by the drills themselves (prices and listings restored from history, counters cleared, drill PINs revoked and removed, the temporary admin account deleted); the backup drill deletes one Kebab Land row by SQL and recovers it from the dump. Lighthouse numbers are local estimates.
