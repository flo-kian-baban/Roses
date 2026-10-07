# Check suite — 2026-10-07 17:00:09Z

Commit 19ea733 · Node v20.19.2 · Next 16.4.0 · build dir .next-check · servers 3100 and 3101 · database: scratch copy roses_check_20261007t170009z of roses, dropped at the end · total 117 s

**FAIL** — 13 of 14 checks passed.

| Check | Result | Time | Evidence | Notes |
| --- | --- | --- | --- | --- |
| production build (.next-check) | PASS | 3.0 s | `build.log` | next build ok |
| servers on 3100 and 3101 (TRUST_PROXY=1) | PASS | 0.6 s | `server-3100.log`, `server-3101.log` | both answer 200 on /senso |
| public page checks: senso (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 14.0 s | `senso/senso-checks.json`, `senso/senso-en.jpg`, `senso/senso-fa.jpg`, `senso/check-page.log` | toggle dir=rtl, Persian headings 15; intro gone at 1359 ms; images 124/124 |
| public page checks: kebab-land (intro, repeat visit, reduced motion, Persian toggle, images) | PASS | 8.9 s | `kebab-land/kebab-land-checks.json`, `kebab-land/kebab-land-en.jpg`, `kebab-land/kebab-land-fa.jpg`, `kebab-land/check-page.log` | toggle dir=rtl, Persian headings 17; intro gone at 1331 ms; images 47/47 |
| brand words in both built pages | PASS | 0.0 s | `brand-words.txt` | no "Mealsy" or "Flo" in visible text or metadata |
| photo links: senso | FAIL | 4.1 s | `senso/photo-links.md`, `senso/photo-links.json` | 135 URLs, 1 not 200/206 |
| photo links: kebab-land | PASS | 3.2 s | `kebab-land/photo-links.md`, `kebab-land/photo-links.json` | 46 URLs, 0 not 200/206 |
| Lighthouse mobile ×3: senso | PASS | 32.1 s | `senso/lighthouse-summary.json`, `senso/lighthouse.log` | LCP 1352 / 1354 / 1354 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| Lighthouse mobile ×3: kebab-land | PASS | 29.8 s | `kebab-land/lighthouse-summary.json`, `kebab-land/lighthouse.log` | LCP 1352 / 1353 / 1353 ms, performance 100 / 100 / 100 (target ≤ 2500, local estimate) |
| admin drill (sign-ins, cookie, PINs, listing rule, sections, notes, edits + restore, delete + restore, venue details) | PASS | 10.1 s | `admin/admin-drill.txt`, `admin/admin-drill.json`, `admin/*.jpg` | ADMIN DRILL PASS (31/31) |
| lockout: 5 per venue + address, 50 per hour per venue with alert and unlock, revoked PIN | PASS | 6.3 s | `lockout-drill.txt` | LOCKOUT DRILL PASS |
| revalidation: admin save reaches the public page within 10 s | PASS | 1.3 s | `revalidation-log.txt` | 105 ms after Save |
| backup and restore drill (pg_dump, scratch restore, equal counts, item recovered) | PASS | 3.6 s | `backup-drill.txt` | 12 table comparisons equal, 0 different; item recovered: true |
| working database untouched (roses: per-table counts and newest revision id identical before and after) | PASS | 0.0 s | `working-db-before-after.json`, `working-db-copy.dump (gitignored)` | venues 2, sections 33, items 387, item_sections 388, revisions 180, admins 1, pins 0, login_failures 0, admin_alerts 0, schema_migrations 3; newest revision id 180 |

Every path is relative to this folder. Screenshots, full Lighthouse JSON, the first HTML responses and the dumps stay on the machine that ran the suite (gitignored); report.md, summary.json, the check JSON files and the text logs are committed. Every drill ran against the scratch copy of the working database, which was dropped afterwards; the working database itself was only read (counts before and after, last row). Lighthouse numbers are local estimates.
