# Goes well with (Kian via the PM, 2026-11-18)

Built on branch `goes-well-with`; not merged. Kian rules on the screenshots first. The rules, the data-model change and the decisions taken are in `CLAUDE.md` ("Goes well with").

Rulings of 2026-11-19 (Kian and the PM), built: migration 009 approved; the editor's card below PRICE and the item's choices; the popup's block below the item's own sizes and options (built as the popup's last group); the screens those two change shot again.

## Screenshots (on disk only, gitignored; to be deleted after Kian's ruling)

`reports/goes-well-with/shots/index.html` in this worktree puts each before beside its after.

- Two items: Latte (Senso: a photo, a description, a choice group) and Roses Koobideh Kebab (Kebab Land: a photo, a description).
- At laptop width (1440 × 900) and at 390 px (the iPhone 13 viewport): the item editor before (no card) and after with 0 and with 4 pairs, each framed on the end of Price and the item's choices, so what follows it shows; the picker; the public popup in English and in Persian, before and after, as the first screen a customer gets and as the whole popup.
- Shot again on 2026-11-19, after the rulings: every After (28), and the editor's four Before shots with the same framing, on main after the Next.js upgrade. The popup's 16 Before shots are those of 2026-11-18: main's popup has not changed, and the customers' pages are byte for byte the same on Next.js 16.4.3 and 16.4.6.
- On the laptop the fourth pair is added through the picker, so the preview beside the editor shows the item's popup with the list, as it does after any save of the list.
- Before is `main` (41cc706; the editor's Before shots on the upgraded main), after is this branch; the builds ran on one scratch copy of the working database with migration 009. The pairs are example data set in that copy only, through the admin API: Latte with Almond Croissant, Pumpkin Cheesecake, Espresso (two sizes) and Everything Bagel With Cream Cheese; Roses Koobideh Kebab with Green Salad, Yogurt with Shallot Dip (no photo, a long name), Red Wine Sangria (two sizes) and Baklava (no photo). Nothing was written to the working database.

Made by `shots.mjs` (this folder), once per build:

```
DATABASE_URL=<scratch copy> DRILL_ADMIN_PIN=<throwaway admin> node reports/goes-well-with/shots.mjs --base http://127.0.0.1:<scratch server port> --label before|after --out reports/goes-well-with/shots [--only editor|popup]
```

## What a pair costs the page

Measured on the two builds, on one data copy (the served HTML of `/senso` and `/kebab-land`):

| | Senso | Kebab Land |
|---|---|---|
| before | 319,898 B (45,655 gzipped) | 219,809 B (26,401 gzipped) |
| after, no pair set | 320,916 B (46,007 gzipped) | 220,827 B (26,719 gzipped) |
| after, four example pairs on one item | 322,156 B | 222,067 B |

- With no pair set, each page differs from before in two places: the menu kit's script (1,018 B more: it fills the rows and answers the tap) and that script's hash in the page's Content-Security-Policy. The customers' stylesheet is byte for byte the same (30,157 B).
- An item with four pairs adds 434 B to its popup's template (the heading and four ids); the block's style (774 B) is written once per page, only when the page has a pair to show.
- The popup's template holds the paired items' ids only; the name, the price line and the photo come from the paired item's own row when the popup opens. No pair photo is requested before a popup is opened (drill check `photos-when-opened`, Chromium and WebKit).

## Acceptance

`scripts/pairs-drill.mjs` (suite step "Goes well with drill"), with the touch drill and the layout drill extended to the new card and picker. The checks are listed in `CLAUDE.md`.
