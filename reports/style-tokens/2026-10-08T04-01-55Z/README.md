# Day-one visual identity of the colour tokens — 2026-10-08

Kian's acceptance: each venue's default token set is its current look, proven by before/after screenshots that are pixel-identical, or with the differences listed.

- **before/**: the public pages served by commit `8cffa11` (the last commit before the tokens), built in a separate worktree (`next build --webpack`) against a scratch copy of the working database.
- **after/**: the same pages served by commit `9f120d1` (the token system), built from the committed tree against the same scratch copy.
- **before-again/**: a second capture of `8cffa11` (Senso only), as a control for capture noise.
- Capture: iPhone 13 viewport at 3×, reduced motion (no intro, no animation), every photo loaded, the tab strip at its start, full page in English and Persian, the item popup, the section list (`scripts/style-identity.mjs shoot`).
- Comparison on a canvas, per pixel, per channel (`scripts/style-identity.mjs compare`); the PNGs and the red diff images stay on disk (gitignored), `identity.md` / `identity.json` are committed.

## Result

| Comparison | Outcome |
| --- | --- |
| `diff/` (tolerance 0) | 0 of 8 identical; max channel delta **31** on every shot; 0.6–2.7 % of pixels |
| `diff-tolerance-2/` (rounding allowed) | max delta 31; full-page shots differ only in rows y 279–368 (the tab row: active tab text, underline, section-list icon); the popup and section-list shots differ in their text |
| `control-before-vs-before/` | two captures of the same old build: 3 of 4 identical; Senso EN differs by 1 515 pixels, max delta 4, all in the photo column (JPEG decode jitter) |

## The differences, listed

1. **Pure black → the kit's ink `#1d1d1f` (delta 31)**: active tab text, active tab underline, section-list button icon, popup title, popup price, popup close icon. These six places were hard-coded `#000` in the old kit CSS while the rest of the page used `#1d1d1f`; they now follow the Page text token so that "Auto" means one thing. Recorded in `src/venues/tokens.ts` (`DAY_ONE_DIFFERENCES`) and checked by the suite's day-one step.
2. **Translucent black over white → the same colour as a solid hex (delta 1)**: row dividers and the tab-bar hairline (`rgba(0,0,0,.1)` → `#e6e6e6`), the language button (`rgba(0,0,0,.05)` → `#f2f2f2`). Invisible; gone at tolerance 2.
3. **Photo decode jitter (delta ≤ 4)**: present between two captures of the same build (the control), not a change.

Nothing else differs: layout, type, photos, spacing and every other colour are the same pixels.
