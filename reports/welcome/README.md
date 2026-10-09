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

## Artwork candidates for Senso (Kian's review of 2026-10-09: leaves not realistic enough and falling too uniformly; snow close but to be cleaner)

Step 1 of the Senso-only artwork batch: ten fall leaves (F1–F10) and ten snowflakes (W1–W10) to pick from, 5 to 7 per season. The picking tool is `gallery.html` in this folder (one self-contained file, our tool, not a public page), built by `gallery/build.mjs` from the artwork in `gallery/art.mjs`; `gallery/shots.mjs` takes the stills below. Open it in a browser (Chromium and WebKit checked).

Every design is original inline SVG defined once as a `<symbol>` (64 × 64) and used with `<use>`, built from plain geometry in `art.mjs`: a leaf is a smoothed outline (hand-placed points through Catmull-Rom curves, sharp corners at tips and teeth, or a sampled margin with leaning teeth for the serrated species), a base gradient along the blade, a shading gradient and a crease across the midrib so the blade reads as curved, a turning patch on the two-tone leaves, veins, a petiole, on five of them a curled edge (pale underside, fold shadow) and on four a few brown spots. A snowflake is one arm reused six times around a centre plate (six-fold symmetry by construction, round caps and joins, no jagged joins); W8–W10 are soft round flakes for depth.

| No. | Design | Colours | gzipped | raw |
| --- | --- | --- | --- | --- |
| F1 | Sugar maple | orange turning to red, one lobe curled, two spots | 1449 B | 4430 B |
| F2 | Red oak | rust and brown, a gold edge, a curled tip | 1221 B | 3428 B |
| F3 | Paper birch | gold, still green at the base, brown spots | 903 B | 2265 B |
| F4 | Trembling aspen | bright gold, a blush of orange at the edge | 1130 B | 2859 B |
| F5 | American elm | yellow over green, lopsided base | 958 B | 2374 B |
| F6 | Ginkgo | butter yellow fan, green at the heart | 877 B | 2264 B |
| F7 | White oak | tan and brown, a red flush, a curled lobe | 1399 B | 3893 B |
| F8 | Sweetgum | crimson to wine, orange at the points | 996 B | 2576 B |
| F9 | American beech | copper and bronze, parallel veins, a curled edge | 1126 B | 3041 B |
| F10 | Sassafras | the mitten: salmon orange, yellow at the base | 1024 B | 2799 B |
| W1 | Stellar dendrite | the classic six-armed star, branched | 273 B | 588 B |
| W2 | Sectored plate | a hexagonal plate with six ridges, white plates | 302 B | 741 B |
| W3 | Fernlike dendrite | feathery, many fine branches | 271 B | 592 B |
| W4 | Stellar plate | six small plates on short arms | 288 B | 693 B |
| W5 | Needle star | six slim filled needles | 251 B | 601 B |
| W6 | Broad branches | thick arms, chevron tips, an open centre | 262 B | 600 B |
| W7 | Twelve-branched | two stars, one turned 30° | 272 B | 608 B |
| W8 | Soft plate | a far hexagonal plate, out of focus | 235 B | 413 B |
| W9 | Soft round | a round flake out of focus | 215 B | 389 B |
| W10 | Soft core | a round flake with a bright core | 229 B | 446 B |
| | shared gradients (spots, crease) | | 185 B | |
| | all ten leaves together | | 8.1 KB | |
| | all ten snowflakes together | | 1.0 KB | |
| | the scene engine as previewed (its CSS and script) | | 3.1 KB | |

Each candidate alone, `zlib.gzipSync` of its symbol with its gradients. The step-2 budget is 15 KB gzipped for everything inline on Senso, artwork included: with the current 4.2 KB overlay, 5–7 leaves at about 1.1 KB each and 5–7 flakes at about 0.26 KB, plus the engine, the sum lands near 14–16 KB, so the picked leaves may need their path precision trimmed (the outlines are written at one decimal with absolute coordinates; relative coordinates and fewer samples cut roughly a quarter).

How a card reads: the design large and still (leaves on white; snow on the cream in the snow tint), the design falling on its own with the step-2 motion at the near size, and the design at the far, middle and near sizes on Senso's welcome background (cream `#fff8ee`). Under each season a full-scene demo shows all ten on a replica of Senso's welcome screen (the served colours of 2026-10-09, the real card markup and CSS, iPhone 13 size) with the motion planned for step 2: three depth layers (far: small, slow, lower opacity; middle; near: larger, a little faster, at most two), every leaf combining a vertical fall, a pendulum sway that dips through the centre of each swing, a slow sideways drift and a 3D flutter (rotateX/Y/Z) at its own speed; snow drifts and sways only, the crystals turn slowly, the soft flakes do not turn; all parameters random per load (which designs, start column, size, layer, duration, delay, sway width, rotation angles), the scene full on the first frame (negative delays), transform and opacity only, 20 particles (2 near, 9 middle, 9 far). "Replay" draws a new scene, "Still" shows the reduced-motion composition (leaves resting low and along the sides; snow hanging scattered).

Colours: the leaves carry their own natural palettes and are not tinted by the Style tab's "Fall leaves" token (an open question for Kian); the snow is drawn in the "Winter snow" token, `#b2becc` on Senso's cream (the Auto rule: cream mixed 60 % toward the snow ink), which is soft on the cream by design; W2 and W4 carry white plates. The gallery sets the same `--c-welcome-*` variables the page's own `<style>` sets.

Stills (Chromium, 1.5 s after load): `gallery-fall-demo.jpg`, `gallery-winter-demo.jpg` (the demos running), `gallery-fall-still.jpg`, `gallery-winter-still.jpg` (the reduced-motion compositions), `gallery-fall-cards.jpg`, `gallery-winter-cards.jpg` (the card grids). Checked on the built file: 172 animations running, every animated element with a valid computed transform (Chromium and WebKit), two loads of the page draw different scenes (the readout under each demo lists every particle's design, column, size and duration). No app code changes in this step; Kebab Land and the default template are untouched.
