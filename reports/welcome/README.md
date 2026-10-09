# Welcome screen — evidence (2026-10-09)

The full-screen welcome overlay that replaced the logo intro (commit `d875996`, suite-passing commit `f742544`): the venue logo, a time-of-day greeting in both languages, the two language buttons and the season scene, before the menu. Hand run of `scripts/welcome-drill.mjs` against a production build of `f742544` on a scratch copy of the working database (`roses_welcome`, dropped afterwards), iPhone 13 viewport, Chromium. The same drill runs inside `npm run check` (run `reports/checks/2026-10-09T14-24-26Z`, PASS 26/26).

## Recordings and stills

Playwright videos of the fall scene (the date mocked to 2026-10-09 10:30, so the greeting is "Good morning"), about 4.6 s each: the entrance, the scene running, then the tap on English and the fade. They are gitignored (`reports/**/*.webm`) and stay on the machine that ran the drill:

- `reports/welcome/senso-fall.webm` (444 KB)
- `reports/welcome/kebab-land-fall.webm` (412 KB)

Stills, one per season and venue, 1.3 s after load (committed): `senso-fall.jpg`, `senso-winter.jpg`, `senso-spring.jpg`, `senso-summer.jpg`, `kebab-land-fall.jpg`, `kebab-land-winter.jpg`, `kebab-land-spring.jpg`, `kebab-land-summer.jpg`; plus `*-reload-persian-remembered.jpg`: the screen on a reload after Persian was chosen (the فارسی button filled, the Persian greeting line first).

## Logo size: two stills for Kian (the PM, 2026-10-09: a design decision, not a metric lever)

`logo-stills.mjs` renders the welcome screen at the width built on 2026-10-09, min(70vw, 280px), and at the previous width, min(60vw, 240px), as the same page with that one rule overridden (iPhone 13, fall, "Good morning"): `logo-70vw-senso.jpg` / `logo-60vw-senso.jpg` (273 px and 234 px wide) and `logo-70vw-kebab-land.jpg` / `logo-60vw-kebab-land.jpg`. The page ships min(70vw, 280px) until Kian picks; the pick is a one-line change in `src/styles/public.css` (`.welcome-logo`).

## The menu after the tap, under throttled mobile conditions (the PM's correction)

Lighthouse's LCP measures the welcome screen (its logo is the largest paint; every suite report says so), so `scripts/after-tap-drill.mjs` measures what the customer waits for after the language tap: Chromium on the iPhone 13 viewport with CDP throttling as DevTools applies Lighthouse's Slow 4G profile (562.5 ms request latency, 1.47 Mbps down, 0.675 Mbps up) and a 4× CPU slowdown; the tap the moment the welcome entrance has settled (about 2.5 s after navigation, first paint at 1.3 s, no photo down yet); two repeats per run; target ≤ 2.5 s from the tap for the menu and for the first section's photos in view. Hand run on a production build of the after-tap commit (`after-tap.txt` in the suite run named in the reply has the suite's figures):

| Run | Menu visible | First row's eager photo(s) | Photos in view loaded | All first-section photos | Target met |
| --- | --- | --- | --- | --- | --- |
| Senso, first section as a List (6 photos, 1 eager, 4 in view) | 230 / 246 ms | 3261 / 2011 ms | 8060 / 4827 ms | 9226 / 16243 ms | miss (photos) |
| Senso, "Senso Signature" as a Grid (6 photos, 2 eager, 4 in view) | 229 / 246 ms | 3980 / 3995 ms | 5179 / 5195 ms | 15278 / 15262 ms | miss (photos) |
| Kebab Land as it is (Appetizers, a List, 2 photos, 1 eager, 1 in view) | 244 / 225 ms | 44 / 43 ms | 244 / 225 ms | 877 / 825 ms | yes |

Eager rule, unchanged and checked on the served HTML: the first row's photos only carry `loading="eager"` with high fetch priority (one in a List, the two cards of a Grid's first row), every other photo is lazy; the whole Senso page has 1 (List) or 2 (Grid) eager photos. Note for the reading: a lazy photo that sits in the viewport loads at once anyway, so after the tap the three other visible Senso photos compete with the eager one for the throttled connection.

