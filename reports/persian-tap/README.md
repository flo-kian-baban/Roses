# Persian tap: the fix and its before/after evidence (the PM, 2026-10-12)

The known miss "Persian tap, Senso": a tap on فارسی laid the whole page out again in Persian in one long task (51–96 ms at CPU 4× on Senso, 51–98 ms on Kebab Land). Traced (Chrome's timeline, CPU 4×): the task is the frame after the switch, about half style recalculation over every element, a third layout, the rest paint.

The fix, in the menu kit's inline script (`src/components/menu-kit.tsx`; the welcome markup, the tap script and the public stylesheet are byte for byte the same):

1. The welcome screen's scene gets a fixed direction (ltr). Nothing in it depends on direction (all its positions are physical), and on Senso its ~200 animated particles were the largest part of the restyle.
2. Each section's item list away from the screen gets `content-visibility: auto` at the size it was last laid out at (`contain-intrinsic-block-size: auto <h>px`), from an IntersectionObserver entry. Such a list skips its style and layout, a language switch included, and keeps its size, so the section boxes the tabs read and the scroll target of a tab tap stay put. Within a quarter screen of the screen a list is plain again, so whatever is on screen is painted exactly as before. Paint containment would otherwise snap text to whole pixels and clip both the band between sections and the edges of Persian glyphs; the first version, which contained whole sections all the time, did both (seen in the diff below and fixed).

Measured by hand on a scratch copy, the old build (main `feeb1cc`) against the new one, the same data, Chromium on the iPhone 13 viewport, CPU 4×, 12 Persian taps each, the longest task from the tap:

| Venue | Before | Over 50 ms | After | Over 50 ms |
|---|---|---|---|---|
| Senso | 62–153 ms | 12 of 12 | no long task | 0 of 12 |
| Kebab Land | 52–94 ms | 12 of 12 | no long task | 0 of 12 |

Raw lines: `persian-tap-by-hand.txt`. The suite's transition drill measures it on every version (`persian-tap-senso`).

## Scroll-follow before and after

`scroll-follow.mjs` (results in `scroll-follow.md` and `scroll-follow.json`). Result on the final build: in every venue and language the active tab is the section under the bar at 10 of 10 positions, before and after, and every tab tap lands at the bar with its tab active (5 of 5; 1 of 1 on the default template's 2-section page), before and after. The same tab as before at 10 of 10 positions, except one on Senso in Persian: the after-build lit the section really under the bar there, but a different one from the old build. That position is reached by a jump of about 17,000 px, and the lists jumped over were never laid out in Persian, so they kept their English heights and the page was 24 px taller at that moment. Scrolling, as a customer does, lays each list out as it comes near. Page heights at rest and the tap offsets are the same on both builds. For each venue and language, chosen on the welcome screen, it reads the active tab at ten scroll positions, the same pixels on both builds, against the section actually under the bar. It also checks that five tab taps land at the bar with their tab active.

## Kebab Land and the default template: screenshots

`visual-diff.mjs` (results in `visual-diff.json`; the control is `visual-diff-control.json`). It takes viewport screenshots at the top and at ten scroll positions, in both languages, each position reached as a customer scrolls. Each pair is compared pixel by pixel. Photos from other hosts are blocked on both builds; uploaded photos load. The control compares the old build with itself, to show the method has no noise. Senso is included too. Result on the final build: 0 differing pixels in all 66 comparisons (3 venues × 2 languages × 11 positions), and 0 in the control.
