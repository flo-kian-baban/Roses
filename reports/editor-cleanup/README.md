# Item editor clean-up (the PM, 2026-11-04)

Branch `editor-cleanup`, not merged: Kian rules on the screenshots first.

## Screenshots (on disk only, gitignored, deleted after Kian's ruling)

`reports/editor-cleanup/shots/` in the `../roses-editor-cleanup` worktree; `index.html` there puts each before beside its after.

- Four items, opened as staff see them on opening, nothing else tapped: Pumpkin Soup (seasonal, allergens to confirm), Red Wine Sangria (Kebab Land, two sizes), Latte (Senso, choice groups), Baba Ghanoosh (Kebab Land, no photo).
- On a laptop (1440 × 900, the editor as its 440 px column) and on a 390 px phone (the iPhone 13 viewport): the first screen and the whole editor.
- The Menu list of one section at 390 px: before, the plain list; after, in its new reorder mode.
- Both builds ran on one fresh scratch copy of the working database. Latte has one choice group in the live data; a second group ("Milk": Oat milk, Almond milk, +$0.75 each) was added to the scratch copy only, for both builds, to show two groups.

Made by `shots.mjs` (this folder):

```
DATABASE_URL=<scratch copy> DRILL_ADMIN_PIN=<throwaway admin> node reports/editor-cleanup/shots.mjs --base http://127.0.0.1:<port> --label before|after
```

## Overflow at 440, 390 and 360 px (the brief's acceptance)

`shots.mjs` measures every element of the editor: reaching past its edges, cut by a box around it, text cut short, a text box showing part of its text, a sideways scroll. Results in `shots/overflow-before.json` and `shots/overflow-after.json`:

| | laptop column (440) | 390 px | 360 px |
|---|---|---|---|
| before | 6 text boxes showing part of their text (descriptions cut to one line) | 7 | 8 |
| after | none | none | none |

The suite checks the same rules on the editor drill's own full item (two sizes, two choice groups, drafts, two sections, everything opened) at 360 px and in the laptop column, with at most three text sizes and one corner radius: `t-calm-layout` in `scripts/editor-drill.mjs`.