Photo bytes of the first sections, as linked from the venues' hosts (HEAD, Content-Length): Senso 6 photos of 237–367 KB (1.70 MB in all; PNG and JPEG at 500 × 333 px, shown at 96 × 96 px in a List and 173 × 173 px in a Grid); Kebab Land 2 photos of 72 and 146 KB (218 KB; WebP at 882 × 736 and 785 × 1024 px, shown at 96 × 96 px). Resized copies in our own storage stay on the go-live list after the owner's written permission; nothing was downloaded.

## Persian greeting drafts (for Kian's wording)

| Hours (device clock) | English | Persian draft | Note |
| --- | --- | --- | --- |
| 05:00–11:59 | Good morning | صبح بخیر | |
| 12:00–16:59 | Good afternoon | ظهر بخیر | Alternative: بعد از ظهر بخیر (more literal, longer). |
| 17:00–04:59 | Good evening | عصر بخیر | Covers the night hours too (no "Good night", as ruled). Alternative for late hours if wanted: شب بخیر (but it is also a farewell in Persian). |

The strings live in `src/lib/welcome.ts` (`GREETINGS`); both languages are real text in the HTML and are shown together until a language is chosen.

## Timings versus targets (hand run; the suite's figures in `reports/checks/2026-10-09T14-24-26Z/report.md` agree)

| Measure | Target | Senso | Kebab Land |
| --- | --- | --- | --- |
| Tap on English → overlay gone, menu visible (measured in the page from the click) | ≤ 300 ms | 214 ms | 229 ms |
| Tap on فارسی → Persian menu visible | ≤ 300 ms | 217 ms | 230 ms |
| LCP, Lighthouse mobile ×3 (suite run; the LCP element is the welcome logo, so this measures the welcome screen, not the menu: see the after-tap table above) | ≤ 2.5 s | 1203 / 1203 / 1203 ms | 1204 / 1203 / 1202 ms |
| TBT, Lighthouse mobile ×3 (suite run) | ≤ 50 ms | 0 / 0 / 0 ms | 0 / 0 / 0 ms |
| Inline code added to the page (overlay markup with its scenes and script + the head decision script), gzipped | ≤ 10 KB | 4.2 KB (20.9 KB raw) | 4.2 KB |
| Welcome block of the stylesheet, gzipped (not inline; cached with the stylesheet) | — | 2.2 KB | 2.2 KB |
| Particles per scene | ≤ about 20 | fall 18, winter 20, spring 16, summer 16 | same |
| Animated properties | transform and opacity only | transform, opacity | transform, opacity |
| Reduced motion | still scene, no movement | 0 animations running, 18 of 18 fall particles standing in view; the tap removes the overlay in 0–1 ms | same |
| Entrance (suite page check, from navigation) | after the logo | logo settled at 667 ms, greeting at 901 / 1039 ms, buttons at 1302 ms | 663 / 919 / 1058 / 1314 ms |

Boundaries (mocked clock, UTC context): 04:59 → evening, 05:00 → morning, 11:59 → morning, 12:00 → afternoon, 16:59 → afternoon, 17:00 → evening; Aug 31 → summer, Sep 1 → fall, Nov 30 → fall, Dec 1 → winter, Feb 28 → winter, Mar 1 → spring, May 31 → spring, Jun 1 → summer, on both venues. Also checked: a first visit pre-highlights nothing and the menu is inert behind the overlay; a reload pre-highlights the last language (filled with the remembered-button token) and stores only `roses-lang`; a section anchor is scrolled to under the category bar after the choice with its tab active; Tab reaches the English button and Enter chooses it; the buttons are 164 × 56 px and named; role dialog with aria-modal; JavaScript off shows the menu directly with the overlay markup hidden; the Style route's `welcome: false` removes the overlay and its head decision from the HTML within 6 ms and `true` brings it back; the served defaults pass the thresholds (Senso: greeting 16:1, buttons 14.3:1, remembered button 12.7:1; Kebab Land: 18.4:1, 14:1, 6:1). Raw output: `welcome-drill.txt`, `welcome-drill.json`.
