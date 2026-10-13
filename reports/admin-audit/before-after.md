# Admin audit: before and after the build (Kian via the PM, 2026-10-13)

Same method, same counting helpers, same data: both runs on a scratch copy of the working database taken on 2026-10-13 at 02:29 UTC (after the research and the placeholder withdrawal), reset to that copy before each run, on the iPhone 13 viewport (Playwright Chromium, 390 × 664, touch). **Before**: `audit-drill.mjs` (the audit's own drill, its task-6 check widened to "Contains: milk", the popup's wording since the research batch) on a build of main 09078a9 → `before-2/`. **After**: `audit-drill-after.mjs` (the same helpers; only the task paths follow the new screens) on a build of 03d4838 → `after/`. Cells: taps (fields · keys · scrolls, px scrolled) · app wait · done. Taps include focusing a field; Tab and Enter are keys; the first audit run (2026-10-13 00:08 UTC, `audit-run.txt`) gave the same "before" taps.

| Task | Before | After | Target (the PM) | Met |
| --- | --- | --- | --- | --- |
| Americano: one price → Small 5.49 / Large 6.49 | 9 (5 · 1 · 1, 660 px) · 1230 ms · done yes | 3 (5 · 4 · 0) · 912 ms · done yes | ≤ 4 taps | yes |
| Milk (Whole milk 0, Lactose-free 0, Oat milk +1) on the 7 lattes of Hot Beverage: Latte, Vanilla Latte, Hazelnut Latte, Organic Beet Latte, Matcha Latte, Pumpkin Spice Latte, Pumpkin Latte | 91 (50 · 7 · 23, 6923 px) · 11790 ms · done yes | 11 (6 · 7 · 3, 957 px) · 2267 ms · done yes | ≤ 12 taps | yes |
| Latte: Oat milk +1 → +1.25 | 4 (2 · 1 · 3, 1671 px) · 588 ms · done yes | 4 (2 · 1 · 3, 1636 px) · 600 ms · done yes | — | — |
| Cappuccino: optional add-on "Extra shot" +$1.50 | 6 (3 · 1 · 2, 495 px) · 819 ms · done yes | 3 (3 · 3 · 0) · 670 ms · done yes | ≤ 3 taps | yes |
| Turkish Coffee: an English and a Persian description | 6 (3 · 0 · 1, 398 px) · 676 ms · done yes | 6 (3 · 0 · 1, 430 px) · 710 ms · done yes | — | — |
| Turkish Coffee: allergens "milk" | 4 (2 · 1 · 2, 965 px) · 565 ms · done yes | 3 (1 · 0 · 1, 853 px) · 354 ms · done yes | ≤ 3 taps | yes |
| Cold Beverage: new "Audit Iced Tea", Small 4.99 / Large 5.99, a description, a photo | 15 (6 · 1 · 2, 1069 px) · 2681 ms · done yes | 9 (6 · 4 · 2, 1084 px) · 2220 ms · done yes | ≤ 9 taps | yes |
| Iced Americano: Cold Beverage → Hot Beverage (ends in Hot Beverage only) | 5 (1 · 0 · 1, 848 px) · 619 ms · done yes | 4 (1 · 0 · 0) · 458 ms · done yes | ≤ 4 taps | yes |
| hide the Milkshake section | 3 (0 · 0 · 0) · 1573 ms · done yes | 3 (0 · 0 · 0) · 1574 ms · done yes | — | — |

Paths after:

- t1-sizes: search "Americano" → row → + Sizes (the cursor in Size 1, its price the item's 5.99) → Small, Tab, 5.49 over it, Enter → Large, Tab, 6.49, Enter
- t2-milk: search "Latte" → Latte → + Choices → Milk, Enter → Whole milk, Tab, Enter → Lactose-free, Tab, Enter → Oat milk, Tab, 1, Enter → Copy to other items… → tick the other 6 lattes → Copy
- t3-option-price: search "Latte" → row → Advanced → Oat milk's extra price: overwrite 1→1.25 → Enter
- t4-extra: search "Cappuccino" → row → + Choices → Enter (no group) → Extra shot, Tab, 1.50, Enter
- t5-description: search "Turkish" → row → More → Description → Description (فارسی) → Done
- t6-allergens: search "Turkish" → row → the Milk chip
- t7-new-item: Jump to section → Cold Beverage → + Add → name, price 4.99, Add photo + choose → Add item (the editor opens on it, More open) → Description → + Sizes → Small, Tab, Enter → Large, Tab, 5.99, Enter
- t8-move: search "Iced Americano" → row → Section → Hot Beverage
- t9-hide-section: Jump to section → Milkshake → the section's switch

Where the after run still scrolled:

- t2-milk: the "Latte" row in Hot Beverage: below the fold (27 px under the screen's bottom edge); scrolled the page 359 px (to mid-screen; at least 60 px to bring it fully on screen); tick Matcha Latte: below the fold (169 px under the screen's bottom edge); scrolled the item panel 422 px (to mid-screen; at least 180 px to bring it fully on screen); tick Pumpkin Latte: covered by div; scrolled the item panel 176 px (to mid-screen; at least 176 px to bring it fully on screen)
- t3-option-price: the "Latte" row in Hot Beverage: below the fold (27 px under the screen's bottom edge); scrolled the page 359 px (to mid-screen; at least 60 px to bring it fully on screen); Advanced: below the fold (192 px under the screen's bottom edge); scrolled the item panel 502 px (to mid-screen; at least 216 px to bring it fully on screen); Oat milk extra price (field): below the fold (465 px under the screen's bottom edge); scrolled the item panel 775 px (to mid-screen; at least 488 px to bring it fully on screen)
- t5-description: More: below the fold (120 px under the screen's bottom edge); scrolled the item panel 430 px (to mid-screen; at least 144 px to bring it fully on screen)
- t6-allergens: the Milk chip (Good to know): below the fold (543 px under the screen's bottom edge); scrolled the item panel 853 px (to mid-screen; at least 565 px to bring it fully on screen)
- t7-new-item: Description (field): below the fold (232 px under the screen's bottom edge); scrolled the item panel 542 px (to mid-screen; at least 280 px to bring it fully on screen); + Sizes (Basics): above the screen; scrolled the item panel 542 px (to mid-screen; at least 232 px to bring it fully on screen)

Page errors: before 0, after 0.

Found while measuring and fixed before this run: the allergen chips first sat above More and Advanced and pushed them about 1,100 px down (option price scrolled 2,601 px, description 1,667 px); they now sit below them (fc35ee3). The "Saved · Undo" toast covered the copy sheet's "Copy to N items" button right after a choice was saved; while a sheet is open it now moves to the top (03d4838).
