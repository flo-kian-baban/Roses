# Admin audit: the item editor's tasks on the iPhone 13 viewport

Report only. Nothing in the product was built or changed, and no real data was changed. Measured on 2026-10-13 at about 00:08 UTC (2026-10-12, 20:08 Toronto). The proposals are in `proposals.md`.

## Setup

- **Code:** a worktree at `/Users/kianbaban/roses-audit` on commit `0273a84` (the admin before this batch), built as `.next-audit` and served by `next start` on port 63367, which was free when picked.
- **Data:** the database `roses_audit` was restored from one read-only `pg_dump` of the working database. Before each run it was reset to a dump of that untouched scratch copy. Dropped afterwards.
- **Uploads:** a scratch copy of the uploads folder (deleted afterwards).
- **Account:** a throwaway admin named "Audit drill", in `roses_audit` only.
- **Browser:** Playwright Chromium with `devices['iPhone 13']` (390 × 664, touch).
- **Starting state for every task:** the Menu tab of `/admin/senso`, freshly loaded, scrolled to the top, nothing open.
- **Done:** "done yes" means the final state was read back from the customers' page (`/senso` HTML) and from the database.
- **Script:** `audit-drill.mjs`; results `audit-results.json` and `audit-run.txt`; a repeat run on the same baseline `audit-results-repeat.json` and `audit-run-repeat.txt`; positions `panel-layout.mjs` / `.json` / `.txt`; probe P2 `probe-webkit-done.mjs` / `.json` / `.txt`. Screenshots (`shots/`, gitignored) stay on the machine.

### How each column was counted

- **Taps** count every tap on a control, including: focusing a field; each Jump to section choice, counted as 2 (open the select, then choose); the photo chooser, counted as 2 ("Add photo", then choose the photo).
- **Fields** count each text entry. Where a field already held text, the old text was typed over; the JSON lists these as "overwrites". On a phone that means selecting the old text first.
- **Keys** count Enter (Tab was not used).
- **Scrolls** count the times the next control was not tappable where it was: below the screen, under a sticky bar, or under the "Saved · Undo" toast. The px figure is how far the script scrolled to bring the control to mid-screen; the minimum needed just to bring it fully on screen is in the JSON (`scrollMinPx`) and in brackets below.
- **App wait** is the script's wall time with no think time, from the first tap until the change could be read on the customers' page. Screenshot time is excluded.
- **Pacing:** before every action the script waited for the previous save to be answered, as a person would.

## Results (MEASURE lines, copied)

| task | taps | fields | keys | scrolls | app wait | done | path |
|---|---|---|---|---|---|---|---|
| t1-sizes | 9 | 5 | 1 | 1 (660 px) | 1176 ms | yes | search "Americano" → row → More → Add size (price becomes "Regular") → overwrite Regular→Small, 5.99→5.49 → Add size again → Large, 6.49 → Enter |
| t2-milk | 91 | 50 | 7 | 23 (6902 px) | 11782 ms | yes | search "Latte" → for each of 7: row → Advanced → 3 × (Add a choice → group "Milk" → choice → [extra price]) → Enter → Done |
| t3-option-price | 4 | 2 | 1 | 3 (1667 px) | 606 ms | yes | search "Latte" → row → Advanced → Oat milk's extra price: overwrite 1→1.25 → Enter |
| t4-extra | 6 | 3 | 1 | 2 (495 px) | 812 ms | yes | search "Cappuccino" → row → Advanced → Add a choice → choice "Extra shot" → extra price overwrite 0→1.50 → Enter (group left empty) |
| t5-description | 6 | 3 | 0 | 1 (398 px) | 678 ms | yes | search "Turkish" → row → More → Description → Description (فارسی) → Done |
| t6-allergens | 4 | 2 | 1 | 2 (740 px) | 578 ms | yes | search "Turkish" → row → Advanced → Allergens (free text, comma separated) → "milk" → Enter |
| t7-new-item | 15 | 6 | 1 | 2 (1026 px) | 2698 ms | yes | Jump to section → Cold Beverage → + Add → name, price 4.99, Add photo + choose → Add item → find the new row → More → Description → Add size → overwrite Regular→Small → Add size again → Large, 5.99 → Enter |
| t8-move | 5 | 1 | 0 | 1 (848 px) | 600 ms | yes | search "Iced Americano" → row → More → scroll to "Also show in…" → tick Hot Beverage (wait for the tick) → untick Cold Beverage |
| t9-hide-section | 3 | 0 | 0 | 0 (0 px) | 1563 ms | yes | Jump to section → Milkshake → the section's switch |

