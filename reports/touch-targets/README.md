# Touch targets in the admin on a phone (the PM, 2026-10-09)

Ruling: every interactive element of the admin on a phone viewport meets the finger over at least 44 × 44 CSS px. A smaller visual is fine when its tap area is padded to 44 × 44. The only exception is an inline text link inside a sentence.

## How it is measured

`scripts/touch-drill.mjs` (also a step of `npm run check`; each run prints its full list in `touch/touch-drill.txt`):

- **Viewports:** the iPhone 13 (390 × 664) and the iPhone SE at Safari's visible height (375 × 548).
- **25 screens on each:**
  - the three sign-in screens;
  - the Menu tab, with its venue and account menus, a section's menu, the add-item sheet, a price being edited, the item editor (More and Advanced open), the Saved · Undo toast and the preview overlay;
  - the item editor for an item with add-ons (Senso), and on Kebab Land's Menu tab for an item with sizes and one with combo parts, plus the delete confirmation;
  - the Style tab's bottom sheet (its default with the Layout group, a colour open, the Welcome group, the sheet at full height);
  - the Details tab, Team and + Add venue.
- **Tap area:** each visible interactive element is scrolled into view. Along the two lines through its centre, its extent is its own box joined with its labels' boxes (a label taps its input) and its `::before` / `::after` pads (an invisible pad counts).
- **Verified unobstructed:** that extent counts only if `document.elementFromPoint` lands on the element, on something inside it or on its label at every whole pixel at least 1 px inside its edges. If anything lies over it, the drill counts the hits from the centre instead.
- **Why the edge pixel is skipped:** Chromium rounds a hit-test point to a whole pixel, so a 44 px box at a fractional position can answer for 43 rows while its neighbour answers for 45. Seen in run `2026-10-10T01-46-59Z` and reproduced by hand by moving a menu by 0.25–0.75 px. A 1 px strip laid over a control's last row is still caught (measured 42), and a 2 px strip across it measures 29.
- **Exempt and covered:** an inline text link inside a sentence is listed as exempt. An element whose centre lies under something else is listed as covered and measured on the screen where it is uncovered.
- **Counting:** each element is measured once per phone, on the first screen where it is visible.

## Result

Same drill, same 25 screens and the same scratch copy of the working database. Before is the code of `2259552`; after is this batch.

| Phone | Measured before | Under 44 × 44 before | Measured after | Under 44 × 44 after | Smallest tap area after |
| --- | --- | --- | --- | --- | --- |
| iPhone 13 (390 × 664) | 1,762 | **698** | 1,762 | **0** | 44 × 44 px |
| iPhone SE (375 × 548) | 1,762 | **698** | 1,762 | **0** | 44 × 44 px |

Every element is listed in `before.csv` and `after.csv` (phone, screen, element, label, box, tap area, status).

### The 698 (iPhone 13; the SE had the same 698), by kind, and how each was fixed

| Under 44 before | Kind | Was | Fix |
| --- | --- | --- | --- |
| 421 | Shown/Hidden switch (items and sections) | 51 × 31 | Same look; an invisible pad makes its tap area 51 × 44 (`.switch::before`) |
| 38 | Section name button | 24 tall (on Kebab Land on the SE, squeezed to 30 wide by its badges) | 44 tall; the badges now sit inside the button |
| 33 | Section collapse button | 36 × 40 | 44 × 44 |
| 33 | + Add item (section header) | 40 tall | 44 × 44 at least |
| 33 | Section menu button | 40 × 40 | 44 × 44 |
| 30 | Section List / Grid (Style tab) | 36 tall | 44 tall |
| 29 | Preview bar chips (phone) | 36 tall; EN / FA 41 wide | Same look; an invisible pad gives 44 × 44 (`.tap`), inside the row's own padding |
| 17 | Top bar: venue switcher, Team, account menu and its items | 36–43 tall | 44 tall |
| 14 | Colour swatches | 40 × 40 | 44 × 44 |
| 12 | Editor tabs (Menu / Style / Details) | 36 tall | Same look; an invisible pad gives 44 tall; the bars' bottom line is drawn inside, so the 44 px bar holds it |
| 4 | Section menu items | 43 tall | 44 tall |
| 4 | Item editor's Done | 40 tall | 44 tall |
| 3 | Preview button | 36 tall | 44 tall |
| 4 | Sign-in links (the alternate sign-in on each of the three screens, Other venue), each on its own line | 20 tall | 44 tall |
| 2 | Sheet Close | 36 × 36 | 44 × 44 |
| 2 | "Required" (add-on) | 23 tall through its label | Label 44 tall |
| 2 | Custom-colour picker | 40 tall through its label | Label 44 tall |
| 2 | Hex field of an open colour | 43 tall | 44 tall |
| 9 | Remove size (2) / add-on (2) / combo part (5) | 36 × 36 | 44 × 44 |
| 1 each | Toast Undo, preview Edit, Auto, Remove location, Add the first item, the bottom sheet's handle | 20–40 tall | 44 tall; the handle keeps its 20 px look and its tap area reaches 24 px above the sheet's edge |

The shared small button size (`sm`, and the editor's small buttons) is 44 px too, so Team's and the alerts' buttons meet the rule wherever they appear.

### Exempt and covered (after, both phones)

- **Exempt:** 1 inline text link, the page address `/senso` in a sentence on the Details tab.
- **Covered on every screen it appeared on (2):**
  - The add-item sheet's backdrop button "Close": its centre is under the sheet; it is tapped on the dimmed area above.
  - A menu row's price button, re-mounted behind the full-screen item editor. Its siblings are measured on the Menu screen.

## The Style tab's bottom sheet on a small phone

Q1 (accepted): opening a colour scrolls the sheet so its swatches (Auto, the venue's colours, Custom) are in view, and the sheet stays at half. The 44 px swatches wrap to two rows: 94 px. The sheet's header was made shorter so they fit on the SE:
- The handle is 20 px visible, with its tap area reaching above the sheet.
- The preview bar's chips keep their 36 px look, padded inside the row.
- The row padding was trimmed.

| iPhone SE, 375 × 548, a colour open | Before this batch | After |
| --- | --- | --- |
| Preview's share of the viewport | 45.1 % (247 px) | 45.1 % (247 px) |
| Sheet at half | 201 px | 201 px |
| Sheet header (handle and preview bar) | 114 px | 104 px |
| Controls area | 87 px | 97 px |
| The open colour's swatches in view | no (2 rows below the fold) | yes (94 px, scrolled into view) |

Measured by the Style drill (`phone-style-layout-se`). It also checks 375 × 553 (45.0 %, swatches in view) and the iPhone 13 (45 %, controls 161 px, swatches in view).
