# Checkpoint A2 evidence — Senso public page, design review build (2026-10-07)

Produced against `next build && next start` on the developer machine with the local Docker Postgres. The public page is served as plain pre-rendered HTML (Pages Router with runtime JavaScript disabled): no framework script, three inline scripts (intro decision, intro removal, language toggle), fonts and logo served from the app itself.

| Item | Evidence |
| --- | --- |
| Full-page iPhone screenshots, all images loaded before capture | `senso-en.png`, `senso-fa.png`; image counts in `senso-checks.json` → `images` / `imagesFa` (124 of 124 loaded, 0 failed) |
| Font comparison (client's originals rendered on sensocafe.ca next to our self-hosted look-alikes, same text and size) | `font-comparison.png`, produced by `scripts/font-comparison.mjs`, which also proves each row rendered in its own font (width differs from a monospace clone) |
| Font requests at runtime | `senso-checks.json` → `fontRequests` (3 files, all from this app's origin, `thirdParty: []`) |
| Lighthouse mobile ×3 (local production build, local estimate) | `lighthouse-run-1..3.json`, `lighthouse-summary.json`, `lighthouse.txt` |
| Logo animation and Persian toggle | `senso-checks.json` (`firstVisit`, `repeatVisit`, `reducedMotion`, `persianToggle`) |
| Brand words in the built HTML (`.next/server/pages/senso.html`) | `brand-words.txt` |
| Photo links (every photo URL in the database plus the logo source URL) | `photo-links.md`, `photo-links.json` (`scripts/check-photo-links.mjs`) |
| Listed / unlisted per section | `psql-senso-counts.txt` |
| Persian drafts for review | `../persian-review.csv` (180 rows; `tools/import/persian-review-export.mjs`), read back with `tools/import/persian-review-apply.mjs` |
| Reconciliation 147 → 138, logo source and sha256, font licences | `data/import/2026-10-07/senso/import-report.md` sections 8 and 9; `src/fonts/SOURCES.md` |