The repeat run on the same baseline had the same counts. Its app waits: t1 1180, t2 11657, t3 597, t4 796, t5 679, t6 584, t7 2678, t8 608, t9 1563 ms.

### Task details

- **Task 2** covered the 7 lattes of Hot Beverage: Latte, Vanilla Latte (hidden), Hazelnut Latte (hidden), Organic Beet Latte, Matcha Latte, Pumpkin Spice Latte (hidden) and Pumpkin Latte. Pumpkin Latte is also placed in the Seasonal section. All 7 got the Milk group in the database; the 4 shown ones were also checked on the customers' page.
- **Task 6:** the Allergens field asks for free text, with the placeholder "nuts, dairy, gluten" and the hint "Comma separated." On the code measured (0273a84) the customers' popup then read "Contains milk", and in Persian "حاوی milk", with the English word inside the Persian sentence. (Since this batch the popup reads "Contains: milk" / "حاوی: شیر" for the allergen words in `src/lib/allergens.json`; a word outside them still shows as typed.)

### What "app wait" contains

- **Saves were never the bottleneck.** Saves were answered locally within about 100 ms. Over a whole task, the time spent waiting for an unanswered save was 25 ms (t1), 178 ms (t2) and 2–20 ms for t3–t9.
- **The customers' page already showed each change** at the first check after the last action (6–15 ms of polling).
- **The rest is mostly the script's own action time** (about 80–120 ms per tap), plus two waits that come from the app: the Jump to section smooth scroll (the Milkshake switch could be tapped 1478 ms after the choice in t9, and the Cold Beverage "+ Add" 1008 ms after it in t7); the photo upload in t7, about 70 ms for a 6 KB JPEG.
- **Not included:** think time, the phone's network and a hosted server.

## Where a person can get lost (measured)

All positions are on the 390 × 664 screen.

**Item panel size**
- The item panel shows 620 px under its 44 px header. With More and Advanced closed its content is 795 px tall: More sits at the bottom edge and Advanced is below it.
- With both groups open the content is 3016 px tall, about 4.9 screens ("Caramel Macchiato", `panel-layout.json`).

**Sizes (t1, t7)**
- **The price turns into a size.** "Add size" on a one-price item turns the price into a first size named "Regular" and saves it at once. The blank second row does not stay, so "Add size" had to be tapped twice in t1 and in t7.
- **Old text has to be typed over:** "Regular" and the old price (2 overwrites in t1, 1 in t7).
- **Customers see every in-between state.** Each field saves and republishes the customers' page. Americano's change records show 4 published states: "Regular $5.99", "Small $5.99", "Small $5.49", "Small $5.49 · Large $6.49".

**Choices (t2–t4)**
- **Hard to reach.** Choices are behind Advanced, and "Add a choice" is below the fold: 10 px under the screen's bottom edge on an item without choices; 354 px under on Latte, which had 2 syrup choices. Every second or third new choice pushed it 34–46 px under again, which accounts for 23 scrolls in t2.
- **The group is retyped on every row.** "Milk" was typed 21 times.
- **Every extra price starts at "0",** so each paid option is an overwrite (7 in t2, 1 in t4).
- **A row saves only once its choice name is filled,** and the hint does not say so.
- **Once typed, the boxes have no labels.** Their only labels are placeholders ("Group", "Choice", "گروه", "گزینه").
- **Changing one price is deep (t3).** The 5th choice's price on Latte was 827 px under the edge: 1137 px scrolled (at least 850).
- **Leaving the group empty (t4)** publishes the choice under "Options / گزینه‌ها · Optional".

**Description (t5)**
- The description is behind More, 88 px under the edge (398 px scrolled; at least 136).
- The boxes are multi-line: Enter adds a new line and does not save. They save when they lose focus, here by the tap on Done. Probe P2 confirmed this in Chromium and in Playwright's WebKit with the iPhone profile; a real iPhone was not tested.

**Allergens (t6)**
- Advanced is 55 px under the edge (175 px scrolled; at least 79). The Allergens field is 255 px under (565 px scrolled; at least 278).

**New item (t7)**
- **The add sheet holds name, one price and a photo only.** After "Add item" the sheet closes and the editor does not open.
- **The new row was off screen,** 202 px under the edge: 534 px scrolled (at least 230) to find and open it.
- **The one price becomes "Regular",** as in t1.

**Moving an item (t8)**
- **There is no "Move to".** Moving means ticking the new section and unticking the old one in "Also show in…", a list of 16 checkboxes about 800 px tall.
- **Hot Beverage's checkbox was far down,** 538 px under the edge (848 px scrolled; at least 549).
- **The tick appears only after the server answers** (24 ms here).
- **The item lands last** in its new section (18 of 18). On a phone the only way to place it is Move up / Move down in More, one tap per place.

