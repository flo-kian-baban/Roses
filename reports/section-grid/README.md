# Section layout: List or Grid per section (Kian, 2026-10-08)

Every section is shown to customers as a **List** (the full-width rows of 2026-10-07, small square photo on the right) or as a **Grid** (two columns of cards: a big square photo on top, then the name and the price; the description shows only in the popup; Uber Eats-style). The owner or an admin chooses it per section in the Style tab, *Layout* group, *Section layout*; staff cannot (403 on the field). Same colour tokens (*Item rows*), same item popup on tap. Saved on the section (`sections.layout`, migration 005), recorded like every change, undoable with *Grid · Undo* / *List · Undo*.

## Captured on the build with the description removed from the cards (Kian, 2026-10-08, later), scratch copy of the working database, "Fresh Juice" switched to Grid through the admin route (`capture.mjs`, `capture.json`)

| what | measured |
|---|---|
| save | HTTP 200, section answers `layout: grid`, one change record; the public page carried the grid 6 ms later |
| public HTML of the section | 8 cards (its 8 shown items), 0 rows, 8 popups (one `<template>` per card), 0 placeholders (every shown juice has a photo), **0 descriptions on the cards** (the one juice that has a description shows it in its popup only); the other sections keep their own layout (12 lists in this copy, which carries Kian's live choices); 4 inline script tags, 0 external scripts (no runtime JavaScript) |
| grid on an iPhone 13 viewport (390 px) | `display: grid`, columns `173px 173px`, gap 12 px across and 20 px down; cards at x = 16 and 201, photos 173 × 173 (a list row's photo is 96 × 96; the second row of cards starts 248 px below the first now that cards carry no description) |
| first four cards | Green Mojito $9.99 · Cantaloupe $9.49 · Orange $10.99 · Mango $9.99 |
| popup from a card | opens with the title "Green Mojito" and the hero photo |
| Persian | `dir=rtl`; the first card sits at x = 201 and the second at x = 16 (the columns mirror) |
| Style tab | the Layout group lists the 15 sections with List / Grid; Fresh Juice reads `grid`, the others `list` |
| restored | the section put back to List, HTTP 200 |

Screenshots: `public-grid-en.jpg` (English, scrolled to the section), `public-grid-popup.jpg` (the popup opened from a card), `public-grid-fa.jpg` (Persian), `style-tab-layout-group.jpg` (the control, laptop).

The check suite covers the same path from the control itself (`section-grid`, `section-grid-undo` in the Style drill: one tap, the public page and the preview within 1 s, Undo) and the staff 403 (`layout-staff-403` in the admin drill).
