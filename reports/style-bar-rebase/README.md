# The style-bar rebase: does it change any screen? (the PM, 2026-11-19)

The PM's brief: "Style-bar: say why it wasn't merged, then rebase it onto main. Kian approved its look as he saw it on 4928. If the rebase changes any screen, stop and send those screens."

**Result: no screen changed.** Every Style screen of the rebased branch is pixel for pixel the one Kian saw, every other screen is pixel for pixel main's, and the customers' pages are byte for byte main's. The three differences found are main's own or the browser's, listed below.

## Why style-bar was not merged

Its merge gate never passed. Three fast-check runs on 2026-11-16 failed, each kept with its cause (`reports/checks/2026-11-16T05-57-44Z`, `…T06-31-42Z`, `…T07-04-17Z`): the laptop was swapping (35 of 37 GB of swap in use), so the suite's servers stalled or answered late; one failure was a race in the editor drill's `t-looks-good`, fixed then (8e89948). The drills of the batch itself passed in every run. A fourth run was started at 07:43 UTC and never got past creating its folders (the session ended there). The branch stayed unmerged and port 4928 served it until 2026-11-19, when it went back to main.

## The rebase

`style-bar` (1825884, e0e215e, 3b215dc, 7092ea6, ad6669f on 41cc706) is now a098a33, 901a18e, 8e89948, f2fcdca, cee1a73 on main b8bb958 (the Next.js upgrade and "Goes well with"). The old tip is kept as the local branch `style-bar-before-rebase`. `git range-diff` shows the same patches: the conflicts were in texts only (CLAUDE.md: both sides added a section; the layout drill's header comment; the index of suite runs: both sides added rows), every source file merged by itself.

## How the screens were compared

Three builds on one scratch copy of the working database (made after migration 009) and of the uploads:

| | Build | |
|---|---|---|
| A | style-bar as Kian saw it on port 4928 | its own build of 2026-11-16 00:57 (`.next-kian`, one minute after commit 1825884), served as built on Next 16.4.3; not built again |
| B | main after the merges of 2026-11-19 (b8bb958) | built today, Next 16.4.6 |
| C | style-bar rebased onto that main (cee1a73) | built today, Next 16.4.6 |

`shots.mjs` (this folder) shot every admin screen of each: the screens of the admin's list (`scripts/layout-rules.mjs`, `adminScreens`), then the Style tab's own states (each of the four dropdowns open, the tab scrolled, the Item popup group open, the Layout group, and on a phone the sheet down, at half and full), on a laptop (1440 × 900), the iPhone 13 viewport (390 × 664) and a 360 px phone, 100 shots on C. `scripts/style-identity.mjs compare` compared them pixel by pixel, tolerance 0. Nothing was saved in the scratch copy (1229 change records before and after each run).

What is not in the shots: the customers' page inside the preview (it is not the admin's, and its welcome scene is drawn afresh on every load) and the clock of the laptop's iPhone frame. The customers' pages were compared as served instead.

## Results (`results/`)

**C against A, the look Kian approved: 90 of 94 shots identical**, all 40 Style shots among them but one. The four that differ:

| Shot | Differs by | Why |
|---|---|---|
| `item-editor-laptop`, `item-editor-360` | 28,962 and 7,985 pixels | main's own: the GOES WELL WITH card in the item editor. Both are identical to B. |
| `style-group-popup-laptop` | 25,468 pixels | main's own: the note under the Item popup's "Price" colour now ends "… and the items under “Goes well with”", which takes a second line and moves the rows under it down by one line. Nothing of the controls row differs. |
| `account-menu-laptop` | 5 pixels, by at most 2 of 255 | the browser's: the edge of one card's rounded corner on the Menu tab. The same build shot four times draws it both ways (control below). |

**C against B, main: 57 of 85 shots identical.** All 25 Style shots differ, as they should (the row of dropdowns in place of the chips). The other 60 are the screens style-bar does not touch (the sign-in screens, the Menu tab and what opens from it, the item editor with its Goes well with card and picker, Details, Team, Add venue): 57 identical, and the three laptop shots of the Menu tab (`menu`, `account-menu`, `venue-switcher`) with the same 5 pixels as above.

**The customers' pages** as B and C serve them from the same data are byte for byte the same: `/senso` 320,916 B, `/kebab-land` 220,827 B. (A serves the pages of the main it was built on: 319,898 B and 219,809 B, the sizes recorded before "Goes well with".)

**Not reached, as expected:** on A the two "Goes well with" screens (6 screen views); on B the five dropdown screens (15 screen views).

## Controls

- **The 5 pixels.** The Menu tab's three laptop shots taken four more times on C alone: `menu-laptop` came out one way three times and the other way once, `account-menu-laptop` 3 and 1, `venue-switcher-laptop` 2 and 2. A's and B's shots each equal one of the two. The phone shots of the same screens were the same every time.
- **The phone's Style sheet.** Shot plainly, the Style screens on the phones came out in one of two ways from one load to the next on one and the same build: the text lines of the sheet that sit on a half CSS pixel drawn one device pixel apart (12 of 40 Style shots differed between two runs of A, 11 of them phone shots, and 8 of 40 between two runs of C, all phone shots; `jitter-probe.mjs`: 4 of 6 loads one way, 2 the other, the geometry identical). The script therefore takes the sheet's body out of the page and puts it back before each shot, after which it is always drawn the same way; the results above are with that.
- **Two mistakes of the first runs, corrected before these results:** a mask over the preview's area also covered the Style sheet on a phone (so those shots compared nothing; the frames are now simply not drawn), and the script's first version tapped the first control of the Layout group, which saved one section's layout in the scratch copy (grid to list; put back, and the script now counts the change records and stops if anything was saved). Neither touched the working database.

## Files

- `shots.mjs`: the screenshots of one server. `jitter-probe.mjs`: the probe of the two renderings.
- `results/c-vs-a.md`, `c-vs-b.md` (and `.json`): every shot with its differing pixels and where; `results/manifest-a|b|c.json`: what each run shot and did not reach.
- The screenshots and the diff images are on disk only (the session's scratch folder), since no screen has to be sent.

```sh
# three scratch servers on one scratch copy (ROSES_CHECK_SUITE=1), then, for each:
DATABASE_URL=<scratch copy> DRILL_ADMIN_PIN=<throwaway admin> node reports/style-bar-rebase/shots.mjs --base http://127.0.0.1:<port> --out <folder>/c
node scripts/style-identity.mjs compare --before <folder>/a --after <folder>/c --out <folder>/c-vs-a
node scripts/style-identity.mjs compare --before <folder>/b --after <folder>/c --out <folder>/c-vs-b
```
