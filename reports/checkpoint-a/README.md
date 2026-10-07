# Checkpoint A evidence — Senso public page, local production build (2026-10-07)

All files were produced by scripts against `next build && next start` on the developer machine with the local Docker Postgres.

| Criterion | Evidence |
| --- | --- |
| Import report | `data/import/2026-10-07/senso/import-report.md` (spelling fixes, oddities, unpriced items, Persian, placements, website descriptions, venue details to confirm, brand sources) |
| Listed / unlisted per section | `psql-senso-counts.txt` (psql output) |
| Full-page iPhone screenshots | `senso-en.png`, `senso-fa.png` (iPhone 13 viewport, Playwright, full page) |
| Logo animation | `senso-checks.json`: `introInFirstHtml` (first HTML response, saved as `senso-first-response.html`), `firstVisit` samples with timestamps (visible early, `data-intro=done` within 1.5 s), `repeatVisit` (skipped via localStorage before first paint), `reducedMotion` (skipped under `prefers-reduced-motion`) |
| Persian toggle | `senso-checks.json` → `persianToggle` (dir=rtl, Persian headings visible, English hidden) |
| Lighthouse mobile ×3 | `lighthouse-run-1..3.json`, `lighthouse-summary.json`, `lighthouse.txt`. Local estimate only, not a hosted result |
| Brand words | `brand-words.txt` (built HTML `.next/server/app/senso.html`: "Mealsy" and whole-word "Flo" in visible text and metadata; URLs excepted) |
| Colours and fonts with sources | `data/import/2026-10-07/senso/import-report.md` section 8; seed in `data/import/2026-10-07/venues.json` |

Re-run: `npm run build && npm run start` then `node scripts/check-page.mjs senso`, `node scripts/check-brand-words.mjs .next/server/app/senso.html`, `node scripts/check-lighthouse.mjs http://localhost:3000/senso --runs 3`.