**Menu list**
- **The page is long:** 22,645 px, with all 16 sections open on load.
- **The top of the screen is taken on load.** The admin's top bar, the tab row, the Needs-attention block and the search bar fill the top 334 px of 664.
- **Rows were off screen or covered:** the Latte row was 23 px under the edge after searching "Latte"; the Matcha Latte row was under the "Saved · Undo" toast (273 px scrolled; at least 67).
- **The toast covers part of every screen.** It sits over about x 116–274, y 588–644 for 10 s after every save.
- **5 of the 16 section names are cut off** in the headers: "Senso Signature", "Hot Beverage", "Tea & Herbal Tea", "Cold Beverage" and "Persian Breakfast".
- **During a search, the header counts are totals** ("18"), not the matches.

**Hide a section (t9)**
- The switch is in the section header and was tappable at once after Jump to section, with no scroll.

## Labels a low-tech staff member might not understand

| label (quoted) | where | why |
|---|---|---|
| "More" / "Advanced" | item panel | They do not say what is inside, yet everyday tasks sit there. Both close again every time an item is opened (Advanced was tapped 7 times in t2). |
| "Set by the sizes below (2)." | Basics, in place of Price | The sizes are not "below". They are inside the collapsed More. |
| "Also show in…" | More | This is the only way to move an item, but the label says "also". Unticking the last box hides the item ("In no section: customers cannot see it."). |
| "Order in Hot Beverage: 11 of 18", "Move up", "Move down" | More | Position as a count. Moving 10 places takes 10 taps. |
| "Serves", placeholder "2 or 3-4 (for platters)" | More | Unclear when it applies or where customers see it. |
| "Add-ons and choices" and its hint "Group (for example “Milk”), choice (for example “Oat milk”), extra price (0 when free)." | Advanced | "Group" is a data idea, and it is retyped on every row. |
| "Required" (a checkbox on each choice) | Advanced | It does not say what is required. Customers see "Required" only when every choice of the group has it. |
| "Combo parts", "For platters and mixed dishes: what the dish is made of.", "Qty", "Part" | Advanced | Jargon. Its relation to the description is unclear. |
| "Allergen, dietary and halal notes (owner and admin)" | Advanced | It names roles instead of saying who sees the notes. |
| "Allergens" / "Dietary", hint "Comma separated." | Advanced | Free text with a typing rule. English words only, shown inside the Persian sentence (on 0273a84). |
| "Note" / "Note (فارسی)" | Advanced | Does not say that customers see it under "Good to know". |
| "Seasons" chips, "None selected: all year." | Basics | Tapping one hides the item outside that season. They sit next to the photo, where a stray tap is easy. |
| "Persian draft" (blue), "Missing" (amber) badges | Basics, More, list rows | "Draft" means imported text waiting for review, which the badge does not say. |
| "Linked from the venue’s website." | under a photo | Does not say whether anything needs doing. |
| "Size", "فارسی", "0.00" (placeholders only) | size rows | Once filled, a row has no column labels. |
| "A size is saved once it has a name and a price." | under the sizes | A rule to know. A half-filled row silently does not save. |
| "Needs attention": "138 need a price", "138 missing Persian", "151 without a photo", "6 Persian drafts" (on load) | top of the Menu tab | Large counts with no clear first step. The block pushes the menu down on every load. |
| "Jump to section" | Menu tab | A select: 2 taps. |
| "Saves as you go" | item panel header | Hidden below 640 px (`hidden … sm:block`), so a phone never shows it. The only sign of saving is the toast. |
| "Done" | item panel, top left | It closes the panel. A description being typed is saved by losing focus, not by Done itself. |

## Buried, duplicated, needing a scroll

### Buried

- **Behind More** (collapsed every time an item opens): Description and Description (فارسی); Sizes; "Also show in…" (sections, i.e. moving); Order; Serves.
- **Behind Advanced** (collapsed every time): Add-ons and choices; Combo parts; Allergens, Dietary, Halal, Note and Note (فارسی); Delete this item.
- **Sizes and choices are split.** Sizes are in More and choices in Advanced. With both open, "Add size" is at 955 px in the panel and "Add a choice" at 2175 px, 1,220 px apart.

### Duplicated

- **Price:** edited in place on the list row, and in the panel.
- **Shown/Hidden:** a switch on the list row, and one in the panel.
- **Seasonal:** the Seasons chips in Basics; the "Seasonal" checkbox in "Also show in…", which tags today's season by itself when ticked on an item with no season.
- **Customer-facing text about an item, in three places:** Description (More); Note (Advanced, shown under "Good to know"); Serves (More).
- **Search clear:** two clear buttons in Chromium, the browser's blue × and the app's ×. Not checked on Safari.
- **Adding to a section:** "+ Add" in the section header, and "Add the first item" in an empty section.
- **Persian twins:** every English field has a Persian twin. In t2, filling the Persian side would have added 42 fields; the tasks did not ask for it.

