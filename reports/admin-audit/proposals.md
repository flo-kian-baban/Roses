# Admin audit: proposals (report only, nothing built; for Kian)

Kian keeps the item editor's side column (on a laptop the editor opens as a column beside the menu; full screen on a phone). Every proposal below is about what goes inside it. Measurements: `findings.md` (the iPhone 13 viewport, commit 0273a84, MEASURE lines from `audit-drill.mjs`). **"Taps now" are measured; "estimated taps after" are counted on the mockups' tap paths, never measured** (nothing is built), with the same counting rules (a tap to focus a field counts; typing is a field; Next and return are keys).

None of the proposals needs a data-model change: sizes stay the item's sizes (`variants`), other choice groups its add-ons (`add_ons`, whose rows already carry their group), allergens and diet the same words in `notes`, sections the same placements.

## Task table

| Task | Taps now (fields · keys · scrolls) | Friction (measured) | Proposed change | Estimated taps after (fields · keys · scrolls) |
| --- | --- | --- | --- | --- |
| 1. Add two sizes to an item | 9 (5 · 1 · 1, 660 px) | Sizes behind More; "Add size" turns the price into "Regular" and must be tapped twice; "Regular" and the old price typed over; 4 in-between states published | Inline row entry (2); sizes in one "Price and choices" block outside More (5) | 4 (5 · 4 · 1) with 2; 3 (5 · 4 · 0) with 2 + 5 |
| 2. A milk choice (3 options, one +$1) on every latte of Hot Beverage (7 items, 3 hidden) | 91 (50 · 7 · 23, 6,902 px) | Done item by item; Advanced reopened 7 times; "Milk" typed 21 times; every extra price starts at 0; "Add a choice" pushed below the screen by each new row | Copy choices to other items, "All lattes" / "All in this section" (1); with 2 + 5 for the first item | 7 with the shortcut, 12 ticking each (6 · ~6 · 0) |
| 3. Change one option's price | 4 (2 · 1 · 3, 1,667 px) | The price sits 827 px below the screen behind Advanced; no labels once filled | Choices visible as compact "name · price" rows (5) | 3 (2 · 1 · 0–1) |
| 4. Add an extra with a price | 6 (3 · 1 · 2, 495 px) | Behind Advanced; price starts at 0 (overwrite); an empty group publishes as "Options · Optional" | "+ Choices" with a named group and inline rows (2 + 5) | 3 (4 · 3 · 0); one more field: the group's name, which customers see |
| 5. Description in English and Persian | 6 (3 · 0 · 1, 398 px) | Behind More; Enter adds a line, the save is on leaving the field | Description in the top block (5) | 5 (3 · 0 · 0) |
| 6. Set allergens | 4 (2 · 1 · 2, 740 px) | Behind Advanced; free English text with a comma rule; English shown inside the Persian sentence (fixed in this batch for the 15 standard words only) | Allergen and diet chips with their Persian (3) | 3 (1 · 0 · 1) |
| 7. New item with a description, a photo and two sizes | 15 (6 · 1 · 2, 1,026 px) | The add sheet takes name, price and photo only and closes; the new row is 202 px below the screen; More; "Regular" again | Open the editor on the new item after "Add item" (not in the top 5), with 2 + 5 | 9 (6 · 4 · 0) |
| 8. Move an item to another section | 5 (1 · 0 · 1, 848 px) | No "Move to": tick the new section and untick the old one in a 16-checkbox, ~800 px list ("Also show in…"); lands last | One "Section" picker in Basics, "At the end / At the top" (4) | 4 (1 · 0 · 0) |
| 9. Hide a section | 3 (0 · 0 · 0) | Fine; Jump to section is a 2-tap select and its smooth scroll takes ~1.5 s | None proposed | 3 |

## Top 5, ranked by value against effort

| Rank | Proposal | Value (measured basis) | Effort | Mockup (gitignored, on disk) |
| --- | --- | --- | --- | --- |
| 1 | **Copy choices to other items** ("Use on other items…" on a choice group: a sheet of the section's items, "All lattes" / "All in this section", Add; one change record per item, one "Saved · Undo") | Task 2: 91 → 7–12 taps, 23 → 0 scrolls; the biggest single saving in the audit | Medium: a sheet in the editor and one route action that writes several items in one transaction (the Undo route already takes several records) | `reports/admin-audit/mockups/1-copy-choices.png` |
| 2 | **Inline row entry** for sizes and choices (name → Next → price → return adds the next row; "+ Sizes" starts with the current price, the name selected; the Persian of each label on a second line) | Task 1: 9 → 4 taps; removes the second "Add size", the "Regular" overwrite and the half-filled row that silently does not save; also in tasks 2, 4, 7 | Low: the editor's row components only | `reports/admin-audit/mockups/2-inline-rows.png` |
| 3 | **Allergens and diet as one-tap chips** (Health Canada's 15 words with their Persian, "Other…" for the rest; research drafts pre-ticked; Confirm beside them) | Task 6: 4 → 3 taps, no typing, no comma rule; every chip has its Persian, so the popup never mixes languages; fits this batch's Confirm | Low: the vocabulary exists (`src/lib/allergens.json`) | `reports/admin-audit/mockups/3-allergen-chips.png` |
| 4 | **One "Section" picker** in Basics ("Section: Cold Beverage ›" → a sheet, one tap moves; "At the end / At the top"; "Also show it in a second section…" for the seasonal and multi-section cases) | Task 8: 5 → 4 taps and 848 px → 0 of scrolling; the "Also show in…" label, which hides the only way to move, goes | Low to medium: the sheet; the save is the existing `section_ids` patch plus a move | `reports/admin-audit/mockups/4-section-picker.png` |
| 5 | **One "Price and choices" block, no More / Advanced** (price, sizes and named choice groups in one place in plain words; group options on a ⋯ menu; description at the top; Good to know, Section and Seasons as one-line rows that open what they hold) | Every item task loses its More / Advanced taps and 1–3 scrolls (tasks 1, 3, 4, 5, 7); sizes and choices stop being 1,220 px apart | High: the editor's layout changes; the editor, admin and touch drills open More and Advanced today and would be rewritten | `reports/admin-audit/mockups/5-choices-block.png` |

Not in the top 5, from the findings: open the editor on a new item after "Add item" (task 7); start the Needs-attention block collapsed (it takes the top of the screen on every load); move the "Saved · Undo" toast off the rows it covers; show the matches, not the totals, in the section counts during a search; section names cut in the headers on a phone.

## Open questions for Kian (none blocks this report)

1. Build order: the PM's hypotheses (a)–(d) are proposals 5, 1, 2 and 3. Recommendation: 2 and 3 first (low effort, no layout change), then 1, then 4, and 5 last because it changes every drill that opens the editor.
2. Choice groups: today "required" is ticked on each choice; customers see "Required" only when every choice of a group has it. Proposal 5 puts one "Customer must pick one" switch on the group (saved on every row, so no data-model change). Confirm that is the meaning Kian wants.
