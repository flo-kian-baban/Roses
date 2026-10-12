# Persian tap: the fix and its before/after evidence (the PM, 2026-10-12)

The known miss "Persian tap, Senso": a tap on فارسی laid the whole page out again in Persian in one long task (51–96 ms at CPU 4× on Senso, 51–98 ms on Kebab Land). Traced (Chrome's timeline, CPU 4×): the task is the frame after the switch, about half style recalculation over every element, a third layout, the rest paint.

The fix, in the menu kit's inline script (`src/components/menu-kit.tsx`; the welcome markup, the tap script and the public stylesheet are byte for byte the same):

1. The welcome screen's scene gets a fixed direction (ltr). Nothing in it depends on direction (all its positions are physical), and on Senso its ~200 animated particles were the largest part of the restyle. Alone it is not enough (Senso 3 of 12 taps still over 50 ms, Kebab Land 2 of 12, by hand).
2. Each section's item list away from the screen gets `content-visibility: auto` at its last laid-out content height (`contain-intrinsic-block-size: auto <h>px`: the IntersectionObserver entry's height less the list's own padding and border, since the property sizes the content box). Such a list skips its style and layout, a language switch included, and keeps its size. Within a quarter screen of the screen a list is plain again, so whatever is on screen is painted exactly as before (paint containment would otherwise snap text to whole pixels and clip the band between sections and the edges of Persian glyphs; the first version, which contained whole sections all the time, did both).
3. A list contained in one language keeps that language's height after a switch (that is what spares the tap the relayout). So a second after a change of the page's direction (after the transition into the menu, ≤ 880 ms), the lists still in the old direction below the screen are laid out again one per frame and contained again at their new height, and a tap on a link to a section first lays out every list still in the old direction, so it aims at the right place.

Two mistakes in the first version (75dc26e), found after the first suite run and corrected in d9de277: the intrinsic size was the border-box height, so a contained Grid list (24 px bottom padding) was 24 px taller and Senso's page grew by up to 72 px while scrolling (the Style drill's position check came back 72 px higher after a save); and nothing relaid the lists after a switch, so on a fresh page in Persian a tab tap to a far section landed up to 238 px off (Kebab Land, Chromium) and 9328 px off (Senso, WebKit). The screenshots did not show either (Chromium's scroll anchoring keeps the screen in place when a box above it changes height), so `layout-check.mjs` now compares the layout in numbers.

All evidence below: the old build (main `feeb1cc`, in a detached worktree) against the new one (`d9de277`), both built from the same scratch copy of the working data (with a temporary venue on the default template, added through the admin API), served side by side.

## Persian tap

`persian-tap.mjs` (raw lines in `persian-tap-by-hand.txt`, numbers in `persian-tap.json`): Chromium on the iPhone 13 viewport, CPU 4×, 12 taps on فارسی each, interleaved, the longest task within 3 s of the tap (past the transition and the relayout one per frame):

| Venue | Before | Over 50 ms | After | Over 50 ms |
|---|---|---|---|---|
| Senso | 53–68 ms | 11 of 12 | no long task | 0 of 12 |
| Kebab Land | 53 ms once | 1 of 12 | no long task | 0 of 12 |

The suite's transition drill measures it on every version (`persian-tap-senso`).

## Scroll-follow

`scroll-follow.mjs` (results in `scroll-follow.md`, `scroll-follow.json`): for each venue and language, chosen on the welcome screen, the active tab at ten scroll positions (the same pixels on both builds) against the section really under the bar, then five tab taps (one on the default template's two-section page). Result: 10 of 10 before and after everywhere, the same tab as before at 10 of 10, every tap landing with its tab active (5 of 5, 1 of 1), in both languages on Senso, Kebab Land and the default template.

## Layout in numbers

`layout-check.mjs` (results in `layout-check.md`, `layout-check.json`), Chromium and WebKit: on a fresh page, 3 s after the language tap, the page's height and the top of every section; the same after a walk down to the bottom and back; tab taps 100 ms and 3 s after the language (the last section then the first, and a middle one). Result: 12 of 12 the same (3 venues × 2 languages × 2 browsers): the same page heights (Senso 18902 / 18801 px, Kebab Land 13126 / 12888 px in Chromium, en / fa), no section at a different top, every tap at the same distance from the bar (0–1 px; 151 px for the default template's last section, whose page is too short to bring it to the bar, on both builds).

## Screenshots: Kebab Land, the default template and Senso

`visual-diff.mjs` (results in `visual-diff.json`; the control is `visual-diff-control.json`): viewport screenshots at the top and at ten scroll positions, in both languages, each position reached as a customer scrolls, compared pixel by pixel; photos from other hosts blocked on both builds, uploaded photos loaded; the control compares the old build with itself. Result: 0 differing pixels in all 66 comparisons (3 venues × 2 languages × 11 positions), 0 in the control.