### Needing a scroll

Positions are px under the screen's bottom edge; distances are px scrolled to bring the control to mid-screen, with the minimum needed in brackets.

| screen | control | under the edge | scrolled (minimum) |
|---|---|---|---|
| Item panel, More open | Add size | 350 px | 660 px (372) |
| Item panel, More open | Description | 88 px | 398 px (136) |
| Item panel, More open | "Also show in…" Hot Beverage | 538 px | 848 px (549) |
| Item panel, closed | Advanced | 55–100 px | 175–220 px (79–124) |
| Item panel, Advanced open | Add a choice | 10–354 px | 320–664 px (32–376) |
| Item panel, Advanced open | Add a choice again after each new choice | 34–46 px | 344–356 px (56–68) |
| Item panel, Advanced open | 5th choice's price | 827 px | 1137 px (850) |
| Item panel, Advanced open | Allergens | 255 px | 565 px (278) |
| Menu list | Latte row after the search | 23 px | 355 px (51) |
| Menu list | the new row after "Add item" | 202 px | 534 px (230) |
| Menu list | Matcha Latte row, under the toast | n/a | 273 px (67) |

The scrolled totals are 6,902 px for t2 (at least 1,688 needed) and 1,667 px for t3 (at least 980). The emulator shows no on-screen keyboard; on an iPhone it covers roughly the lower 40 % while typing, so these counts are a lower bound.

## The PM's four hypotheses: what the measurements say

**(a) Sizes and add-ons as one "Choices" block in plain words.** Today they are in two collapsed groups, 1,220 px apart. t1 needed More plus a 660 px scroll (372 minimum) to reach "Add size"; t4 needed Advanced plus 2 scrolls (495 px; 111 minimum) to reach "Add a choice". Their save rules differ: a size needs a name and a price; a choice needs a choice name, and its group is retyped on every row. The customers' popup already shows them as one list of banded groups. One block outside More/Advanced would remove a group tap and at least one scroll per task.

**(b) "Copy choices from another item" and "Apply to all items in this section".** t2 is the costliest task: 91 taps, 50 fields, 7 Enter and 23 scrolls (6,902 px) for 7 lattes; per latte 12 taps, 7 fields and about 3 scrolls, plus Done. "Milk" was typed 21 times and the paid price overwritten 7 times. Copy or apply-to-all would reduce t2 to roughly the first latte's 12 taps plus a few.

**(c) Inline row entry (label, Tab, price, Enter adds the next row).** t1 took 9 taps, 5 fields and 1 Enter. 4 of those 9 taps are the second "Add size" (the blank row does not stay) and 3 taps that only focus a size box. 2 of the 5 fields typed over "Regular" and the old price. Today Enter saves and leaves the box; it adds no row. Each size row runs name → فارسی → price → × (from the source), so Tab from the name lands in the Persian box. Enter-adds-a-row with name → price next to each other would replace those 4 taps with keys.

**(d) Allergens as one-tap chips.** t6 took 4 taps, 2 fields, 1 Enter and 2 scrolls (740 px; 357 minimum), behind Advanced. The field takes free English text with a comma rule, and (on 0273a84) the Persian page showed "حاوی milk". Halal is already 3 one-tap radios; Dietary is free text too. Staff cannot set any of these. Chips would remove the typed field and the comma rule, and could carry a Persian label each.

## Probes

- **P1 (task 1 on Mocha, with no wait for saves):** done yes. Nothing was lost locally, where saves are answered within about 100 ms. A slow network was not tested.
- **P2 (Done saves a description still being typed):** saved yes in Chromium and in Playwright's WebKit with the iPhone 13 profile. Not tested on a real iPhone.

## Not measured, caveats

- **No real iPhone.** Not covered: the keyboard, the iOS select wheel, the photo picker taps, and whether the autofocused field opens the keyboard.
- **Typing method.** Text is inserted per field (`insertText`). Playwright's key-by-key typing sometimes dropped a word right after a tap (no beforeinput fired), which is a test-tool effect. Those early trial runs were discarded.
- **Admin role only.** Staff was not measured.
- **Shots are per logical step**, not per keystroke.
- **Panel positions come from one plain item** ("Caramel Macchiato"). Items with sizes, choices or longer text sit lower.
- **App waits are local:** no network and no hosted server.
- **Tab order** is from the source, not measured.
