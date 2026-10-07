# Check suite — 2026-10-07 16:21:16Z

Commit 6b129a5 · Node v20.19.2 · Next 16.4.0 · build dir .next-check · servers 3100 and 3101 · total 132 s

**PASS** — 13 of 13 checks passed.

| Check | Result | Time | Evidence | Notes |
| --- | --- | --- | --- | --- |
| production build (.next-check) | PASS | 5.3 s | `build.log` | next build ok |
| servers on 3100 and 3101 (TRUST_PROXY=1) | PASS | 0.6 s | `server-3100.log`, `server-3101.log` | both answer 200 on /senso |
| public page checks: senso (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 18.9 s | `senso/senso-checks.json`, `senso/senso-en.png`, `senso/senso-fa.png`, `senso/check-page.log` | toggle dir=rtl, Persian headings 15; intro gone at 1369 ms; images 124/124 |
| public page checks: kebab-land (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 10.5 s | `kebab-land/kebab-land-checks.json`, `kebab-land/kebab-land-en.png`, `kebab-land/kebab-land-fa.png`, `kebab-land/check-page.log` | toggle dir=rtl, Persian headings 17; intro gone at 1339 ms; images 47/47 |
| brand words in both built pages | PASS | 0.0 s | `brand-words.txt` | no "Mealsy" or "Flo" in visible text or metadata |
| photo links: senso | PASS | 4.2 s | `senso/photo-links.md`, `senso/photo-links.json` | 135 URLs, 0 not 200/206 |
| photo links: kebab-land | PASS | 3.1 s | `kebab-land/photo-links.md`, `kebab-land/photo-links.json` | 46 URLs, 0 not 200/206 |
| Lighthouse mobile ×3: senso | PASS | 36.4 s | `senso/lighthouse-summary.json`, `senso/lighthouse.log` | LCP 1353 / 1354 / 1354 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| Lighthouse mobile ×3: kebab-land | PASS | 28.8 s | `kebab-land/lighthouse-summary.json`, `kebab-land/lighthouse.log` | LCP 1353 / 1352 / 1352 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| admin drill (sign-ins, cookie, PINs, listing rule, sections, notes, edits + restore, delete + restore, venue details) | PASS | 15.8 s | `admin/admin-drill.txt`, `admin/admin-drill.json`, `admin/*.png` | ADMIN DRILL PASS (30/30) |
| lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN | PASS | 2.8 s | `lockout-drill.txt` | LOCKOUT DRILL PASS |
| revalidation: admin save reaches the public page within 10 s | PASS | 1.4 s | `revalidation-log.txt` | 111 ms after Save |
| backup and restore drill (pg_dump, scratch restore, equal counts, item recovered) | PASS | 3.6 s | `backup-drill.txt` | 12 table comparisons equal, 0 different; item recovered: true |

Every path is relative to this folder. Drill data changes are reversible and reversed by the drills themselves (prices and listings restored from history, counters cleared, drill PINs revoked and removed, the temporary admin account deleted); the backup drill deletes one Kebab Land row by SQL and recovers it from the dump. Lighthouse numbers are local estimates.
