# Item editor rebuild: before and after (Kian, 2026-10-13)

Same method, same counting helpers, one data copy, the iPhone 13 viewport (Playwright Chromium, 390 × 664, touch). The data copy: one read-only `pg_dump` of the working database taken on 2026-10-13 at 14:08 UTC, restored as the scratch database `roses_audit` with a throwaway admin, reset to that copy before each run (the earlier audit's copy of 02:29 UTC was dropped with its session, so this round takes its own, used for both runs). **Before**: a build of main dc0d1cf (code identical to 25efc14) → `editor-before/`. **After**: a build of de00b66 → `editor-after/`. Both with `audit-drill-editor.mjs`: the audit's helpers verbatim (everything between `import fs` and `// ===== the tasks` is `audit-drill.mjs`'s), the earlier paths for `--ui before` unchanged from `audit-drill-after.mjs`, the new screens' shortest paths for `--ui after`, and three new tasks (10–12).

Cells: taps (fields · keys · scrolls, px scrolled). Taps include focusing a field; Tab and Enter are keys; a scroll is counted each time the next control was not tappable where it was. Two counts per task, two rules (the PM, 2026-10-13): **in the editor** (from the moment the item editor is open) decides each numeric target; **from the Menu tab** (search, row, task: how the earlier runs counted) must be equal to or better than the "before" column for every task.

| Task | In the editor, before | In the editor, after | Target (in the editor) | Met | Menu tab, before | Menu tab, after | Menu tab: equal or better |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t3 Latte: Oat milk +1 → +1.25 (Milk is its second choice group) | 2 (1 · 1 · 2, 1277 px) | 1 (1 · 1 · 0) | ≤ 2 taps, 0 scroll | yes | 4 (2 · 1 · 3, 1636 px) | 3 (2 · 1 · 1, 359 px) | yes (better) |
| t5 Turkish Coffee: an English and a Persian description | 4 (2 · 0 · 1, 430 px) | 3 (2 · 0 · 0) | ≤ 3 taps | yes | 6 (3 · 0 · 1, 430 px) | 5 (3 · 0 · 0) | yes (better) |
| t10 Mocha: hide it from its editor | 1 (0 · 0 · 1, 353 px) | 1 (0 · 0 · 0) | 1 tap, 0 scroll | yes | 3 (1 · 0 · 1, 353 px) | 3 (1 · 0 · 0) | yes (a scroll fewer) |
| t11 Pumpkin Soup: see every section it is in | 2 (0 · 0 · 3, 1145 px) | 0 (0 · 0 · 0) | 0 taps | yes | 4 (1 · 0 · 4, 1342 px) | 2 (1 · 0 · 1, 197 px) | yes (better) |
| t6 Turkish Coffee: allergens "milk" | 1 (0 · 0 · 1, 853 px) | 2 (0 · 0 · 0) | ≤ 3 taps | yes | 3 (1 · 0 · 1, 853 px) | 4 (1 · 0 · 0) | **no: one tap more** (the group closed by the ruling; batch 2 below) |
| t12 Latte: duplicate it | not in that build | 2 (0 · 0 · 1, 590 px) | ≤ 2 taps | yes | not in that build | 4 (1 · 0 · 2, 949 px) | — (new) |
| t1 Americano: one price → Small 5.49 / Large 6.49 | 1 (4 · 4 · 0) | 1 (4 · 4 · 0) | — | — | 3 (5 · 4 · 0) | 3 (5 · 4 · 0) | yes (equal) |
| t2 Milk on the 7 lattes of Hot Beverage | 9 (5 · 7 · 2, 598 px) | 9 (5 · 7 · 2, 598 px) | — | — | 11 (6 · 7 · 3, 957 px) | 11 (6 · 7 · 3, 957 px) | yes (equal) |
| t4 Cappuccino: optional "Extra shot" +$1.50 | 1 (2 · 3 · 0) | 1 (2 · 3 · 0) | — | — | 3 (3 · 3 · 0) | 3 (3 · 3 · 0) | yes (equal) |
| t7 Cold Beverage: new "Audit Iced Tea", two sizes, a description, a photo | 2 (4 · 4 · 2, 1084 px) | 2 (4 · 4 · 0) | — | — | 9 (6 · 4 · 2, 1084 px) | 9 (6 · 4 · 0) | yes (2 scrolls fewer) |
| t8 Iced Americano: Cold Beverage → Hot Beverage | 2 (0 · 0 · 0) | 2 (0 · 0 · 0) | — | — | 4 (1 · 0 · 0) | 4 (1 · 0 · 0) | yes (equal) |
| t9 hide the Milkshake section (not in the editor) | — | — | — | — | 3 (0 · 0 · 0) | 3 (0 · 0 · 0) | yes (equal) |

All six numeric targets met in the editor. From the Menu tab every task is equal or better except t6, one tap more; the PM's next batch (Allergens & diet open by default while drafts wait for Confirm) addresses it, measured in `editor-after-2/` with that batch, target ≤ 3 from the Menu tab.

Every task done in both runs (the final state read back from the public page and the scratch database), except t12 before, which that build cannot do. Page errors: before 0, after 0. App wait (first tap to the change on the public page), before / after: t1 907 / 878 ms, t2 2250 / 2247, t3 597 / 426, t4 638 / 679, t5 708 / 567, t6 352 / 458, t7 2270 / 2211, t8 455 / 452, t9 1562 / 1568, t10 351 / 316, t11 827 / 266 (no save: until the sections were seen), t12 — / 525.

**t6, the one full count that grew (3 → 4).** Allergens & diet is a closed group by the ruling (1e), so from the Menu tab it is search, item, Allergens & diet, chip; before, the chips sat open at the bottom of the editor (one tap fewer, one scroll of 853 px more). In the editor it is 2 taps. The PM's next batch opens the group by default while the item has allergen or dietary drafts waiting for Confirm (Turkish Coffee has), measured again from the Menu tab with that batch (`editor-after-2/`). An item opened from the "Allergens to confirm" filter still opens with the group open (the research drill's Confirm path is unchanged: chip, item, Confirm).

**t12, the copy, checked field by field in the database**: "Latte (copy)" / "لاته (کپی)", hidden, in Hot Beverage right after Latte, the same description, price, sizes, choices (both groups, the copied Milk included), combo parts, serves, photo reference, notes, draft flags and seasons; off the public page; the editor opened on it with its name selected. One Undo: the copy gone from the database 114 ms after the tap, its editor closed, Latte untouched. The scroll in the editor is the one to reach Other, which sits under Latte's two choice groups; Duplicate is the first thing inside it.

Paths after:

- t3: search "Latte" → row → Oat milk's extra price (tappable on the editor's first screen: no scroll counted; its row is the last one on that screen, partly under the fold) → 1.25 → Enter
- t5: search "Turkish" → row → Description → Description (فارسی) → Done
- t6: search "Turkish" → row → Allergens & diet → the Milk chip
- t10: search "Mocha" → row → the Shown switch in the status at the top
- t11: search "Pumpkin Soup" → row → the chips under Where & when ("Appetizer", "Fall Menu")
- t12: search "Latte" → row → Other → Duplicate
- t1: search "Americano" → row → + Size (the cursor in Size 1, its price the item's) → Small, Tab, 5.49, Enter → Large, Tab, 6.49, Enter
- t2: search "Latte" → row → + Choice group → Milk, Enter → Whole milk, Tab, Enter → Lactose-free, Tab, Enter → Oat milk, Tab, 1, Enter → Copy to… → tick the other 6 lattes → Copy
- t4: search "Cappuccino" → row → + Choice group → Enter (no group) → Extra shot, Tab, 1.50, Enter
- t7: Jump to section → Cold Beverage → + Add → name, price, Add photo + choose → Add item (the editor opens on it) → Description → + Size → Small, Tab, Enter → Large, Tab, 5.99, Enter
- t8: search "Iced Americano" → row → Change → Hot Beverage

Where the after run still scrolled: the page, to reach the Latte row under the fold of the Menu tab (t2, t3, t12, 359 px each) and the Pumpkin Soup row (t11, 197 px), both before the editor opens; in t2 the copy sheet's list (as before); in t12 the editor, to reach Other.

Raw: `editor-before/audit-run.txt` and `audit-editor-before-results.json`, `editor-after/audit-run.txt` and `audit-editor-after-results.json` (every step with its time, the paths, the overwrites); screenshots of every step under each folder's `shots/` on disk only. Stills of the new editor: `editor-stills.mjs` → `editor-stills/shots/` (on disk only).
