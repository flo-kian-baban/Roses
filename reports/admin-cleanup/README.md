# Admin-wide clean-up (the PM, 2026-11-06)

Kian approved the screenshots on 2026-11-06 (no changes); the batch was merged into `main` after the PM's four items before the merge (CLAUDE.md, "Admin clean-up: ruling and merge"), and the screenshots below were deleted then, as ruled.

## Screenshots (on disk only, gitignored; deleted on 2026-11-06 after Kian's ruling)

`reports/admin-cleanup/shots/` in the `../roses-admin-cleanup` worktree; `index.html` there puts each before beside its after.

- Every admin screen, signed out and signed in as an admin: the sign-in screens (venue picker, PIN, email and password); the Menu tab with an alert; the venue switcher and the account menu open; a section's menu; a section being reordered; the Add item, Add section, Rename section and Delete section sheets; the item editor; the Style tab, a colour open, the Welcome group open; Details; Team; Add venue.
- On a laptop (1440 × 900) and a 390 px phone (the iPhone 13 viewport); the whole page as well for Style, Details and Team.
- Both builds (before: `main` at 92563ff, built in a temporary worktree; after: this branch) were built from and ran on one scratch copy of the working database and of the uploads (made 2026-11-06 21:44 UTC), with a throwaway admin; an alert was added to that copy so the alerts card shows.

Made by `shots.mjs` (this folder), with the screens and the rules of `scripts/layout-rules.mjs`:

```
DATABASE_URL=<scratch copy> DRILL_ADMIN_PIN=<throwaway admin> node reports/admin-cleanup/shots.mjs --base http://127.0.0.1:<scratch server port> --label before|after --out reports/admin-cleanup/shots
```

## Layout at 1440, 390 and 360 px

`shots/layout-before.json` and `shots/layout-after.json`, 19 screens at 3 widths:

| | screen views with something cut, past the edges or scrolling sideways | text sizes in use | corner radii in use |
|---|---|---|---|
| before | 40 of 57 | 11, 12, 13, 14, 15, 16, 17, 19, 24, 26 and 32 px | 4, 8, 9, 12, 16, 20, 22, 24 and 28 px, and pills |
| after | 0 of 57 | 13, 16, 17 px and the page title's 28 px | 12 px (the switch, the check box, the radio dot and a person's initials keep their own shapes) |

Before, what was cut: the Persian name in every Menu row (cut short with "…": 153 rows on the laptop, 274 at 390 px, 345 at 360 px, on the Menu tab and every screen over it), the preview bar in the Style tab's sheet on a phone (past the screen's edge and scrolling sideways), people's names and emails on Team, the venue's name in the top bar on a phone (every signed-in screen), the one-line explanation under each colour in the Style tab on a phone ("Auto · dark text for the tab b…"). After: nothing, on every screen at the three widths.

The suite checks the same on every run: `scripts/layout-drill.mjs`, step `layout`.
