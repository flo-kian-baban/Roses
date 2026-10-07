# tools/capture — read-only discovery capture

Captures the six menu sources listed in `sources.json` into `data/raw/<source-slug>/<YYYY-MM-DD>/`
and builds the acceptance report from the raw files.

```
cd tools/capture
npm install                      # Playwright
npx playwright install chromium  # browser binary (once)
npm run capture                  # all sources → data/raw/<slug>/<today>/
npm run analyze                  # → data/raw/<today>-capture-report.md
```

Options: `node capture.mjs --only mealsy-sensocafe,roseskebablands-drinks --date 2026-10-07`,
`node analyze.mjs --date 2026-10-07`.

## What a capture folder contains

| Path | What | Raw? |
| --- | --- | --- |
| `responses/NNN-<host-path-query>.json` | Every XHR/fetch response with a JSON body, byte-for-byte | yes |
| `decoded/NNN-….decoded.json` | `gunzip(base64(Data))` of Mealsy `Data` envelopes (the menu lives here) | derived |
| `screenshots/` | Mealsy: landing viewport (PNG), one category (PNG), item detail (JPEG), whole menu with the inner scroller expanded (JPEG, tiled when taller than Chromium's limit). Pages: whole page (JPEG, tiled) | — |
| `html/index.html` | Rendered DOM after scrolling the whole page / every category | yes (see redactions) |
| `manifest.json` | Each saved file → request URL, method, status, content type, bytes, sha256; `observed` = what was on screen (category nav, section titles, items with name/price/description/picture, headings, Elementor widgets, tel links); `imageUrls` (recorded, never downloaded); `skipped`, `redactions`, `errors` | — |

## What is never saved (rules.mjs)

- Mealsy responses that are account, ordering or location configuration rather than menu content (`dataCategory=0`, the account detail endpoint, ordering hours, order promise time) are skipped and listed under `skipped` in the manifest.
- The account lookup response is reduced to its identifying fields (ids, venue name, namespace, languages); the removed keys are listed under `redactions`.
- Phone numbers, emails and network addresses are masked in saved HTML, JSON and in the manifest's on-screen extraction (`[PHONE REMOVED]`, `[EMAIL REMOVED]`, `[IP REMOVED]`), with counts under `redactions`. For tap-to-call links the manifest keeps only a boolean, `hrefDigitsMatchDisplayed`.
- `node purge.mjs [--date …]` applies the same rules to an existing capture and records each deleted file under `removed` in its manifest. It was run once on the 2026-10-07 capture.

## Capture limits (enforced in code)

- Chromium headless with an iPhone 13 viewport, touch and mobile user agent (`deviceScaleFactor` 2).
- No login, no form submission, no add-to-cart, no orders, no personal data entered. The only clicks are: scrolling, opening one item's detail dialog, closing it.
- Request headers, cookies and tokens are never written. Responses whose URL path looks like an auth endpoint are not saved. Credential-looking keys inside a saved body would be redacted and listed under `redactions` (none occurred). Credential-looking query values inside embedded URLs in saved HTML are replaced with `[REDACTED]` (one Google Maps browser key per Mealsy page).
- Images are never downloaded by the tool; only their URLs are recorded. The browser renders the page normally, nothing is written to disk.

## Mealsy specifics learned during discovery

- API: `https://prod1.api.mymealsy.com/online-ordering/api/v1/` — `BusinessAccounts?xRefCode=<slug>`, `Data?businessLocationId=…&dataCategory=0|1|2`, `BusinessAccounts/<id>?…&orderChannel=3`.
- `dataCategory=1` carries every menu of the account (`Menus[].MenuSections[].MenuItems[]`), gzip+base64 in the `Data` field. Names, descriptions and photo paths are JSON-in-a-string (`{"En": "…"}`). The web app renders one of the menus; `analyze.mjs` identifies it by matching on-screen section titles and item names.
- The app renders all sections at once inside a `.menu-page-container` scroller; nothing loads on scroll.
