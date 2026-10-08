# Category tabs follow taps and the scroll — before and after (2026-10-08)

Kian's report (2026-10-08, with a screenshot): on the public pages the highlighted tab in the sticky category bar did not match the
section on screen after a tap or while scrolling, and the highlight jumped around during a jump.

## Cause (the build of eab383f and earlier)

The active tab came from an IntersectionObserver band (from 56 px below the top of the viewport to 35 % of its height); the first
section in page order touching the band won. Three defects followed:

- After a tap the section landed 8 px below the bar (the bar is 48.4 px tall, the anchor offset was 56 px), so the previous section
  still touched the band's top edge and won the tie: the tab before the tapped one stayed lit (6 of 20 taps on Senso, the case in the
  screenshot: "Salad" under the bar, "Persian Breakfast" lit).
- A long jump lit every tab on the way (13 tab changes on a Senso jump from the last tab to the first), and the strip scrolled for
  each of them.
- The strip was scrolled with scrollIntoView on the tab, which also acts on the page's own scroll.

## Fix (this commit)

`src/components/menu-kit.tsx`: the current section is the last one whose top has reached the bar's bottom edge (the tie at a boundary
goes to the section that just arrived; at the end of a page that has scrolled it is the last section, while a page too short to
scroll keeps its first tab), computed on scroll (passive, one update per
frame). A tap lights its tab at once and locks it while the page scrolls there; the lock lifts when the scroll settles (160 ms without
a scroll event) or the customer takes over (touch, wheel, keys). The strip scrolls itself to centre the active tab (never the page).
The tap's scroll target is the measured bar height, and the templates' anchor offset is now 48 px (`scroll-mt-12`) to match it for
links straight to a section. No new dependency, no data-model change, still no runtime JavaScript framework on the public pages.

## Method

Playwright, iPhone 13 viewport (390 × 844, 3×, touch), Chromium and WebKit (the Playwright builds), script `tabs-measure.mjs` in this
folder (run from the repo root: `node reports/tabs-follow-scroll/tabs-measure.mjs <base> <venue> <before|after> [chromium|webkit] [en|fa]`).
Taps: every tab in order, then long jumps (first, last, second, second-to-last, first); after each tap the page is left to settle
(300 ms without movement) and the active tab, the section's top relative to the bar's bottom edge, the tabs lit on the way (a
MutationObserver on the tabs' class) and whether the active tab is inside the strip are recorded. Stepping: 60 px steps down to the
bottom and back up; at each step the active tab is compared with the section under the bar (the last section at the end of the page).

| Build | Venue | Browser | Language | Taps ending on the tapped tab | Section at the bar (±1 px) | Taps that lit other tabs on the way | Active tab outside the strip | Steps off, down · up | Last tab lit at the bottom | File |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | Senso | chromium | en (ltr) | 14/20 | 3/20 | 10 (up to 13 tabs) | 0 | 1/316 · 1/316 | yes | `before-senso-chromium-en.json` |
| before | Senso | webkit | en (ltr) | 14/20 | 3/20 | 10 (up to 9 tabs) | 0 | 1/316 · 1/316 | yes | `before-senso-webkit-en.json` |
| before | Kebab Land | chromium | en (ltr) | 21/22 | 3/22 | 6 (up to 13 tabs) | 0 | 3/208 · 3/208 | yes | `before-kebab-land-chromium-en.json` |
| after | Senso | chromium | en (ltr) | 20/20 | 20/20 | 0 (up to 0 tabs) | 0 | 0/316 · 0/316 | yes | `after-senso-chromium-en.json` |
| after | Senso | chromium | fa (rtl) | 20/20 | 20/20 | 0 (up to 0 tabs) | 0 | 0/315 · 0/315 | yes | `after-senso-chromium-fa.json` |
| after | Senso | webkit | en (ltr) | 20/20 | 20/20 | 0 (up to 0 tabs) | 0 | 0/316 · 0/316 | yes | `after-senso-webkit-en.json` |
| after | Kebab Land | chromium | en (ltr) | 22/22 | 22/22 | 0 (up to 0 tabs) | 0 | 0/208 · 0/208 | yes | `after-kebab-land-chromium-en.json` |
| after | Kebab Land | webkit | en (ltr) | 22/22 | 22/22 | 0 (up to 0 tabs) | 0 | 0/208 · 0/208 | yes | `after-kebab-land-webkit-en.json` |

Stepping was mostly right before (the band and "section under the bar" agree away from the boundaries); the taps and the jumps were
the defects, plus the ties at the boundaries. Screenshots: `before-senso-tap-second.jpg` and `after-senso-tap-second.jpg` (Chromium,
after tapping the second tab, "Hot Beverage").

The suite now proves the behaviour on every run (`scripts/check-page.mjs`, "tabs" in each venue's checks JSON): every tap ends on its
tab at the bar with no other tab lit on the way and the tab inside the strip; 60 px steps down and up with 0 off; the last tab lit at
the bottom; a link straight to a section opens with its tab active.
