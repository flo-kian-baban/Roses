# Checkpoint B evidence — Kebab Land page and admin, local build (2026-10-07)

Produced against `next build && next start` on the developer machine with the local Docker Postgres. Nothing is deployed. Client addresses in the lockout log are masked (`<addr-A>` = IPv4 loopback, `<addr-B>` = IPv6 loopback); the drill admin's email is masked; PIN values were never written to any file.

| Item | Evidence |
| --- | --- |
| Senso Persian: 180 drafts confirmed by Kian, flags cleared, revision rows | `persian-apply.txt` (apply output, psql counts, re-export shows 0 rows); `persian-rows.txt` (per-field counts, the 177-vs-180 correction) |
| Kebab Land import | `../../data/import/2026-10-07/kebab-land/import-report.md`, `kebab-land.json`, `persian-drafts.json`; psql counts per section in `psql-kebab-land-counts.txt` |
| Kebab Land page checks (intro, repeat visit, reduced motion, Persian toggle, images loaded) | `kebab-land-checks.json`, `kebab-land-first-response.html`, screenshots `kebab-land-en.png`, `kebab-land-fa.png` (iPhone 13, full page, 47 of 47 images loaded) |
| Senso page re-checked after the template split | `senso-checks.json`, `senso-en.png`, `senso-fa.png` (124 of 124 images) |
| Lighthouse mobile ×3, Kebab Land (local estimate) | `lighthouse-kebab-land.txt`, `lighthouse-run-1..3.json`, `lighthouse-summary.json` |
| Brand words in both built pages | `brand-words.txt` |
| Photo links, Kebab Land (45 photos + logo source) | `photo-links.md`, `photo-links.json` |
| Kebab Land Persian drafts for Kian's review | `../persian-review-kebab-land.csv` (274 rows; count in `persian-review-kebab-land-count.txt`) |
| Admin acceptance drill (30 checks: sign-ins, cookie, PINs, listing rule in UI/API/database, sections, notes permissions, three edits + restore, delete + restore, venue details) | `admin/admin-drill.txt`, `admin/admin-drill.json`, screenshots `admin/01-…16-*.png` |
| Lockout: 5 per venue + address (default 15 min, two real addresses); 50 per hour per venue (10 addresses via TRUST_PROXY on a second server) with alert and admin unlock; revoked PIN | `lockout-drill.txt` |
| Revalidation: price saved in the admin, polled on the public page | `revalidation-log.txt` |
| Backup and restore drill (pg_dump, restore into a scratch database, equal counts, item recovered) | `backup-drill.txt`; runbook `../../docs/runbook.md` |
